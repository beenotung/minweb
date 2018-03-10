// import * as fetch from "isomorphic-fetch"
// let fetch = require("isomorphic-fetch").fetch;
import {minifyHTML, MinifyHTMLOptions} from "./core";

const fetch = require("node-fetch");

function checkUrl(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    if (s.charCodeAt(i) > 255) {
      return encodeURI(s);
    }
  }
  return s;
}

export async function main(url: string, options?: MinifyHTMLOptions) {
  if (!options) {
    options = {url}
  } else {
    options.url = url;
  }
  return fetch(checkUrl(url))
    .then(x => x.text())
    .then(s =>
      minifyHTML(s, options)
      + `<!--- url=${url} chars=${s.length} -->`
    )
}
