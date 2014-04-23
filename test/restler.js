var rest   = require('../lib/restler'),
    http   = require('http'),
    util    = require('util'),
    path   = require('path'),
    fs     = require('fs'),
    crypto = require('crypto');

var port = 9000;
var hostname = 'localhost';
var host = 'http://' + hostname + ':' + port;

var nodeunit = require('nodeunit');
nodeunit.assert.re = function(actual, expected, message) {
  if (!new RegExp(expected).test(actual)) {
    nodeunit.assert.fail(actual, expected, message, '~=', nodeunit.assert.re);
  }
};


function setup(response) {
  return function(next) {
    this.server = http.createServer(response);
    this.server.listen(port, hostname, next);
  };
}

function teardown() {
  return function (next) {
    if (this.server._handle) {
      this.server.close();
    }
    process.nextTick(next);
  };
}


function echoResponse(request, response) {
  if (request.headers['x-connection-abort'] == 'true') {
    request.connection.destroy();
    return;
  }
  var echo = [];
  echo.push(request.method + ' ' + request.url + ' HTTP/' + request.httpVersion);
  for (var header in request.headers) {
    echo.push(header + ': ' + request.headers[header]);
  }
  echo.push('', '');
  echo = echo.join('\r\n');

  request.addListener('data', function(chunk) {
    echo += chunk.toString('binary');
  });

  request.addListener('end', function() {
    response.writeHead(request.headers['x-status-code'] || 200, {
      'content-type': 'text/plain',
      'content-length': echo.length,
      'request-method': request.method.toLowerCase()
    });
    setTimeout(function() {
      response.end(request.method == 'HEAD' ? undefined : echo);
    }, request.headers['x-delay'] | 0);
  });
}

