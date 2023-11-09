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
   * }}
   */
  const { getIgnoredPaths } = window.HarloweHacker;

  /** @type {StateEntry} */
  HarloweHacker.stateMap = [];

  function getFullPath(parentPath, item, key) {
    return !parentPath ? key : `${parentPath}${getSubPathFragment(item, key)}`;
  }

  /**
   * @param {Record<string, unknown>|Map<string, unknown>|unknown[]} data
   * @returns {StateEntry}
   */
  function getStateMap(data, path = '', ignore = []) {
    if (ignore.includes(data)) return [];
    if (getIgnoredPaths().includes(path)) return [];

    const type = getType(data, true);
    switch (type) {
      case 'boolean':
      case 'null':
      case 'undefined':
      case 'string':
      case 'number':
      case 'other':
        return {
          path,
          type,
          value: data,
        };
      case 'array':
      case 'object':
      case 'map': {
        const resultKeys = getKeys(data).filter((key) => {
          const fullPath = getFullPath(path, data, key);
          return !getIgnoredPaths().includes(fullPath);
        });

        return {
          path,
          type,
          value: data,
          size: resultKeys.length,
          keys: resultKeys,
          items: resultKeys.map((key) => {
            return getStateMap(getSubItem(data, key), getFullPath(path, data, key), [...ignore, data]);
          }),
        };
      }
    }
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
          const oldCount = oldValues.filter((val) => val === value).length;
          const newCount = newValues.filter((val) => val === value).length;
          if (oldCount === newCount) continue;
          if (oldCount > newCount) {
            removedValues.push(...new Array(oldCount - newCount).fill(value));
          } else if (newCount > oldCount) {
            addedValues.push(...new Array(newCount - oldCount).fill(value));
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
            msg: `${addedValues.length} ${addedValues.length === 1 ? 'value' : 'values'} added to array`,
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
        return result;
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
          const expectedPath = getFullPath(item1.path, item1.value, keyAdded);
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
          const expectedPath = getFullPath(item1.path, item1.value, keyShared);
          const subItem1 = item1.items.find((si1) => si1.path === expectedPath);
          const subItem2 = item2.items.find((si2) => si2.path === expectedPath);
          if (!subItem1 || !subItem2) {
            // This shouldn't happen, if it doesn't ill remove this.
            console.warn('Expected to find subitem 1 and 2 with shared key, but did not find', {
              keyShared,
              expectedPath,
              item1items: item1.items,
              item2items: item2.items,
            });
          } else {
            // if (subItem1.path.startsWith('character.'))
            //   console.log(compareItem(subItem1, subItem2), subItem1, subItem2);
            result.push(...compareItem(subItem1, subItem2));
          }
        }
        return result;
      }
    }
  }

  HarloweHacker.stateMap = getStateMap(Harlowe.API_ACCESS.STATE.variables);
  window.HarloweHacker.checkDiff = () => {
    const newStateMap = getStateMap(Harlowe.API_ACCESS.STATE.variables);
    const diffs = compareItem(newStateMap, HarloweHacker.stateMap);
    HarloweHacker.stateMap = newStateMap;
    return diffs;
  };

  // Track diffs
  function tickCheckDiffs() {
    const before = Date.now();
    const diffs = window.HarloweHacker.checkDiff();
    const elapsed = Date.now() - before;
    if (diffs.length) {
      console.log('------------------');
      diffs.forEach((diff) => console.log(diff));
    }
    setTimeout(tickCheckDiffs, Math.min(333, elapsed * 10));
  }
  tickCheckDiffs();
})();
