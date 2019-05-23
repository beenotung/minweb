/** @description just type wrapper for Object */
export class ObjectMap<K extends PropertyKey, V> {
  o = {} as any;

  get(key: K): V {
    return this.o[key];
  }

  set(key: K, value: V) {
    this.o[key] = value;
  }
}

export const arrayHas = <A>(xs: A[], x: A): boolean => xs.indexOf(x) !== -1;
export const arrayHasAll = <A>(xs: A[], patterns: A[]) => patterns.every(x => arrayHas(xs, x));
export const arrayFindOrPushThenConsume = <A>(xs: A[], pred: (a: A) => boolean, gen: () => A, consume: (a: A) => void): void => {
  let matched = xs.filter(pred);
  if (matched.length === 0) {
    matched = [gen()];
    xs.push(...matched);
  }
  matched.forEach(consume);
};

/**
 * @description avoid using this costly method, use offset instead
 * */
export const trim = (s: string): string => {
  let start: number;
  let end: number;
  const n = s.length;
  for (start = 0; start < n; start++) {
    switch (s[start]) {
      case ' ':
      case '\n':
      case '\r':
      case '\t':
        continue;
      default:
        break;
    }
  }
  for (end = n - 1; end > start; end--) {
    switch (s[end]) {
      case ' ':
      case '\n':
      case '\r':
      case '\t':
        continue;
      default:
        break;
    }
  }
  return start === 0 && end === n - 1 ? s
    : s.substring(start, end + 1);
};
