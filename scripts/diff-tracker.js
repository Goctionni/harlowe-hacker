(() => {
  if (!('Harlowe' in window)) return;
  if (!('HarloweHacker' in window)) window['HarloweHacker'] = {};

  /**
   * @typedef {"string" | "number" | "boolean" | "undefined" | "function" | "object" | "null" | "array" | "empty array" | "map" | "empty map" | "empty object" | "other"} ValType
   * @typedef {{
   *  path: string,
   *  value: unknown,
   *  type: ValType,
   *  size?: number,
   *  keys?: string[],
   *  items?: StateEntry[]
   * }} StateEntry
   */

  /**
   * @type {{
   *  getKeys: (arg: Record<string, unknown> | Map<string, unknown> | unknown[]) => string[],
   *  getType: (val: unknown, ignoreEmpty: boolean) => ValType,
   *  getSubItem: (item: Map<string, unknown>|unknown[]|Record<string,unknown>, key: string|number) => unknown,
   *  getSubPathFragment: (item: Map<string, unknown>|unknown[]|Record<string,unknown>, key: string|number) => string,
   *  isPrimitive: (val: unknown) => boolean,
   * }}
   */
  const { getKeys, getType, getSubItem, getSubPathFragment, isPrimitive } = window.HarloweHacker.util;
  /**
   * @type {{
   *  getIgnoredPaths: () => string[],
   *  addIgnorePath: (path: string) => void,
   * }}
   */
  const { getIgnoredPaths, addIgnorePath } = window.HarloweHacker;

  /** @type {StateEntry} */
  let stateMap = [];

  /**
   * @param {Record<string, unknown>|Map<string, unknown>|unknown[]} data
   * @returns {StateEntry}
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
            const itemKeys = getKeys(item);
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

    const type = getType(data, true);
    const resultKeys = getKeys(data);
    return {
      path: parentPath,
      type,
      value: data,
      size: resultKeys.length,
      keys: resultKeys,
      items: resultKeys.map((key) => {
        const subPath = !parentPath ? key : `${parentPath}${getSubPathFragment(data, key)}`;
        return mapItem(subPath, getSubItem(data, key));
      }),
    };
  }

  /**
   * @param {StateEntry} item1
   * @param {StateEntry} item2
   */
  function compareItem(item1, item2) {
    if (item1.type !== item2.type) {
      return [
        {
          path: item1.path,
          msg: `Value type changed from '${item2.type}' to '${item1.type}'`,
          new: item1.value,
          old: item2.value,
        },
      ];
    }
    switch (item1.type) {
      case 'null':
      case 'undefined':
      case 'boolean':
      case 'number':
      case 'string':
        return item1.value === item2.value
          ? []
          : [
              {
                path: item1.path,
                msg: `Value changed`,
                new: item1.value,
                old: item2.value,
              },
            ];

      case 'array':
      case 'empty array': {
        const newValues = item1.items.map((subItem) => subItem.value);
        const oldValues = item2.items.map((subItem) => subItem.value);
        // Figure out added/removed values
        const allValues = [...new Set([...newValues, ...oldValues])];
        const removedValues = [];
        const addedValues = [];
        for (const value of allValues) {
          const oldCount = oldValues.filter((val) => val === oldValue).length;
          const newCount = newValues.filter((val) => val === oldValue).length;
          if (oldCount === newCount) continue;
          if (oldCount > newCount) {
            removedValues.push(...new Array(oldCount - newCount).fill(value));
          } else if (newCount > oldCount) {
            addedValues.push(...new Array(oldCount - newCount).fill(value));
          }
        }
        // Figure out actual result
        const result = [];
        if (removedValues.length) {
          result.push({
            path: item1.path,
            msg: `${removedValues.length} values removed from array`,
            array: item1.value,
            removedValues,
          });
        } else {
          const numMovedItems = oldValues.reduce((numMoved, oldVal, i) => {
            return numMoved + (oldVal === newValues[i] ? 0 : 1);
          }, 0);
          if (numMovedItems) {
            result.push({
              path: item1.path,
              msg: `${numMovedItems} items in array have been moved`,
              array: item1.value,
            });
          }
        }
        if (addedValues.length) {
          result.push({
            path: item1.path,
            msg: `${addedValues.length} values added to array`,
            array: item1.value,
            addedValues,
          });
        }

        for (const subItem1 of item1.items) {
          // Only do recursion on non-primitives
          if (!isPrimitive(subItem1.value)) continue;
          // Only check for diffs if the object previously existed
          const subItem2 = item2.items.find((si2) => si2.value === subItem1.value);
          if (!subItem2) continue;

          // Recursion
          result.push(...compareItem(subItem1, subItem2));
        }
      }

      case 'object':
      case 'empty object':
      case 'map':
      case 'empty map': {
        const keys1 = item1.keys ?? [];
        const keys2 = item2.keys ?? [];
        const keysAdded = keys1.filter((k1) => !keys2.includes(k1));
        const keysRemoved = keys2.filter((k2) => !keys1.includes(k2));
        const keysShared = keys1.filter((k1) => keys2.includes(k1));

        const result = [];
        if (keysRemoved.length) {
          result.push({
            path: item1.path,
            msg: `${keysAdded.length} properties removed`,
            value: item1.value,
            properties: keysAdded,
          });
        }

        // Properties added
        for (const keyAdded of keysAdded) {
          const expectedPath = !item1.path ? keyAdded : `${item1.path}${getSubPathFragment(item1.value, keyAdded)}`;
          const subItem1 = item1.items.find((si1) => si1.path === expectedPath);
          if (!subItem1) {
            // This shouldn't happen, if it doesn't ill remove this.
            console.warn('Expected to find subitem with added key, but did not find', {
              keyAdded,
              expectedPath,
              items: item1.items,
            });
          } else {
            result.push({
              path: item1.path,
              msg: `Property added: "${keyAdded}"`,
              value: subItem1.value,
            });
          }
        }

        // Properties shared
        for (const keyShared of keysShared) {
          const expectedPath = !item1.path ? keyShared : `${item1.path}${getSubPathFragment(item1.value, keyShared)}`;
          const subItem1 = item1.items.find((si1) => si1.path === expectedPath);
          const subItem2 = item1.items.find((si2) => si2.path === expectedPath);
          if (!subItem1 || !subItem2) {
            // This shouldn't happen, if it doesn't ill remove this.
            console.warn('Expected to find subitem 1 and 2 with shared key, but did not find', {
              keyShared,
              expectedPath,
              item1items: item1.items,
              item2items: item2.items,
            });
          } else {
            console.log(compareItem(subItem1, subItem2), subItem1, subItem2);
            result.push(...compareItem(subItem1, subItem2));
          }
        }
        return result;
      }
    }
  }

  const before = Date.now();
  stateMap = getStateMap(Harlowe.API_ACCESS.STATE.variables);
  console.log('getStateMap', stateMap);
  console.log(Date.now() - before);
  console.log('Shallow map', getStateMap(Harlowe.API_ACCESS.STATE.variables, false));
  window.HarloweHacker.checkDiff = () => {
    const newStateMap = getStateMap(Harlowe.API_ACCESS.STATE.variables);
    const diffs = compareItem(newStateMap, stateMap);
    stateMap = newStateMap;
    return diffs;
  };
})();
