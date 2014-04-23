var util      = require('util'),
    events    = require("events"),
    http      = require('http'),
    https     = require('https'),
    url       = require('url'),
    qs        = require('qs'),
    multipart = require('./multipartform'),
    zlib      = require('zlib'),
    iconv     = require('iconv-lite');

function mixin(target, source) {
  source = source || {};
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
}

function Request(uri, options) {
  events.EventEmitter.call(this);
  this.url = url.parse(uri);
  this.options = options;
  this.headers = {
    'Accept': '*/*',
    'User-Agent': 'Restler for node.js',
    'Host': this.url.host
  };

  this.headers['Accept-Encoding'] = 'gzip, deflate';

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

  this._applyAuth();

  if (this.options.multipart) {
    this.headers['Content-Type'] = 'multipart/form-data; boundary=' + multipart.defaultBoundary;
    var multipart_size = multipart.sizeOf(this.options.data, multipart.defaultBoundary);
    if (typeof multipart_size === 'number' && multipart_size === multipart_size) {
        this.headers['Content-Length'] = multipart_size;
    }
    else {
        console.log("Building multipart request without Content-Length header, please specify all file sizes");
    }
  } else {
    if (typeof this.options.data == 'object') {
      this.options.data = qs.stringify(this.options.data);
      this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      this.headers['Content-Length'] = this.options.data.length;
    }
    if (typeof this.options.data == 'string') {
      var buffer = new Buffer(this.options.data, this.options.encoding || 'utf8');
      this.options.data = buffer;
      this.headers['Content-Length'] = buffer.length;
    }
    if (!this.options.data) {
      this.headers['Content-Length'] = 0;
    }
  }

  var proto = (this.url.protocol == 'https:') ? https : http;

  this.request = proto.request({
    host: this.url.hostname,
    port: this.url.port,
    path: this._fullPath(),
    method: this.options.method,
    headers: this.headers,
    rejectUnauthorized: this.options.rejectUnauthorized
  });

  this._makeRequest();
}

util.inherits(Request, events.EventEmitter);

