import {HTMLItem, htmlItem_to_string_no_comment, parseHTMLTree, Tag} from "./parser";
import {TextDecorator, Theme, ThemeStyles} from "./theme";
import {opt_out_line, opt_out_link} from "./opt-out";

const noop = () => {
};

/**
 * @return <boolean> has or is text
 * */
const item_has_text = (item: HTMLItem): boolean =>
  !!item.text || item.children.some(item_has_text);

const item_has_tag = (item: HTMLItem, name: string): boolean =>
  (item.tag && item.tag.name.toLowerCase() == name) || item.children.some(item => item_has_tag(item, name));

const item_is_tag = (item: HTMLItem, name: string): boolean =>
  item.tag && item.tag.name.toLowerCase() == name;

const item_is_any_tag = (item: HTMLItem, names: string[]): boolean =>
  item.tag && names.indexOf(item.tag.name.toLowerCase()) !== -1;


/* for textonly and article */
const tag_whitelist = [
  'head'
  , 'style'
  , 'link'
  , 'meta'
];

function filter_textonly(topLevel: HTMLItem[]): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item_is_any_tag(item, [
        'script'
        , 'button'
        , 'img'
        , 'video'
      ])) {
      return;
    }
    if (item.command
      || item.text
      || item_is_any_tag(item, tag_whitelist)) {
      return res.push(item)
    }
    if (item_has_text(item)) {
      res.push(item);
      item.children = filter_textonly(item.children);
    }
  });
  return res;
}

const Tag_Article = 'article';

function filter_article(topLevel: HTMLItem[]): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item_is_tag(item, Tag_Article) || item_is_any_tag(item, tag_whitelist)) {
      return res.push(item);
    }
    if (item_has_tag(item, Tag_Article) || tag_whitelist.some(t => item_has_tag(item, t))) {
      res.push(item);
      item.children = filter_article(item.children);
    }
  });
  return res;
}

function filter_skip_comment(topLevel: HTMLItem[]): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item.comment) {
      return;
    }
    res.push(item);
    item.children = filter_skip_comment(item.children)
  });
  return res;
}

/**
 * @param {Array<HTMLItem>} topLevel
 * @param {Array<String>} skipTags
 * @param {Array<String>} skipAttrs
 * @param {Array<Function>} skipAttrFs return false if this element should be removed
 * */
function filter_skip_tag_attr(topLevel: HTMLItem[], skipTags: string[], skipAttrs: string[], skipAttrFs: Array<(name: string, value: string) => boolean>): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item_is_any_tag(item, skipTags)) {
      return;
    }
    res.push(item);
    if (item.tag) {
      item.tag.attributes = item.tag.attributes
        .filter(a =>
          (skipAttrs.indexOf(a.name.toLowerCase()) === -1)
          && skipAttrFs.every(f => f(a.name, a.value))
        )
      ;
    }
    item.children = filter_skip_tag_attr(item.children, skipTags, skipAttrs, skipAttrFs);
  });
  return res;
}

function find_tag(topLevel: HTMLItem[], tagName: string): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item_is_tag(item, tagName)) {
      return res.push(item)
    }
    res.push(...find_tag(item.children, tagName));
  });
  return res;
}

function scanner_add_to_body(item: HTMLItem, preChildren: HTMLItem[], postChildren: HTMLItem[]) {
  if (item_is_tag(item, 'body')) {
    item.tag.noBody = false;
    item.children = [...preChildren, ...item.children, ...postChildren];
    return;
  }
  item.children.forEach(item => scanner_add_to_body(item, preChildren, postChildren));
}

function scanner_map_text(item: HTMLItem, f: (s: string) => string) {
  if (item.text) {
    item.text = f(item.text);
  }
  item.children.forEach(item => scanner_map_text(item, f));
}

function scanner_update_tag(item: HTMLItem, f: (tag: Tag) => void) {
  if (item.tag) {
    f(item.tag)
  }
  item.children.forEach(item => scanner_update_tag(item, f));
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

const defaultSkipTags: string[] = [
  'script'
  // , 'style'
  // , 'link'
  , 'img'
];

export function minifyHTML(s: string, options?: MinifyHTMLOptions): string {
  if (!s) {
    return ''
  }
  let topLevel = parseHTMLTree(s);
  topLevel = filter_skip_comment(topLevel);
  if (options && options.article_mode) {
    topLevel = filter_article(topLevel)
  }
  if (options && options.text_mode) {
    topLevel = filter_textonly(topLevel)
  }
  // const res = [];
  const skipTags: string[] = (options && options.skipTags) ? options.skipTags : defaultSkipTags;
  const skipAttrs: string[] = [];
  const skipAttrFs: Array<(name: string, value: string) => boolean> = [];

  if (skipTags.indexOf('style') !== -1) {
    skipTags.push('link');
    skipAttrs.push('style');
    if (skipTags.indexOf('script') !== -1) {
      /* plain static page */
      skipAttrs.push('class', 'id');
      skipAttrFs.push((name, value) => !name.startsWith('data-'));
    }
  }
  topLevel = filter_skip_tag_attr(topLevel, skipTags, skipAttrs, skipAttrFs);

  const hrefPrefix = (options && options.hrefPrefix) ? options.hrefPrefix : '';
  const addPrefix = (s: string) =>
    (s[0] == '"' || s[0] == "'")
      ? s.replace(s[0], s[0] + hrefPrefix)
      : hrefPrefix + s
  ;
  const url: string = (options && options.url) ? options.url : '';
  if (url) {
    const protocol = url_to_protocol(url);
    const host = url_to_host(url);
    const base = url_to_base(url);
    const fixUrl = (url: string) => {
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
      return url;
    };
    /* apply url fix */
    topLevel.forEach(item => scanner_update_tag(item, tag => {
      const name = tag.name.toLowerCase();
      const attrs = tag.attributes;
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
    }))
  }
  if (options && options.textDecorator) {
    topLevel.forEach(item => scanner_map_text(item, options.textDecorator))
  }
  {
    const themeName = (options && options.theme || 'default');
    const themeHTML = ThemeStyles.get(themeName);
    const themeStyle = parseHTMLTree(themeHTML);
    const optOutLink = parseHTMLTree(opt_out_link);
    const optOutLine = parseHTMLTree(opt_out_line);
    find_tag(topLevel, 'body').forEach(body => {
      if (body.tag.noBody) {
        body.tag.noBody = false;
        body.children.push(...optOutLink)
      } else {
        body.children = [
          ...optOutLink
          , ...optOutLine
          , ...themeStyle
          , ...body.children
          , ...optOutLine
          , ...optOutLink
        ]
      }
    })
  }
  // res.push(`<script>document.baseURI='${hrefPrefix}'</script>`);
  return topLevel.map(htmlItem_to_string_no_comment).join('');
}
