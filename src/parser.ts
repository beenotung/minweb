export interface Attribute {
  name: string;
  value?: string;
}

export interface Command {
  name: string;
  attributes: Attribute[];
}

export type TagChild = string | Tag;

export interface Tag {
  name: string;
  attributes: Attribute[];
  children: TagChild[];
  noBody: boolean
}

const is_bracket = (s: string) => s == '<' || s == '>';
const is_space = (s: string) => s == ' ' || s == '\n' || s == '\r' || s == '\t';
const is_name_char = (s: string) => s != '=' && s != '/' && !is_space(s) && !is_bracket(s);

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

function parseValue(s: string, offset: number): [string, number] {
  console.error(`parseValue(s, ${offset})`);
  let start = offset;
  let mode: '"' | "'" | '' = '';
  for (; offset < s.length; offset++) {
    const c = s[offset];
    if (mode == '' && (c == '"' || c == "'")) {
      mode = c;
      continue;
    }
    if (mode !== '' && c == '\\') {
      offset++;
      continue;
    }
    if (mode == c) {
      mode = '';
      if (offset != start) {
        offset++;
        break;
      }
      continue;
    }
    if (mode == '' && !is_name_char(c)) {
      break;
    }
  }
  console.error({last: s[offset], start, end: offset, mode});
  const res = s.substring(start, offset);
  console.error(`parsed value:${res}`);
  return [res, offset];
}

function parseC(c: string, s: string, offset: number): number {
  console.error(`parseC(${c}, s, ${offset})`);
  for (; offset < s.length && s[offset] != c; offset++) ;
  return offset + 1;
}

const compare_str = (src: string, srcOffset: number, pattern: string): boolean => {
  for (let i = 0; i < pattern.length; i++) {
    if (src[srcOffset + i] != pattern[i]) {
      return false;
    }
  }
  return true;
};

export interface HTMLParserOptions {
  oncommand(name: string, attributes: Attribute[]);

  oncomment(text: string);

  onopentag(name: string, attributes: Attribute[], noBody: boolean);

  ontext (text: string);

  onclosetag(name: string, noBody: boolean);
}

export function parseHTMLText(s: string, offset = 0, options: HTMLParserOptions): void {
  console.error(`parseHTMLText(s, ${offset})`);
  let tagName: string;
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
            options.onclosetag(name, false);
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
              offset++;
              /* has value */
              offset = parseSpace(s, offset);
              let value: string;
              [value, offset] = parseValue(s, offset);
              attrs.push({name, value})
            } else {
              /* no value */
              attrs.push({name})
            }
            if (s[offset] == '>') {
              break;
            }
          }
          console.error({attrs});
          offset = parseSpace(s, offset);
          let alsoClose = false;
          if (s[offset] == '/') {
            offset = parseC('>', s, offset);
            alsoClose = true;
          }
          if (mode == 'open') {
            tagName = name;
            options.onopentag(name, attrs, alsoClose);
            if (alsoClose) {
              options.onclosetag(name, alsoClose);
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
          if (tagName === 'script') {
            for (; offset < s.length && !compare_str(s, offset, '</script>'); offset++) ;
          } else {
            for (; offset < s.length && s[offset] !== '<'; offset++) ;
          }
          console.error({start, end: offset});
          if (start != offset) {
            const text = s.substring(start, offset);
            options.ontext(text);
          }
        }
      }
    }
}

const noop = () => {
};

export function parseHTMLTree(s: string): [Command[], Tag] {
  const commands: Command[] = [];
  let firstTag: Tag;
  let tag: Tag;
  let tagStack: Tag[] = [];
  parseHTMLText(s, 0, {
    oncomment: noop
    , onopentag: (name, attributes, noBody) => {
      let newTag: Tag = {name, attributes, children: [], noBody};
      if (!firstTag) {
        firstTag = newTag
      }
      tagStack.push(newTag);
      if (tag) {
        tag.children.push(newTag);
      }
      tag = newTag;
    }
    , ontext: text => {
      tag.children.push(text);
    }
    , onclosetag: name => {
      tagStack.pop();
      tag = tagStack[tagStack.length - 1];
    }
    , oncommand: (name, attributes) => {
      commands.push({name, attributes});
    }
  });
  return [commands, firstTag];
}

export const attrsToString = (attrs: Attribute[]) =>
  attrs
    .map(a =>
      a.value
        ? a.name + "=" + a.value
        : a.name
    )
    .join(' ')
;
export const tag_head_to_string = (name: string, attributes: Attribute[]): string =>
  name + (attributes.length === 0 ? '' : ' ' + attrsToString(attributes));

export const command_to_string = (c: Command): string =>
  `<!${c.name} ${attrsToString(c.attributes)}>`;

export const is_text = (x: TagChild): boolean => typeof x === "string";

export const tag_child_to_string = (x: TagChild): string =>
  typeof x === "string"
    ? x
    : tag_to_string(x)
;
export const tag_is_any_name = (tag: Tag, names: string[]) => names.indexOf(tag.name.toLowerCase()) !== -1;
export const tag_to_string = (t: Tag): string =>
  t.noBody
    ? `<${t.name} ${attrsToString(t.attributes)}/>`
    : `<${t.name} ${attrsToString(t.attributes)}>${t.children.map(x => tag_child_to_string(x)).join('')}</${t.name}>`;
