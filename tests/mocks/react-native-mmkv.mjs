export class MMKV {
  constructor() {
    this.storage = new Map();
  }
  set(key, val) {
    this.storage.set(key, val);
  }
  getString(key) {
    const v = this.storage.get(key);
    return typeof v === 'string' ? v : undefined;
  }
  getNumber(key) {
    const v = this.storage.get(key);
    return typeof v === 'number' ? v : undefined;
  }
  getBoolean(key) {
    const v = this.storage.get(key);
    return typeof v === 'boolean' ? v : undefined;
  }
  delete(key) {
    this.storage.delete(key);
  }
  clearAll() {
    this.storage.clear();
  }
  getAllKeys() {
    return Array.from(this.storage.keys());
  }
  contains(key) {
    return this.storage.has(key);
  }
}
