var fs = require('fs'),
    sys   = require('sys');

exports.defaultBoundary = '48940923NODERESLTER3890457293';

function File(path, contentType) {
  this.path = path;
  this.filename = this._basename(path);
  this.contentType = contentType || 'application/octet-stream';
}

File.prototype = {
  _basename: function(path) {
    var parts = path.split(/\/|\\/);
    return parts[parts.length - 1];
  },
  load: function() {
    var p = new process.Promise(), self = this;
    fs.cat(this.path, 'binary').addCallback(function(data) {
      self.data = data;
      p.emitSuccess();
    });
    return p;
  }
};

function Data(filename, contentType, data) {
  this.filename = filename;
  this.contentType = contentType || 'application/octet-stream';
  this.data = data;
}

function Part(name, value) {
  this.name = name;
  this.value = value;
}

Part.prototype = {
  _encodeData: function() {
    return "Content-Disposition: form-data; name=\"" + this.name + 
            "\"; filename=\"" + this.value.filename + "\"\r\n" +
            "Content-Type: " + this.value.contentType + "\r\n\r\n" + 
            this.value.data + "\r\n";
  },
  _encodeSimple: function() {
    return "Content-Disposition: form-data; name=\"" + 
            this.name + "\"\r\n\r\n" + this.value + "\r\n";
  },
  _encode: function() {
    if (this.value.data) return this._encodeData();
    else return this._encodeSimple();
  },
  encode: function(callback) {
    var self = this;
    if (this.value instanceof File) {
      this.value.load().addCallback(function() {
        callback.call(self, self._encode());
      });
    } else {
      callback.call(self, self._encode());
    }
  }
}

function Request(data, boundary) {
  this.encoding = 'binary';
  this.boundary = '--' + (boundary || exports.defaultBoundary);
  this.data = data;
  this.fieldCount = this._fieldCount();
}

Request.prototype = {
  _fieldCount: function() {
    var i = 0;
    for (var name in this.data) i++;
    return i;
  },
  eachPart: function(callback) {
    for (var name in this.data) {
      callback.call(this, new Part(name, this.data[name]));
    }
  },
  encode: function(callback) {
    var data = [], self = this;
    this.eachPart(function(part) {
      part.encode(function(encoded) {
        data.push(self.boundary + '\r\n' + encoded);
        
        if (data.length == self.fieldCount) {
          callback.call(self, data.join('') + self.boundary + '--');
        }
      });
    });
  },
  send: function(request, callback) {
    var sentCount = 0, self = this;
    this.eachPart(function(part) {
      part.encode(function(encoded) {
        request.write(self.boundary + '\r\n' + encoded, 'binary');
        sentCount++;
        
        if (sentCount == self.fieldCount) {
          request.write(self.boundary + '--', self.encoding, 'binary');
          callback.call(self);
        }
      });
    });
  }
}

process.mixin(exports, {
  file: function(path, contentType) { 
    return new File(path, contentType)
  },
  data: function(filename, contentType, data) {
    return new Data(filename, contentType, data);
  },
  encode: function(data, callback) {
    var r = new Request(data);
    r.encode(callback);
    
    return r;
  },
  send: function(request, data, callback) {
    var r = new Request(data);
    r.send(request, callback);
    
    return r;
  }
});