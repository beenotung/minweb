"use strict";
let fetch = require('node-fetch');
let jsdom = require('jsdom');
let {JSDOM} = jsdom;

module.exports = function (context, req, res) {
  let url = req.url.replace('/minWeb/', '');
  if (url === "/minWeb") {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('Please append the target url at the end' +
      '<br>Example:' +
      '<br>https://wt-2f31e8aca451cf5494a2ee7270b6a7dc-0.run.webtask.io/minWeb/https://hk.yahoo.com/');
  } else {
    res.writeHead(200, {'Content-Type': 'application/json'});
    fetch(url)
      .then(res => res.text())
      .then(text => {
        res.writeHead(200, {'Content-Type': 'text/html'});
        let dom = new JSDOM(text);
        res.end(dom.window.document.body.textContent);
      })
    // res.end(JSON.stringify(url, void 0, 2));
  }
};
