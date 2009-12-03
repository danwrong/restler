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
    'Host': url.domain,
    'User-Agent': 'Restler for node.js'
  }, options.headers || {});
  
  if (!this.url.path) this.url.path = '/'
  
  // set port and method defaults
  if (!this.url.port) this.url.port = (this.url.protocol == 'https') ? '443' : '80';
  if (!this.options.method) this.options.method = (this.options.data) ? 'post' : 'get';
  
  // stringify query given in options of not given in URL
  if (this.options.query && !this.url.query) {
    if (typeof this.options.query == 'object') 
      this.url.query = qs.stringify(this.options.query);
    else this.url.query = this.options.query;
  }
  
  this._applyBasicAuth();
  
  this.client = http.createClient(this.url.port, this.url.domain);
  
  this._applySSL();
  
  if (options.multipart) this._sendMultipartRequest();
  else this._sendRequest();
    
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
        
        if (parseInt(response.statusCode) >= 400) self._respond('error', body);
        else self._respond('success', body);
        
        self._respond('complete', body);
      });
    }
  },
  _respond: function(type, data) {
    if (this.options.originalRequest) this.options.originalRequest.emit(type, data);
    else this.emit(type, data);
  },
  _sendRequest: function() {
    var self = this;
    
    if (typeof this.options.data == 'object') {
      this.options.data = qs.stringify(this.options.data);
      this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      this.headers['Content-Length'] = this.options.data.length;
    }
  
    var req = this.client[this.options.method](this._fullPath(), this.headers);
  
    if (this.options.data) req.sendBody(this.options.data.toString(), this.options.encoding || 'utf8');
    
    req.finish(function(response) {
      self._responseHandler(response);
    });
  },
  _sendMultipartRequest: function() {
    var self = this;
    
    this.headers['Content-Type'] = 'multipart/form-data; boundary=' + multipart.defaultBoundary;
    this.headers['Transfer-Encoding'] = 'chunked';
  
    var req = this.client[this.options.method](this._fullPath(), this.headers);
  
    multipart.send(req, this.options.data, function() {
      req.finish(function(response) {
        self._responseHandler(response);
      });
    });
  }
}); 

function shortcutOptions(options, method) {
  options = options || {};
  options.method = method;
  options.parser = options.parser || parsers.auto;
  return options;
}
    
function request(url, options) {  
  return new RestRequest(url, options);
}

function get(url, options) {
  return request(url, shortcutOptions(options, 'get'));
}

function post(url, options) {
  return request(url, shortcutOptions(options, 'post'));
}

function put(url, options) {
  return request(url, shortcutOptions(options, 'put'));
}

function del(url, options) {
  return request(url, shortcutOptions(options, 'del'));
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
  request: request,
  get: get,
  post: post,
  put: put,
  del: del,
  parsers: parsers,
  file: multipart.file,
  data: multipart.data
});