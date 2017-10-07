"use strict";
let fetch = require('node-fetch');
// let jsdom = require('jsdom');
// let {JSDOM} = jsdom;
let Xray = require('x-ray');
let x = Xray();

let url = 'https://hk.yahoo.com/';

console.log('start to fetch', url);
fetch(url)
  .then(res => res.text())
  .then(text => {
    console.log('fetched', text.length, 'words');
//     let dom = new JSDOM(text);
//     console.log('dom', dom);
//     console.log(dom.window.document.querySelector("p").textContent);
  });

x(url, 'html@html')(function (err, header) {
  if (err) {
    throw err;
  }
  console.log('header', header.length);
  console.log(header);
});
