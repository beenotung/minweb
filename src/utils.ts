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
