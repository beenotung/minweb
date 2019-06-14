import { opt_out_line, opt_out_link } from './opt-out';
import {
  Attribute,
  HTMLItem,
  htmlItem_to_string_no_comment,
  parseHTMLTree,
  Tag,
} from './parser';
import { TextDecorator, Theme, ThemeStyles } from './theme';

/**
 * @return <boolean> has or is text
 * */
const item_has_text = (item: HTMLItem): boolean =>
  !!item.text || item.children.some(item_has_text);

const item_has_tag = (item: HTMLItem, name: string): boolean =>
  (item.tag && item.tag.name.toLowerCase() == name.toLowerCase()) ||
  item.children.some(item => item_has_tag(item, name));

const item_is_command = (item: HTMLItem, name: string): boolean =>
  item.command && item.command.name.toLowerCase() == name.toLowerCase();

const item_is_tag = (item: HTMLItem, name: string): boolean =>
  item.tag && item.tag.name.toLowerCase() == name.toLowerCase();

const item_is_any_tag = (item: HTMLItem, names: string[]): boolean =>
  item.tag && names.indexOf(item.tag.name.toLowerCase()) !== -1;

/* for textonly and article */
export const tag_whitelist = ['head', 'style', 'link', 'meta'];
export const textonly_tag_blackList = [
  'script',
  'button',
  'img',
  'video',
  'svg',
];

function filter_textonly(topLevel: HTMLItem[]): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item_is_any_tag(item, textonly_tag_blackList)) {
      return;
    }
    if (item.command || item.text || item_is_any_tag(item, tag_whitelist)) {
      return res.push(item);
    }
    if (item_has_text(item)) {
      res.push(item);
      item.children = filter_textonly(item.children);
    }
  });
  return res;
}

export const Tag_Article = 'article';

function filter_article(topLevel: HTMLItem[]): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (
      item_is_tag(item, Tag_Article) ||
      item_is_any_tag(item, tag_whitelist)
    ) {
      return res.push(item);
    }
    if (
      item_has_tag(item, Tag_Article) ||
      tag_whitelist.some(t => item_has_tag(item, t))
    ) {
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
    item.children = filter_skip_comment(item.children);
  });
  return res;
}

/**
 * @param {Array<HTMLItem>} topLevel
 * @param {Array<String>} skipTags
 * @param {Array<String>} skipAttrs
 * @param {Array<Function>} skipAttrFs return false if this element should be removed
 * */
function filter_skip_tag_attr(
  topLevel: HTMLItem[],
  skipTags: string[],
  skipAttrs: string[],
  skipAttrFs: Array<(name: string, value: string) => boolean>,
): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item_is_any_tag(item, skipTags)) {
      return;
    }
    res.push(item);
    if (item.tag) {
      item.tag.attributes = item.tag.attributes.filter(
        a =>
          skipAttrs.indexOf(a.name.toLowerCase()) === -1 &&
          skipAttrFs.every(f => f(a.name, a.value)),
      );
    }
    item.children = filter_skip_tag_attr(
      item.children,
      skipTags,
      skipAttrs,
      skipAttrFs,
    );
  });
  return res;
}

function find_tag(topLevel: HTMLItem[], tagName: string): HTMLItem[] {
  const res: HTMLItem[] = [];
  topLevel.forEach(item => {
    if (item_is_tag(item, tagName)) {
      return res.push(item);
    }
    res.push(...find_tag(item.children, tagName));
  });
  return res;
}

function find_or_inject_tag(
  topLevel: HTMLItem[],
  tagName: string,
  f: (item: HTMLItem) => void,
  mode: 'push' | 'unshift' = 'push',
): void {
  let matched = find_tag(topLevel, tagName);
  if (matched.length === 0) {
    const item: HTMLItem = {
      tag: {
        name: tagName,
        attributes: [],
        noBody: true,
      },
      children: [],
    };
    matched = [item];
    if (mode === 'push') {
      topLevel.push(item);
    } else if (mode === 'unshift') {
      topLevel.unshift(item);
    }
  }
  matched.forEach(f);
}

