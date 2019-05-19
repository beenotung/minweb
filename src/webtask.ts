import {main} from "./main";
import {Theme} from "./theme";
import {MinifyHTMLOptions} from "./core";

const unescape = require("querystring").unescape;

export interface Response {
  writeHead(statusCode: number, headers: any)

  end(html: string);
}

const htmlHeader = {
  "Content-Type": "text/html"
};
const body_to_html = (body: string) => `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>Minify Web Page</title>
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="format-detection" content="telephone=no">
  <meta name="msapplication-tap-highlight" content="no">
</head>
<${body}>
</html>`;

function handleUI(context, req: Request, res: Response) {
  res.writeHead(200, htmlHeader);
  const theme_str = [
    'Default'
    , 'Light'
    , 'Dark'
    , 'Console'
  ].map(s => `<option value="${s.toLowerCase()}">${s}</option>`).join('');
  res.end(body_to_html(`<body>
</body><h1>Minify Webpage</h1>

<a href="https://github.com/beenotung/minweb">
  <img style="position: absolute; top: 0; right: 0; border: 0;"
       src="https://camo.githubusercontent.com/38ef81f8aca64bb9a64448d0d70f1308ef5341ab/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f72696768745f6461726b626c75655f3132313632312e706e67"
       alt="Fork me on GitHub"
       data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png"></a>
<script>
function checkKey(event){
  if(event.keyCode==13||event.key=="Enter"){
    event.preventDefault();
    go();
    return false;
  }
}
</script>
<table>
<tbody>
<tr><td><label for="url">URL</label></td><td><input name="url" onkeydown="checkKey(event)" onkeypress="checkKey(event)"></td></tr>
<tr><td><label for="theme">Theme</label></td><td><select name="theme">${theme_str}</select></td></tr>
<tr><td><label for="text_mode">Text Mode</label></td><td><input name="text_mode" type="checkbox"></td></tr>
<tr><td><label for="article_mode">Article Mode</label></td><td><input name="article_mode" type="checkbox"></td></tr>
<tr><td><label for="no_script">No Script</label></td><td><input name="no_script" type="checkbox" checked></td></tr>
<tr><td><label for="no_iframe">No IFrame</label></td><td><input name="no_iframe" type="checkbox" checked></td></tr>
<tr><td><label for="no_style">No Style</label></td><td><input name="no_style" type="checkbox"></td></tr>
<tr><td><label for="no_img">No Image</label></td><td><input name="no_img" type="checkbox"></td></tr>
<tr><td><label for="inject_style">Readable Enhancement</label></td><td><input name="inject_style" type="checkbox"></td></tr>
</tbody>
</table>
<script>
function getOption(name){
  return document.getElementsByName(name)[0].checked ? "&" + name + "=true" : "";
}
function go(){
  location.href += "?"
    + "theme=" +document.getElementsByName('theme')[0].value
    + getOption('text_mode')
    + getOption('article_mode')
    + getOption('no_script')
    + getOption('no_iframe')
    + getOption('no_style')
    + getOption('no_img')
    + getOption('inject_style')
    + "&url=" + document.getElementsByName('url')[0].value;
    ;
}
</script>
<button onclick="go()">Go</button>

<h2>Use from URL</h2>
<p>
Append the target url at the end
</p>
Examples:
<style>li{margin: 0.5em;}ul{margin: 0;}</style>
<ul>
<li><a href="#" onclick="location.href=this.textContent">https://wt-2f31e8aca451cf5494a2ee7270b6a7dc-0.run.webtask.io/minWeb/https://hk.yahoo.com/</a></li>
<li><a href="#" onclick="location.href=this.textContent">https://wt-2f31e8aca451cf5494a2ee7270b6a7dc-0.run.webtask.io/minWeb/?theme=default&no_script=true&url=yahoo.hk</a></li>
</ul>
`));
}

function handleProxy(context, req: Request, res: Response) {
  let url: string = req.url.replace('/minWeb', '');
  if (url[0] == '/') {
    url = url.substring(1);
  }
  let skipTags: string[] = [];
  let options: MinifyHTMLOptions = {skipTags};
  if (url[0] == '?') {
    url = url.substring(1);
    for (; ;) {
      if (url.startsWith('theme=')) {
        options.theme = url.split('&')[0].replace('theme=', '') as Theme;
      } else if (url.startsWith('text_mode=true')) {
        options.text_mode = true;
      } else if (url.startsWith('inject_style=true')) {
        options.inject_style = true;
      } else if (url.startsWith('article_mode=true')) {
        options.article_mode = true;
      } else if (url.startsWith('no_iframe=true')) {
        skipTags.push("iframe");
      } else if (url.startsWith('no_script=true')) {
        skipTags.push("script");
      } else if (url.startsWith('no_style=true')) {
        skipTags.push("style", "link");
      } else if (url.startsWith('no_img=true')) {
        skipTags.push("img");
      } else if (url.startsWith('url=')) {
        url = url.replace('url=', '');
        break;
      } else {
        res.writeHead(400, htmlHeader);
        res.end(body_to_html(`<h1>Error</h1>Invalid url: <pre>${url}</pre>`));
        return;
      }
      url = url.substring(url.indexOf('&') + 1);
    }
  }
  if (url.indexOf('%') != -1) {
    url = encodeURI(unescape(url));
  }
  url = url ? ('http://' + url) : url;
  if (url.startsWith('http://http://') || url.startsWith('http://https://')) {
    url = url.replace('http://', '');
  }
  options.hrefPrefix = req.url.split('url=')[0] + 'url=';
  if (!'tes') {
    res.writeHead(200, htmlHeader);
    res.end(body_to_html(`<pre>${options.hrefPrefix}</pre>`));
    return;
  }
  main(url, options)
    .then(html => {
      res.writeHead(200, htmlHeader);
      res.end(html);
    })
    .catch(e => {
        res.writeHead(500, htmlHeader);
        res.end(body_to_html(`
<h1>Error</h1>
<p>Failed to parse destination html</p>
<p>url = <code>${url}</code></p>
<code>${e.toString()}</code>
`
        ));
      }
    )
}

module.exports = function (context, req: Request, res: Response) {
  if (req.url.startsWith('/minWeb?') || req.url.startsWith('/minWeb/?')) {
    return handleProxy(context, req, res);
  }
  if (req.url.startsWith('/minWeb/')) {
    let url = req.url.replace('/minWeb/', '');
    if (url.length === 0) {
      return handleUI(context, req, res);
    }
    return handleProxy(context, req, res);
  }
  if (req.url.endsWith('/minWeb')) {
    return handleUI(context, req, res);
  }
};
