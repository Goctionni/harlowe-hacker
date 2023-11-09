(() => {
  if (!('Harlowe' in window)) return;
  if (!('HarloweHacker' in window)) window['HarloweHacker'] = {};

  /**
   * @param {string} tag
   * @param  {...(Record<string, unknown> | HTMLElement | HTMLElement[])} args
   * @returns {HTMLElement} HTML Element
   */
  function _(selector, ...args) {
    const [tag, ...classes] = selector.split('.');
    /** @type {HTMLElement} */
    const element = document.createElement(tag);
    classes.forEach((className) => element.classList.add(`hh__${className.replace(/\s/g, '-')}`));
    for (const arg of args.flat()) {
      if (arg instanceof Node) {
        element.appendChild(arg);
      } else if (arg && typeof arg === 'object') {
        const attrs = Object.keys(arg);
        for (const attr of attrs) {
          const val = arg[attr];
          if (attr.startsWith('on') && typeof val === 'function') {
            element.addEventListener(attr.toLowerCase().slice('2'), val);
          } else if (attr === 'class') {
            /** @type {string[]} */
            const classNames = val.split(' ');
            classNames.forEach((className) => element.classList.add(`hh__${className}`));
          } else {
            element.setAttribute(attr, val);
          }
        }
      } else if (typeof arg === 'string' || typeof arg === 'number') {
        element.appendChild(document.createTextNode(arg));
      } else {
        console.log('_() dont know what to do with arg', arg);
      }
    }
    if (tag === 'button' && !element.getAttribute('type')) element.setAttribute('type', 'button');
    return element;
  }
  /**
   * @param {string} tag
   * @param  {...(Record<string, unknown> | HTMLElement | HTMLElement[])} args
   * @returns {HTMLElement} HTML Element
   */
  function __(tag, ...args) {
    const el = _(tag, ...args);
    document.body.appendChild(el);
    return el;
  }
  /**
   * @param {unknown} val
   * @param {boolean} ignoreEmpty
   */
  function getType(val, ignoreEmpty = false) {
    const type = typeof val;
    switch (type) {
      case 'boolean':
      case 'function':
      case 'number':
      case 'string':
      case 'undefined':
        return type;
      case 'object':
        if (val === null) return 'null';
        if (Array.isArray(val)) {
          return ignoreEmpty || val.length ? 'array' : 'empty array';
        }
        if (val instanceof Map) {
          return ignoreEmpty || val.size ? 'map' : 'empty map';
        }
        return ignoreEmpty || Object.keys(val).length ? 'object' : 'empty object';
      case 'bigint':
        return 'number';
    }
    return 'other';
  }
  /**
   * @param {string} str
   * @returns boolean
   */
  function isSimpleObjectKey(str) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
  }
  /**
   * @param {string} str
   */
  function getObjectKey(str) {
    if (isSimpleObjectKey(str)) {
      return `.${str}`;
    }
    return `['${str}']`;
  }
  /**
   * @param {unknown} val
   * @returns boolean
   */
  function isPrimitive(val) {
    const type = typeof val;
    return ['boolean', 'number', 'string', 'undefined'].includes(type) || val === null;
  }

  const normalObject = {};
  const normalConstructor = normalObject.constructor;
  /**
   * @param {unknown} val
   * @returns {boolean}
   */
  function isAllowedValue(val) {
    if (typeof val === 'function') return false;
    if (val && typeof val === 'object' && 'constructor' in val && val.constructor !== normalConstructor) return false;
    return true;
  }

  /**
   * @param {Record<string, unknown> | Map<string,unknown>} val
   * @returns {string[]}
   */
  function getKeys(val) {
    if (!val || typeof val !== 'object') return [];
    if (Array.isArray(val)) return [...val.keys()].filter((key) => isAllowedValue(val[key])).sort();
    if (val instanceof Map) return [...val.keys()].filter((key) => isAllowedValue(val.get(key))).sort();
    return Object.keys(val)
      .filter((key) => isAllowedValue(val[key]))
      .sort();
  }

  function getSubItem(item, key) {
    if (Array.isArray(item)) return item[key];
    if (item instanceof Map) return item.get(key);
    return item[key];
  }

  function setSubItem(item, key, value) {
    if (Array.isArray(item)) {
      item[key] = value;
    } else if (item instanceof Map) {
      item.set(key, value);
    } else {
      item[key] = value;
    }
  }

  function getSubPathFragment(item, key) {
    if (Array.isArray(item)) return `[${key}]`;
    if (item instanceof Map) return `.get('${key}')`;
    return getObjectKey(key);
  }

  /**
   * @param {string[]} arr1
   * @param {string[]} arr2
   */
  function stringArrayMatch(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }

  window.HarloweHacker.util = {
    _,
    __,
    getType,
    isSimpleObjectKey,
    getObjectKey,
    isPrimitive,
    isAllowedValue,
    getSubItem,
    setSubItem,
    getSubPathFragment,
    getKeys,
    stringArrayMatch,
  };
})();
