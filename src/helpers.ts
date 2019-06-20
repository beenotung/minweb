import { TextDecorator, Theme } from './theme';
/* for textonly and article */
export const tag_whitelist = ['head', 'style', 'link', 'meta'];
export const textonly_tag_blackList = [
  'script',
  'button',
  'img',
  'video',
  'svg',
  'nav',
];
export const Tag_Article = 'article';
export const Tag_IFrame = 'iframe';

export interface MinifyHTMLOptions {
  textDecorator?: TextDecorator;
  theme?: Theme;
  skipTags?: string[];
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

export function genFixUrl(url: string) {
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
  return fixUrl;
}

export function genAddPrefix(hrefPrefix: string) {
  const addPrefix = (s: string) =>
    s[0] == '"' || s[0] == "'"
      ? s.replace(s[0], s[0] + hrefPrefix)
      : hrefPrefix + s;
  return addPrefix;
}
