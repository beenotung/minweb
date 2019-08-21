import { minifyHTML } from '../src/core';
import { saveFile, testUrl } from './utils';

async function test(html: string, name: string) {
  // console.log('testing:', name);
  const outHtml: string = await minifyHTML(html, { article_mode: true });
  await Promise.all([
    saveFile('in.html', html),
    saveFile('out.html', outHtml),
  ]);
}

testUrl(test, 'https://s.nextmedia.com/realtime/a.php?i=20190806&s=7015342&a=59901011');
