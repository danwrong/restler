// From Narwhal (http://github.com/kriskowal/narwhal/)
// original code: http://code.google.com/p/js-uri/

// Based on the regex in RFC2396 Appendix B.
var URI_RE = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/;

// Based on: http://data.iana.org/TLD/tlds-alpha-by-domain.txt
var TLDS = exports.TLDS = [
    "AC","AD","AE","AERO","AF","AG","AI","AL","AM","AN","AO","AQ","AR","ARPA","AS","ASIA","AT","AU","AW","AX","AZ",
    "BA","BB","BD","BE","BF","BG","BH","BI","BIZ","BJ","BM","BN","BO","BR","BS","BT","BV","BW","BY","BZ",
    "CA","CAT","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","COM","COOP","CR","CU","CV","CX","CY","CZ",
    "DE","DJ","DK","DM","DO","DZ",
    "EC","EDU","EE","EG","ER","ES","ET","EU",
    "FI","FJ","FK","FM","FO","FR",
    "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GOV","GP","GQ","GR","GS","GT","GU","GW","GY",
    "HK","HM","HN","HR","HT","HU",
    "ID","IE","IL","IM","IN","INFO","INT","IO","IQ","IR","IS","IT",
    "JE","JM","JO","JOBS","JP",
    "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ",
    "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
    "MA","MC","MD","ME","MG","MH","MIL","MK","ML","MM","MN","MO","MOBI","MP","MQ","MR","MS","MT","MU","MUSEUM","MV","MW","MX","MY","MZ",
    "NA","NAME","NC","NE","NET","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
    "OM","ORG",
    "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PRO","PS","PT","PW","PY",
    "QA",
    "RE","RO","RS","RU","RW",
    "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","ST","SU","SV","SY","SZ",
    "TC","TD","TEL","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TP","TR","TRAVEL","TT","TV","TW","TZ",
    "UA","UG","UK","US","UY","UZ",
    "VA","VC","VE","VG","VI","VN","VU",
    "WF","WS",
    "XN",
    "YE","YT","YU",
    "ZA","ZM","ZW"
];


/**
 * Uniform Resource Identifier (URI) - RFC3986
 */
var URI = exports.URI = function(str) {
    if (!str) str = "";
    var result = str.match(URI_RE);
    this.scheme = result[1] || null;
    this.authority = result[2] || null;
    this.path = result[3] || null;
    this.query = result[4] || null;
    this.fragment = result[5] || null;
}

/**
 * Convert the URI to a String.
 */
URI.prototype.toString = function () {
    var str = "";
 
    if (this.scheme)
        str += this.scheme + ":";

    if (this.authority)
        str += "//" + this.authority;

    if (this.path)
        str += this.path;

    if (this.query)
        str += "?" + this.query;

    if (this.fragment)
        str += "#" + this.fragment;
 
    return str;
}

exports.parse = URI.parse = function(uri) {
    return new URI(uri);
}

exports.unescape = URI.unescape = function(str, plus) {
    return decodeURI(str).replace(/\+/g, " ");
}

exports.unescapeComponent = URI.unescapeComponent = function(str, plus) {
    return decodeURIComponent(str).replace(/\+/g, " ");
}

// from Chiron's HTTP module:

/**** keys
    members of a parsed URI object.
*/
exports.keys = [
    "url",
    "protocol",
    "authorityRoot",
    "authority",
        "userInfo",
            "user",
            "password",
        "domain",
            "domains",
        "port",
    "path",
        "root",
        "directory",
            "directories",
        "file",
    "query",
    "anchor"
];

/**** expressionKeys
    members of a parsed URI object that you get
    from evaluting the strict regular expression.
*/
exports.expressionKeys = [
    "url",
    "protocol",
    "authorityRoot",
    "authority",
        "userInfo",
            "user",
            "password",
        "domain",
        "port",
    "path",
        "root",
        "directory",
        "file",
    "query",
    "anchor"
];

/**** strictExpression
*/
exports.strictExpression = new RegExp( /* url */
    "^" +
    "(?:" +
        "([^:/?#]+):" + /* protocol */
    ")?" +
    "(?:" +
        "(//)" + /* authorityRoot */
        "(" + /* authority */
            "(?:" +
                "(" + /* userInfo */
                    "([^:@]*)" + /* user */
                    ":?" +
                    "([^:@]*)" + /* password */
                ")?" +
                "@" +
            ")?" +
            "([^:/?#]*)" + /* domain */
            "(?::(\\d*))?" + /* port */
        ")" +
    ")?" +
    "(" + /* path */
        "(/?)" + /* root */
        "((?:[^?#/]*/)*)" +
        "([^?#]*)" + /* file */
    ")" +
    "(?:\\?([^#]*))?" + /* query */
    "(?:#(.*))?" /*anchor */
);

