import * as readArt from 'read-art';
import { saveFile, testUrl } from './utils';

const logTo = { console: false, file: true };

export let lib = {};

async function test(html: string, name: string) {
  // console.log('testing:', name);
  html = html.trim();

  const article = await readArt(html);
  lib = article;

  const outHtml = `
<html>
<head>
<meta charset="UTF-8">
<title>${article.title}</title>
</head>
<body>
<h1>${article.title}</h1>
<p>${article.content}</p>
</body>
</html>
`.trim();
  await Promise.all([
    saveFile('in.html', html),
    saveFile('out.html', outHtml),
  ]);
}

testUrl(test, 'https://s.nextmedia.com/realtime/a.php?i=20190806&s=7015342&a=59901011');
