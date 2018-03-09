import * as fetch from "isomorphic-fetch"
import {minifyHTML} from "./core";

let url = "https://en.wikipedia.org/wiki/Gem%C3%BCtlichkeit";
url = "https://hk.yahoo.com/";

fetch(url)
  .then(x => x.text())
  .then(s => console.log(minifyHTML(s, {
    // textDecorator: debugTextDecorator
    theme: 'dark'
    // theme: 'light'
    // theme: 'console'
  })));
