export let config = {
  dev: false,
  debug: false,
  autoRepair: false,
};
// config.dev = true;
// config.debug = true;
// config.autoRepair = true;

interface ParseResult<T> {
  res: string;
  data: T;
}

abstract class Node {
  outerHTML: string;
  childNodes?: Node[];
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
        acc += '\\' + html[i + 1];
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
  attrs: Array<Attr | string> = [];

  get outerHTML(): string {
    let html = '';
    this.attrs.forEach(attrOrSpace => {
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

  hasName(name: string): boolean {
    return this.attrs.some(
      attr => typeof attr === 'object' && attr.name === name,
    );
  }

  getValue(name: string): string | undefined {
    const attr = this.attrs.find(
      attr => typeof attr === 'object' && attr.name === name,
    ) as Attr;
    if (!attr) {
      return;
    }
    const value = attr.value;
    if (!value) {
      return;
    }
    const c = value[0];
    if (c === value[value.length - 1]) {
      switch (c) {
        case '"':
        case "'":
          return value.substring(1, value.length - 1);
      }
    }
    return value;
  }
}

function parseTagAttrs(html: string): ParseResult<Attributes> {
  const attributes = new Attributes();
  const { res } = forChar(html, (c, i, html) => {
    switch (c) {
      case ' ':
      case '\n':
        attributes.attrs.push(c);
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
        attributes.attrs.push(attr);
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
    case 'base':
      return true;
    default:
      return false;
  }
}

/**
 * parse until the body of the element (not recursively)
 * */
function parseHTMLElementHead(html: string): ParseResult<HTMLElement> {
  assert(html[0] === '<', 'expect tag open bracket');
  html = html.substr(1);
  /* tslint:disable:no-use-before-declare */
  const node = new HTMLElement();
  /* tslint:enable:no-use-before-declare */
  {
    const { res, data } = parseTagName(html);
    node.tagName = data;
    html = res;
  }
  {
    const { res, data } = parseTagAttrs(html);
    node.attributes = data;
    html = res;
  }
  if (html.startsWith('/>')) {
    node.noBody = true;
    html = html.substr(2);
    return { res: html, data: node };
  }
  // html starts with '>'
  html = html.substr(1);
  return { res: html, data: node };
}

/**
 * start from end of body, must not be still inside open tag
 * */
function parseHTMLElementTail(
  html: string,
  node: HTMLElement,
  closeTagHTML: string,
): ParseResult<void> {
  assert(html[0] === '<', 'expect tag close bracket');
  // TODO support edge case of different cases of opening and closing (e.g. <p></P>)
  if (html.startsWith(closeTagHTML)) {
    // normal close
    node.notClosed = false;
    html = html.substr(closeTagHTML.length);
  } else {
    // auto repair close
    node.notClosed = true;
    if (config.debug) {
      console.log('auto repair:', node);
    }
  }
  return { res: html, data: void 0 };
}

class HTMLElement extends Node {
  tagName: string;
  noBody = false;
  attributes: Attributes;
  /* auto repair */
  notClosed = true;

  get outerHTML(): string {
    let html = `<${this.tagName}`;
    html += this.attributes.outerHTML;
    if (this.noBody) {
      html += '/>';
      return html;
    }
    html += '>';
    (this.childNodes || []).forEach(node => (html += node.outerHTML));
    if (!noBody(this.tagName) && (config.autoRepair || !this.notClosed)) {
      html += `</${this.tagName}>`;
    }
    return html;
  }

  static parse(html: string): ParseResult<Node> {
    // const originalHtml = html;
    let node: HTMLElement;
    {
      const { res, data } = parseHTMLElementHead(html);
      node = data;
      html = res;
    }
    if (node.tagName.toLowerCase() === 'style') {
      return continueParseStyleFromHTMLElement(html, node);
    }
    if (node.tagName.toLowerCase() === 'script') {
      return continueParseScriptFromHTMLElement(html, node);
    }
    if (noBody(node.tagName)) {
      return { res: html, data: node };
    }
    node.childNodes = [];
    for (; html.length > 0; ) {
      const c = html[0];
      if (c === '<') {
        // meet open/close tag
        if (html.startsWith('</')) {
          // close node
          const selfCloseTagHtml = `</${node.tagName}>`;
          if (html.startsWith(selfCloseTagHtml)) {
            // normal close
            node.notClosed = false;
            html = html.substr(selfCloseTagHtml.length);
            break;
          } else {
            // auto repair close
            node.notClosed = true;
            if (config.debug) {
              console.log('auto repair:', node);
            }
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

function parseStyleComment(html: string): ParseResult<string> {
  assert(html[0] === '/', `expect start style comment prefix ${s('/')}`);
  assert(html[1] === '*', `expect start style comment prefix ${s('*')}`);
  html = html.substr(2);
  let acc = '';
  const { res } = forChar(html, (c, i, html) => {
    if (c === '*' && html[i + 1] === '/') {
      return 'stop';
    }
    acc += c;
  });
  html = res;
  assert(html[0] === '*', `expect start style comment suffix ${s('*')}`);
  assert(html[1] === '/', `expect start style comment suffix ${s('/')}`);
  return { res: html.substr(2), data: acc };
}

function parseStyleBody(
  html: string,
  closeTagHTML: string,
): ParseResult<string> {
  let acc = '';
  const { res } = forChar(html, (c, i, html) => {
    if (c === '/' && html[i + 1] === '*') {
      const { res, data } = parseStyleComment(html.substr(i));
      acc += '/*' + data + '*/';
      return { res };
    }
    // TODO support edge case of different cases, e.g. <style></STYLE>
    if (html.startsWith(closeTagHTML, i)) {
      return 'stop';
    }
    acc += c;
  });
  return { res, data: acc };
}

abstract class DSLELement extends HTMLElement {
  textContent: string;

  get outerHTML(): string {
    let html = `<${this.tagName}`;
    html += this.attributes.outerHTML;
    if (this.noBody) {
      html += '/>';
      return html;
    }
    html += '>';
    html += this.textContent;
    html += `</${this.tagName}>`;
    return html;
  }
}

class Style extends DSLELement {}

function continueParseStyleFromHTMLElement(
  html: string,
  node: HTMLElement,
): ParseResult<Style> {
  const style = new Style();
  Object.assign(style, node);
  if (style.noBody) {
    return { res: html, data: style };
  }
  const closeTagHTML = `</${node.tagName}>`;
  {
    const { res, data } = parseStyleBody(html, closeTagHTML);
    style.textContent = data;
    html = res;
  }
  {
    const { res } = parseHTMLElementTail(html, style, closeTagHTML);
    html = res;
  }
  return { res: html, data: style };
}

class Script extends DSLELement {}

function parseScriptBody(
  html: string,
  closeTagHTML: string,
): ParseResult<string> {
  let acc = '';
  const { res } = forChar(html, (c, i, html) => {
    switch (c) {
      case '"':
      case "'": {
        const { res, data } = parseString(html.substr(i), c);
        acc += data;
        return { res };
      }
      case '/': {
        if (html[i + 1] === '/') {
          // single line comment
          html = html.substr(i + 2);
          let end = html.indexOf('\n');
          if (end === -1) {
            end = html.length;
          }
          acc += '//' + html.substring(0, end);
          return { res: html.substr(end) };
        }
        if (html[i + 1] === '*') {
          // multiple line comment
          html = html.substring(i + 2);
          let end = html.indexOf('*/');
          if (end === -1) {
            end = html.length;
          }
          acc += '/*' + html.substring(0, end) + '*/';
          return { res: html.substring(end + 2) };
        }
        acc += c;
        break;
      }
      default:
        if (html.startsWith(closeTagHTML, i)) {
          return 'stop';
        }
        acc += c;
    }
  });
  return { res, data: acc };
}

function parseJSONScriptBody(
  html: string,
  closeTagHTML: string,
): ParseResult<string> {
  // TODO escape string
  let end = html.indexOf(closeTagHTML);
  if (end === -1) {
    end = html.length;
  }
  const acc = html.substr(0, end);
  const res = html.substr(end);
  return { res, data: acc };
}

function continueParseScriptFromHTMLElement(
  html: string,
  node: HTMLElement,
): ParseResult<Script> {
  const script = new Script();
  Object.assign(script, node);
  if (script.noBody) {
    return { res: html, data: script };
  }
  const closeTagHTML = `</${node.tagName}>`;
  if (
    script.attributes.hasName('type') &&
    script.attributes.getValue('type') === 'application/json'
  ) {
    const { res, data } = parseJSONScriptBody(html, closeTagHTML);
    script.textContent = data;
    html = res;
  } else {
    const { res, data } = parseScriptBody(html, closeTagHTML);
    script.textContent = data;
    html = res;
  }
  {
    const { res } = parseHTMLElementTail(html, script, closeTagHTML);
    html = res;
  }
  return { res: html, data: script };
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
    console.log('|>>>:html(first-10)|', html.substr(0, 10), '|html:<<<|');
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
    console.log('|>>>:res(first-10)|', res.res.substr(0, 10), '|res:<<<|');
    console.log('|>>>:data|');
    logNode(res.data);
    console.log('|data:<<<|');
  }
  return res;
}

export function parseHtml(html: string): HTMLElement {
  const root = new Document();
  root.childNodes = [];
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

/* for debug */
export function wrapNode(node: Node) {
  const constructor = ((node as any) as HTMLElement)
    .constructor as NodeConstructor<any>;
  const name = constructor.name;
  return {
    name,
    node: {
      ...node,
      childNodes: node.childNodes
        ? node.childNodes.map(node => wrapNode(node))
        : [],
    },
  };
}

export function logNode(node: Node) {
  console.log(JSON.stringify(wrapNode(node), null, 2));
}
