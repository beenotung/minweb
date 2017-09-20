const cheerio = require('cheerio');
const fetch = require('node-fetch');

fetch('https://.com/cheeriojs/cheerio')
.then(x=>x.text())
.then(x=> {
    console.log('loaded',x.length,'chars');
    let $ = cheerio.load(x);

    let es = $('html').children();
});
