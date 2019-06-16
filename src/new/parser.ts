export let config = {
  dev: false,
  debug: false,
  debugStream: false,
  autoRepair: false,
};
// config.dev = true;
// config.debug = true;
// config.autoRepair = true;

interface ParseResult<T> {
  res: string;
  data: T;
}

export abstract class Node {
  abstract outerHTML: string;
  abstract minifiedOuterHTML: string;
  childNodes?: Node[];

  constructor(public parentNode: Node) {
    if (!parentNode) {
      return;
    }
    if (parentNode.childNodes) {
      parentNode.childNodes.push(this);
    } else {
      parentNode.childNodes = [this];
    }
  }

  toJSON() {
    const res = {
      ...this,
      parentNode: undefined,
    };
    delete res.childNodes;
    res.childNodes = this.childNodes;
    return res;
  }

  abstract clone(): this;
}

export interface NodeConstructor<T extends Node> {
  name: string;

  new (parent: Node): T;

  parse(html: string, parent: Node): ParseResult<T>;
}

export function walkNode(
  node: Node,
  f: (node: Node, parent: Node, idx: number) => void,
  parent = node,
  idx = -1,
) {
  f(node, parent, idx);
  node.childNodes.forEach((child, idx) => walkNode(child, f, node, idx));
}

export function walkNodeReversed(
  node: Node,
  f: (node: Node, parent: Node, idx: number) => void,
  parent = node,
) {
  const stack: Array<{ node: Node; parent: Node; idx: number }> = [];
  walkNode(
    node,
    (node, parent, idx) => stack.push({ node, parent, idx }),
    parent,
  );
  for (let i = stack.length; i > 0; i--) {
    const { node, parent, idx } = stack.pop();
    f(node, parent, idx);
  }
}

/**
 * trim the left and right whitespace, but preserve at most one whitespace if it exist
 * */
export function trimText(s: string): string {
  let t = s.trimLeft();
  if (t.length !== s.length) {
    t = s[0] + s.substr(1).trimLeft();
  }
  s = t;
  t = s.trimRight();
  if (t.length !== s.length) {
    t = s.substr(0, s.length - 1).trimRight() + s[s.length - 1];
  }
  return t;
}

type ForCharResult = 'stop' | 'skip' | { res: string; stop?: boolean };

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
          if (res.stop) {
            break main;
          }
        }
      }
    }
  }
  return { res: html.substr(i) };
}

function assert(b: boolean, error) {
  if (!b) {
    throw error;
  }
}

function newNode<T extends Node>(node: T): T {
  const newNode = new (node.constructor as any)(node.parentNode);
  // newNode.parentNode.childNodes.pop()
  return newNode;
}

export class Text extends Node {
  outerHTML: string;

  clone(): this {
    const node = newNode(this);
    node.outerHTML = this.outerHTML;
    node.childNodes = node.childNodes
      ? this.childNodes.slice()
      : this.childNodes;
    return node;
  }

  get minifiedOuterHTML(): string {
    return trimText(this.outerHTML);
  }

  static parse(html: string, parent: Node): ParseResult<Text> {
    let acc = '';
    const { res } = forChar(html, c => {
      switch (c) {
        case '<':
          return 'stop';
        default:
          acc += c;
      }
    });
    const node = new Text(parent);
    node.outerHTML = acc;
    return {
      res,
      data: node,
    };
  }
}

