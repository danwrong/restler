var helper = require ('./test_helper'),
    multipartform = require('../lib/multipartform'),
    multipart = require('multipart'),
    sys  = require('sys');
    
function parseMultipart(data, callback) {
  var parts = {};
  
  var stream = new multipart.Stream({ 
    boundary: '--' + multipartform.defaultBoundary, 
    data: data
  });
  
  sys.p(stream);
  
  stream.addListener('part', function(part) {
    sys.p(part);
    var buffer = '';
    part.addListener('body', function(chunk) {
      buffer += chunk;
    });
    part.addListener('complete', function() {
      parts[part.name] = {
        filename: part.filename,
        contentType: part.headers['content-type'],
        data: buffer
      };
    });
  });
  
  stream.addListener('complete', function() {
    callback.call(this, parts);
  });
}
    
helper.testCase("Multipart Form Encoder Tests", {
  testWithSimpleDataShouldBeValidMultipartRequest: function(test) {
    multipartform.encode({ a: 3, b: 2 }, function(data) {
      parseMultipart(data, function(parts) {
        sys.p(parts);
      });
    });
  },
})