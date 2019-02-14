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
  return [res, offset];
}

function parseValue(s: string, offset: number): [string, number] {
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
  const res = s.substring(start, offset);
  return [res, offset];
}

function parseC(c: string, s: string, offset: number): number {
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

  ontext(text: string);

  onclosetag(name: string, noBody: boolean);
}

export function parseHTMLText(s: string, offset = 0, options: HTMLParserOptions): void {
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
              const text = s.substring(start, offset - 3);
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
export type HTMLItemType = 'command' | 'tag' | 'text' | 'comment';

/* one and only one field */
export interface HTMLItem {
  command?: Command
  comment?: string
  tag?: Tag
  text?: string
  children: HTMLItem[]
}

export function parseHTMLTree(s: string): HTMLItem[] {
  const topLevel: HTMLItem[] = [];
  const levelStack: HTMLItem[] = [];
  let currentLevel: HTMLItem;
  parseHTMLText(s, 0, {
    oncommand: (name, attributes) => {
      const c = {command: {name, attributes}, children: []};
      if (currentLevel) {
        currentLevel.children.push(c)
      } else {
        topLevel.push(c);
      }
    }
    , oncomment: text => {
      const c = {comment: text, children: []};
      if (currentLevel) {
        currentLevel.children.push(c);
      } else {
        topLevel.push(c);
      }
    }
    , onopentag: (name, attributes, noBody) => {
      const c = {tag: {name, attributes, noBody}, children: []};
      if (currentLevel) {
        currentLevel.children.push(c);
      } else {
        topLevel.push(c);
      }
      if (!noBody && [
        'img'
        , 'br'
        , 'hr'
        , 'meta'
        , 'link'
        , 'input'
      ].indexOf(name.toLowerCase()) !== -1) {
        /* this tag will never be closed (event) */
        c.tag.noBody = true;
        return;
      }
      currentLevel = c;
      levelStack.push(c);
    }
    , ontext: text => {
      const c = {text, children: []};
      if (currentLevel) {
        currentLevel.children.push(c);
      } else {
        topLevel.push(c);
      }
    }
    , onclosetag: (name, noBody) => {
      if (currentLevel && currentLevel.tag) {
        if (name !== currentLevel.tag.name) {
          /* e.g. img */
          if ('') {
            console.error({name, noBody, currentLevel, levelStack: levelStack.map(x => x.tag.name)});
            throw new Error('closing tag name unmatch');
          }
          currentLevel.tag.noBody = true;
          levelStack.pop();
        }
      }
      levelStack.pop();
      currentLevel = levelStack[levelStack.length - 1];
    }
  });
  return topLevel;
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

export const htmlItem_to_string = (x: HTMLItem): string =>
  'command' in x ? `<!${tag_head_to_string(x.command.name, x.command.attributes)}>`
    : 'comment' in x ? `<!--${x.comment}-->`
    : 'tag' in x ? '<' + tag_head_to_string(x.tag.name, x.tag.attributes) + (x.tag.noBody && x.children.length === 0 ? '/>' : '>' + x.children.map(htmlItem_to_string).join('') + `</${x.tag.name}>`)
      : 'text' in x ? x.text
        : (() => {
          console.error('unknown html item:', x);
          throw new Error('unknown html item:' + JSON.stringify(x))
        })()
;
export const htmlItem_to_string_no_comment = (x: HTMLItem): string =>
  'command' in x ? `<!${tag_head_to_string(x.command.name, x.command.attributes)}>`
    : 'comment in x' ? ''
    : 'tag' in x ? '<' + tag_head_to_string(x.tag.name, x.tag.attributes) + (x.tag.noBody && x.children.length === 0 ? '/>' : '>' + x.children.map(htmlItem_to_string_no_comment).join('') + `</${x.tag.name}>`)
      : 'text' in x ? x.text
        : (() => {
          console.error('unknown html item:', x);
          throw new Error('unknown html item:' + JSON.stringify(x))
        })()
;
