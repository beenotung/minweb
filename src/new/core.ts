export let config = {
  dev: false,
  debug: false,
};
// config.dev = true;
// config.debug = true;

interface ParseResult<T> {
  res: string;
  data: T;
}

abstract class Node {
  outerHTML: string;
  childNodes: Node[] = [];
}

interface NodeConstructor<T extends Node> {
  name: string;

  new (): T;

  parse(html: string): ParseResult<T>;
}

type ForCharResult = 'stop' | 'skip' | { res: string };

function forChar(
  html: string,
  f: (c: string, i: number, html: string) => ForCharResult | undefined,
): { res: string } {
  let i: number;
  main: for (i = 0; i < html.length; i++) {
    const c = html[i];
    const res = f(c, i, html);
    switch (res) {
      case 'stop':
        break main;
      case 'skip':
        i++;
        break;
      default: {
        if (res && res.res) {
          html = res.res;
          i = -1;
        }
      }
    }
  }
  return { res: html.substr(i) };
}

class Text extends Node {
  static parse(html: string): ParseResult<Text> {
    let acc = '';
    const { res } = forChar(html, c => {
      switch (c) {
        case '<':
          return 'stop';
        default:
          acc += c;
      }
    });
    const node = new Text();
    node.outerHTML = acc;
    return {
      res,
      data: node,
    };
  }
}

function assert(b: boolean, error) {
  if (!b) {
    throw error;
  }
}

function parseTagName(html: string): ParseResult<string> {
  if (html[0] === '!') {
    throw new Error('expect non-command opening');
  }
  let name = '';
  const { res } = forChar(html, c => {
    switch (c) {
      case '>':
      case ' ':
        return 'stop';
      default:
        name += c;
    }
  });
  return { res, data: name };
}

function parseAttrName(html: string): ParseResult<string> {
  let name = '';
  const { res } = forChar(html, c => {
    switch (c) {
      case '=':
      case ' ':
      case '/':
      case '>':
        return 'stop';
      default:
        name += c;
    }
  });
  return { res, data: name };
}

function s(json): string {
  return JSON.stringify(json, null, 2);
}

function parseString(html: string, deliminator: string): ParseResult<string> {
  {
    const head = html[0];
    assert(
      head === deliminator,
      `expect string quote ${s(deliminator)}, got ${s(head)}`,
    );
  }
  let acc = deliminator;
  const { res } = forChar(html.substr(1), (c, i, html) => {
    switch (c) {
      case deliminator:
        acc += c;
        return 'stop';
      case '\\':
        acc += html[i + 1];
        return 'skip';
      default:
        acc += c;
    }
  });
  return { res: res.substr(1), data: acc };
}

function parseAttrValue(html: string): ParseResult<string> {
  const c = html[0];
  switch (c) {
    case '"':
    case "'":
      return parseString(html, c);
    default:
      return parseTagName(html);
  }
}

interface Attr {
  name: string;
  value?: string;
}

class Attributes extends Node {
  // to preserve spaces
  data: Array<Attr | string> = [];

  get outerHTML(): string {
    let html = '';
    this.data.forEach(attrOrSpace => {
      if (typeof attrOrSpace === 'string') {
        const space: string = attrOrSpace;
        html += space;
      } else {
        const attr: Attr = attrOrSpace;
        const { name, value } = attr;
        html += name;
        if (typeof value === 'string') {
          html += '=' + value;
        }
      }
    });
    return html;
  }
}

function parseTagAttrs(html: string): ParseResult<Attributes> {
  const attributes = new Attributes();
  const { res } = forChar(html, (c, i, html) => {
    switch (c) {
      case ' ':
      case '\n':
        attributes.data.push(c);
        break;
      case '/':
      case '>':
        return 'stop';
      default: {
        let attr: Attr;
        {
          html = html.substr(i);
          const { res, data } = parseAttrName(html);
          attr = {
            name: data,
          };
          html = res;
        }
        if (html[0] === '=') {
          html = html.substr(1);
          const { res, data } = parseAttrValue(html);
          attr.value = data;
          html = res;
        }
        attributes.data.push(attr);
        return { res: html };
      }
    }
  });
  return { res, data: attributes };
}

function noBody(tagName: string) {
  switch (tagName.toLowerCase()) {
    case 'br':
    case 'input':
    case 'meta':
    case 'img':
    case 'link':
      return true;
    default:
      return false;
  }
}

class HTMLElement extends Node {
  tagName: string;
  noBody = false;
  attributes: Attributes;

  get outerHTML(): string {
    let html = `<${this.tagName}`;
    html += this.attributes.outerHTML;
    if (this.noBody) {
      html += '/>';
      return html;
    }
    html += '>';
    this.childNodes.forEach(node => (html += node.outerHTML));
    if (!noBody(this.tagName)) {
      html += `</${this.tagName}>`;
    }
    return html;
  }

