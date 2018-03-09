export interface Attribute {
  name: string;
  value?: string;
}

export interface HTMLParserOptions {
  oncommand(name: string, attributes: Attribute[]);

  oncomment(text: string);

  onopentag(name: string, attributes: Attribute[]);

  ontext (text: string);

  onclosetag(name: string);
}

const is_bracket = (s: string) => s == '<' || s == '>';
const is_space = (s: string) => s == ' ' || s == '\n' || s == '\r' || s == '\t';
const is_name_char = (s: string) => !is_space(s) && !is_bracket(s);

function parseSpace(s: string, offset: number): number {
  for (; is_space(s[offset]); offset++) ;
  return offset;
}

function parseName(s: string, offset: number): [string, number] {
  console.error(`parseName(s, ${offset})`);
  let res = '';
  for (; ; offset++) {
    const c = s[offset];
    if (offset < s.length && is_name_char(c)) {
      res += c;
      continue;
    }
    break;
  }
  if (res.length == 0) {
    console.error('failed to parse name', {offset, c: s[offset]});
    throw new Error('failed to parse name');
  }
  console.error('parsed name of length:', res.length);
  return [res, offset];
}

function parseC(c: string, s: string, offset: number): number {
  console.error(`parseC(${c}, s, ${offset})`);
  for (; offset < s.length && s[offset] != c; offset++) ;
  return offset + 1;
}

export function parseHTMLText(s: string, offset = 0, options: HTMLParserOptions): void {
  console.error(`parseHTMLText(s, ${offset})`);
  main:
    for (; offset < s.length;) {
      offset = parseSpace(s, offset);
      if (offset >= s.length) {
        return;
      }
      const c = s[offset];
      offset++;
      switch (c) {
        case '<': {
          offset = parseSpace(s, offset);
          let mode: 'open' | 'close' | 'command';
          const c = s[offset];
          if (c == '!') {
            if (s[offset + 1] == '-' && s[offset + 2] == '-') {
              offset += 3;
              const start = offset;
              for (; ; offset++) {
                if (s[offset] == '-' && s[offset + 1] == '-' && s[offset + 2] == '>') {
                  offset += 3;
                  break;
                }
              }
              const text = s.substring(start, offset);
              options.oncomment(text);
              continue main;
            }
            mode = 'command';
            offset++;
          } else if (c == '/') {
            mode = 'close';
            offset++;
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
            if (!is_name_char(s[offset])) {
              break;
            }
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
          offset = parseSpace(s, offset);
          let alsoClose = false;
          if (s[offset] == '/') {
            offset = parseC('>', s, offset);
            alsoClose = true;
          }
          if (mode == 'open') {
            options.onopentag(name, attrs);
            if (alsoClose) {
              options.onclosetag(name);
            }
          } else if (mode == 'command') {
            options.oncommand(name, attrs)
          }
          /* end of '<' case */
        }
          break;
        default: {
          /* textContent */
          const start = offset;
          for (; offset < s.length && s[offset] !== '<'; offset++) ;
          console.error({start, end:offset});
          const text = s.substring(start, offset);
          options.ontext(text);
        }
      }
    }
}
