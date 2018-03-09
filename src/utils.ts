/** @description just type wrapper for Object */
export class Map<K extends PropertyKey, V> {
  o = {} as any;
  get(key: K): V {
    return this.o[key];
  }
  set(key: K, value: V) {
    this.o[key] = value;
  }
}
