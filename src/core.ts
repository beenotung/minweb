import {Attribute, parseHTMLText} from "./parser";
import {TextDecorator, Theme, ThemeStyles} from "./theme";

const noop = () => {
};

export interface MinifyHTMLOptions {
  textDecorator?: TextDecorator
  theme?: Theme
  skipTags?: string[]
  url?: string
  hrefPrefix?: string
}

const attrsToString = (attrs: Attribute[]) =>
  attrs
    .map(a =>
      a.value
        ? a.name + "=" + a.value
        : a.name
    )
    .join(' ')
;

function url_to_protocol(s: string): string {
  return s.split('://')[0];
}

function url_to_host(s: string): string {
  let ss = s.split('://');
  ss.shift();
  s = ss.join('://');
  return s.split('/')[0];
}

function url_to_base(s: string): string {
  if (s.endsWith(url_to_host(s))) {
    return s + '/';
  }
  const ss = s.split('/');
  const last = ss.pop();
  return ss.join('/') + '/';
}

export function minifyHTML(s: string, options?: MinifyHTMLOptions): string {
  if (!s || !s.trim()) {
    return '';
  }
  const res = [];
  const skipTags: string[] = (options && options.skipTags) ? options.skipTags : [
    'script'
    // , 'style'
    // , 'link'
    , 'img'
  ];
  const hrefPrefix = (options && options.hrefPrefix) ? options.hrefPrefix : '';
  const addPrefix = (s: string) =>
    (s[0] == '"' || s[0] == "'")
      ? s.replace(s[0], s[0] + hrefPrefix)
      : hrefPrefix + s
  ;
  const url: string = (options && options.url) ? options.url : '';
  const protocol = url_to_protocol(url);
  const host = url_to_host(url);
  const base = url_to_base(url);
  const fixUrl = (url: string) => {
    console.error('before:' + url);
    let wrapper: string = '';
    if (url.startsWith('"') && url.endsWith('"')) {
      wrapper = '"';
    } else if (url.startsWith("'") && url.endsWith("'")) {
      wrapper = "'";
    }
    if (wrapper) {
      url = url.substring(1, url.length - 1);
    }
    url = url[0] == '/'
      ? protocol + '://' + host + url
      : (
        url.startsWith('http://') || url.startsWith('https://')
          ? url
          : base + url
      );
    if (wrapper) {
      url = wrapper + url + wrapper;
    }
    console.error('after:' + url);
    return url;
  };
  console.error(s);
  console.error("total length:", s.length);
  let tagName: string;
  parseHTMLText(s, 0, {
    oncommand: (name, attrs) => res.push(`<!${name}${attrs.length > 0 ? " " + attrsToString(attrs) : ""}>`)
    // , oncomment: text => res.push(`<!--${text}-->`)
    , oncomment: noop
    , onopentag: (name, attrs) => {
      tagName = name;
      if (skipTags.indexOf(name) !== -1) {
        return;
      }
      if (skipTags.indexOf('style') !== -1) {
        attrs = attrs.filter(a => a.name !== 'style');
        console.error({attrs});
      }
      if (url) {
        if (name == 'a') {
          attrs.forEach(a => {
            if (a.name == 'href' && a.value) {
              a.value = addPrefix(fixUrl(a.value));
            }
          })
        } else if (name == 'link') {
          attrs.forEach(a => {
            if (a.name == 'href' && a.value) {
              a.value = fixUrl(a.value);
            }
          })
        } else if (name == 'img') {
          attrs.forEach(a => {
            if (a.name == 'src' && a.value) {
              a.value = fixUrl(a.value);
            }
          })
        } else if (name == 'base' && '') {
          /* breaking image links on some sites */
          attrs.forEach(a => {
            if (a.name == 'href' && a.value) {
              a.value = hrefPrefix;
            }
          })
        } else if (name == 'form' && '') {
          /* doesn't work */
          console.error('checking form');
          const method = attrs.find(a => a.name.toLowerCase() == 'method');
          if (method && method.value) {
            switch (method.value.toLowerCase()) {
              case 'get':
              case '"get"':
              case "'get'":
                attrs.forEach(a => {
                  if (a.name == 'action' && a.value) {
                    a.value = addPrefix(fixUrl(a.value));
                    console.error("added prefix:" + a.value);
                  }
                });
                break;
            }
          }
        }
      }
      res.push(`<${name}${attrs.length > 0 ? " " + attrsToString(attrs) : ""}>`)
    }
    , ontext: text => {
      if (skipTags.indexOf(tagName) != -1) {
        return;
      }
      if (options && options.textDecorator) {
        text = options.textDecorator(text);
      }
      res.push(text);
    }
    , onclosetag: (name) => {
      if (skipTags.indexOf(name) != -1) {
        return;
      }
      res.push(`</${name}>`)
    }
  });
  const theme = (options && options.theme || 'default');
  res.push(ThemeStyles.get(theme));
  // res.push(`<script>document.baseURI='${hrefPrefix}'</script>`);
  return res.join('');
}
