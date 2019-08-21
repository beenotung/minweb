import {
  defaultSkipTags,
  genAddPrefix,
  genFixUrl,
  MinifyHTMLOptions,
  Tag_Article,
  Tag_IFrame,
  tag_whitelist,
  textonly_tag_blackList,
} from './helpers';
import { opt_out_line, opt_out_link } from './opt-out';
import {
  Attr,
  Attributes,
  Command,
  Comment,
  Document,
  getElementByTagName,
  getElementsByTagName,
  hasElementByAnyTagName,
  hasElementByTagName,
  HTMLElement,
  isAnyTagName,
  Node,
  parseHtmlDocument,
  Text,
  walkNode,
  walkNodeReversed,
} from './parser';
import { ThemeStyles } from './theme';

const mergeText = (node: Node) => {
  if (node.childNodes) {
    for (let i = node.childNodes.length - 1; i > 0; i--) {
      const c = node.childNodes[i];
      const prev = node.childNodes[i - 1];
      if (c instanceof Text && prev instanceof Text) {
        prev.outerHTML += c.outerHTML;
        node.childNodes.splice(i, 1);
      }
    }
    node.childNodes.forEach(node => mergeText(node));
  }
};

function findOrInjectAttr(attrs: Attributes, name: string): Attr {
  name = name.toLowerCase();
  for (const attr of attrs.attrs) {
    if (typeof attr === 'object' && attr.name.toLowerCase() === name) {
      return attr;
    }
  }
  const attr: Attr = {
    name,
  };
  attrs.attrs.push(attr);
  return attr;
}

/* tslint:disable:no-unused-variable */
// const dev = console.log.bind(console, '[core]');
/* tslint:enable:no-unused-variable */

function findOrInjectElement(
  node: Node,
  tagName: string,
  options?: {
    injectIntoTagName?: string;
    mode?: 'push' | 'unshift';
  },
): HTMLElement {
  let element = getElementByTagName(node, tagName);
  if (!element) {
    element = new HTMLElement();
    element.tagName = tagName;
    element.attributes = new Attributes();
    element.notClosed = false;
    (element as any).injected = true;
    const target =
      options && options.injectIntoTagName
        ? findOrInjectElement(node, options.injectIntoTagName)
        : node;
    if (!target.childNodes) {
      target.childNodes = [];
    }
    const mode = options && options.mode ? options.mode : 'push';
    switch (mode) {
      case 'push':
        target.childNodes.push(element);
        break;
      case 'unshift':
        target.childNodes.unshift(element);
        break;
    }
  }
  return element;
}

function text(text: string): Text {
  const node = new Text();
  node.outerHTML = text;
  return node;
}

