import * as fs from 'fs';
import { logNode, parseHtml } from '../src/new/core';

const fetch = require('node-fetch');

function test(html: string) {
  console.log('== input html ==');
  console.log(html);
  console.log('================');

  const root = parseHtml(html);

  let restructuredHtml = root.textContent;
  if (restructuredHtml !== html) {
    console.log('not matched');
    console.log();
    console.log('== restructured html ==');
    console.log(restructuredHtml);
    console.log('=======================');
  } else {
    console.log('matched');
  }

  console.log();
  console.log('== parsed root == ');
  logNode(root);
  console.log('================= ');
  // const s2 = topLevel.map(htmlItem_to_string_no_comment).join('');
  // console.error(s2);
}

function testUrl(url: string) {
  fetch(url)
    .then(x => x.text())
    .then(html => test(html));
}

function testFile(filename: string) {
  test(fs.readFileSync(filename).toString());
}

// testUrl('http://yahoo.hk');
// testUrl('https://www.forbes.com/sites/jennifercohen/2014/06/18/5-proven-methods-for-gaining-self-discipline/');
// testFile('demo/link.html');
testFile('demo/mobile.html');