/**** Parser
    returns a URI parser function given
    a regular expression that renders 
    `expressionKeys` and returns an `Object`
    mapping all `keys` to values.
*/
exports.Parser = function (expression) {
    return function (url) {
        if (typeof url == "undefined")
            throw new Error("HttpError: URL is undefined");
        if (typeof url != "string") return new Object(url);

        var items = {};
        var parts = expression.exec(url);

        for (var i = 0; i < parts.length; i++) {
            items[exports.expressionKeys[i]] = parts[i] ? parts[i] : "";
        }

        items.root = (items.root || items.authorityRoot) ? '/' : '';

        items.directories = items.directory.split("/");
        if (items.directories[items.directories.length - 1] == "") {
            items.directories.pop();
        }

        /* normalize */
        var directories = [];
        for (var i = 0; i < items.directories.length; i++) {
            var directory = items.directories[i];
            if (directory == '.') {
            } else if (directory == '..') {
                if (directories.length && directories[directories.length - 1] != '..')
                    directories.pop();
                else
                    directories.push('..');
            } else {
                directories.push(directory);
            }
        }
        items.directories = directories;

        items.domains = items.domain.split(".");

        return items;
    };
};

/**** parse
    a strict URI parser.
*/
exports.parse = exports.Parser(exports.strictExpression);

/**** format
    accepts a parsed URI object and returns
    the corresponding string.
*/
exports.format = function (object) {
    if (typeof(object) == 'undefined')
        throw new Error("UrlError: URL undefined for urls#format");
    if (object instanceof String || typeof(object) == 'string')
        return object;
    var domain =
        object.domains ?
        object.domains.join(".") :
        object.domain;
    var userInfo = (
            object.user ||
            object.password 
        ) ?
        (
            (object.user || "") + 
            (object.password ? ":" + object.password : "") 
        ) :
        object.userInfo;
    var authority = (
            userInfo ||
            domain ||
            object.port
        ) ? (
            (userInfo ? userInfo + "@" : "") +
            (domain || "") + 
            (object.port ? ":" + object.port : "")
        ) :
        object.authority;
    var directory =
        object.directories ?
        object.directories.join("/") :
        object.directory;
    var path =
        directory || object.file ?
        (
            (directory ? directory + "/" : "") +
            (object.file || "")
        ) :
        object.path;
    return (
        (object.protocol ? object.protocol + ":" : "") +
        (authority ? "//" + authority : "") +
        (object.root || (authority && path) ? "/" : "") +
        (path ? path : "") +
        (object.query ? "?" + object.query : "") +
        (object.anchor ? "#" + object.anchor : "")
    ) || object.url || "";
};

/**** resolveObject
    returns an object representing a URL resolved from
    a relative location and a source location.
*/
exports.resolveObject = function (source, relative) {
    if (!source) 
        return relative;

    source = exports.parse(source);
    relative = exports.parse(relative);

    if (relative.url == "")
        return source;

    delete source.url;
    delete source.authority;
    delete source.domain;
    delete source.userInfo;
    delete source.path;
    delete source.directory;

    if (
        relative.protocol && relative.protocol != source.protocol ||
        relative.authority && relative.authority != source.authority
    ) {
        source = relative;
    } else {
        if (relative.root) {
            source.directories = relative.directories;
        } else {

            var directories = relative.directories;
            for (var i = 0; i < directories.length; i++) {
                var directory = directories[i];
                if (directory == ".") {
                } else if (directory == "..") {
                    if (source.directories.length) {
                        source.directories.pop();
                    } else {
                        source.directories.push('..');
                    }
                } else {
                    source.directories.push(directory);
                }
            }

            if (relative.file == ".") {
                relative.file = "";
            } else if (relative.file == "..") {
                source.directories.pop();
                relative.file = "";
            }
        }
    }

    if (relative.root)
        source.root = relative.root;
    if (relative.protcol)
        source.protocol = relative.protocol;
    if (!(!relative.path && relative.anchor))
        source.file = relative.file;
    source.query = relative.query;
    source.anchor = relative.anchor;

    return source;
};

/**** relativeObject
    returns an object representing a relative URL to
    a given target URL from a source URL.
*/
exports.relativeObject = function (source, target) {
    target = exports.parse(target);
    source = exports.parse(source);

    delete target.url;

    if (
        target.protocol == source.protocol &&
        target.authority == source.authority
    ) {
        delete target.protocol;
        delete target.authority;
        delete target.userInfo;
        delete target.user;
        delete target.password;
        delete target.domain;
        delete target.domains;
        delete target.port;
        if (
            !!target.root == !!source.root && !(
                target.root &&
                target.directories[0] != source.directories[0]
            )
        ) {
            delete target.path;
            delete target.root;
            delete target.directory;
            while (
                source.directories.length &&
                target.directories.length &&
                target.directories[0] == source.directories[0]
            ) {
                target.directories.shift();
                source.directories.shift();
            }
            while (source.directories.length) {
                source.directories.shift();
                target.directories.unshift('..');
            }

            if (!target.root && !target.directories.length && !target.file && source.file)
                target.directories.push('.');

            if (source.file == target.file)
                delete target.file;
            if (source.query == target.query)
                delete target.query;
            if (source.anchor == target.anchor)
                delete target.anchor;
        }
    }

    return target;
};

/**** resolve
    returns a URL resovled to a relative URL from a source URL.
*/
exports.resolve = function (source, relative) {
    return exports.format(exports.resolveObject(source, relative));
};

/**** relative
    returns a relative URL to a target from a source.
*/
exports.relative = function (source, target) {
    return exports.format(exports.relativeObject(source, target));
};
