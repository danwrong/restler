var helper = require ('./test_helper'),
    rest = require('../lib/restler'),
    sys  = require('sys');
    
helper.testCase("Basic Tests", helper.echoServer, {
  testRequestShouldTakePath: function(host, test) {
    rest.get(host + '/thing').addListener('complete', function(data) {
      test.assertTrue(/^GET \/thing/.test(data), 'should hit /thing');
    });
  },
  testRequestShouldWorkWithNoPath: function(host, test) {
   rest.get(host).addListener('complete', function(data) {
     test.assertTrue(/^GET \//.test(data), 'should hit /');
   });
  },
  testRequestShouldWorkPreserveQueryStringInURL: function(host, test) {
   rest.get(host + '/thing?boo=yah').addListener('complete', function(data) {
     test.assertTrue(/^GET \/thing\?boo\=yah/.test(data), 'should hit /thing?boo=yah');
   });
  },
  testRequestShouldBeAbleToGET: function(host, test) {
   rest.get(host).addListener('complete', function(data) {
     test.assertTrue(/^GET/.test(data), 'should be GET');
   });
  },
  testRequestShouldBeAbleToPUT: function(host, test) {
   rest.put(host).addListener('complete', function(data) {
     test.assertTrue(/^PUT/.test(data), 'should be PUT');
   });
  },
  testRequestShouldBeAbleToPOST: function(host, test) {
   rest.post(host).addListener('complete', function(data) {
     test.assertTrue(/^POST/.test(data), 'should be POST');
   });
  },
  testRequestShouldBeAbleToDELETE: function(host, test) {
   rest.del(host).addListener('complete', function(data) {
     test.assertTrue(/^DELETE/.test(data), 'should be DELETE');
   });
  },
  testRequestShouldSerializeQuery: function(host, test) {
    rest.get(host, { query: { q: 'balls' } }).addListener('complete', function(data) {
      test.assertTrue(/^GET \/\?q\=balls/.test(data), 'should hit /?q=balls');
    });
  },
  testRequestShouldPostBody: function(host, test) {
    rest.post(host, { data: "balls" }).addListener('complete', function(data) {
      test.assertTrue(/\r\n\r\nballs/.test(data), 'should have balls in the body')
    });
  },
  testRequestShouldSerializePostBody: function(host, test) {
    rest.post(host, { data: { q: 'balls' } }).addListener('complete', function(data) {
      test.assertTrue(/content-type\: application\/x-www-form-urlencoded/.test(data), 
                      'should set content-type');
      test.assertTrue(/content-length\: 7/.test(data), 'should set content-length');
      test.assertTrue(/\r\n\r\nq=balls/.test(data), 'should have balls in the body')
    });
  },
  testRequestShouldSendHeaders: function(host, test) {
    rest.get(host, {
      headers: { 'Content-Type': 'application/json' }
    }).addListener('complete', function(data) {
      test.assertTrue(/content\-type\: application\/json/.test(data), 'should content type header')
    });
  },
  testRequestShouldSendBasicAuth: function(host, test) {
    rest.post(host, { username: 'danwrong', password: 'flange' }).addListener('complete', function(data) {
      test.assertTrue(/authorization\: Basic ZGFud3Jvbmc6Zmxhbmdl/.test(data), 'should have auth header')
    });
  },
  testRequestShouldSendBasicAuthIfInURL: function(host, test) {
    var port = host.match(/\:(\d+)/)[1];
    host = "http://danwrong:flange@localhost:" + port;
    rest.post(host).addListener('complete', function(data) {
      test.assertTrue(/authorization\: Basic ZGFud3Jvbmc6Zmxhbmdl/.test(data), 'should have auth header')
    });
  },
  testRequestShouldFire2XXAnd200Events: function(host, test) {
    var count = 0;
    
    rest.get(host).addListener('2XX', function() {
      count++;
    }).addListener('200', function() {
      count++;
    }).addListener('complete', function() {
      test.assertEquals(2, count);
    });
  },
  testRequestShouldFireError4XXand404EventsFor404: function(host, test) {
    var count = 0;
    
    rest.get(host, { headers: { 'X-Give-Me-Status': 404 }}).addListener('error', function() {
      count++;
    }).addListener('4XX', function() {
      count++;
    }).addListener('404', function() {
      count++;
    }).addListener('complete', function() {
      test.assertEquals(3, count);
    });
  }
});
 
helper.testCase('Multipart Tests', helper.echoServer, {
 testMultipartRequestWithSimpleVars: function(host, test) {
   rest.post(host, {
     data: { a: 1, b: 'thing' },
     multipart: true
   }).addListener('complete', function(data) {
     test.assertTrue(/content-type\: multipart\/form-data/.test(data), 'should set content type')
     test.assertTrue(/name="a"(\s)+1/.test(data), 'should send a=1');
     test.assertTrue(/name="b"(\s)+thing/.test(data), 'should send b=thing');
   });
 }
});


helper.testCase("Deserialization Tests", helper.dataServer, {
  testAutoSerializerShouldParseJSON: function(host, test) {
    rest.get(host, {
      headers: { 'Accepts': 'application/json' }
    }).addListener('complete', function(data) {
      test.assertEquals(true, data.ok, "returned " + sys.inspect(data));
    });
  },
  testAutoSerializerShouldParseXML: function(host, test) {
    rest.get(host, {
      headers: { 'Accepts': 'application/xml' }
    }).addListener('complete', function(data) {
      test.assertEquals("true", data.document.ok, "returned " + sys.inspect(data));
    });
  },
  testAutoSerializerShouldParseYAML: function(host, test) {
    rest.get(host, {
      headers: { 'Accepts': 'application/yaml' }
    }).addListener('complete', function(data) {
      test.assertEquals(true, data.ok, "returned " + sys.inspect(data));
    });
  }
});

helper.testCase('Redirect Tests', helper.redirectServer, {
  testShouldAutomaticallyFollowRedirects: function(host, test) {
    rest.get(host).addListener('complete', function(data) {
      test.assertEquals('Hell Yeah!', data, "returned " + sys.inspect(data));
    });
  }
});