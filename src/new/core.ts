import {
  defaultSkipTags,
  MinifyHTMLOptions,
  Tag_Article,
  Tag_IFrame,
  tag_whitelist,
  textonly_tag_blackList,
} from '../core';
import {
  Command,
  Comment,
  Document,
  HTMLElement,
  isAnyTagName,
  Node,
  parseHtmlDocument,
  Text,
  walkNode,
  walkNodeReversed,
} from './parser';

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

export function minifyDocument(
  document: Document,
  options: MinifyHTMLOptions,
): Document {
  if (!minifyDocument.skipClone) {
    document = document.clone();
  }
  // walkNode(document, node => node.childNodes = node.childNodes || []);

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
            element.isTagName(Tag_Article) ||
            element.isAnyTagName(tag_whitelist) ||
            element.hasElementByTagName(Tag_Article) ||
            element.hasElementByAnyTagName(tag_whitelist)
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

  return document;
}

export namespace minifyDocument {
  export let skipClone = true;
}

export function minifyHTML(html: string, options: MinifyHTMLOptions): string {
  if (!html) {
    return '';
  }
  const document = parseHtmlDocument(html);
  return minifyDocument(document, options).minifiedOuterHTML;
}
