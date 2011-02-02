var sys       = require('sys'),
    http      = require('http'),
    https     = require('https'),
    url       = require('url'),
    qs        = require('querystring'),
    multipart = require('./multipartform');
    
function mixin(target, source) {
  Object.keys(target).forEach(function(key) {
    target[key] = source[key];
  });
  
  return target;
}
    
function Request(uri, options) {
  this.url = url.parse(uri);
  this.options = options;
  this.headers = {
    'Accept': '*/*',
    'User-Agent': 'Restler for node.js'
  }
  
  mixin(this.headers, options.headers || {});
  
  // set port and method defaults
  if (!this.url.port) this.url.port = (this.url.protocol == 'https:') ? '443' : '80';
  if (!this.options.method) this.options.method = (this.options.data) ? 'POST' : 'GET';
  if (typeof this.options.followRedirects == 'undefined') this.options.followRedirects = true;
  
  // stringify query given in options of not given in URL
  if (this.options.query && !this.url.query) {
    if (typeof this.options.query == 'object') 
      this.url.query = qs.stringify(this.options.query);
    else this.url.query = this.options.query;
  }
  
  this._applyBasicAuth();
  
  // TODO support chunked requests as well
  if (typeof this.options.data == 'object') {
    this.options.data = qs.stringify(this.options.data);
    this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    this.headers['Content-Length'] = this.options.data.length;
  } else if (this.options.multipart) {
    this.headers['Content-Type'] = 'multipart/form-data; boundary=' + multipart.defaultBoundary;
    this.headers['Transfer-Encoding'] = 'chunked';
  }
  
  var proto = (this.url.protocol == 'https:') ? https : http;
  
  this.request = proto.request({
    host: this.url.host,
    port: this.url.port,
    path: this._fullPath(),
    method: this.options.method,
    headers: this.headers
  });
  
  this._makeRequest();
}

Request.prototype = new process.EventEmitter();
mixin(Request.prototype, {
  _isRedirect: function(response) {
    return ([301, 302].indexOf(response.statusCode) >= 0);
  },
  _fullPath: function() {
    var path = this.url.path;
    if (this.url.anchor) path += '#' + this.url.anchor;
    if (this.url.query) path += '?' + this.url.query;
    return path;
  },
  _applyBasicAuth: function() {
    var authParts;
    
    if (this.url.auth) {
      authParts = this.url.auth.split(':');
      this.options.username = authParts[0];
      this.options.password = authParts[1];
    }
    
    if (this.options.username && this.options.password) {
      var b = new Buffer([this.options.username, this.options.password].join(':'));
      this.headers['Authorization'] = "Basic " + b.toString('base64');
    }
  },
  _responseHandler: function(response) {
    var self = this;
    
    if (this._isRedirect(response) && this.options.followRedirects == true) {
      try {
        var location = url.resolve(this.url, response.headers['location']);
        this.options.originalRequest = this;
        
        request(location, this.options);
      } catch(e) {
        self._respond('error', '', 'Failed to follow redirect');
      }
    } else {
      var body = '';
      
      response.addListener('data', function(chunk) {
        // TODO Handle different encodings
        body += chunk.toString();
      });
      
      response.addListener('end', function() {
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
    if (this.options.originalRequest) {
      this.options.originalRequest.emit(type, data, response);
    } else {
      this.emit(type, data, response);
    }
  },
  _makeRequest: function() { 
    var self = this;
       
    this.request.addListener("response", function(response) {
		  self._responseHandler(response);
  	});
  
    if (this.options.data) {
      this.request.write(this.options.data.toString(), this.options.encoding || 'utf8');
    }
  },
  run: function() {
    var self = this;
    
    if (this.options.multipart) {
      multipart.write(this.request, this.options.data, function() {
        self.request.end();
      });
    } else {
		  this.request.end();
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
  	return (new Request(url, options)).run();
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

// TODO Make these async so it'll work with async parsers (xml2js)

var parsers = {
  auto: function(data) {
    var contentType = this.headers['content-type'];
    
    if (contentType) {
      for (var matcher in parsers.auto.parsers) {
        if (contentType == matcher) {
          return parsers.auto.parsers[matcher].call(this, data);
        }
      }
    }
    
    return data;
  }
}

parsers.auto.parsers = {
  'application/json': function(data) {
    return data && JSON.parse(data);
  }
};

try {
  var yaml = require('yaml');
  parsers.auto.parsers['application/yaml'] = function(data) {
    return data && yaml.eval(data);
  }
} catch(e) {}


function Service(defaults) {
  if (defaults.baseURL) {
   this.baseURL = defaults.baseURL;
   delete defaults.baseURL; 
  }
  
  this.defaults = defaults;
}

mixin(Service.prototype, {
  request: function(path, options) {
    return request(this._url(path), this._withDefaults(options));
  },
  get: function(path, options) {
    return get(this._url(path), this._withDefaults(options));
  },
  put: function(path, options) {
    return put(this._url(path), this._withDefaults(options));
  },
  post: function(path, options) {
    return post(this._url(path), this._withDefaults(options));
  },
  del: function(path, options) {
    return del(this._url(path), this._withDefaults(options));
  },
  _url: function(path) {
    if (this.baseURL) return uri.resolve(this.baseURL, path);
    else return path;
  },
  _withDefaults: function(options) {
    var o = mixin({}, this.defaults);
    return mixin(o, options);
  }
});

function service(constructor, defaults, methods) {
  constructor.prototype = new Service(defaults || {});
  mixin(constructor.prototype, methods);
  return constructor;
}

mixin(exports, {
  Request: Request,
  Service: Service,
  request: request,
  service: service,
  get: get,
  post: post,
  put: put,
  del: del,
  parsers: parsers,
  file: multipart.file,
  data: multipart.data
});