/* tslint:disable:no-unused-variable */
function scanner_add_to_body(
  item: HTMLItem,
  preChildren: HTMLItem[],
  postChildren: HTMLItem[],
) {
  if (item_is_tag(item, 'body')) {
    item.tag.noBody = false;
    item.children = [...preChildren, ...item.children, ...postChildren];
    return;
  }
  item.children.forEach(item =>
    scanner_add_to_body(item, preChildren, postChildren),
  );
}

/* tslint:enable:no-unused-variable */

function scanner_map_text(item: HTMLItem, f: (s: string) => string) {
  if (item.text) {
    item.text = f(item.text);
  }
  item.children.forEach(item => scanner_map_text(item, f));
}

function scanner_update_tag(
  item: HTMLItem,
  f: (tag: Tag, item: HTMLItem) => void,
) {
  if (item.tag) {
    f(item.tag, item);
  }
  item.children.forEach(item => scanner_update_tag(item, f));
}

function url_to_protocol(s: string): string {
  return s.split('://')[0];
}

function url_to_host(s: string): string {
  const ss = s.split('://');
  ss.shift();
  s = ss.join('://');
  return s.split('/')[0];
}

function url_to_base(s: string): string {
  if (s.endsWith(url_to_host(s))) {
    return s + '/';
  }
  const ss = s.split('/');
  ss.pop();
  return ss.join('/') + '/';
}

export interface MinifyHTMLOptions {
  textDecorator?: TextDecorator;
  theme?: Theme;
  skipTags: string[];
  url?: string;
  hrefPrefix?: string;
  article_mode?: boolean;
  text_mode?: boolean;
  inject_style?: boolean;
}

export const defaultSkipTags: string[] = [
  'script',
  // , 'style'
  // , 'link'
  'img',
  'svg',
];

/**
 * append or overwrite
 * */
function addAttributes(target: Attribute[], newAttrs: Attribute[]) {
  for (const newAttr of newAttrs) {
    const name = newAttr.name.toLowerCase();
    let found = false;
    target.forEach(x => {
      if (x.name.toLowerCase() === name) {
        found = true;
        x.value = newAttr.value;
      }
    });
    if (!found) {
      target.push(newAttr);
    }
  }
}