module.exports['Basic'] = {

  setUp: setup(echoResponse),
  tearDown: teardown(),

  'Should GET': function (test) {
    rest.get(host).on('complete', function(data) {
      test.re(data, /^GET/, 'should be GET');
      test.done();
    });
  },

  'Should PATCH': function(test) {
    rest.patch(host).on('complete', function(data) {
      test.re(data, /^PATCH/, 'should be PATCH');
      test.done();
    });
  },

  'Should PUT': function(test) {
    rest.put(host).on('complete', function(data) {
      test.re(data, /^PUT/, 'should be PUT');
      test.done();
    });
  },

  'Should POST': function(test) {
    rest.post(host).on('complete', function(data) {
      test.re(data, /^POST/, 'should be POST');
      test.done();
    });
  },

  'Should DELETE': function(test) {
    rest.del(host).on('complete', function(data) {
      test.re(data, /^DELETE/, 'should be DELETE');
      test.done();
    });
  },

  'Should HEAD': function(test) {
    rest.head(host).on('complete', function(data, response) {
      test.equal(response.headers['request-method'], 'head', 'should be HEAD');
      test.done();
    });
  },

  'Should GET withouth path': function(test) {
    rest.get(host).on('complete', function(data) {
      test.re(data, /^GET \//, 'should hit /');
      test.done();
    });
  },

  'Should GET path': function(test) {
      rest.get(host + '/thing').on('complete', function(data) {
        test.re(data, /^GET \/thing/, 'should hit /thing');
        test.done();
      });
    },

  'Should preserve query string in url': function(test) {
    rest.get(host + '/thing?boo=yah').on('complete', function(data) {
      test.re(data, /^GET \/thing\?boo\=yah/, 'should hit /thing?boo=yah');
      test.done();
    });
  },

  'Should serialize query': function(test) {
    rest.get(host, { query: { q: 'balls' } }).on('complete', function(data) {
      test.re(data, /^GET \/\?q\=balls/, 'should hit /?q=balls');
      test.done();
    });
  },

  'Should POST body': function(test) {
    rest.post(host, { data: 'balls' }).on('complete', function(data) {
      test.re(data, /\r\n\r\nballs/, 'should have balls in the body');
      test.done();
    });
  },

  'Should serialize POST body': function(test) {
    rest.post(host, { data: { q: 'balls' } }).on('complete', function(data) {
      test.re(data, /content-type\: application\/x-www-form-urlencoded/, 'should set content-type');
      test.re(data, /content-length\: 7/, 'should set content-length');
      test.re(data, /\r\n\r\nq=balls/, 'should have balls in the body');
      test.done();
    });
  },

  'Should send headers': function(test) {
    rest.get(host, {
      headers: { 'Content-Type': 'application/json' }
    }).on('complete', function(data) {
      test.re(data, /content\-type\: application\/json/, 'should have "content-type" header');
      test.done();
    });
  },

  'Should send Bearer auth': function(test) {
    rest.post(host, { accessToken: 't0k3n' }).on('complete', function(data) {
      test.re(data, /authorization\: Bearer t0k3n/, 'should have "authorization "header');
      test.done();
    });
  },

  'Should send basic auth': function(test) {
    rest.post(host, { username: 'danwrong', password: 'flange' }).on('complete', function(data) {
      test.re(data, /authorization\: Basic ZGFud3Jvbmc6Zmxhbmdl/, 'should have "authorization "header');
      test.done();
    });
  },

  'Should send basic auth with blank password': function(test) {
    rest.post(host, { username: 'danwrong', password: '' }).on('complete', function(data) {
      test.re(data, /authorization\: Basic ZGFud3Jvbmc6/, 'should have "authorization "header');
      test.done();
    });
  },

  'Should send basic auth if in url': function(test) {
    rest.post('http://danwrong:flange@' + hostname + ':' + port).on('complete', function(data) {
      test.re(data, /authorization\: Basic ZGFud3Jvbmc6Zmxhbmdl/, 'should have "authorization" header');
      test.done();
    });
  },

  'Should fire 2XX and 200 events': function(test) {
    test.expect(3);
    rest.get(host).on('2XX', function() {
      test.ok(true);
    }).on('200', function() {
      test.ok(true);
    }).on('complete', function() {
      test.ok(true);
      test.done();
    });
  },

  'Should fire fail, 4XX and 404 events for 404': function(test) {
    test.expect(4);
    rest.get(host, { headers: { 'x-status-code': 404 }}).on('fail', function() {
      test.ok(true);
    }).on('4XX', function() {
      test.ok(true);
    }).on('404', function() {
      test.ok(true);
    }).on('complete', function() {
      test.ok(true);
      test.done();
    });
  },

  'Should fire error and complete events on connection abort': function(test) {
    test.expect(2);
    rest.get(host, { headers: { 'x-connection-abort': 'true' }}).on('error', function() {
      test.ok(true);
    }).on('complete', function() {
      test.ok(true);
      test.done();
    });
  },

  'Should correctly retry': function(test) {
    var counter = 0;
    rest.get(host, { headers: { 'x-connection-abort': 'true' }}).on('complete', function() {
      if (++counter < 3) {
        this.retry(10);
      } else {
        test.ok(true);
        test.done();
      }
    });
  },

  'Should correctly retry after abort': function(test) {
    var counter = 0;
    rest.get(host).on('complete', function() {
      if (++counter < 3) {
        this.retry().abort();
      } else {
        test.ok(true);
        test.done();
      }
    }).abort();
  },

  'Should correctly retry while pending': function(test) {
    var counter = 0, request;
    function command() {
      var args = [].slice.call(arguments);
      var method = args.shift();
      if (method) {
        setTimeout(function() {
          request[method]();
          command.apply(null, args);
        }, 50);
      }
    }

    request = rest.get(host, { headers: { 'x-delay': '1000' } }).on('complete', function() {
      if (++counter < 3) {
        command('retry', 'abort');
      } else {
        test.ok(true);
        test.done();
      }
    });
    command('abort');
  }

};

module.exports['Multipart'] = {

  setUp: setup(echoResponse),
  tearDown: teardown(),

  'Test multipart request with simple vars': function(test) {
    rest.post(host, {
      data: { a: 10, b: 'thing' },
      multipart: true
    }).on('complete', function(data) {
      test.re(data, /content-type\: multipart\/form-data/, 'should set "content-type" header');
      test.re(data, /name="a"(\s)+10/, 'should send a=10');
      test.re(data, /name="b"(\s)+thing/, 'should send b=thing');
      test.re(data, /content-length: 200/, 'should send content-length header');

      test.done();
    });
  },

  'Test multipart request with Data vars': function(test) {
    rest.post(host, {
      data: {
        a: 10,
        b: rest.data('b.txt', 'text/plain', 'thing'),
        c: rest.data('c.txt', 'text/plain', new Buffer('thing'))
      },
      multipart: true
    }).on('complete', function(data) {
      test.re(data, /content-type\: multipart\/form-data/, 'should set "content-type" header');
      test.re(data, /name="a"(\s)+10/, 'should send a=10');
      test.re(data, /name="b"; filename="b.txt"\s+Content-Length: 5\s+Content-Type: text\/plain\s+thing\s/, 'should send b=thing');
      test.re(data, /name="c"; filename="c.txt"\s+Content-Length: 5\s+Content-Type: text\/plain\s+thing\s/, 'should send c=thing');
      test.re(data, /content-length: 410/, 'should send content-length header');

      test.done();
    });
  },

};


function dataResponse(request, response) {
  switch (request.url) {
    case '/json':
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{ "ok": true }');
      break;
    case '/xml':
      response.writeHead(200, { 'content-type': 'application/xml' });
      response.end('<document><ok>true</ok></document>');
      break;
    case '/yaml':
      response.writeHead(200, { 'content-type': 'application/yaml' });
      response.end('ok: true');
      break;
    case '/gzip':
      response.writeHead(200, { 'content-encoding': 'gzip' });
      response.end(Buffer('H4sIAAAAAAAAA0vOzy0oSi0uTk1RSEksSUweHFwADdgOgJYAAAA=', 'base64'));
      break;
    case '/deflate':
      response.writeHead(200, { 'content-encoding': 'deflate' });
      response.end(Buffer('eJxLzs8tKEotLk5NUUhJLElMHhxcAI9GO1c=', 'base64'));
      break;
    case '/truth':
      response.writeHead(200, {
        'content-encoding': 'deflate',
        'content-type': 'application/json'
      });
      response.end(Buffer('eJw1i0sKgDAQQ++S9Sj+cDFXEReCoy2UCv0oIt7dEZEsEvKSC4eZErjoCTaCr5uQjICHilQjYfLxkAD+g/IN3BCcXXT3GSF7u0uI2vjs3HubwW1ZdwRRcCZj/QpOIcv9ACXbJLo=', 'base64'));
      break;
    case '/binary':
      response.writeHead(200);
      response.end(Buffer([9, 30, 64, 135, 200]));
      break;
    case '/push-json':
      var echo = '';
      request.addListener('data', function(chunk) {
        echo += chunk.toString('binary');
      });
      request.addListener('end', function() {
        response.writeHead(200, {
          'content-type': 'application/json'
        });
        response.end(JSON.stringify(JSON.parse(echo)));
      });
      break;
    case '/custom-mime':
      response.writeHead(200, {
        'content-type': 'application/vnd.github.beta.raw+json; charset=UTF-8'
      });
      response.end(JSON.stringify([6,6,6]));
      break;
    case '/mal-json':
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('Чебурашка');
      break;
    case '/mal-xml':
      response.writeHead(200, { 'content-type': 'application/xml' });
      response.end('Чебурашка');
      break;
    case '/mal-yaml':
      response.writeHead(200, { 'content-type': 'application/yaml' });
      response.end('{Чебурашка');
      break;
    case '/abort':
      setTimeout(function() {
        response.writeHead(200);
        response.end('not aborted');
      }, 100);
      break;
    case '/charset':
      response.writeHead(200, {
        'content-type': 'text/plain; charset=windows-1251'
      });
      response.end(Buffer('e0e1e2e3e4e5b8e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff', 'hex'));
      break;
    case '/timeout':
      setTimeout(function() {
        response.writeHead(200);
        response.end('that took a while');
      }, 100);
      break;
    default:
      response.writeHead(404);
      response.end();
  }
}

module.exports['Deserialization'] = {

  setUp: setup(dataResponse),
  tearDown: teardown(),

  'Should parse JSON': function(test) {
    rest.get(host + '/json').on('complete', function(data) {
      test.equal(data.ok, true, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should parse XML': function(test) {
    rest.get(host + '/xml').on('complete', function(data, response) {
      test.equal(data.document.ok[0], 'true', 'returned: ' + response.raw + ' parsed to ' + util.inspect(data));
      test.done();
    });
  },

  'Should parse YAML': function(test) {
    rest.get(host + '/yaml').on('complete', function(data) {
      test.equal(data.ok, true, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should gunzip': function(test) {
    rest.get(host + '/gzip').on('complete', function(data) {
      test.re(data, /^(compressed data){10}$/, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should inflate': function(test) {
    rest.get(host + '/deflate').on('complete', function(data) {
      test.re(data, /^(compressed data){10}$/, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should decode and parse': function(test) {
    rest.get(host + '/truth').on('complete', function(data) {
      var expected = {
            what: -6,
            is: {},
            the: [ 0, 0, 0 ],
            answer: 'answer',
            to: 2,
            life: 'life',
            universe: null,
            and: 3.14,
            everything: true
          };
      test.deepEqual(data, expected, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should decode as buffer': function(test) {
    rest.get(host + '/binary', { decoding: 'buffer' }).on('complete', function(data) {
      test.ok(data instanceof Buffer, 'should be buffer');
      test.equal(data.toString('base64'), 'CR5Ah8g=', 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should decode as binary': function(test) {
    rest.get(host + '/binary', { decoding: 'binary' }).on('complete', function(data) {
      test.ok(typeof data == 'string', 'should be string: ' + util.inspect(data));
      test.equal(data, '\t\u001e@È', 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should decode as base64': function(test) {
    rest.get(host + '/binary', { decoding: 'base64' }).on('complete', function(data) {
      test.ok(typeof data == 'string', 'should be string: ' + util.inspect(data));
      test.equal(data, 'CR5Ah8g=', 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should post and parse JSON': function(test) {
    var obj = { secret : 'very secret string' };
    rest.post(host + '/push-json', {
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify(obj)
    }).on('complete', function(data) {
      test.equal(obj.secret, data.secret, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should post and parse JSON via shortcut method': function(test) {
    var obj = { secret : 'very secret string' };
    rest.postJson(host + '/push-json', obj).on('complete', function(data) {
      test.equal(obj.secret, data.secret, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should put and parse JSON via shortcut method': function(test) {
    var obj = { secret : 'very secret string' };
    rest.putJson(host + '/push-json', obj).on('complete', function(data) {
      test.equal(obj.secret, data.secret, 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should understand custom mime-type': function(test) {
    rest.parsers.auto.matchers['application/vnd.github+json'] = function(data, callback) {
      rest.parsers.json.call(this, data, function(err, data) {
        if (!err) {
          data.__parsedBy__ = 'github';
        }
        callback(err, data);
      });
    };
    rest.get(host + '/custom-mime').on('complete', function(data) {
      test.expect(3);
      test.ok(Array.isArray(data), 'should be array, returned: ' + util.inspect(data));
      test.equal(data.join(''), '666', 'should be [6,6,6], returned: ' + util.inspect(data));
      test.equal(data.__parsedBy__, 'github', 'should use vendor-specific parser, returned: ' + util.inspect(data.__parsedBy__));
      test.done();
    });
  },

  'Should correctly soft-abort request': function(test) {
    test.expect(4);
    rest.get(host + '/abort').on('complete', function(data) {
      test.equal(data, null, 'data should be null');
      test.equal(this.aborted, true, 'should be aborted');
      test.done();
    }).on('error', function(err) {
        test.ok(false, 'should not emit error event');
      }).on('abort', function(err) {
        test.equal(err, null, 'err should be null');
        test.equal(this.aborted, true, 'should be aborted');
      }).on('success', function() {
        test.ok(false, 'should not emit success event');
      }).on('fail', function() {
        test.ok(false, 'should not emit fail event');
      }).abort();
  },

  'Should correctly hard-abort request': function(test) {
    test.expect(4);
    rest.get(host + '/abort').on('complete', function(data) {
      test.ok(data instanceof Error, 'should be error, got: ' + util.inspect(data));
      test.equal(this.aborted, true, 'should be aborted');
      test.done();
    }).on('error', function(err) {
        test.ok(err instanceof Error, 'should be error, got: ' + util.inspect(err));
      }).on('abort', function(err) {
        test.equal(this.aborted, true, 'should be aborted');
      }).on('success', function() {
        test.ok(false, 'should not emit success event');
      }).on('fail', function() {
        test.ok(false, 'should not emit fail event');
      }).abort(true);
  },

  'Should correctly handle malformed JSON': function(test) {
    test.expect(4);
    rest.get(host + '/mal-json').on('complete', function(data, response) {
      test.ok(data instanceof Error, 'should be instanceof Error, got: ' + util.inspect(data));
      test.re(data.message, /^Failed to parse/, 'should contain "Failed to parse", got: ' + util.inspect(data.message));
      test.equal(response.raw, 'Чебурашка', 'should be "Чебурашка", got: ' + util.inspect(response.raw));
      test.done();
    }).on('error', function(err) {
      test.ok(err instanceof Error, 'should be instanceof Error, got: ' + util.inspect(err));
    }).on('success', function() {
      test.ok(false, 'should not have got here');
    }).on('fail', function() {
      test.ok(false, 'should not have got here');
    });
  },

  'Should correctly handle malformed XML': function(test) {
    test.expect(4);
    rest.get(host + '/mal-xml').on('complete', function(data, response) {
      test.ok(data instanceof Error, 'should be instanceof Error, got: ' + util.inspect(data));
      test.re(data.message, /^Failed to parse/, 'should contain "Failed to parse", got: ' + util.inspect(data.message));
      test.equal(response.raw, 'Чебурашка', 'should be "Чебурашка", got: ' + util.inspect(response.raw));
      test.done();
    }).on('error', function(err) {
      test.ok(err instanceof Error, 'should be instanceof Error, got: ' + util.inspect(err));
    }).on('success', function() {
      test.ok(false, 'should not have got here');
    }).on('fail', function() {
      test.ok(false, 'should not have got here');
    });
  },

  'Should correctly handle malformed YAML': function(test) {
    test.expect(4);
    rest.get(host + '/mal-yaml').on('complete', function(data, response) {
      test.ok(data instanceof Error, 'should be instanceof Error, got: ' + util.inspect(data));
      test.re(data.message, /^Failed to parse/, 'should contain "Failed to parse", got: ' + util.inspect(data.message));
      test.equal(response.raw, '{Чебурашка', 'should be "{Чебурашка", got: ' + util.inspect(response.raw));
      test.done();
    }).on('error', function(err) {
      test.ok(err instanceof Error, 'should be instanceof Error, got: ' + util.inspect(err));
    }).on('success', function() {
      test.ok(false, 'should not have got here');
    }).on('fail', function() {
      test.ok(false, 'should not have got here');
    });
  }

};


module.exports['Deserialization']['Should correctly convert charsets '] = function(test) {
  rest.get(host + '/charset').on('complete', function(data) {
    test.equal(data, 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя');
    test.done();
  });
};


function redirectResponse(request, response) {
  if (request.url == '/redirected') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('redirected');
  } else if (request.url == '/') {
    response.writeHead(301, {
      'location': host + '/' + (request.headers['x-redirects'] ? '1' : 'redirected')
    });
    response.end('redirect');
  } else {
    var count = parseInt(request.url.substr(1), 10);
    var max = parseInt(request.headers['x-redirects'], 10);
    response.writeHead(count < max ? 301 : 200, {
      'location': host + '/' + (count + 1)
    });
    response.end(count.toString(10));
  }
}

module.exports['Redirect'] = {

  setUp: setup(redirectResponse),
  tearDown: teardown(),

  'Should follow redirects': function(test) {
    rest.get(host).on('complete', function(data) {
      test.equal(data, 'redirected', 'returned: ' + util.inspect(data));
      test.done();
    });
  },

  'Should follow multiple redirects': function(test) {
    rest.get(host, {
      headers: { 'x-redirects': '5' }
    }).on('complete', function(data) {
      test.equal(data, '5', 'returned: ' + util.inspect(data));
      test.done();
    });
  }

};


function contentLengthResponse(request, response) {
  response.writeHead(200, { 'content-type': 'text/plain' });
  if ('content-length' in request.headers) {
    response.write(request.headers['content-length']);
  } else {
    response.write('content-length is not set');
  }
  response.end();
}

module.exports['Content-Length'] = {

  setUp: setup(contentLengthResponse),
  tearDown: teardown(),

  'JSON content length': function(test) {
    rest.post(host, {
      data: JSON.stringify({ greeting: 'hello world' })
    }).on('complete', function(data) {
      test.equal(26, data, 'should set content-length');
      test.done();
    });
  },

  'JSON multibyte content length': function (test) {
    rest.post(host, {
      data: JSON.stringify({ greeting: 'こんにちは世界' })
    }).on('complete', function(data) {
      test.equal(36, data, 'should byte-size content-length');
      test.done();
    });
  },

  'None data request content length': function (test) {
    rest.post(host).on('complete', function(data) {
      test.equal(0, data, 'should set content-length');
      test.done();
    });
  }

};

module.exports['Timeout'] = {
  setUp: setup(dataResponse),
  tearDown: teardown(),

  'will timeout within given time': function(test) {
    rest.get(host + '/timeout', {timeout: 50})
    .on('timeout', function () {
      test.ok(true, 'timeout endpoint is 100ms and timeout was 50ms');
      test.done();
    })
    .on('complete', function () {
      test.ok(false, 'should not emit complete event');
    });
  }
};
