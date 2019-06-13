import * as fs from 'fs';
import { parseHtml, wrapNode } from '../src/new/core';

const fetch = require('node-fetch');

const logTo = { console: false, file: true };

function test(html: string) {
  if (logTo.console) {
    console.log('== input html ==');
    console.log(html);
    console.log('================');
  }

  const root = parseHtml(html);
  const wrappedNode = wrapNode(root);

  const restructuredHtml = root.outerHTML;
  if (restructuredHtml !== html) {
    console.log('not matched');
    if (logTo.file) {
      fs.writeFileSync('in.html', html);
      fs.writeFileSync('out.html', restructuredHtml);
      fs.writeFileSync('out-in-len.html', restructuredHtml.substr(0, html.length));
      fs.writeFileSync('out-extra.html', restructuredHtml.substr(html.length));
      fs.writeFileSync('root.json', JSON.stringify(root, null, 2));
      fs.writeFileSync('wrapped-root.json', JSON.stringify(wrappedNode, null, 2));
    }
    if (logTo.console) {
      console.log();
      console.log('== restructured html ==');
      console.log(restructuredHtml);
      console.log('=======================');
    }
  } else {
    console.log('matched');
  }

  if (logTo.console) {
    console.log();
    console.log('== parsed root == ');
    console.log(JSON.stringify(wrappedNode, null, 2));
    console.log('================= ');
  }
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
// testFile('demo/a.html');
// testFile('demo/mobile.html');
// testFile('demo/comment.html');
// testFile('demo/not-closed.html');
// testFile('demo/style.html');
// testFile('demo/script.html');
// testFile('demo/link.html');
// testFile('demo/link-compact.html');
testFile('demo/json.html');
