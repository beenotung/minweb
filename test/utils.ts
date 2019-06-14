import * as fs from 'fs';
import * as util from 'util';

const fetch = require('node-fetch');

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

export async function saveFile(filename: string, content: string) {
  console.log('save', content.length, 'chars to', filename);
  return writeFile(filename, content);
}

export function catchMain(p: Promise<any>) {
  p.catch(e => {
    console.error(e);
    process.exit(1);
  });
}

interface TestFunction {
  (html: string, name: string): Promise<void> | void
}

export function testUrl(test: TestFunction, url: string) {
  catchMain(fetch(url)
    .then(x => x.text())
    .then(html => test(html, url)));
}

export function testFile(test: TestFunction, filename: string) {
  catchMain(readFile(filename).then(f => test(f.toString(), filename)));
}