export function minifyHTML(s: string, options?: MinifyHTMLOptions): string {
  if (!s) {
    return '';
  }
  let topLevel = parseHTMLTree(s);
  topLevel = filter_skip_comment(topLevel);
  if (options && options.article_mode) {
    topLevel = filter_article(topLevel);
  }
  if (options && options.text_mode) {
    topLevel = filter_textonly(topLevel);
  }
  // const res = [];
  const skipTags: string[] =
    options && options.skipTags ? options.skipTags : defaultSkipTags;
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
  if (skipTags.indexOf('iframe') !== -1) {
    topLevel.forEach(top =>
      scanner_update_tag(top, (tag, item) => {
        if (tag.name.toLowerCase() != 'iframe') {
          return;
        }
        tag.name = 'a';
        const t = tag.attributes.find(x => x.name.toLowerCase() == 'src');
        if (t) {
          const src = t.value;
          tag.attributes = [{ name: 'href', value: src }];
          tag.noBody = false;
          item.children = [{ text: 'iframe: ' + src, children: [] }];
        } else {
          tag.attributes = [];
          item.children = [];
        }
      }),
    );
  }
  topLevel = filter_skip_tag_attr(topLevel, skipTags, skipAttrs, skipAttrFs);

  const hrefPrefix = options && options.hrefPrefix ? options.hrefPrefix : '';
  const addPrefix = (s: string) =>
    s[0] == '"' || s[0] == "'"
      ? s.replace(s[0], s[0] + hrefPrefix)
      : hrefPrefix + s;
  const url: string = options && options.url ? options.url : '';
  if (url) {
    const protocol = url_to_protocol(url);
    const host = url_to_host(url);
    const base = url_to_base(url);
    const fixUrl = (url: string) => {
      let wrapper = '';
      if (url.startsWith('"') && url.endsWith('"')) {
        wrapper = '"';
      } else if (url.startsWith("'") && url.endsWith("'")) {
        wrapper = "'";
      }
      if (wrapper) {
        url = url.substring(1, url.length - 1);
      }
      url =
        url[0] == '/'
          ? protocol + '://' + host + url
          : url.startsWith('http://') || url.startsWith('https://')
          ? url
          : base + url;
      if (wrapper) {
        url = wrapper + url + wrapper;
      }
      return url;
    };
    /* apply url fix */
    topLevel.forEach(item =>
      scanner_update_tag(item, tag => {
        const name = tag.name.toLowerCase();
        const attrs = tag.attributes;
        if (name == 'a') {
          attrs.forEach(a => {
            if (a.name == 'href' && a.value) {
              a.value = addPrefix(fixUrl(a.value));
            }
          });
        } else if (name == 'link') {
          attrs.forEach(a => {
            if (a.name == 'href' && a.value) {
              a.value = fixUrl(a.value);
            }
          });
        } else if (name == 'img') {
          attrs.forEach(a => {
            if (a.name == 'src' && a.value) {
              a.value = fixUrl(a.value);
            }
          });
        } else if (name == 'base' && '') {
          /* breaking image links on some sites */
          attrs.forEach(a => {
            if (a.name == 'href' && a.value) {
              a.value = hrefPrefix;
            }
          });
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
                    console.error('added prefix:' + a.value);
                  }
                });
                break;
            }
          }
        }
      }),
    );
  }
  if (options && options.textDecorator) {
    topLevel.forEach(item => scanner_map_text(item, options.textDecorator));
  }
  {
    const themeName = (options && options.theme) || 'default';
    const themeHTML = ThemeStyles.get(themeName);
    const themeStyle = parseHTMLTree(themeHTML);
    const optOutLink = parseHTMLTree(opt_out_link);
    const optOutLine = parseHTMLTree(opt_out_line);
    find_or_inject_tag(topLevel, 'body', body => {
      body.tag.noBody = false;
      if (body.children.length === 0) {
        body.children = [...optOutLink];
      } else {
        body.children = [
          ...optOutLink,
          ...optOutLine,
          ...themeStyle,
          ...body.children,
          ...optOutLine,
          ...optOutLink,
        ];
      }
    });

    if (options.inject_style) {
      const mobileTopLevel = parseHTMLTree(
        `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="format-detection" content="telephone=no">
  <meta name="msapplication-tap-highlight" content="no">
</head>
<body>
</body>
</html>`.replace(/\n/g, ''),
      );
      const [doctype, html] = mobileTopLevel;
      const [head] = html.children;

      if (!item_is_command(topLevel[0], 'DOCTYPE')) {
        topLevel.unshift(doctype);
      } else {
        addAttributes(
          topLevel[0].command.attributes,
          doctype.command.attributes,
        );
      }

      find_or_inject_tag(
        topLevel,
        'html',
        item =>
          ((console.log({ html }) as any) && false) ||
          addAttributes(item.tag.attributes, html.tag.attributes),
      );

      find_or_inject_tag(topLevel, 'head', item => {
        item.children = [...head.children, ...item.children];
        item.tag.noBody = false;
        item.children.push(...parseHTMLTree(``));
      });

      find_or_inject_tag(topLevel, 'body', item => {
        item.tag.noBody = false;
        item.children.push(
          ...parseHTMLTree(
            '<link rel="stylesheet" href="https://unpkg.com/normalize.css@8.0.1/normalize.css" type="text/css">',
          ),
          ...parseHTMLTree(
            '<link rel="stylesheet" href="https://unpkg.com/@beenotung/sakura.css/css/sakura.css" type="text/css">',
          ),
        );
      });
    }
  }
  // res.push(`<script>document.baseURI='${hrefPrefix}'</script>`);
  return topLevel.map(htmlItem_to_string_no_comment).join('');
}
