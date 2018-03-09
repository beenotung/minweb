import {Attribute, parseHTMLText} from "./parser";
import {TextDecorator, Theme, ThemeStyles} from "./theme";

const noop = () => {
};


export interface MinifyHTMLOptions {
  textDecorator?: TextDecorator
  theme?: Theme
  skipTags?: string[]
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

export function minifyHTML(s: string, options?: MinifyHTMLOptions): string {
  const res = [];
  const skipTags: string[] = (options && options.skipTags) ? options.skipTags : [
    'script'
    // , 'style'
    // , 'link'
    , 'img'
  ];
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
