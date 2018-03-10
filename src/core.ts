import {
  attrsToString,
  command_to_string,
  parseHTMLText,
  parseHTMLTree,
  Tag,
  tag_head_to_string,
  tag_is_any_name,
  tag_to_string,
  TagChild
} from "./parser";
import {TextDecorator, Theme, ThemeStyles} from "./theme";
import {opt_out_line, opt_out_link} from "./opt-out";
import {arrayHasAll} from "./utils";

const noop = () => {
};

function tag_has_text(tag: Tag): boolean {
  return tag.children.some(t => typeof t === "string" ? !!t.trim() : tag_has_text(t));
}

function tag_to_string_textonly(tag: Tag | string): string {
  if (typeof tag === "string") {
    return tag.trim();
  }
  if (tag_is_any_name(tag, [
      'script'
      , 'button'
      , 'img'
      , 'video'
    ])) {
    return '';
  }
  if (tag_has_text(tag) || tag_is_any_name(tag, [
      'meta'
      , 'link'
    ])) {
    return tag.noBody
      ? `<${tag.name} ${attrsToString(tag.attributes)}/>`
      : `<${tag.name} ${attrsToString(tag.attributes)}>${tag.children.map(t => tag_to_string_textonly(t)).join('')}</${tag.name}>`
  }
  return '';
}

export function minifyHTML_textonly(s: string): string {
  const [cmds, tag] = parseHTMLTree(s);
  return cmds.map(c => command_to_string(c)).join('')
    + tag_to_string_textonly(tag);
}

const Tag_Article = 'article';
const tag_has_article = (t: TagChild): boolean =>
  typeof t === "string"
    ? false
    : t.name.toLowerCase() == Tag_Article || t.children.some(tag_has_article)
;

function tag_to_string_article(tag: Tag): string {
  if (tag_is_any_name(tag, [
      Tag_Article
      , 'head'
      , 'script'
      , 'style'
      , 'link'
    ])) {
    /* this is the article tag */
    return tag_to_string(tag);
  }
  if (tag_is_any_name(tag, [])) {
    return '';
  }
  if (tag_has_article(tag)) {
    /* has article child, but this is not article */
    return tag.noBody
      ? `<${tag.name} ${attrsToString(tag.attributes)}/>`
      : `<${tag.name} ${attrsToString(tag.attributes)}>${tag.children.map(t => typeof t === "string" ? '' : tag_to_string_article(t)).join('')}</${tag.name}>`
  }
  /* not related to article */
  return '';
}

export function minifyHTML_article(s: string): string {
  const [cmds, tag] = parseHTMLTree(s);
  return cmds.map(c => command_to_string(c)).join('')
    + tag_to_string_article(tag);
}

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

export interface MinifyHTMLOptions {
  textDecorator?: TextDecorator
  theme?: Theme
  skipTags?: string[]
  url?: string
  hrefPrefix?: string
  article_mode?: boolean
  text_mode?: boolean
}

export function minifyHTML(s: string, options?: MinifyHTMLOptions): string {
  if (!s || !s.trim()) {
    return '';
  }
  if (options && options.article_mode) {
    console.error('before minifyHTML_article:' + s.length);
    s = minifyHTML_article(s);
    console.error('after minifyHTML_article:' + s.length);
    console.error('>>>>');
    console.error(s);
    console.error('<<<<');
  }
  if (options && options.text_mode) {
    s = minifyHTML_textonly(s);
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
    // console.error('before:' + url);
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
    // console.error('after:' + url);
    return url;
  };
  // console.error('s:');
  // console.error('>>>>');
  // console.error(s);
  // console.error('<<<<');
  // console.error("total length:", s.length);
  let tagName: string;
  parseHTMLText(s, 0, {
    oncommand: (name, attrs) => res.push(`<!${name}${attrs.length > 0 ? " " + attrsToString(attrs) : ""}>`)
    // , oncomment: text => res.push(`<!--${text}-->`)
    , oncomment: noop
    , onopentag: (name, attrs, noBody) => {
      tagName = name;
      if (skipTags.indexOf(name) !== -1) {
        return;
      }
      if (skipTags.indexOf('style') !== -1) {
        attrs = attrs.filter(a => a.name.toLowerCase() !== 'style');
        if (arrayHasAll(skipTags, ['script', 'link'])) {
          /* plain static page */
          attrs = attrs
            .filter(a => {
              const name = a.name.toLowerCase();
              return name !== 'class'
                && name !== 'id'
                && !name.startsWith('data-');
            })
        }
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
      const _name = name.toLowerCase();
      if (_name == 'body' && noBody) {
        res.push(`<${tag_head_to_string(name, attrs)}>`);
        res.push(opt_out_link);
        res.push(`</${name}>`);
        return;
      }
      if (noBody) {
        return res.push(`<${tag_head_to_string(name, attrs)}/>`)
      }
      res.push(`<${tag_head_to_string(name, attrs)}>`);
      if (_name == 'body') {
        res.push(opt_out_link + opt_out_line)
      }
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
    , onclosetag: (name, noBody) => {
      if (noBody) {
        return;
      }
      if (skipTags.indexOf(name.toLowerCase()) != -1) {
        return;
      }
      res.push(`</${name}>`)
    }
  });
  const theme = (options && options.theme || 'default');
  res.push(ThemeStyles.get(theme));
  if (options && options.article_mode && '') {
    res.push(`<style>body *{display: none;} article *{display: initial;}</style>`);
    res.push(`<script>
var es = document.getElementsByTagName('article');
for(var i=es.length-1;i>=0;i--){
  var e = es[i];
  for(;;){
    e.style.display='initial';
    if(e.parentElement){
      e=e.parentElement;
    }else{
      break;
    }
  }
}
</script>`);
  }
  // res.push(`<script>document.baseURI='${hrefPrefix}'</script>`);
  return res.join('');
}
