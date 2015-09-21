Restler [![NPM Version](https://img.shields.io/npm/v/restler.svg?style=flat)](https://www.npmjs.com/package/restler) ![Node Version](https://img.shields.io/node/v/restler.svg?style=flat) ![Downloads](https://img.shields.io/npm/dm/restler.svg?style=flat)
=======

(C) Dan Webb (dan@danwebb.net/@danwrong) 2011, Licensed under the MIT-LICENSE

An HTTP client library for node.js.  Hides most of the complexity of creating and using http.Client.

See [Version History](https://github.com/danwrong/restler/wiki/Version-History) for changes

Installing
----------

```
npm install restler
```

Running the tests
-----------------

```
npm test
```


Features
--------

* Easy interface for common operations via http.request
* Automatic serialization of post data
* Automatic serialization of query string data
* Automatic deserialization of XML, JSON and YAML responses to JavaScript objects
* Provide your own deserialization functions for other datatypes
* Automatic following of redirects
* Send files with multipart requests
* Transparently handle SSL (just specify https in the URL)
* Deals with basic auth for you, just provide username and password options
* Simple service wrapper that allows you to easily put together REST API libraries
* Transparently handle content-encoded responses (gzip, deflate)
* Transparently handle different content charsets via [iconv-lite](https://github.com/ashtuchkin/iconv-lite)


API
---

### request(url, options)

Basic method to make a request of any type. The function returns a RestRequest object that emits events:

#### events

* `complete: function(result, response)` - emitted when the request has finished whether it was successful or not. Gets passed the response result and the response object as arguments. If some error has occurred, `result` is always instance of `Error`, otherwise it contains response data.
* `success: function(data, response)` - emitted when the request was successful. Gets passed the response data and the response object as arguments.
* `fail: function(data, response)` - emitted when the request was successful, but 4XX or 5XX status code returned. Gets passed the response data and the response object as arguments.
* `error: function(err, response)` - emitted when some errors have occurred (eg. connection aborted, parse, encoding, decoding failed or some other unhandled errors). Gets passed the `Error` object and the response object (when available) as arguments.
* `abort: function()` - emitted when `request.abort()` is called.
* `timeout: function(ms)` - when a request takes more than the timeout option eg: {timeout:5000}, the request will be aborted. error and abort events will not be called, instead timeout will be emitted.
* `2XX`, `3XX`, `4XX`, `5XX: function(data, response)` - emitted for all requests with response codes in the range (eg. `2XX` emitted for 200, 201, 203).
* <code><i>actual response code</i>: function(data, response)</code> - emitted for every single response code (eg. 404, 201, etc).

#### members

* `abort([error])` Cancels request. `abort` event is emitted. `request.aborted` is set to `true`. If non-falsy `error` is passed, then `error` will be additionally emitted (with `error` passed as a param and `error.type` is set to `"abort"`). Otherwise only `complete` event will raise.
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

### patch(url, options)

Create a PATCH request.

### json(url, data, options)

Send json `data` via GET method.

### postJson(url, data, options)

Send json `data` via POST method.

### putJson(url, data, options)

Send json `data` via PUT method.

### patchJson(url, data, options)

Send json `data` via PATCH method.

### Parsers

You can give any of these to the parsers option to specify how the response data is deserialized.
In case of malformed content, parsers emit `error` event. Original data returned by server is stored in `response.raw`.

#### parsers.auto

Checks the content-type and then uses parsers.xml, parsers.json or parsers.yaml.
If the content type isn't recognised it just returns the data untouched.

#### parsers.json, parsers.xml, parsers.yaml

All of these attempt to turn the response into a JavaScript object. In order to use the YAML and XML parsers you must have yaml and/or xml2js installed.

### Options

* `method` Request method, can be get, post, put, delete. Defaults to `"get"`.
* `query` Query string variables as a javascript object, will override the querystring in the URL. Defaults to empty.
* `data` The data to be added to the body of the request. Can be a string or any object.
Note that if you want your request body to be JSON with the `Content-Type: application/json`, you need to
`JSON.stringify` your object first. Otherwise, it will be sent as `application/x-www-form-urlencoded` and encoded accordingly.
Also you can use `json()` and `postJson()` methods.
* `parser` A function that will be called on the returned data. Use any of predefined `restler.parsers`. See parsers section below. Defaults to `restler.parsers.auto`.
* `xml2js` [Options](https://github.com/Leonidas-from-XIV/node-xml2js#options) for xml2js
* `encoding` The encoding of the request body. Defaults to `"utf8"`.
* `decoding` The encoding of the response body. For a list of supported values see [Buffers](http://nodejs.org/api/buffer.html#buffer_buffer). Additionally accepts `"buffer"` - returns response as `Buffer`. Defaults to `"utf8"`.
* `headers` A hash of HTTP headers to be sent. Defaults to `{ 'Accept': '*/*', 'User-Agent': 'Restler for node.js' }`.
* `username` Basic auth username. Defaults to empty.
* `password` Basic auth password. Defaults to empty.
* `accessToken` OAuth Bearer Token. Defaults to empty.
* `multipart` If set the data passed will be formatted as `multipart/form-encoded`. See multipart example below. Defaults to `false`.
* `client` A http.Client instance if you want to reuse or implement some kind of connection pooling. Defaults to empty.
* `followRedirects` If set will recursively follow redirects. Defaults to `true`.
* `timeout` If set, will emit the timeout event when the response does not return within the said value (in ms)
* `rejectUnauthorized` If true, the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails. Verification happens at the connection level, before the HTTP request is sent. Default true.
* `agent` [HTTP Agent][http-agent-doc] instance to use. If not defined [globalAgent][http-global-agent-doc] will be used. If false opts out of connection pooling with an Agent, defaults request to Connection: close.

Example usage
-------------

```javascript
var rest = require('./restler');

rest.get('http://google.com').on('complete', function(result) {
  if (result instanceof Error) {
    console.log('Error:', result.message);
    this.retry(5000); // try again after 5 sec
  } else {
    console.log(result);
  }
});

rest.get('http://twaud.io/api/v1/users/danwrong.json').on('complete', function(data) {
  console.log(data[0].message); // auto convert to object
});

rest.get('http://twaud.io/api/v1/users/danwrong.xml').on('complete', function(data) {
  console.log(data[0].sounds[0].sound[0].message); // auto convert to object
});

rest.get('http://someslowdomain.com',{timeout: 10000}).on('timeout', function(ms){
  console.log('did not return within '+ms+' ms');
}).on('complete',function(data,response){
  console.log('did not time out');
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
  console.log(data.audio_url);
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
  console.log(data);
});

// post JSON
var jsonData = { id: 334 };
rest.postJson('http://example.com/action', jsonData).on('complete', function(data, response) {
  // handle response
});

// put JSON
var jsonData = { id: 334 };
rest.putJson('http://example.com/action', jsonData).on('complete', function(data, response) {
  // handle response
});

```

TODO
----
* What do you need? Let me know or fork.

[http-agent-doc]: https://nodejs.org/api/http.html#http_class_http_agent
[http-global-agent-doc]: https://nodejs.org/api/http.html#http_http_globalagent 