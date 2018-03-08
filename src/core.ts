export interface Attribute {
  name: string;
  value?: string;
}

export interface HTMLParserOptions {
  onopencommand(name: string, attributes: Attribute[]);

  onopentag(name: string, attributes: Attribute[]);

  ontext (text: string);

  onclosetag(name: string);
}

const is_bracket = (s: string) => s !== '<' && s !== '>';
const is_space = (s: string) => s == ' ' || s == '\n' || s == '\r' || s == '\t';

function parseSpace(s: string, offset: number): number {
  for (; is_space(s[offset]); offset++) ;
  return offset;
}

function parseName(s: string, offset: number): [string, number] {
  let res = '';
  for (const c = s[offset]; offset < s.length && !is_space(c) && !is_bracket(c); offset++) {
    res += c;
  }
  return [res, offset];
}

function parseC(c: string, s: string, offset: number): number {
  for (; s[offset] != c; offset++) ;
  return offset + 1;
}

export function parseHTMLText(s: string, offset = 0, options: HTMLParserOptions) {
  for (; ;) {
    offset = parseSpace(s, offset);
    if (offset >= s.length) {
      return;
    }
    switch (s[offset]) {
      case '<': {
        offset = parseSpace(s, offset);
        let mode: 'open' | 'close' | 'command';
        const c = s[offset];
        if (c == '!') {
          mode = 'command'
        } else if (c == '/') {
          mode = 'close'
        } else {
          mode = 'open'
        }
        let name;
        [name, offset] = parseName(s, offset);
        if (mode == 'close') {
          options.onclosetag(name);
          offset = parseC('>', s, offset);
          continue;
        }
        let attrs: Attribute[] = [];
        for (; ;) {
          offset = parseSpace(s, offset);
          let name: string;
          [name, offset] = parseName(s, offset);
          offset = parseSpace(s, offset);
          if (s[offset] == '=') {
            /* has value */
            offset = parseSpace(s, offset);
            let value: string;
            [value, offset] = parseName(s, offset);
            attrs.push({name, value})
          } else {
            /* no value */
            attrs.push({name})
          }
          if (s[offset] == '>') {
            break;
          }
        }
        if (mode == 'open') {
          options.onopentag(name, attrs)
        } else if (mode == 'command') {
          options.onopencommand(name, attrs)
        }
        /* end of '<' case */
      }
        break;
      default:
        console.error("unknown token", {s, offset});
        throw new Error("unknown token")
    }
  }
}
