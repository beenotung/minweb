import { parseHtmlDocument, wrapNode } from '../src/new/parser';
import { saveFile, testFile, testUrl } from './utils';

const logTo = { console: false, file: true };

async function test(html: string, name: string) {
  html = html.trim();
  if (logTo.console) {
    console.log('== input html ==');
    console.log(html);
    console.log('================');
  }

  const root = parseHtmlDocument(html);
  const wrappedNode = wrapNode(root);

  const restructuredHtml = root.outerHTML;
  if (restructuredHtml !== html) {
    console.log('not matched:', name);
    if (logTo.file) {
      await Promise.all([
        saveFile('in.html', html),
        saveFile('out.html', restructuredHtml),
        saveFile('out-in-len.html', restructuredHtml.substr(0, html.length)),
        saveFile('out-extra.html', restructuredHtml.substr(html.length)),
        saveFile('root.json', JSON.stringify(root, null, 2)),
        saveFile('wrapped-root.json', JSON.stringify(wrappedNode, null, 2)),
      ]);
    }
    if (logTo.console) {
      console.log();
      console.log('== restructured html ==');
      console.log(restructuredHtml);
      console.log('=======================');

      console.log();
      console.log('== parsed root == ');
      console.log(JSON.stringify(wrappedNode, null, 2));
      console.log('================= ');
    }
    process.exit(1);
  } else {
    console.log('matched:', name);
  }

  // const s2 = topLevel.map(htmlItem_to_string_no_comment).join('');
  // console.error(s2);
}

testFile(test, 'demo/a.html');
testFile(test,'demo/input.html');
testFile(test, 'demo/mobile.html');
testFile(test, 'demo/comment.html');
testFile(test, 'demo/not-closed.html');
testFile(test, 'demo/wrongly-closed-not-match-parent.html');
testFile(test, 'demo/wrongly-closed-match-parent.html');
testFile(test, 'demo/style.html');
testFile(test, 'demo/script.html');
testFile(test, 'demo/link.html');
testFile(test, 'demo/json.html');
testFile(test, 'demo/svg.html');
testUrl(test, 'http://yahoo.hk');
testUrl(test, 'https://www.forbes.com/sites/jennifercohen/2014/06/18/5-proven-methods-for-gaining-self-discipline/');
testUrl(test, 'https://www.jessicahk.com/articles/qing-gan-ce-shi-kan-ni-shi-fou-hao-se-nu');
