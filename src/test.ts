import * as fetch from "isomorphic-fetch"
import {minifyHTML} from "./core";


const url = "https://en.wikipedia.org/wiki/Gem%C3%BCtlichkeit";
fetch(url)
  .then(x => x.text())
  .then(s => console.log(minifyHTML(s, {
    // textDecorator: debugTextDecorator
    theme: 'dark'
    // theme: 'light'
    // theme: 'console'
  })));
