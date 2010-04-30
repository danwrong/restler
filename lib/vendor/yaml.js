// (The MIT License)
// 
// Copyright (c) 2009 TJ Holowaychuk tj@vision-media.ca
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

YAML = {
  
  /**
   * Value of the given _token_.
   *
   * The following conversion are made, otherwise
   * the _token_ is passed to eval().
   *
   *   true  | yes | on    // => true
   *   false | no  | off   // => false
   *
   * @param  {string} token
   * @return {mixed}
   * @api private
   */
  
  valueOf: function(token) {
    switch (token) {
      case 'true':
      case 'yes':
      case 'on':
        return true
        
      case 'false':
      case 'no':
      case 'off':
        return false
        
      default:
        return eval('(' + token + ')')
    }
  },
  
  /**
   * Tokenize _str_.
   *
   * @param  {string} str
   * @return {array}
   * @api private
   */
  
  tokenize: function(str) {
    return str.match(/(---|true|yes|on|false|no|off|null|#(.*)|\[(.*?)\]|\{(.*?)\}|[\w\-]+:|-(.+)|\d+\.\d+|\d+|\n+)/g)
  },
  
  /**
   * Strip leading / trailing whitespace from _str_.
   *
   * @param  {string} str
   * @return {string}
   * @api private
   */
  
  strip: function(str) {
    return str.replace(/^\s*|\s*$/g, '')
  },
  
  /**
   * Parse the given _tokens_.
   *
   * @param  {array} tokens
   * @return {array}
   * @api private
   */
  
  parse: function(tokens) {
    var token, list = /^-(.*)/, key = /^([\w\-]+):/, stack = {}
    while (token = tokens.shift())
      if (token[0] == '#' || token == '---' || token == "\n") 
        continue
      else if (key.exec(token) && tokens[0] == "\n")
        stack[RegExp.$1] = this.parse(tokens)
      else if (key.exec(token))
        stack[RegExp.$1] = this.valueOf(tokens.shift())
      else if (list.exec(token))
        (stack.constructor == Array ?
          stack : (stack = [])).push(this.strip(RegExp.$1))
    return stack
  },
  
  /**
   * Evaluate the given YAML _str_.
   *
   * @param  {string} str
   * @return {hash}
   * @api public
   */
  
  eval: function(str) {
    return this.parse(this.tokenize(str))
  }
};

Object.keys(YAML).forEach(function(yamlKey) {
  exports[yamlKey] = YAML[yamlKey]
})