function parseTagName(html: string): ParseResult<string> {
  if (html[0] === '!') {
    throw new Error('expect non-command opening');
  }
  if (html[0] === '/') {
    console.error('html:', html.substr(0, 20));
    throw new Error('expect non-closing-tag');
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
    case '/': {
      let acc = c;
      const { res } = forChar(html.substr(1), (c, i, html) => {
        if (c.trim().length === 0) {
          return 'stop';
        }
        if (c === '>') {
          return 'stop';
        }
        if (c === '/' && html[i + 1] === '>') {
          acc += c;
          // return { res: html.substr(i + 1) ,stop:true}
          return 'stop';
        }
        acc += c;
      });
      return { res, data: acc };
    }
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

  constructor(parent: Node) {
    super(parent);
    parent.childNodes.pop();
  }

  clone(): this {
    const node = newNode(this);
    node.attrs = this.attrs.slice();
    node.childNodes = node.childNodes
      ? this.childNodes.slice()
      : this.childNodes;
    return node;
  }

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

  get minifiedOuterHTML(): string {
    let html = '';
    this.attrs.forEach(attr => {
      if (typeof attr === 'string') {
        return;
      }
      const { name, value } = attr;
      html += ' ' + name;
      if (typeof value === 'string') {
        html += '=' + value;
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

  static parse(html: string, parent: Node): ParseResult<Attributes> {
    const attributes = new Attributes(parent);
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
function parseHTMLElementHead(
  html: string,
  parent: Node,
): ParseResult<HTMLElement> {
  assert(html[0] === '<', 'expect tag open bracket');
  // assert(html[1]!=='/',new Error('expect tag name'));
  html = html.substr(1);
  /* tslint:disable:no-use-before-declare */
  const node = new HTMLElement(parent);
  /* tslint:enable:no-use-before-declare */
  {
    if (html[0] === '/') {
      node.extraClosing = true;
      node.noBody = true;
      html = html.substr(1);
    }
    const { res, data } = parseTagName(html);
    node.tagName = data;
    html = res;
  }
  {
    const { res, data } = Attributes.parse(html, node);
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

export function isTagName(node: Node, tagName: string) {
  /* tslint:disable:no-use-before-declare */
  return node instanceof HTMLElement && node.isTagName(tagName);
  /* tslint:enable:no-use-before-declare */
}

export function isAnyTagName(node: Node, tagNames: string[]) {
  /* tslint:disable:no-use-before-declare */
  return node instanceof HTMLElement && node.isAnyTagName(tagNames);
  /* tslint:enable:no-use-before-declare */
}

export class HTMLElement extends Node {
  tagName: string;
  noBody?: boolean;
  attributes: Attributes;
  /* auto repair */
  notOpened?: boolean;
  notClosed = true;
  extraClosing?: boolean;

  clone(): this {
    const node = newNode(this);
    node.tagName = this.tagName;
    node.noBody = this.noBody;
    node.attributes = this.attributes.clone();
    node.notClosed = this.notClosed;
    node.childNodes = node.childNodes
      ? this.childNodes.map(node => node.clone())
      : this.childNodes;
    return node;
  }

  get outerHTML(): string {
    if (this.extraClosing) {
      return config.autoRepair ? '' : `</${this.tagName}>`;
    }
    let html = '';
    if (!this.notOpened) {
      html += `<${this.tagName}`;
      html += this.attributes.outerHTML;
      if (this.noBody) {
        html += '/>';
        return html;
      }
      html += '>';
    }
    (this.childNodes || []).forEach(node => (html += node.outerHTML));
    if (!noBody(this.tagName) && (config.autoRepair || !this.notClosed)) {
      html += `</${this.tagName}>`;
    }
    return html;
  }

  get minifiedOuterHTML(): string {
    if (this.extraClosing) {
      return '';
    }
    let html = `<${this.tagName}`;
    html += this.attributes.minifiedOuterHTML;
    if (this.noBody) {
      html += '/>';
      return html;
    }
    html += '>';
    if (this.childNodes) {
      this.childNodes.forEach(node => (html += node.minifiedOuterHTML));
    }
    if (!noBody(this.tagName) && (config.autoRepair || !this.notClosed)) {
      html += `</${this.tagName}>`;
    }
    return html;
  }

  /**
   * @param tagName assume to be in lower case
   * TODO optimize this part if possible
   * */
  isTagName(tagName: string): boolean {
    return this.tagName.toLowerCase() === tagName;
  }

  /**
   * @param tagNames assume to be in lower case
   * TODO optimize this part if possible
   * */
  isAnyTagName(tagNames: string[]): boolean {
    const tagName = this.tagName.toLowerCase();
    return tagNames.some(tag => tag === tagName);
  }

  hasText(): boolean {
    return (
      this.childNodes &&
      this.childNodes.some(
        node =>
          node instanceof Text ||
          (node instanceof HTMLElement && node.hasText()),
      )
    );
  }

  getElementsByTagName(tagName: string): HTMLElement[] {
    const elements: HTMLElement[] = [];
    walkNode(this, node => {
      if (isTagName(node, tagName)) {
        elements.push(node as HTMLElement);
      }
    });
    return elements;
  }

  hasElementByTagName(tagName: string): boolean {
    const f = (node: Node) =>
      isTagName(node, tagName) || node.childNodes.some(node => f(node));
    return f(this);
  }

  hasElementByAnyTagName(tagNames: string[]): boolean {
    const f = (node: Node) =>
      isAnyTagName(node, tagNames) || node.childNodes.some(node => f(node));
    return f(this);
  }

  hasParentElementByTagName(tagName: string): boolean {
    tagName = tagName.toLowerCase();
    for (let node = this.parentNode; node; node = node.parentNode) {
      if (node instanceof HTMLElement && node.isTagName(tagName)) {
        return true;
      }
    }
    return false;
  }

  static parse(html: string, parent: Node): ParseResult<Node> {
    // const originalHtml = html;
    let node: HTMLElement;
    {
      const { res, data } = parseHTMLElementHead(html, parent);
      node = data;
      html = res;
    }
    if (node instanceof HTMLElement) {
      if (node.extraClosing) {
        return { res: html, data: node };
      }
    }
    if (node.tagName.toLowerCase() === 'style') {
      return continueParseStyleFromHTMLElement(html, node);
    }
    if (node.tagName.toLowerCase() === 'script') {
      return continueParseScriptFromHTMLElement(html, node);
    }
    if (node.noBody || noBody(node.tagName)) {
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
            const { res, data } = HTMLElement.parse(html, node);
            if (data instanceof HTMLElement) {
              assert(
                data.extraClosing,
                new Error('expect to repair extra closing'),
              );
              if (data.hasParentElementByTagName(data.tagName)) {
                // auto closing parent, then re-open
                node.childNodes.pop();
                const repairingTagName = data.tagName.toLowerCase();
                let repairingNodeParent: Node;
                for (
                  let nodeAcc = node.parentNode;
                  nodeAcc;
                  nodeAcc = nodeAcc.parentNode
                ) {
                  if (nodeAcc instanceof HTMLElement) {
                    nodeAcc.notClosed = true;
                    if (nodeAcc.isTagName(repairingTagName)) {
                      // this is the matching parent parent
                      nodeAcc.notClosed = false;
                      repairingNodeParent = nodeAcc.parentNode;
                    }
                    // still need to travel up-ward
                  }
                }
                const reopenedNode = node.clone();
                reopenedNode.parentNode.childNodes.pop();
                reopenedNode.childNodes = [];
                // reopenedNode.parentNode = repairingNodeParent;
                // reopenedNode.parentNode.childNodes.push(reopenedNode);
                const res1 = res;
                {
                  const { res, data } = parse(
                    Document,
                    reopenedNode.outerHTML + res1,
                    repairingNodeParent,
                  );
                  if (data instanceof HTMLElement) {
                    data.notOpened = true;
                  }
                  html = res;
                }
                continue;
              } else {
                // ignore extra closing
                html = res;
                continue;
              }
            }
            if (data instanceof HTMLElement && noBody(data.tagName)) {
              html = res;
              continue;
            }
            node.notClosed = true;
            if (config.debug) {
              console.log('auto repair:', node);
            }

            break;
          }
        } else {
          // open node
          /* tslint:disable:no-use-before-declare */
          const { res, data } = parse(Document, html, node);
          /* tslint:enable:no-use-before-declare */
          html = res;
        }
      } else {
        // meet body content
        const { res, data } = parse(Text, html, node);
        html = res;
      }
    }
    return { res: html, data: node };
  }
}

class Command extends HTMLElement {
  constructor(parent: Node) {
    super(parent);
    this.noBody = true;
  }

  get outerHTML(): string {
    let html = `<!${this.tagName}`;
    html += this.attributes.outerHTML;
    html += `>`;
    return html;
  }

  get minifiedOuterHTML(): string {
    let html = `<!${this.tagName}`;
    html += this.attributes.minifiedOuterHTML;
    html += '>';
    return html;
  }

  static parse(html: string, parent: Node): ParseResult<HTMLElement> {
    assert(html[0] === '<', `expect open command tag ${s('<')}`);
    assert(html[1] === '!', `expect open command prefix ${s('<!')}`);
    html = html.substr(2);
    const command = new Command(parent);
    {
      const { res, data } = parseTagName(html);
      command.tagName = data;
      html = res;
    }
    {
      const { res, data } = Attributes.parse(html, command);
      command.attributes = data;
      html = res;
    }
    assert(html[0] === '>', `expect close command tag ${s('>')}`);
    html = html.substr(1);
    return { res: html, data: command };
  }
}

export class Comment extends Command {
  content: string;

  clone(): this {
    const node = newNode(this);
    node.content = this.content;
    node.childNodes = node.childNodes
      ? this.childNodes.slice()
      : this.childNodes;
    return node;
  }

  get outerHTML(): string {
    return `<!--${this.content}-->`;
  }

  get minifiedOuterHTML(): string {
    return '';
  }

  static parse(html: string, parent: Node): ParseResult<Comment> {
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
    const comment = new Comment(parent);
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

abstract class DSLElement extends HTMLElement {
  textContent: string;
  abstract minifiedTextContent: string;

  clone(): this {
    const node = newNode(this);
    node.textContent = this.textContent;
    node.childNodes = node.childNodes
      ? this.childNodes.slice()
      : this.childNodes;
    return node;
  }

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

  get minifiedOuterHTML(): string {
    let html = `<${this.tagName}`;
    html += this.attributes.minifiedOuterHTML;
    if (this.noBody) {
      html += '/>';
      return html;
    }
    html += '>';
    html += this.minifiedTextContent;
    html += `</${this.tagName}>`;
    return html;
  }
}

class Style extends DSLElement {
  get minifiedTextContent(): string {
    let acc = '';
    forChar(this.textContent, (c, i, html) => {
      switch (c) {
        case '/': {
          if (html[i + 1] === '*') {
            i += 2;
            let end = html.indexOf('*/', i);
            if (end === -1) {
              end = html.length;
            }
            return { res: html.substr(end) };
          }
          acc += c;
          break;
        }
        case '"':
        case "'": {
          const { res, data } = parseString(html.substr(i), c);
          acc += data;
          return { res };
        }
        default: {
          if (
            c.trim().length !== 0 ||
            (acc.length === 0 || acc[acc.length - 1].trim().length !== 0)
          ) {
            acc += c;
          }
        }
      }
    });
    return acc;
  }
}

function continueParseStyleFromHTMLElement(
  html: string,
  node: HTMLElement,
): ParseResult<Style> {
  const style = new Style(node.parentNode);
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

class Script extends DSLElement {
  get minifiedTextContent(): string {
    let acc = '';
    forChar(this.textContent, (c, i, html) => {
      switch (c) {
        case '/': {
          const nextC = html[i + 1];
          if (nextC === '/') {
            let end = html.indexOf('\n', i);
            if (end === -1) {
              end = html.length;
            }
            return { res: html.substr(end) };
          }
          if (nextC === '*') {
            let end = html.indexOf('*/', i);
            if (end === -1) {
              end = html.length;
            }
            return { res: html.substr(end) };
          }
          acc += c;
          break;
        }
        case '"':
        case "'": {
          const { res, data } = parseString(html, c);
          acc += data;
          return { res };
        }
        case '`': {
          const { res, data } = parseStringWithDashQuote(html);
          acc += data;
          return { res };
        }
        default: {
          if (
            acc.length === 0 ||
            c.trim().length !== 0 ||
            acc[acc.length - 1].trim().length !== 0
          ) {
            acc += c;
          }
        }
      }
    });
    return acc;
  }
}

function parseStringWithDashQuote(html: string): ParseResult<string> {
  assert(html[0] === '`', 'expect string with dash quote starting quote');
  let acc = '';
  const { res } = forChar(html.substr(1), (c, i, html) => {
    if (c === '$' && html[i + 1] === '{') {
      const { res, data } = parseScriptBody(html.substr(2), '}');
      acc += '$' + data;
      return { res };
    }
    if (c === '`') {
      return 'stop';
    }
    acc += c;
  });
  acc = '`' + acc + '`';
  return { res: res.substr(1), data: acc };
}

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
      case '`': {
        const { res, data } = parseStringWithDashQuote(html);
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
  const script = new Script(node.parentNode);
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

export class Document extends Node {
  childNodes: Node[] = [];

  constructor() {
    super(null);
  }

  clone(): this {
    const node = newNode(this);
    node.childNodes = node.childNodes
      ? this.childNodes.slice()
      : this.childNodes;
    return node;
  }

  get outerHTML(): string {
    return this.childNodes.map(node => node.outerHTML).join('');
  }

  get minifiedOuterHTML(): string {
    return this.childNodes.map(node => node.minifiedOuterHTML).join('');
  }

  static parse(html: string, parent: Node): ParseResult<Node> {
    if (html[0] === '<') {
      if (html[1] === '!') {
        if (html[2] === '-' && html[2] === '-') {
          return parse(Comment, html, parent);
        }
        // not '<!--'
        return parse(Command, html, parent);
      }
      // not '<!'
      return parse(HTMLElement, html, parent);
    }
    // not '<'
    return parse(Text, html, parent);
  }
}

let parseLevel = 0;

function parse<T extends Node>(
  context: NodeConstructor<T>,
  html: string,
  parent: Node,
): ParseResult<T> {
  const prefix = ' '.repeat(parseLevel * 2);
  if (config.dev) {
    console.log(prefix + 'enter context:', context.name);
  }
  if (config.debugStream) {
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
  const res = context.parse(html, parent);
  parseLevel--;
  if (config.dev) {
    console.log(prefix + 'leave context:', context.name);
  }
  if (config.debugStream) {
    console.log('|>>>:res(first-10)|', res.res.substr(0, 10), '|res:<<<|');
    console.log('|>>>:data|');
    logNode(res.data);
    console.log('|data:<<<|');
  }
  return res;
}

export function parseHtmlDocument(html: string, skipTrim = false): Document {
  if (!skipTrim) {
    // to escape 5 leading 0xFEFF
    html = html.trimLeft();
  }
  const root = new Document();
  for (; html.length > 0; ) {
    const c = html[0];
    const p = (context: NodeConstructor<any>) => {
      const { res, data } = parse(context, html, root);
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
  const nodeJson = node.toJSON();
  if (node.childNodes) {
    delete nodeJson.childNodes;
    nodeJson.childNodes = node.childNodes.map(node => wrapNode(node)) as any[];
  }
  return {
    name,
    node: nodeJson,
  };
}

export function logNode(node: Node) {
  console.log(JSON.stringify(wrapNode(node), null, 2));
}

// for easy reference
export let NodeClasses: Array<typeof Node> = [
  Text,
  Attributes,
  HTMLElement,
  Command,
  Comment,
  DSLElement,
  Style,
  Script,
  Document,
];
