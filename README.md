Restler
-------

(C) Dan Webb (dan@danwebb.net) 2009, Licensed under the MIT-LICENSE

An HTTP client library for node.js.  Hides most of the complexity of creating and using http.Client. Very early days yet.

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
    })
