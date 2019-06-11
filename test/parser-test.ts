import * as fs from 'fs';
import { htmlItem_to_string_no_comment, parseHTMLTree } from '../src/parser';

const fetch = require('node-fetch');

function test(s1: string) {
  const topLevel = parseHTMLTree(s1);
  const s2 = topLevel.map(htmlItem_to_string_no_comment).join('');
  console.log(s1);
  console.error(s2);
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
testFile('demo/link.html');
