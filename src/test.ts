import * as fetch from "isomorphic-fetch"
import {parseHTMLText} from "./core";

const url = "https://en.wikipedia.org/wiki/Gem%C3%BCtlichkeit";
fetch(url)
  .then(x => x.text())
  .then(s => console.log(parseHTMLText(s, 0, {onopentag})))
