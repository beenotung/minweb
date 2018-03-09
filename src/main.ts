// import * as fetch from "isomorphic-fetch"
// let fetch = require("isomorphic-fetch").fetch;
const fetch = require("node-fetch");
import {Theme} from "./theme";
import {minifyHTML, MinifyHTMLOptions} from "./core";

export interface MainOptions {
  skipTags?: string[]
  theme?: Theme
  hrefPrefix  ?: string
}

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
      + `<hr><div style="text-align: center"><a href="#" onclick="
location.href=location.href.indexOf('url=')!==-1
?location.href.substring(location.href.indexOf('url=')+'url='.length)
:location.href.replace(location.origin,'').replace('/minWeb/','')
">Opt-Out</a></div>`
    )
}
