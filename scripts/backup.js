function getDiffs(val1, val2, path = 'State', maxDepth = 10, depth = 0) {
  if (ignoredPaths.includes(path.slice(6))) return [];
  const type1 = getType(val1, true);
  const type2 = getType(val2, true);
  if (type1 !== type2) {
    return [{ path, diff: `Different types (${type1}, ${type2})`, val1, val2 }];
  }
  switch (type1) {
    case 'string':
    case 'null':
    case 'number':
    case 'undefined':
    case 'boolean':
      return val1 === val2 ? [] : [{ path, diff: `Value changed`, val1, val2 }];
    case 'empty array':
    case 'array':
      val1 = val1.filter((v) => typeof v !== 'function');
      val2 = val2.filter((v) => typeof v !== 'function');
      const allPrimitive = [...val1, ...val2].every(isPrimitive);
      if (allPrimitive) {
        if (val1.length === val2.length && val1.every((v1, i) => v1 === val2[i])) {
          return [];
        }
        const added = val1.filter((v1) => !val2.includes(v1));
        const removed = val2.filter((v2) => !val1.includes(v2));
        if (!added.length && !removed.length) {
          return [{ path, diff: 'Items are in different order', val1, val2 }];
        }
        if (!added.length) {
          return [{ path, diff: `${removed.length} items were removed from array`, val1, val2 }];
        }
        if (!removed.length) {
          return [{ path, diff: `${added.length} items were added to array`, val1, val2 }];
        }
        return [
          { path, diff: `${added.length} items were added to array, ${removed.length} were removed`, val1, val2 },
        ];
      }
      if (depth >= maxDepth) return [];

      // Will technically generate false negatives if undefined's were added
      for (; val1.length < val2.length; val1.push(undefined));
      return val1
        .map((v1, i) => {
          return getDiffs(v1, val2[i], `${path}[${i}]`, maxDepth, depth + 1);
        })
        .flat();
    case 'empty object':
    case 'object': {
      const keys1 = keys(val1);
      const keys2 = keys(val2);
      const newKeys = keys1.filter((k1) => !keys2.includes(k1));
      const removedKeys = keys2.filter((k2) => !keys1.includes(k2));
      const sharedKeys = keys1.filter((k1) => keys2.includes(k1));
      const diffs = [
        ...newKeys.map((newKey) => ({
          path,
          diff: `Added attribute "${newKey}"`,
          value: val1[newKey],
        })),
        ...removedKeys.map((removedKey) => ({
          path,
          diff: `Removed attribute "${removedKey}"`,
          value: val2[removedKey],
        })),
      ];
      sharedKeys.forEach((key) => {
        const attr1 = val1[key];
        const attr2 = val2[key];
        if (attr1 === attr2) return;
        const newPath = path + (isSimpleObjectKey(key) ? `.${key}` : `["${key}"]`);
        diffs.push(...getDiffs(attr1, attr2, newPath, maxDepth, depth + 1));
      });
      return diffs;
    }
    case 'empty map':
    case 'map': {
      const keys1 = keys(val1);
      const keys2 = keys(val2);
      const newKeys = keys1.filter((k1) => !keys2.includes(k1));
      const removedKeys = keys2.filter((k2) => !keys1.includes(k2));
      const sharedKeys = keys1.filter((k1) => keys2.includes(k1));
      const diffs = [
        ...newKeys.map((newKey) => ({
          path,
          diff: `Added attribute ${newKey}`,
          value: val1.get(newKey),
        })),
        ...removedKeys.map((removedKey) => ({
          path,
          diff: `Removed attribute ${removedKey}`,
          value: val2.get(newKey),
        })),
      ];
      sharedKeys.forEach((key) => {
        const attr1 = val1.get(key);
        const attr2 = val2.get(key);
        if (attr1 === attr2) return;
        const newPath = `${path}.get('${key}')`;
        diffs.push(...getDiffs(attr1, attr2, newPath, maxDepth, depth + 1));
      });
      return diffs;
    }
  }
}

let currentState;

function checkDiffs() {
  const before = Date.now();
  const newState = cloneModel(Harlowe.API_ACCESS.STATE.variables, {}, []);
  const diffs = getDiffs(newState, currentState, 'State');
  if (diffs.length > 0) {
    console.log('-----------------------');
    diffs.forEach((diff) => console.log(diff));
    console.log('-----------------------');
  }
  currentState = newState;
  const elapsed = Date.now() - before;
  setTimeout(checkDiffs, elapsed * 5);
}

function trackDiffs() {
  currentState = cloneModel(Harlowe.API_ACCESS.STATE.variables, {}, []);
  setTimeout(checkDiffs(), 500);
}

/**
 * @param {unknown} data
 * @param {Array<{original: unknown, clone: unknown}>} ignore
 * @param {Array | Map | Record} sourceValue
 * @returns {unknown}
 */
function cloneModel(data, emptyValue, ignore) {
  const type = getType(data);
  switch (type) {
    case 'null':
    case 'undefined':
    case 'boolean':
    case 'string':
    case 'number':
      return data;
    case 'empty array':
    case 'array':
      emptyValue.push(
        ...data
          .filter((item) => typeof item !== 'function')
          .map((item) => {
            // We can just clone non-objects
            if (item === null || typeof item !== 'object') return cloneModel(item, null, ignore);
            // If we have the value already, use that
            const previousClone = ignore.find((ignoreItem) => ignoreItem.original === item);
            if (previousClone) return previousClone.clone;
            // Otherwise, first create a clone, save it, before recursion
            const clone = Array.isArray(item) ? [] : item instanceof Map ? new Map() : {};
            ignore.push({ original: item, clone });
            cloneModel(item, clone, ignore);
            return clone;
          }),
      );
      return emptyValue;
    case 'empty map':
    case 'map':
      const clone = emptyValue;
      const keys = [...data.keys()];
      for (const key of keys) {
        const value = data.get(key);
        if (typeof value === 'function') continue;
        if (value === null || typeof value !== 'object') {
          clone.set(key, cloneModel(value, null, ignore));
        } else {
          // Possible recursion risk, first check if we have a clone already
          const previousClone = ignore.find((ignoreItem) => ignoreItem.original === value);
          if (previousClone) {
            clone.set(key, previousClone.clone);
          } else {
            // Possible recursion risk, create and index empty object first
            const innerClone = Array.isArray(value) ? [] : value instanceof Map ? new Map() : {};
            ignore.push({ original: value, clone: innerClone });
            clone.set(key, cloneModel(value, innerClone, ignore));
          }
        }
      }
      return clone;
    case 'empty object':
    case 'object':
      const newObj = emptyValue;
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'function') return;
        if (value === null || typeof value !== 'object') {
          newObj[key] = cloneModel(value, null, ignore);
          return;
        }
        // Possible recursion risk, first check if we have a clone already
        const previousClone = ignore.find((ignoreItem) => ignoreItem.original === value);
        if (previousClone) {
          newObj[key] = previousClone.clone;
          return;
        }

        // We dont already have a clone, create an empty seed object, store it and clone into it
        const innerClone = Array.isArray(value) ? [] : value instanceof Map ? new Map() : {};
        ignore.push({ original: value, clone: innerClone });
        newObj[key] = cloneModel(value, innerClone, ignore);
      });
      return newObj;
  }
  return null;
}
