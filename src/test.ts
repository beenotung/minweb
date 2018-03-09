const fetch = require("node-fetch");
import {minifyHTML} from "./core";

let url = "https://en.wikipedia.org/wiki/Gem%C3%BCtlichkeit";
url = "https://hk.yahoo.com/";
url = 'https://hk.style.yahoo.com/%E8%82%89%E5%A5%B3%E8%88%87%E8%83%96%E5%A5%B3-033000246.html';

fetch(url)
  .then(x => x.text())
  .then(s => console.log(minifyHTML(s, {
    // textDecorator: debugTextDecorator
    theme: 'dark'
    // theme: 'light'
    // theme: 'console'
  })));
