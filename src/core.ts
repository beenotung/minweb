import {parseHTMLText} from "./parser";
import {Theme, ThemeStyles} from "./theme";

const noop = () => {
};

export type TextDecorator = (s: string) => string;

export interface MinifyHTMLOptions {
  textDecorator?: TextDecorator
  theme?: Theme
}

export function minifyHTML(s: string, options?: MinifyHTMLOptions): string {
  const res = [];
  console.error(s);
  console.error("total length:", s.length);
  parseHTMLText(s, 0, {
    oncommand: (name, attrs) => res.push(`<!${name}>`)
    // , oncomment: text => res.push(`<!--${text}-->`)
    , oncomment: noop
    , onopentag: (name, attrs) => res.push(`<${name}>`)
    , ontext: text =>
      (options && options.textDecorator)
        ? res.push(options.textDecorator(text))
        : res.push(text)
    , onclosetag: (name) => res.push(`</${name}>`)
  });
  const theme = (options && options.theme || 'default');
  res.push(ThemeStyles.get(theme));
  return res.join('');
}
