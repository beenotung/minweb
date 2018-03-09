import {Attribute, parseHTMLText} from "./parser";
import {TextDecorator, Theme, ThemeStyles} from "./theme";

const noop = () => {
};


export interface MinifyHTMLOptions {
  textDecorator?: TextDecorator
  theme?: Theme
  skipTags?: string[]
  url?: string
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
  const res = [];
  const skipTags: string[] = (options && options.skipTags) ? options.skipTags : [
    'script'
    // , 'style'
    // , 'link'
    , 'img'
  ];
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
        if (name == 'a' || name == 'link') {
          attrs.forEach(a => {
            if (a.name == 'href' && a.value) {
              a.value = fixUrl(a.value);
            }
          })
        } else if (name == 'img') {
          attrs.forEach(a => {
            if (a.name == 'src' && a.value) {
              console.error('fixing img src:' + a.value);
              a.value = fixUrl(a.value);
            }
          })
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
  return res.join('');
}
