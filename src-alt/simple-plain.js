var toArray = xs => {
  var res = new Array(xs.length);
  for(var i=0; i< xs.length; i++){
    res[i] = xs[i];
  }
  return res;
};
var isAny = (x,xs) => xs.indexOf(x) !== -1;
var passList = [];
var removeList = [];
var clear = e => {
  var tagName = e.tagName.toLowerCase();
  if (isAny(tagName,[
    'script',
    'style',
    'link',
    'img',
    'video',
    'svg',
  ])){
    removeList.push(tagName);
    e.remove();
    return;
  }
  passList.push(tagName);
  for(var i=e.children.length-1;i>=0;i--){
    clear(e.children[i]);
  }
};
var uniq = xs => {
  var ys = [];
  xs.forEach(x=>ys.indexOf(x)===-1?ys.push(x):'');
  return ys;
};
var trim = s => {
  s = s.split('\n')
  .map(s=>s.trimRight())
  .join('\n')
  ;
  var cs = [];
  s.split('').forEach(c => {
    var last = cs[cs.length-1];
    if (c !== last) {
      cs.push(c);
      return;
    }
    if(isAny(c,'\n')){
      return;
    }
    cs.push(c);
  });
  return cs.join('');
};
var hack = () => {
  var i = setTimeout(()=>{});
  for(;i<=0;i--){
    clearTimeout(i);
    clearInterval(i);
  }
  clear(document.documentElement);
  var e = document.createElement('pre');
  var s = document.body || document.documentElement;
  s = s.textContent;
  e.textContent = trim(s);
  e.style.whiteSpace = 'pre-wrap';
  document.documentElement.remove();
  document.appendChild(e);
  passList = uniq(passList);
  removeList = uniq(removeList);
};
var plain = hack;
