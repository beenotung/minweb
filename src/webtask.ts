import {main} from "./main";
import {Theme} from "./theme";

const unescape = require("querystring").unescape;

export interface Response {
  writeHead(statusCode: number, headers: any)

  end(html: string);
}

const htmlHeader = {
  "Content-Type": "text/html"
};
const body_to_html = (body: string) => `<html><head><meta charset="UTF-8"></head>${body}</html>`;

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

<table>
<tbody>
<tr><td><label for="url">URL</label></td><td><input name="url"></td></tr>
<tr><td><label for="theme">Theme</label></td><td><select name="theme">${theme_str}</select></td></tr>
<tr><td><label for="no_script">No Script</label></td><td><input name="no_script" type="checkbox" checked></td></tr>
<tr><td><label for="no_style">No Style</label></td><td><input name="no_style" type="checkbox"></td></tr>
<tr><td><label for="no_img">No Image</label></td><td><input name="no_img" type="checkbox"></td></tr>
</tbody>
</table>
<script>
function getOption(name){
  return document.getElementsByName(name)[0].checked ? "&" + name + "=true" : "";
}
function go(){
  location.href += "?"
    + "theme=" +document.getElementsByName('theme')[0].value
    + getOption('no_script')
    + getOption('no_style')
    + getOption('no_img')
    + "&url=" + document.getElementsByName('url')[0].value;
    ;
}
</script>
<button onclick="go()">Go</button>

<h2>Use from URL</h2>
<p>
Append the target url at the end<br>
Example:<br>
https://wt-2f31e8aca451cf5494a2ee7270b6a7dc-0.run.webtask.io/minWeb/https://hk.yahoo.com/
</p>
`));
}

function handleProxy(context, req: Request, res: Response) {
  let url: string = req.url.replace('/minWeb', '');
  if (url[0] == '/') {
    url = url.substring(1);
  }
  let skipTags: string[] = [];
  let theme: Theme;
  if (url[0] == '?') {
    url = url.substring(1);
    for (; ;) {
      if (url.startsWith('theme=')) {
        theme = url.split('&')[0].replace('theme=', '') as Theme;
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
  const hrefPrefix = req.url.split('url=')[0] + 'url=';
  if (!'tes') {
    res.writeHead(200, htmlHeader);
    res.end(body_to_html(`<pre>${hrefPrefix}</pre>`));
    return;
  }
  main(url, {skipTags, theme, hrefPrefix})
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
