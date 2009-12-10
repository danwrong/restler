Restler
=======

(C) Dan Webb (dan@danwebb.net/@danwrong) 2009, Licensed under the MIT-LICENSE

An HTTP client library for node.js.  Hides most of the complexity of creating and using http.Client. Very early days yet.



Features
--------

* Easy interface for basic operations via http.Client
* Automatic serialization of post data
* Automatic serialization of query string data
* Automatic deserialization of XML, JSON and YAML responses to JavaScript objects
* Provide your own deserialization functions for other datatypes
* Automatic following of redirects
* Send files with multipart requests
* Transparently handle SSL (just specify https in the URL)
* Deals with basic auth for you, just provide username and password options
    
    
API
---

### request(url, options)

Basic method to make a request of any type.  The function returns a RestRequest object
that emits events:

* _complete_ emitted when the request has finished whether it was successful or not.  Gets passed the response data and the response as arguments.
* _success_ emitted when the request was successful.  Gets passed the response data and the response as arguments.
* _error_ emitted when the request was unsuccessful.  Gets passed the response data and the response as arguments.
* _2XX, 3XX, 4XX, 5XX etc_ emitted for all requests with response codes in the range.  Eg. 2XX emitted for 200, 201, 203
* _actual response code_ there is an event emitted for every single response code.  eg.  404, 201, etc.

### get(url, options)

Create a GET request. 

### post(url, options)

Create a POST request.

### put(url, options)

Create a PUT request.

### del(url, options)

Create a DELETE request.

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
* _parser_ A function that will be called on the returned data.  try parsers.auto, parsers.json etc
* _encoding_ The encoding of the request body.  defaults to utf8
* _headers_ a hash of HTTP headers to be sent
* _username_ Basic auth username
* _password_ Basic auth password
* _multipart_ If set the data passed will be formated as multipart/form-encoded.  See multipart example below.
* _client_ A http.Client instance if you want to reuse or implement some kind of connection pooling.
* _followRedirects_ Does what it says on the tin.


SSL Support
-----------

TLS support for HTTP requests has been added to node.js but is not in 0.1.20.  If you need
SSL support get the latest version of node.js from github, install gnutls and then compile it.
If you've done this the Restler will send SSL requests if you specify a https protocol.


Example usage
-------------

    var sys = require('sys'),
        rest = require('./restler');

    rest.get('http://google.com').addListener('complete', function(data) {
      sys.puts(data);
    });

    rest.get('http://twaud.io/api/v1/users/danwrong.json').addListener('complete', function(data) {
      sys.puts(data[0].message); // auto convert to object
    });
    
    rest.get('http://twaud.io/api/v1/users/danwrong.xml').addListener('complete', function(data) {
      sys.puts(data[0].sounds[0].sound[0].message); // auto convert to object
    });
    
    rest.post('http://user:pass@service.com/action', {
      data: { id: 334 },
    }).addListener('complete', function(data, response) {
      if (response.statusCode == 201) {
        // you can get at the raw response like this...
      }
    });
    
    // multipart request sending a file and using https
    rest.post('https://twaud.io/api/v1/upload.json', {
      multipart: true,
      data: {
        username: 'danwrong',
        password: 'wouldntyouliketoknow',
        'sound[message]': 'hello from restler!',
        'sound[file]': rest.file('doug-e-fresh_the-show.mp3', 'audio/mpeg')
      }
    }).addListener('complete', function(data) {
      sys.puts(data.audio_url);
    });
    
    // create a service constructor for very easy API wrappers a la HTTParty...
    Twitter = rest.service(function(u, p) {
      this.defaults.username = u;
      this.defaults.password = p;
    }, {
      baseURL: 'http://twitter.com'
    }, {
      update: function(message) {
        return this.post('/statuses/update.json', { data: { status: message } });
      }
    });
    
    var client = new Twitter('danwrong', 'password');
    client.update('Tweeting using a Restler service thingy').addListener('complete', function(data) {
      sys.p(data);
    });

    
Running the tests
-----------------

    node test/restler.js
    
    
TODO
----
* replace xml2json with own implementation
* What do you need? Let me know or fork.


Acknowledgements
----------------

Restler uses base64, querystring and uri from Narwhal, yaml by TJ Holowaychuk and xml2json by Thomas Frank.  See each of the files
in the vendor directory for their licences.
