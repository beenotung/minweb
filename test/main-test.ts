import {unescape} from "querystring";
import {main} from "../src/main";

const fetch = require("node-fetch");

let url = "https://en.wikipedia.org/wiki/Gem%C3%BCtlichkeit";
url = "https://hk.yahoo.com/";
url = 'https://hk.style.yahoo.com/%E8%82%89%E5%A5%B3%E8%88%87%E8%83%96%E5%A5%B3-033000246.html';
url = 'http://beeno-tung.surge.sh';
url = 'https://maps.google.com.hk/maps?f=q&geocode=&q=22.316776,114.167558(%E5%AE%B6%E5%AE%B6%E7%A6%AE%E5%93%81%E6%8F%9B%E9%A0%98%E4%B8%AD%E5%BF%83%EF%BC%9A%E6%97%BA%E8%A7%92%E5%BB%A3%E6%9D%B1%E9%81%93+982+%E8%99%9F%E5%98%89%E5%AF%8C%E5%95%86%E6%A5%AD%E4%B8%AD%E5%BF%83+17+%E6%A8%93%E5%85%A8%E5%B1%A4+-+%E6%97%BA%E8%A7%92%E6%B8%AF%E9%90%B5%E7%AB%99+E1+%E5%87%BA%E5%8F%A3+)&z=17&iwloc=A';
url = encodeURI(unescape('https%3A%2F%2Fhk.celebrity.yahoo.com%2F%E6%B9%AF%E6%B4%9B%E9%9B%AF%E8%88%87%E7%BE%85%E5%A4%A9%E5%AE%87%E5%88%86%E6%89%8B%E5%9B%9B%E5%80%8B%E6%9C%88-%E7%AC%AC%E4%B8%89%E8%80%85%E5%8E%9F%E4%BE%86%E4%BF%82-065231528.html'));
url = 'https://games.yahoo.com.tw/';
url = 'https://r.search.yahoo.com/cbclk/dWU9QjdCODZBRTlCNzQ2NEFFNSZ1dD0xNTIwNjE3ODE2MTg5JnVvPTcxOTQ5MzI3MjU5ODAwJmx0PTImZXM9QXQwLlNkd0dQUy4yeEpwbw--/RV=2/RE=1520646616/RO=10/RU=https%3a%2f%2f139138531.r.bat.bing.com%2f%3fld%3dd3-ALI12sUzyccKnkWzVxwcTVUCUyK7Cg53lfeS07QngoGb0g12Hlar5Zez7ZR-LLMhpRleMPRWaYOrbsb4g-kLKveSeWQeUS6r1PUGJamBDOjz1eh-tTcHQNrRUo7m7kvmFRJYIVnsTYuMSVwQSL5JO6wxf0%26u%3dhttps%253a%252f%252fad.doubleclick.net%252fddm%252fclk%252f404337215%253b204394749%253bg/RK=2/RS=d63UcC5UFER0RobH2Uooqqf8tVU-';
url = 'https://hk.celebrity.yahoo.com/%E7%9B%B8%E9%9A%9417%E5%B9%B4%E8%BF%94%E7%84%A1%E7%B6%AB%E6%8B%8D%E5%8A%87-%E5%8D%83%E5%AC%85-%E7%82%BA%E6%BC%94%E8%97%9D%E5%B7%A5%E4%BD%9C%E5%A2%9E%E5%80%BC-224532527.html';
url = 'https://hkuspace.hku.hk/#';
url = 'https://hk.search.yahoo.com/search;_ylt=A2oKmJX33KJaSUQAywWzygt.;_ylc=X1MDMjExNDcwMjAwMwRfcgMyBGZyA3lmcC1zZWFyY2gtdG4EZ3ByaWQDSGh6MDVEVUFRTEN4ZkJ1OWFDQ2I1QQRuX3JzbHQDMARuX3N1Z2cDMTAEb3JpZ2luA2hrLnNlYXJjaC55YWhvby5jb20EcG9zAzAEcHFzdHIDBHBxc3RybAMwBHFzdHJsAzYEcXVlcnkDc2VhcmNoBHRfc3RtcAMxNTIwNjIyNzg0?p=search&fr2=sb-top&fr=yfp-search-tn';
url = 'https://hk.news.yahoo.com/%E8%B2%AA%E7%8E%A9%E7%94%9F%E5%90%9E%E9%BC%BB%E6%B6%95%E8%9F%B2-%E6%BE%B3%E6%B4%B2%E9%9D%92%E5%B9%B4%E6%9F%93%E5%AF%84%E7%94%9F%E8%9F%B2%E8%87%B4%E7%99%B1%E7%98%93-064100120.html';
url = 'http://yahoo.hk';

main(url, {
  // textDecorator: debugTextDecorator
  theme: 'dark'
  // theme: 'light'
  // theme: 'console'
  , skipTags: [
    "script"
    , "style"
    , "link"
  ]
  , url: url
  , hrefPrefix: 'https://minweb.surge.sh?url='
  // , article_mode: true
  // , text_mode: true
}, s => console.error(s))
  .then(s => console.log(s))
;
