var sys    = require('sys'),
    http   = require('http'),
    uri    = require('./vendor/uri'),
    qs     = require('./vendor/querystring'),
    base64 = require('./vendor/base64');
    
function _isRedirect(response) {
  return ([301, 302].indexOf(response.statusCode) >= 0);
}

function _mungeOptions(options, method) {
  if (typeof options == 'function') options = { complete: options };
  options.method = method;
  options.parser = parsers.auto;
  return options;
}

function _fullPath(uri) {
  var path = uri.path;
  if (uri.anchor) path += '#' + uri.anchor;
  if (uri.query) path += '?' + query;
  return path;
}

function _basicAuth(headers, username, password) {
  var auth = base64.encode(username + ':' + password);
  headers['Authorization'] = "Basic " + auth;
}
    
    
function request(url, options) {  
  var url = uri.parse(url);
  
  var headers = process.mixin({
    'Accept': '*/*',
    'Host': url.domain
  }, options.headers || {});
  
  if (!url.path) url.path = '/'
  
  if (!url.port) url.port = (url.protocol == 'https') ? '443' : '80';
  if (!options.method) options.method = (options.body) ? 'post' : 'get';
  
  if (options.body) {
    if (typeof options.body == 'object') options.body = qs.stringify(options.body);
    headers['Content-Length'] = options.body.length;
  }
  
  if (options.query && !url.query) {
    if (typeof options.query == 'object') url.query = qs.stringify(options.query);
    else url.query = options.query;
  }
  
  if (url.user) options.username = url.user;
  if (url.password) options.password = url.password;
  
  if (options.username && options.password) _basicAuth(headers, options.username, options.password);
  
  var client = http.createClient(url.port, url.domain);
  var req = client[options.method](_fullPath(url), headers);
  
  if (options.data) req.sendBody(options.body, options.encoding || 'utf8');
  
  req.finish(function(response) {
    if (_isRedirect(response)) {
      var location = response.headers['location'];
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
  });
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
    if (this.headers['content-type'].indexOf('application/json') == 0) return parsers.json(data);
    if (this.headers['content-type'].indexOf('application/xml') == 0) return parsers.xml(data);
    return data;
  },
  xml: function(data) {
    // TODO
  },
  json: function(data) {
    return JSON.parse(data);
  }
}

process.mixin(exports, {
  request: request,
  get: get,
  post: post,
  put: put,
  del: del,
  parsers: parsers
});