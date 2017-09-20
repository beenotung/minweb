const fetch = require('node-fetch');

let log = console.log;
let error = console.error;
let print = console.log;

let Modes = [
  'outside'
  , 'tagName'
  , 'closeTagName'
  , 'tagAttrName'
  , 'tagAttrValue'
];
let Mode = {};
Modes.forEach(x=>Mode[x]=x);

let parse = (text, i, mode, output) => {
  let s = text.slice(i);
  let tagName;
  let tagAttrName;
  let tagAttrValue;
  let textContent;
  let changeMode = newMode => {
    if (Mode[newMode] === undefined) {
      throw new TypeError('invalid newMode: ' + newMode);
    }
    switch (mode) {
      case Mode.outside:
        break
      case Mode.tagName:
        log('tagName:', tagName);
        break;
      case Mode.closeTagName:
        log('closeTagName:', tagName);
        break;
      case Mode.tagAttrName:
        log('tagAttrName:', tagAttrName);
        break;
      case Mode.tagAttrValue:
        log('tagAttrValue:', tagAttrValue);
        break;
      default:
        throw new Error('not impl for mode:' + mode);
    }
    log(`mode: ${mode} -> ${newMode}`);
    mode = newMode;
    switch (c) {
      case Mode.outside:
        textContent = '';
        break;
      default:
        throw new Error('not impl for newMode:' + mode);
    }
  };
  loop:
  for (let c of s) {
    switch (mode) {
      case Mode.outside:
        if (c == '<') {
          changeMode(Mode.tagName);
          tagName = '';
          continue loop;
        }
      case Mode.tagName:
        switch (c) {
          case '>':
            changeMode(Mode.outside);
            continue loop;
          case ' ':
            changeMode(Mode.tagAttrName);
            tagAttrName = '';
            continue loop;
          default:
            if (tagName == '' && c == '/') {
              changeMode(Mode.closeTagName);
            } else {
              tagName += c;
            }
            continue loop;
        }
      case Mode.closeTagName:
        if (c == '>') {
          changeMode(Mode.outside);
        } else {
          tagName += c;
        }
        continue loop;
      case Mode.tagAttrName:
        if (tagAttrName == '' && c == ' ') {
            continue loop;
        }
        if (c == ' ') {
          changeMode(Mode.tagAttrName);
          tagAttrName = '';
          continue loop;
        }
        if (c == '>') {
          changeMode(Mode.outside);
          continue loop;
        }
        if (c == '=') {
          changeMode(Mode.tagAttrValue);
          tagAttrValue = '';
          continue loop;
        }
        tagAttrName += c;
        continue loop;
      case Mode.tagAttrValue:
        if (c == ' ') {
          changeMode(Mode.tagAttrName);
          continue loop;
        }
        tagAttrValue += c;
        continue loop;
      default:
        return error('unknown mode: ' + mode);
    }
  }
  return output;
};

//let url = 'https://github.com/tautologistics/node-htmlparser';
let url = 'https://www.google.com.hk/?gfe_rd=cr&dcr=0&ei=_ujBWax70ITgAtTCtcAB';

fetch(url)
  .then(x => x.text())
  .then(x => {
    log('loaded', x.length, 'chars');

    let output = [];
    parse(x, 0, Mode.outside, output);
    log('output', output);
  })
  .catch(e => error(e));