mixin(Request.prototype, {
  _isRedirect: function(response) {
    return ([301, 302, 303, 307].indexOf(response.statusCode) >= 0);
  },
  _fullPath: function() {
    var path = this.url.pathname || '/';
    if (this.url.hash) path += this.url.hash;
    if (this.url.query) path += '?' + this.url.query;
    return path;
  },
  _applyAuth: function() {
    var authParts;

    if (this.url.auth) {
      authParts = this.url.auth.split(':');
      this.options.username = authParts[0];
      this.options.password = authParts[1];
    }

    if (this.options.username && this.options.password !== undefined) {
      var b = new Buffer([this.options.username, this.options.password].join(':'));
      this.headers['Authorization'] = "Basic " + b.toString('base64');
    } else if (this.options.accessToken) {
      this.headers['Authorization'] = "Bearer " + this.options.accessToken;
    }
  },
  _responseHandler: function(response) {
    var self = this;

    if (self._isRedirect(response) && self.options.followRedirects) {
      try {
        // 303 should redirect and retrieve content with the GET method
        // http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html#sec10.3.4
        if (response.statusCode === 303) {
            self.url    = url.parse(url.resolve(self.url.href, response.headers['location']));
            self.options.method = 'GET';
            delete self.options.data;
            self._retry();
        } else {
            self.url = url.parse(url.resolve(self.url.href, response.headers['location']));
            self._retry();
            // todo handle somehow infinite redirects
        }
      } catch(err) {
        err.message = 'Failed to follow redirect: ' + err.message;
        self._fireError(err, response);
      }
    } else {
      var body = '';

      response.setEncoding('binary');

      response.on('data', function(chunk) {
        body += chunk;
      });

      response.on('end', function() {
        response.rawEncoded = body;
        self._decode(new Buffer(body, 'binary'), response, function(err, body) {
          if (err) {
            self._fireError(err, response);
            return;
          }
          response.raw = body;
          body = self._iconv(body, response);
          self._encode(body, response, function(err, body) {
            if (err) {
              self._fireError(err, response);
            } else {
              self._fireSuccess(body, response);
            }
          });
        });
      });
    }
  },
  _decode: function(body, response, callback) {
    var decoder = response.headers['content-encoding'];
    if (decoder in decoders) {
      decoders[decoder].call(response, body, callback);
    } else {
      callback(null, body);
    }
  },
  _iconv: function(body, response) {
    var charset = response.headers['content-type'];
    if (charset) {
      charset = /\bcharset=(.+)(?:;|$)/i.exec(charset);
      if (charset) {
        charset = charset[1].trim().toUpperCase();
        if (charset != 'UTF-8') {
          try {
            return iconv.decode(body, charset);
          } catch (err) {}
        }
      }
    }
    return body;
  },
  _encode: function(body, response, callback) {
    var self = this;
    if (self.options.decoding == 'buffer') {
      callback(null, body);
    } else {
      body = body.toString(self.options.decoding);
      if (self.options.parser) {
        self.options.parser.call(response, body, callback);
      } else {
        callback(null, body);
      }
    }
  },
  _fireError: function(err, response) {
    this._fireCancelTimeout();
    this.emit('error', err, response);
    this.emit('complete', err, response);
  },
  _fireCancelTimeout: function(){
    var self = this;
    if(self.options.timeout){
      clearTimeout(self.options.timeoutFn);
    }
  },
  _fireTimeout: function(err){
    this.emit('timeout', err);
    this.aborted = true;
    this.timedout = true;
    this.request.abort();
  },
  _fireSuccess: function(body, response) {
    if (parseInt(response.statusCode) >= 400) {
      this.emit('fail', body, response);
    } else {
      this.emit('success', body, response);
    }
    this.emit(response.statusCode.toString().replace(/\d{2}$/, 'XX'), body, response);
    this.emit(response.statusCode.toString(), body, response);
    this.emit('complete', body, response);
  },
  _makeRequest: function() {
    var self = this;
    var timeoutMs = self.options.timeout;
    if(timeoutMs){
      self.options.timeoutFn = setTimeout(function(){
        self._fireTimeout(timeoutMs);
      },timeoutMs);
    }
    this.request.on('response', function(response) {
      self._fireCancelTimeout();
      self.emit('response', response);
      self._responseHandler(response);
    }).on('error', function(err) {
      self._fireCancelTimeout();
      if (!self.aborted) {
        self._fireError(err, null);
      }
    });
  },
  _retry: function() {
    this.request.removeAllListeners().on('error', function() {});
    if (this.request.finished) {
      this.request.abort();
    }
    Request.call(this, this.url.href, this.options); // reusing request object to handle recursive calls and remember listeners
    this.run();
  },
  run: function() {
    var self = this;
    if (this.options.multipart) {
      multipart.write(this.request, this.options.data, function() {
        self.request.end();
      });
    } else {
      if (this.options.data) {
        this.request.write(this.options.data.toString(), this.options.encoding || 'utf8');
      }
      this.request.end();
    }

    return this;
  },
  abort: function(err) {
    var self = this;

    if (err) {
      if (typeof err == 'string') {
        err = new Error(err);
      } else if (!(err instanceof Error)) {
        err = new Error('AbortError');
      }
      err.type = 'abort';
    } else {
      err = null;
    }

    self.request.on('close', function() {
      if (err) {
        self._fireError(err, null);
      } else {
        self.emit('complete', null, null);
      }
    });

    self.aborted = true;
    self.request.abort();
    self.emit('abort', err);
    return this;
  },
  retry: function(timeout) {
    var self = this;
    timeout = parseInt(timeout);
    var fn = self._retry.bind(self);
    if (!isFinite(timeout) || timeout <= 0) {
      process.nextTick(fn, timeout);
    } else {
      setTimeout(fn, timeout);
    }
    return this;
  }
});

function shortcutOptions(options, method) {
  options = options || {};
  options.method = method;
  options.parser = (typeof options.parser !== "undefined") ? options.parser : parsers.auto;
  return options;
}

function request(url, options) {
  var request = new Request(url, options);
  request.on('error', function() {});
  process.nextTick(request.run.bind(request));
  return request;
}

