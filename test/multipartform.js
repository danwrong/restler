    multipartform = require('../lib/multipartform'),
    multipart = require('multipart'),
    sys  = require('sys');
    fs = require('fs')
http = require("http");
    

http.createServer(function (req, res) {
  var mp = multipart.parse(req),
    fields = {},
    name, filename;
  mp.addListener("error", function (er) {
    res.writeHead(400, {"content-type":"text/plain"});
    res.write("You sent a bad message!\n"+er.message);
    res.close();
  });
  mp.addListener("partBegin", function (part) {
    name = part.name;
    filename = part.filename;
    if (name) fields[name] = "";
  });
  mp.addListener("body", function (chunk) {
    if (name) {
      // just a demo.  in reality, you'd probably
      // want to sniff for base64 encoding, decode,
      // and write the bytes to a file or something.
      fields[name] += chunk;
	if (!part.file) {
	            path = "./photo.jpg";

	        part.file = {
	          path: path,
	          handle: new fs.FileWriteStream(path, {flags: "w+", encoding: 'binary'}),
	        };
	}
	part.file.handle.write(chunk, function(err, bytesWritten) {
		sys.p(bytesWritten);
	});

    }
  });
  mp.addListener("complete", function () {
	part.file.handle.close();
    var response = "You posted: \n" + sys.inspect(fields);
    res.writeHead(200, {
      "content-type" : "text/plain",
      "content-length" : response.length
    });
    res.write(response);
    res.close();
  })
}).listen("5001");


request_headers = {}
request_headers["Host"] = "up.flickr.com";
request_headers["User-Agent"] = "node.js";
request_headers["Content-Type"] = "multipart/form-data; boundary=" + multipartform.defaultBoundary;
request_headers['Transfer-Encoding'] = 'chunked';

parts= {};
parts["photo"] = multipartform.file("./test/girls.jpg", "girls", 136892);
http_request = http.createClient("5001", "localhost").request("POST", "/services/upload", request_headers);

// write out the multiparts to the request
// when we are done close the request, so the http request fires off
multipartform.write(http_request, parts, null, function(err) {
	if (err) {
		callback(err);
		return;
	}
	sys.p("closing and sending");
	http_request.close();
});
