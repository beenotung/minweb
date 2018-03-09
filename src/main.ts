// import * as fetch from "isomorphic-fetch"
// let fetch = require("isomorphic-fetch").fetch;
let fetch = require("node-fetch");
import {Theme} from "./theme";
import {minifyHTML} from "./core";

export function main(url: string, skipTags: string[] = [], theme?: Theme) {
  const options = arguments.length > 1 ? {skipTags, theme} : undefined;
  return fetch(url)
    .then(x => x.text())
    .then(s => minifyHTML(s, options))
}
