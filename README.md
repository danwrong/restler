Restler
=======

(C) Dan Webb (dan@danwebb.net) 2009, Licensed under the MIT-LICENSE

An HTTP client library for node.js.  Hides most of the complexity of creating and using http.Client. Very early days yet.



Features
--------

* Easy interface for basic operations via http.Client
* Automatic serialization of post data
* Automatic serialization of query string data
* Automatic deserialization of XML, JSON and YAML responses to JavaScript objects
* Provide your own deserialization functions for other datatypes
* Automatic following of redirects
* Deals with basic auth for you, just provide username and password options
    
    

API
---

### request(url, options)

Basic method to make a request of any type.

### get(url, complete_callback_or_options)

Send a GET request.   You can either just specify a complete callback or a full options hash.

### post(url, complete_callback_or_options)

Send a POST request.   You can either just specify a complete callback or a full options hash.

### put(url, complete_callback_or_options)

Send a PUT request.   You can either just specify a complete callback or a full options hash.

### del(url, complete_callback_or_options)

Send a DELETE request.   You can either just specify a complete callback or a full options hash.

### response parsers

You can give any of these to the parsers option to specify how the response data is deserialized.

#### parsers.auto

Checks the content-type and then uses parsers.xml, parsers.json or parsers.yaml.  
If the content type isn't recognised it just returns the data untouched.

#### parsers.json, parsers.xml, parsers.yaml

All of these attempt to turn the response into a JavaScript object.

### options hash

* _method_ Request method, can be get, post, put, del
* _query_ Query string variables as a javascript object, will override the querystring in the URL
* _data_ The data to be added to the body of the request.  Can be a string or any object
* _complete_ A callback function to be ran when the request is complete
* _parser_ A function that will be called on the returned data.  try parsers.auto, parsers.json etc
* _encoding_ The encoding of the request body.  defaults to utf8
* _headers_ a hash of HTTP headers to be sent
* _username_ Basic auth username
* _password_ Basic auth password


Example usage
-------------

    var sys = require('sys'),
        rest = require('./restler');

    rest.get('http://google.com', function(data) {
      sys.puts(data);
    });

    rest.get('http://twaud.io/api/v1/users/danwrong.json', function(data) {
      sys.puts(data[0].message); // auto convert to object
    });
    
    rest.get('http://twaud.io/api/v1/users/danwrong.xml', function(data) {
      sys.puts(data[0].sounds[0].sound[0].message); // auto convert to object
    });
    
    rest.post('http://user:pass@service.com/action', {
      data: { id: 334 },
      complete: function(data) {
        // process response
      }
    });

    
Running the tests
-----------------

    node test/restler.js
    
    
TODO
----

* Automatically serialize multipart-form-encoded requests so you can send files etc.
* Deal with SSL transparently
* What do you need? Let me know or fork.
