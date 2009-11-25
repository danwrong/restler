function URI(uri) {
  var matches = URI.uriRegex.exec(uri);
  
  URI.keys.forEach(function(key, i) {
	   this[key] = matches[i] || '';
	}, this);
	 
	var query = {};
	
	this.queryString.replace(URI.queryRegex, function ($0, $1, $2) {
		if ($1) query[$1] = $2;
	});
	
	this.query = query;
	
	if (!this.path) this.path = '/';
	this.fullPath = this.path;
	if (this.queryString) this.fullPath += "?" + this.queryString;
}

URI.keys = ["source","protocol","authority","userInfo","user","password","host",
	          "port","relative","path","directory","file","queryString","anchor"];
URI.uriRegex = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
URI.queryRegex = /(?:^|&)([^&=]*)=?([^&]*)/g

URI.prototype = {
  
}

exports.encode = function(obj) {
  
}

exports.decode = function(query) {
  
}

exports.parse = function(uri) {
  return new URI(uri);
}