  static parse(html: string): ParseResult<Node> {
    assert(html[0] === '<', 'expect tag open bracket');
    const node = new HTMLElement();
    {
      const { res, data } = parseTagName(html.substr(1));
      node.tagName = data;
      html = res;
    }
    {
      const { res, data } = parseTagAttrs(html);
      node.attributes = data;
      html = res;
    }
    if (config.debug) {
      console.log('parsing element body:');
      console.log(s({ node, html }));
    }
    if (html.startsWith('/>')) {
      node.noBody = true;
      html = html.substr(2);
      return { res: html, data: node };
    }
    // html starts with '>'
    html = html.substr(1);
    if (noBody(node.tagName)) {
      return { res: html, data: node };
    }
    for (; html.length > 0; ) {
      const c = html[0];
      if (c === '<') {
        // meet open/close tag
        if (html.startsWith('</')) {
          // close node
          const selfCloseTagHtml = `</${node.tagName}>`;
          if (html.startsWith(selfCloseTagHtml)) {
            // normal close
            html = html.substr(selfCloseTagHtml.length);
            break;
          } else {
            // auto repair close
            break;
          }
        } else {
          // open node
          /* tslint:disable:no-use-before-declare */
          const { res, data } = parse(Document, html);
          /* tslint:enable:no-use-before-declare */
          node.childNodes.push(data);
          html = res;
        }
      } else {
        // meet body content
        const { res, data } = parse(Text, html);
        node.childNodes.push(data);
        html = res;
      }
    }
    return { res: html, data: node };
  }
}

class Command extends HTMLElement {
  constructor() {
    super();
    this.noBody = true;
  }

  get outerHTML(): string {
    let html = `<!${this.tagName}`;
    html += this.attributes.outerHTML;
    html += `>`;
    return html;
  }

  static parse(html: string): ParseResult<HTMLElement> {
    assert(html[0] === '<', `expect open command tag ${s('<')}`);
    assert(html[1] === '!', `expect open command prefix ${s('<!')}`);
    html = html.substr(2);
    const command = new Command();
    {
      const { res, data } = parseTagName(html);
      command.tagName = data;
      html = res;
    }
    {
      const { res, data } = parseTagAttrs(html);
      command.attributes = data;
      html = res;
    }
    assert(html[0] === '>', `expect close command tag ${s('>')}`);
    html = html.substr(1);
    return { res: html, data: command };
  }
}

class Comment extends Command {
  content: string;

  get outerHTML(): string {
    return `<!--${this.content}-->`;
  }

  static parse(html: string): ParseResult<Comment> {
    assert(html[0] === '<', `expect open comment tag ${s('<')}`);
    assert(html[1] === '!', `expect open comment prefix ${s('!')}`);
    assert(html[2] === '-', `expect open comment prefix ${s('-')}`);
    assert(html[3] === '-', `expect open comment prefix ${s('-')}`);
    html = html.substr(4);
    let acc = '';
    const { res } = forChar(html, (c, i, html) => {
      switch (c) {
        case '-':
          // if (html.startsWith('-->', i)) {
          if (html[i + 1] === '-' && html[i + 2] === '>') {
            return 'stop';
          }
          acc += c;
          break;
        default:
          acc += c;
      }
    });
    html = res;
    assert(html[0] === '-', `expect close comment suffix ${s('-')}`);
    assert(html[1] === '-', `expect close comment suffix ${s('-')}`);
    assert(html[2] === '>', `expect close comment suffix ${s('>')}`);
    html = html.substr(3);
    const comment = new Comment();
    comment.content = acc;
    return { res: html, data: comment };
  }
}

class Document extends HTMLElement {
  get outerHTML(): string {
    return this.childNodes.map(node => node.outerHTML).join('');
  }

  static parse(html: string): ParseResult<Node> {
    if (html[0] === '<') {
      if (html[1] === '!') {
        if (html[2] === '-' && html[2] === '-') {
          return parse(Comment, html);
        }
        // not '<!--'
        return parse(Command, html);
      }
      // not '<!'
      return parse(HTMLElement, html);
    }
    // not '<'
    return parse(Text, html);
  }
}

let parseLevel = 0;

function parse<T extends Node>(
  context: NodeConstructor<T>,
  html: string,
): ParseResult<T> {
  const prefix = ' '.repeat(parseLevel * 2);
  if (config.dev) {
    console.log(prefix + 'enter context:', context.name);
  }
  if (config.debug) {
    console.log('|>>>:html|', html, '|html:<<<|');
    /*
    console.log({
      len: html.length,
      s: s(html),
      0: html.charCodeAt(0),
      1: html.charCodeAt(1),
    });
    */
  }
  parseLevel++;
  const res = context.parse(html);
  parseLevel--;
  if (config.dev) {
    console.log(prefix + 'leave context:', context.name);
  }
  if (config.debug) {
    console.log('|>>>:res|', res.res, '|res:<<<|');
    console.log('|>>>:data|');
    logNode(res.data);
    console.log('|data:<<<|');
  }
  return res;
}

export function parseHtml(html: string): HTMLElement {
  const root = new Document();
  for (; html.length > 0; ) {
    const c = html[0];
    const p = (context: NodeConstructor<any>) => {
      const { res, data } = parse(context, html);
      root.childNodes.push(data);
      html = res;
    };
    switch (c) {
      case '<':
        p(Document);
        break;
      default:
        p(Text);
    }
  }
  if (html.length !== 0) {
    console.error('not fully parsed html string');
  }
  return root;
}

export function logNode(node: Node) {
  function walkNode(node: Node) {
    const constructor = ((node as any) as HTMLElement)
      .constructor as NodeConstructor<any>;
    const name = constructor.name;
    return {
      name,
      node: {
        ...node,
        childNodes: node.childNodes.map(node => walkNode(node)),
      },
    };
  }

  console.log(JSON.stringify(walkNode(node), null, 2));
}
