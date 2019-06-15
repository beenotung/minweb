import * as fs from 'fs';
import {
  defaultSkipTags,
  MinifyHTMLOptions,
  Tag_Article,
  Tag_IFrame,
  tag_whitelist,
  textonly_tag_blackList,
} from '../core';
import {
  Comment,
  config,
  HTMLElement,
  isAnyTagName,
  parseHtmlDocument,
  Text,
  walkNode,
  wrapNode,
} from './parser';

export function minifyHTML(html: string, options: MinifyHTMLOptions): string {
  if (!html) {
    return '';
  }
  const document = parseHtmlDocument(html);
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
        if (node instanceof Text) {
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
  if (config.dev) {
    fs.writeFileSync(
      'wrapped-root.json',
      JSON.stringify(wrapNode(document), null, 2),
    );
  }

  return document.outerHTML.trim();
}
