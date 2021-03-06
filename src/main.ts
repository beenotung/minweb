import { minifyHTML } from './core';
import { MinifyHTMLOptions } from './helpers';

const fetch = require('node-fetch');

function checkUrl(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    if (s.charCodeAt(i) > 255) {
      return encodeURI(s);
    }
  }
  return s;
}

export async function main(
  url: string,
  options?: MinifyHTMLOptions,
  htmlWatcher?: (s: string) => void,
): Promise<string> {
  if (!options) {
    options = { url };
  } else {
    options.url = url;
  }
  return fetch(checkUrl(url))
    .then(x => x.text())
    .then(async html => {
      if (htmlWatcher) {
        htmlWatcher(html);
      }
      const minifiedHtml = await minifyHTML(html, options);
      const p =
        Math.round((minifiedHtml.length / html.length) * 100 * 100) / 100;
      return (
        minifiedHtml +
        `\n<!--- url=${url} ori-chars=${html.length} minified-to=${p}% -->`
      );
    })
    .catch(e => {
      console.error(e);
      return Promise.reject(e);
    });
}
