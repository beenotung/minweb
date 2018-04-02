const fetch = require('node-fetch');
import {htmlItem_to_string, parseHTMLTree} from "../src/parser";

function test(url: string) {
  fetch(url)
    .then(x => x.text())
    .then(s1 => {
      const topLevel = parseHTMLTree(s1);
      const s2 = topLevel.map(htmlItem_to_string).join('');
      console.log(s1);
      console.error(s2);
    })
}

test('http://yahoo.hk');
