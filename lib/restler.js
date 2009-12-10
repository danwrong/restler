var sys       = require('sys'),
    http      = require('http'),
    uri       = require('./vendor/uri'),
    qs        = require('./vendor/querystring'),
    base64    = require('./vendor/base64'),
    x2j       = require('./vendor/xml2json'),
    yaml      = require('./vendor/yaml'),
    multipart = require('./multipartform');
    
function RestRequest(url, options) {
  this.url = uri.parse(url);
  this.options = options;
  this.headers = process.mixin({
    'Accept': '*/*',
    'Host': this.url.domain,
    'User-Agent': 'Restler for node.js'
  }, options.headers || {});
  
  if (!this.url.path) this.url.path = '/'
  
  // set port and method defaults
  if (!this.url.port) this.url.port = (this.url.protocol == 'https') ? '443' : '80';
  if (!this.options.method) this.options.method = (this.options.data) ? 'POST' : 'GET';
  
  // stringify query given in options of not given in URL
  if (this.options.query && !this.url.query) {
    if (typeof this.options.query == 'object') 
      this.url.query = qs.stringify(this.options.query);
    else this.url.query = this.options.query;
  }
  
  this._applyBasicAuth();
  
  this.client = this._getClient(this.url.port, this.url.domain);
  
  this._applySSL();
  
  if (this.options.multipart) this._createMultipartRequest();
  else this._createRequest();
    
}

RestRequest.prototype = new process.EventEmitter();
process.mixin(RestRequest.prototype, {
  _isRedirect: function(response) {
    return ([301, 302].indexOf(response.statusCode) >= 0);
  },
  _fullPath: function() {
    var path = this.url.path;
    if (this.url.anchor) path += '#' + this.url.anchor;
    if (this.url.query) path += '?' + this.url.query;
    return path;
  },
  _applySSL: function() {
    if (this.url.protocol == 'https') {
      try {
        this.client.setSecure("X509_PEM");
      } catch(e) {
        sys.puts('WARNING: SSL not supported in your version of node JS');
      }
    }
  },
  _applyBasicAuth: function() {
    // use URL credentials over options
    if (this.url.user) this.options.username = this.url.user;
    if (this.url.password) this.options.password = this.url.password;
    
    if (this.options.username && this.options.password) {
      var auth = base64.encode(this.options.username + ':' + this.options.password);
      this.headers['Authorization'] = "Basic " + auth;
    }
  },
  _getClient: function(port, host) {
    return this.options.client || http.createClient(port, host);
  },
  _responseHandler: function(response) {
    var self = this;
    
    if (this._isRedirect(response)) {
      var location = uri.resolve(this.url, response.headers['location']);
      this.options.originalRequest = this;
      request(location, this.options);
    } else {
      var body = '';
      
      response.addListener('body', function(chunk) {
        body += chunk;
      });
      
      response.addListener('complete', function() {
        if (self.options.parser) body = self.options.parser.call(response, body);
        
        if (parseInt(response.statusCode) >= 400) self._respond('error', body, response);
        else self._respond('success', body, response);
        
        self._respond(response.statusCode.toString().replace(/\d{2}$/, 'XX'), body, response);
        self._respond(response.statusCode.toString(), body, response);
        
        self._respond('complete', body, response);
      });
    }
  },
  _respond: function(type, data, response) {
    if (this.options.originalRequest) this.options.originalRequest.emit(type, data, response);
    else this.emit(type, data, response);
  },
  _makeRequest: function(method) {
    // Support new and old interface for making requests for now
    if (typeof this.client.request == 'function') {
      return this.client.request(method, this._fullPath(), this.headers);
    } else {
      method = method.toLowerCase();
      if (method == 'delete') method = 'del';
      return this.client[method](this._fullPath(), this.headers);
    }
  },
  _createRequest: function() {
    if (typeof this.options.data == 'object') {
      this.options.data = qs.stringify(this.options.data);
      this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      this.headers['Content-Length'] = this.options.data.length;
    }
  
    this.request = this._makeRequest(this.options.method);
  
    if (this.options.data) this.request.sendBody(this.options.data.toString(), this.options.encoding || 'utf8');
  },
  _createMultipartRequest: function() {
    this.headers['Content-Type'] = 'multipart/form-data; boundary=' + multipart.defaultBoundary;
    this.headers['Transfer-Encoding'] = 'chunked';
  
    this.request = this._makeRequest(this.options.method);
  },
  run: function() {
    var self = this;
    
    if (this.options.multipart) {
      multipart.send(this.request, this.options.data, function() {
        self.request.finish(function(response) {
          self._responseHandler(response);
        });
      });
    } else {
      this.request.finish(function(response) {
        self._responseHandler(response);
      });
    }
    
    return this;
  }
}); 

function shortcutOptions(options, method) {
  options = options || {};
  options.method = method;
  options.parser = options.parser || parsers.auto;
  return options;
}
    
function request(url, options) {  
  return (new RestRequest(url, options)).run();
}

function get(url, options) {
  return request(url, shortcutOptions(options, 'GET'));
}

function post(url, options) {
  return request(url, shortcutOptions(options, 'POST'));
}

function put(url, options) {
  return request(url, shortcutOptions(options, 'PUT'));
}

function del(url, options) {
  return request(url, shortcutOptions(options, 'DELETE'));
}

var parsers = {
  auto: function(data) {
    if (this.headers['content-type'].indexOf('application/json') == 0) 
      return parsers.json(data);
    if (this.headers['content-type'].indexOf('application/xml') == 0) 
      return parsers.xml(data);
    if (this.headers['content-type'].indexOf('application/yaml') == 0) 
      return parsers.yaml(data);
    return data;
  },
  xml: function(data) {
    return x2j.parse(data);
  },
  json: function(data) {
    return JSON.parse(data);
  },
  yaml: function(data) {
    return yaml.eval(data);
  }
}

process.mixin(exports, {
  RestRequest: RestRequest,
  request: request,
  get: get,
  post: post,
  put: put,
  del: del,
  parsers: parsers,
  file: multipart.file,
  data: multipart.data
});