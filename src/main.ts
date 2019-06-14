// import * as fetch from "isomorphic-fetch"
// let fetch = require("isomorphic-fetch").fetch;
import { MinifyHTMLOptions } from './core';
import { minifyHTML } from './new/core';

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
    .then(s => {
      if (htmlWatcher) {
        htmlWatcher(s);
      }
      return (
        minifyHTML(s, options) + `\n<!--- url=${url} chars=${s.length} -->`
      );
    })
    .catch(e => {
      console.error(e);
      return Promise.reject(e);
    });
}
