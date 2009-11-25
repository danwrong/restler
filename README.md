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
