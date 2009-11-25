var sys  = require('sys'),
    http = require('http'),
    uri  = require('./uri');
    
function _isRedirect(response) {
  return ([301, 302].indexOf(response.statusCode) >= 0);
}
    
    
function request(url, options) {  
  sys.puts('Requesting: ' + url);
  var url = uri.parse(url);
  
  var headers = process.mixin({
    'Accept': '*/*',
    'Host': url.host
  }, options.headers || {});
  
  if (!url.port) url.port = (url.protocol == 'https') ? '443' : '80';
  if (!options.method) options.method = (options.body) ? 'post' : 'get';
  if (options.body) {
    if (typeof options.body == 'object') options.body = uri.encode(options.body);
    headers['Content-Length'] = options.body.length;
  }
  
  var client = http.createClient(url.port, url.host);
  var req = client[options.method](url.fullPath, headers);
  
  if (options.data) req.sendBody(options.body, options.encoding || 'utf8');
  
  req.finish(function(response) {
    if (_isRedirect(response)) {
      var location = response.headers['location'];
      sys.puts("Redirecting to: " + location);
      request(location, options);
    } else {
      var body = '';
      
      response.addListener('body', function(chunk) {
        body += chunk;
      });
      
      response.addListener('complete', function() {
        options.complete.call(response, body);
      });
    }
  });
}

function get(url, options) {
  if (typeof options == 'function') options = { complete: options };
  options.method = 'get';
  request(url, options)
}

function post(url, options) {
  if (typeof options == 'function') options = { complete: options };
  options.method = 'post';
  request(url, options)
}

function put(url, options) {
  if (typeof options == 'function') options = { complete: options };
  options.method = 'put';
  request(url, options)
}

function del(url, options) {
  if (typeof options == 'function') options = { complete: options };
  options.method = 'del';
  request(url, options)
}

process.mixin(exports, {
  request: request,
  get: get,
  post: post,
  put: put,
  del: del
});