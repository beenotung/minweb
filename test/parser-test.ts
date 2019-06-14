import { htmlItem_to_string_no_comment, parseHTMLTree } from '../src/parser';
import { saveFile, testFile } from './utils';


async function test(s1: string) {
  const topLevel = parseHTMLTree(s1);
  const s2 = topLevel.map(htmlItem_to_string_no_comment).join('');
  await Promise.all([
    saveFile('in.html', s1),
    saveFile('out.html', s2),
  ]);
}

// testUrl(test, 'http://yahoo.hk');
// testUrl(test, 'https://www.forbes.com/sites/jennifercohen/2014/06/18/5-proven-methods-for-gaining-self-discipline/');
testFile(test, 'demo/a.html');
