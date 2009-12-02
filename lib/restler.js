var sys       = require('sys'),
    http      = require('http'),
    uri       = require('./vendor/uri'),
    qs        = require('./vendor/querystring'),
    base64    = require('./vendor/base64'),
    x2j       = require('./vendor/xml2json'),
    yaml      = require('./vendor/yaml'),
    multipart = require('./multipartform');
    
function _isRedirect(response) {
  return ([301, 302].indexOf(response.statusCode) >= 0);
}

function _mungeOptions(options, method) {
  if (typeof options == 'function') options = { complete: options };
  options.method = method;
  options.parser = options.parser || parsers.auto;
  return options;
}

function _fullPath(uri) {
  var path = uri.path;
  if (uri.anchor) path += '#' + uri.anchor;
  if (uri.query) path += '?' + uri.query;
  return path;
}

function _basicAuth(headers, username, password) {
  var auth = base64.encode(username + ':' + password);
  headers['Authorization'] = "Basic " + auth;
}  

function _responseHandler(url, options) {
  return function(response) {
    if (_isRedirect(response)) {
      var location = uri.resolve(url, response.headers['location']);
      request(location, options);
    } else {
      var body = '';
      
      response.addListener('body', function(chunk) {
        body += chunk;
      });
      
      response.addListener('complete', function() {
        if (options.parser) body = options.parser.call(response, body);
        options.complete.call(response, body);
      });
    }
  }
}  
    
function request(url, options) {  
  var url = uri.parse(url);
  
  // mix in headers to default headers
  var headers = process.mixin({
    'Accept': '*/*',
    'Host': url.domain,
    'User-Agent': 'Restler for node.js'
  }, options.headers || {});
  
  if (!url.path) url.path = '/'
  
  // set port and method defaults
  if (!url.port) url.port = (url.protocol == 'https') ? '443' : '80';
  if (!options.method) options.method = (options.data) ? 'post' : 'get';
  
  // stringify query given in options of not given in URL
  if (options.query && !url.query) {
    if (typeof options.query == 'object') 
      url.query = qs.stringify(options.query);
    else url.query = options.query;
  }
  
  // use URL credentials over options
  if (url.user) options.username = url.user;
  if (url.password) options.password = url.password;
  
  // add basic auth header if needed
  if (options.username && options.password) 
    _basicAuth(headers, options.username, options.password);
  
  var client = http.createClient(url.port, url.domain);
  
  // try to use SSL if HTTPS
  if (url.protocol == 'https') {
    try {
      client.setSecure("X509_PEM");
    } catch(e) {
      sys.puts('WARNING: SSL not supported in your version of node JS');
    }
  }
  
  if (options.multipart) {
    headers['Content-Type'] = 'multipart/form-data; boundary=' + multipart.defaultBoundary;
    headers['Transfer-Encoding'] = 'chunked';
    
    var req = client[options.method](_fullPath(url), headers);
    
    multipart.send(req, options.data, function() {
      req.finish(_responseHandler(url, options));
    });
  } else {
    if (typeof options.data == 'object') {
      options.data = qs.stringify(options.data);
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = options.data.length;
    }
    
    var req = client[options.method](_fullPath(url), headers);
    
    if (options.data) req.sendBody(options.data.toString(), options.encoding || 'utf8');
    req.finish(_responseHandler(url, options));
  }
}

function get(url, options) {
  request(url, _mungeOptions(options, 'get'));
}

function post(url, options) {
  request(url, _mungeOptions(options, 'post'));
}

function put(url, options) {
  request(url, _mungeOptions(options, 'put'));
}

function del(url, options) {
  request(url, _mungeOptions(options, 'del'));
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