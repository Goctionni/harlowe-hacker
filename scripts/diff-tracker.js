(() => {
  if (!('Harlowe' in window)) return;
  if (!('HarloweHacker' in window)) window['HarloweHacker'] = {};

  /**
   * @typedef {"string" | "number" | "boolean" | "undefined" | "function" | "object" | "null" | "array" | "empty array" | "map" | "empty map" | "empty object" | "other"} ValType
   * @typedef {{path: string, value: unknown, type: ValType, size?: number, keys?: string[]}} StateEntry
   */

  /**
   * @type {{
   *  keys: (arg: Record<string, unknown> | Map<string, unknown> | unknown[]) => string[],
   *  getType: (val: unknown, ignoreEmpty: boolean) => ValType,
   *  getObjectKey: (str: string) => string,
   *  stringArrayMatch: (arr1: string[], arr2: string[]) => boolean,
   * }}
   */
  const { keys, getType, getObjectKey, stringArrayMatch } = window.HarloweHacker.util;
  /**
   * @type {{
   *  getIgnoredPaths: () => string[],
   *  addIgnorePath: (path: string) => void,
   * }}
   */
  const { getIgnoredPaths, addIgnorePath } = window.HarloweHacker;

  /** @type {StateEntry[]} */
  let stateMap = [];

  /**
   * @param {Record<string, unknown>|Map<string, unknown>|unknown[]} data
   * @returns {Array<StateEntry>}
   */
  function getStateMap(data, doRecursion = true, parentPath = '', ignore = []) {
    if (!data || typeof data !== 'object') throw 'getStateMap should only be called with array, map or object';
    if (ignore.includes(data)) return [];
    if (getIgnoredPaths().includes(parentPath)) return [];

    function mapItem(pathPrefix, item) {
      if (getIgnoredPaths().includes(pathPrefix)) return [];
      const type = getType(item, false, true);
      switch (type) {
        case 'array':
        case 'object':
        case 'map':
          if (doRecursion) {
            return getStateMap(item, doRecursion, pathPrefix, [...ignore, data]);
          } else {
            const itemKeys = keys(item);
            return {
              path: pathPrefix,
              type,
              value: item,
              size: itemKeys.length,
              keys: itemKeys,
            };
          }
        default:
          return {
            path: pathPrefix,
            type,
            value: item,
          };
      }
    }

    function result(typeName, keys, getPath, getValue) {
      return {
        path: parentPath,
        type: typeName,
        value: data,
        size: keys.length,
        keys: keys,
        items: keys.map((key) => mapItem(!parentPath ? key : `${parentPath}${getPath(key)}`, getValue(key))),
      };
    }
    if (Array.isArray(data)) {
      return result(
        'array',
        keys(data),
        (key) => `[${key}]`,
        (key) => data[key],
      );
    }
    if (data instanceof Map) {
      return result(
        'map',
        keys(data),
        (key) => `.get('${key}')`,
        (key) => data.get(key),
      );
    }
    // Record
    return result('object', keys(data), getObjectKey, (key) => data[key]);
  }

  const before = Date.now();
  stateMap = getStateMap(Harlowe.API_ACCESS.STATE.variables);
  console.log('getStateMap', stateMap);
  console.log(Date.now() - before);
  console.log('Shallow map', getStateMap(Harlowe.API_ACCESS.STATE.variables, false));
})();
