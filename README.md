Restler
=======

(C) Dan Webb (dan@danwebb.net/@danwrong) 2011, Licensed under the MIT-LICENSE

An HTTP client library for node.js (0.6.x and up).  Hides most of the complexity of creating and using http.Client.

**Release 2.x.x** is dedicated to modifying how errors are handled and emitted. Currently errors are being fired as an on 'error' event but as [@ctavan](https://github.com/ctavan) pointed out on [issue #36](https://github.com/danwrong/restler/pull/36) a better approach (and more commonly in vogue now) would be to pass the error obj to the callback.

Ths change will inevitably affect those using older < 0.2.x versions of restler. Those not ready to upgrade yet are encouraged to stay on the 0.2.x version.

See [Version History](https://github.com/danwrong/restler/wiki/Version-History) for changes


Features
--------

* Easy interface for common operations via http.request
* Automatic serialization of post data
* Automatic serialization of query string data
* Automatic deserialization of XML, JSON and YAML responses to JavaScript objects (if you have js-yaml and/or xml2js in the require path)
* Provide your own deserialization functions for other datatypes
* Automatic following of redirects
* Send files with multipart requests
* Transparently handle SSL (just specify https in the URL)
* Deals with basic auth for you, just provide username and password options
* Simple service wrapper that allows you to easily put together REST API libraries
* Transparently handle content-encoded responses (gzip, deflate) (requires node 0.6+)
* Transparently handle different content charsets via [iconv](https://github.com/bnoordhuis/node-iconv) (if available)


API
---

### request(url, options)

Basic method to make a request of any type. The function returns a RestRequest object that emits events:

#### events

* `complete: function(result, response)` - emitted when the request has finished whether it was successful or not. Gets passed the response result and the response object as arguments. If some error has occurred, `result` is always instance of `Error`, otherwise it contains response data.
* `success: function(data, response)` - emitted when the request was successful. Gets passed the response data and the response object as arguments.
* `fail: function(data, response)` - emitted when the request was successful, but 4xx status code returned. Gets passed the response data and the response object as arguments.
* `error: function(err, response)` - emitted when some errors have occurred (eg. connection aborted, parse, encoding, decoding failed or some other unhandled errors). Gets passed the `Error` object and the response object (when available) as arguments.
* `abort: function()` - emitted when `request.abort()` is called.
* `2XX`, `3XX`, `4XX`, `5XX: function(data, response)` - emitted for all requests with response codes in the range (eg. `2XX` emitted for 200, 201, 203).
* <code><i>actual response code</i>: function(data, response)</code> - emitted for every single response code (eg. 404, 201, etc).

#### members

* `abort([error])` Cancels request. `abort` event is emitted. `request.aborted` is set to `true`. If non-falsy `error` is passed, then `error` will be additionaly emitted (with `error` passed as a param and `error.type` is set to `"abort"`). Otherwise only `complete` event will raise.
* `retry([timeout])` Re-sends request after `timeout` ms. Pending request is aborted.
* `aborted` Determines if request was aborted.


### get(url, options)

Create a GET request.

### post(url, options)

Create a POST request.

### put(url, options)

Create a PUT request.

### del(url, options)

Create a DELETE request.

### head(url, options)

Create a HEAD request.

### json(url, data, options)

Send json `data` via GET method.

### postJson(url, data, options)

Send json `data` via POST method.


### Parsers

You can give any of these to the parsers option to specify how the response data is deserialized.
In case of malformed content, parsers emit `error` event. Original data returned by server is stored in `response.raw`.

#### parsers.auto

Checks the content-type and then uses parsers.xml, parsers.json or parsers.yaml.
If the content type isn't recognised it just returns the data untouched.

#### parsers.json, parsers.xml, parsers.yaml

All of these attempt to turn the response into a JavaScript object. In order to use the YAML and XML parsers you must have yaml and/or xml2js installed.

### Options

* `method` Request method, can be get, post, put, del. Defaults to `"get"`.
* `query` Query string variables as a javascript object, will override the querystring in the URL. Defaults to empty.
* `data` The data to be added to the body of the request. Can be a string or any object.
Note that if you want your request body to be JSON with the `Content-Type: application/json`, you need to
`JSON.stringify` your object first. Otherwise, it will be sent as `application/x-www-form-urlencoded` and encoded accordingly.
Also you can use `json()` and `postJson()` methods.
* `parser` A function that will be called on the returned data. Use any of predefined `restler.parsers`. See parsers section below. Defaults to `restler.parsers.auto`.
* `encoding` The encoding of the request body. Defaults to `"utf8"`.
* `decoding` The encoding of the response body. For a list of supported values see [Buffers](http://nodejs.org/docs/latest/api/buffers.html#buffers). Additionally accepts `"buffer"` - returns response as `Buffer`. Defaults to `"utf8"`.
* `headers` A hash of HTTP headers to be sent. Defaults to `{ 'Accept': '*/*', 'User-Agent': 'Restler for node.js' }`.
* `username` Basic auth username. Defaults to empty.
* `password` Basic auth password. Defaults to empty.
* `multipart` If set the data passed will be formated as `multipart/form-encoded`. See multipart example below. Defaults to `false`.
* `client` A http.Client instance if you want to reuse or implement some kind of connection pooling. Defaults to empty.
* `followRedirects` If set will recursively follow redirects. Defaults to `true`.


Example usage
-------------

```javascript
var sys = require('util'),
    rest = require('./restler');

rest.get('http://google.com').on('complete', function(result) {
  if (result instanceof Error) {
    sys.puts('Error: ' + result.message);
    this.retry(5000); // try again after 5 sec
  } else {
    sys.puts(result);
  }
});

rest.get('http://twaud.io/api/v1/users/danwrong.json').on('complete', function(data) {
  sys.puts(data[0].message); // auto convert to object
});

rest.get('http://twaud.io/api/v1/users/danwrong.xml').on('complete', function(data) {
  sys.puts(data[0].sounds[0].sound[0].message); // auto convert to object
});

rest.post('http://user:pass@service.com/action', {
  data: { id: 334 },
}).on('complete', function(data, response) {
  if (response.statusCode == 201) {
    // you can get at the raw response like this...
  }
});

// multipart request sending a 321567 byte long file using https
rest.post('https://twaud.io/api/v1/upload.json', {
  multipart: true,
  username: 'danwrong',
  password: 'wouldntyouliketoknow',
  data: {
    'sound[message]': 'hello from restler!',
    'sound[file]': rest.file('doug-e-fresh_the-show.mp3', null, 321567, null, 'audio/mpeg')
  }
}).on('complete', function(data) {
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
client.update('Tweeting using a Restler service thingy').on('complete', function(data) {
  sys.p(data);
});

// post JSON
var jsonData = { id: 334 };
rest.postJson('http://example.com/action', jsonData).on('complete', function(data, response) {
  // handle response
});

```

Running the tests
-----------------
install **[nodeunit](https://github.com/caolan/nodeunit)**

```bash
npm install nodeunit
```

then

```bash
node test/all.js
```

or

```bash
nodeunit test/restler.js
```

TODO
----
* What do you need? Let me know or fork.
