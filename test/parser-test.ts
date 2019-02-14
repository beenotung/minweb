const fetch = require('node-fetch');
import {htmlItem_to_string, htmlItem_to_string_no_comment, parseHTMLTree} from "../src/parser";

function test(url: string) {
  fetch(url)
    .then(x => x.text())
    .then(s1 => {
      const topLevel = parseHTMLTree(s1);
      const s2 = topLevel.map(htmlItem_to_string_no_comment).join('');
      console.log(s1);
      console.error(s2);
    })
}

// test('http://yahoo.hk');
test('https://www.forbes.com/sites/jennifercohen/2014/06/18/5-proven-methods-for-gaining-self-discipline/');