function get(url, options) {
 return request(url, shortcutOptions(options, 'GET'));
}

function patch(url, options) {
  return request(url, shortcutOptions(options, 'PATCH'));
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

function head(url, options) {
  return request(url, shortcutOptions(options, 'HEAD'));
}

function json(url, data, options, method) {
  options = options || {};
  options.parser = (typeof options.parser !== "undefined") ? options.parser : parsers.auto;
  options.headers = options.headers || {};
  options.headers['content-type'] = 'application/json';
  options.data = JSON.stringify(data || {});
  options.method = method || 'GET';
  return request(url, options);
}

function postJson(url, data, options) {
  return json(url, data, options, 'POST');
}

function putJson(url, data, options) {
  return json(url, data, options, 'PUT');
}

var parsers = {
  auto: function(data, callback) {
    var contentType = this.headers['content-type'];
    var contentParser;
    if (contentType) {
      contentType = contentType.replace(/;.+/, ''); // remove all except mime type (eg. text/html; charset=UTF-8)
      if (contentType in parsers.auto.matchers) {
        contentParser = parsers.auto.matchers[contentType];
      } else {
        // custom (vendor) mime types
        var parts = contentType.match(/^([\w-]+)\/vnd((?:\.(?:[\w-]+))+)\+([\w-]+)$/i);
        if (parts) {
          var type = parts[1];
          var vendors = parts[2].substr(1).split('.');
          var subtype = parts[3];
          var vendorType;
          while (vendors.pop() && !(vendorType in parsers.auto.matchers)) {
            vendorType = vendors.length
              ? type + '/vnd.' + vendors.join('.') + '+' + subtype
              : vendorType = type + '/' + subtype;
          }
          contentParser = parsers.auto.matchers[vendorType];
        }
      }
    }
    if (typeof contentParser == 'function') {
      contentParser.call(this, data, callback);
    } else {
      callback(null, data);
    }
  },
  json: function(data, callback) {
    if (data && data.length) {
      var parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (err) {
        err.message = 'Failed to parse JSON body: ' + err.message;
        callback(err, null);
      }
      if (parsedData !== undefined) {
        callback(null, parsedData);
      }
    } else {
      callback(null, null);
    }
  }
};

parsers.auto.matchers = {
  'application/json': parsers.json
};

try {
  var yaml = require('yaml');

  parsers.yaml = function(data, callback) {
    if (data) {
      try {
        callback(null, yaml.eval(data));
      } catch (err) {
        err.message = 'Failed to parse YAML body: ' + err.message;
        callback(err, null);
      }
    } else {
      callback(null, null);
    }
  };

  parsers.auto.matchers['application/yaml'] = parsers.yaml;
} catch(e) {}

try {
  var xml2js = require('xml2js');

  parsers.xml = function(data, callback) {
    if (data) {
      var parser = new xml2js.Parser();
      parser.parseString(data, function(err, data) {
        if (err) {
          err.message = 'Failed to parse XML body: ' + err.message;
        }
        callback(err, data);
      });
    } else {
      callback(null, null);
    }
  };

  parsers.auto.matchers['application/xml'] = parsers.xml;
} catch(e) { }

var decoders = {
  gzip: function(buf, callback) {
    zlib.gunzip(buf, callback);
  },
  deflate: function(buf, callback) {
    zlib.inflate(buf, callback);
  }
};


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
  patch: function(path, options) {
    return patch(this._url(path), this._withDefaults(options));
  },
  put: function(path, options) {
    return put(this._url(path), this._withDefaults(options));
  },
  post: function(path, options) {
    return post(this._url(path), this._withDefaults(options));
  },
  json: function(method, path, data, options) {
    return json(this._url(path), data, this._withDefaults(options), method);
  },
  del: function(path, options) {
    return del(this._url(path), this._withDefaults(options));
  },
  _url: function(path) {
    if (this.baseURL) return url.resolve(this.baseURL, path);
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
  patch: patch,
  post: post,
  put: put,
  del: del,
  head: head,
  json: json,
  postJson: postJson,
  putJson: putJson,
  parsers: parsers,
  file: multipart.file,
  data: multipart.data
});