const mobileDocument = parseHtmlDocument(
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
const mobileMetaList = getElementsByTagName(mobileDocument, 'meta');

export function minifyDocument(
  document: Document,
  options: MinifyHTMLOptions,
): Document {
  if (!minifyDocument.skipClone) {
    document = document.clone();
  }
  // walkNode(document, node => node.childNodes = node.childNodes || []);
  const html = findOrInjectElement(document, 'html');
  const head = findOrInjectElement(document, 'head', {
    injectIntoTagName: 'html',
  });
  const body = findOrInjectElement(document, 'body', {
    injectIntoTagName: 'html',
  });

  let keepTags: string[] = tag_whitelist.slice();
  const skipTags: string[] = options.skipTags || defaultSkipTags;
  const skipAttrs: string[] = [];
  const skipAttrFs: Array<(name: string, value?: string) => boolean> = [];
  if (skipTags.includes('style')) {
    skipTags.push('link');
    skipAttrs.push('style');
    keepTags = keepTags.filter(tag => tag !== 'style' && tag !== 'link');
    if (skipTags.includes('script')) {
      skipAttrs.push('class', 'id');
      skipAttrFs.push((name: string) => name.startsWith('data-'));
    }
  }
  const skipIFrame = skipTags.includes(Tag_IFrame);

  const hrefPrefix = options.hrefPrefix || '';
  const addPrefix = genAddPrefix(options.hrefPrefix);
  const url = options.url || '';
  const fixUrl = url ? genFixUrl(url) : undefined;

  walkNode(document, node => {
    node.childNodes = (node.childNodes || []).filter(node => {
      // skip comment
      if (node instanceof Comment) {
        return false;
      }
      if (isAnyTagName(node, keepTags)) {
        return true;
      }

      const element = node instanceof HTMLElement ? node : undefined;

      if (element) {
        if (element.isAnyTagName(skipTags)) {
          return false;
        }
        element.attributes.attrs = element.attributes.attrs.filter(
          attr =>
            !(
              typeof attr === 'object' &&
              (skipAttrs.some(name => attr.name.toLowerCase() === name) ||
                skipAttrFs.some(f => f(attr.name, attr.value)))
            ),
        );
      }

      if (options.article_mode && element) {
        if (
          !(
            hasElementByTagName(node, Tag_Article) ||
            hasElementByAnyTagName(node, tag_whitelist)
          )
        ) {
          return false;
        }
      }

      if (options.text_mode) {
        if (node instanceof Text || node instanceof Command) {
          return true;
        }
        if (
          element.isAnyTagName(textonly_tag_blackList) ||
          !element.hasText()
        ) {
          return false;
        }
      }

      if (skipIFrame && element) {
        if (element.isTagName(Tag_IFrame)) {
          element.tagName = 'a';
          const src = element.attributes.getValue('src');
          if (src) {
            // has src
            element.attributes.attrs = [{ name: 'href', value: src }];
            element.noBody = false;
            element.notClosed = false;
            const text = new Text();
            text.outerHTML = 'iframe: ' + src;
            element.childNodes = [text];
            return true;
          } else {
            // has no src
            element.attributes.attrs = [];
            element.childNodes = [];
            return false;
          }
        }
      }

      // fix url
      if (url && element) {
        const name = element.tagName.toLowerCase();
        const updateValue = (name: string, f: (value: string) => string) =>
          element.attributes.forEachAttr(attr => {
            if (attr.name.toLowerCase() === name && attr.value) {
              attr.value = f(attr.value);
            }
          });
        switch (name) {
          case 'a':
            updateValue('href', value => addPrefix(fixUrl(value)));
            break;
          case 'link':
            updateValue('href', value => fixUrl(value));
            break;
          case 'img':
            updateValue('src', value => fixUrl(value));
            break;
          case 'base':
            // breaking image links on some sites
            if ('') {
              updateValue('href', value => hrefPrefix);
            }
            break;
          case 'form':
            // doesn't work
            if ('') {
              console.error('checking form');
              updateValue('method', method => {
                switch (method.toLowerCase()) {
                  case 'get':
                  case '"get"':
                  case "'get'":
                    updateValue('action', value => {
                      const newValue = addPrefix(fixUrl(value));
                      console.error('added prefix: ' + newValue);
                      return newValue;
                    });
                }
                return method;
              });
            }
            break;
        }
      }

      if (options.textDecorator && node instanceof Text) {
        node.outerHTML = options.textDecorator(node.outerHTML);
      }

      return true;
    });
  });

  walkNodeReversed(document, (node, parent, idx) => {
    if (node instanceof HTMLElement && node.isTagName('div')) {
      // remove empty div
      const minifiedInnerHTML = node.childNodes
        .map(x => x.minifiedOuterHTML)
        .join('')
        .trim();
      if (minifiedInnerHTML.length === 0) {
        parent.childNodes.splice(idx, 1);
        return;
      }
      // flatten shallow dom
      if (node.childNodes.length === 1) {
        parent.childNodes[idx] = node.childNodes[0];
      }
    }
  });

  // merge text elements, this is possible because original elements in the middle may be removed
  mergeText(document);

  // inject opt-out link
  // inject theme style
  if (body.childNodes.length === 0) {
    body.childNodes.push(text(opt_out_link));
  } else {
    body.childNodes = [
      text(opt_out_link),
      text(opt_out_line),
      text(ThemeStyles.get(options.theme || 'default')),
      ...body.childNodes,
      text(opt_out_line),
      text(opt_out_link),
    ];
  }

  if (options.inject_style) {
    {
      const first = document.childNodes[0];
      if (first.outerHTML.toUpperCase().trim() !== '<!DOCTYPE HTML>') {
        document.childNodes.unshift(text('<!DOCTYPE html>'));
      }
    }

    const lang = findOrInjectAttr(html.attributes, 'lang');
    lang.value = lang.value || '"en"';
    const dir = findOrInjectAttr(html.attributes, 'dir');
    dir.value = dir.value || '"ltr"';

    head.childNodes = [...mobileMetaList, ...(head.childNodes || [])];

    body.childNodes = [
      text(
        '<link rel="stylesheet" href="https://unpkg.com/normalize.css@8.0.1/normalize.css" type="text/css">',
      ),
      text(
        '<link rel="stylesheet" href="https://unpkg.com/@beenotung/sakura.css/css/sakura.css" type="text/css">',
      ),
      ...(body.childNodes || []),
    ];
  }

  return document;
}

export namespace minifyDocument {
  export let skipClone = true;
}

export async function minifyHTML(
  html: string,
  options: MinifyHTMLOptions,
): Promise<string> {
  if (!html) {
    return '';
  }
  let document = parseHtmlDocument(html);
  if (options.article_mode && !getElementByTagName(document, 'article')) {
    // in article-mode, but no article element in the html
    await require('read-art')(html).then(article => {
      html = `<html lang="en"
<head>
<meta charset="UTF-8">
<title>${article.title}</title>
</head>
<body>
${article.title}
<hr>
<p>${article.content}</p>
</body>
</html>`;
      document = parseHtmlDocument(html);
      options = {
        ...options,
        article_mode: false,
      };
    });
  }
  return minifyDocument(document, options).minifiedOuterHTML;
}
