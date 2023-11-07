(() => {
  if (!('Harlowe' in window)) return;

  const { _, __, getType, isSimpleObjectKey } = window.HarloweHacker.util;
  const { getIgnoredPaths, addIgnorePath } = window.HarloweHacker;

  function canExpand(val) {
    const type = getType(val);
    return type === 'array' || type === 'object' || type === 'map';
  }

  function canEdit(val) {
    const type = getType(val);
    return type === 'string' || type === 'number' || type === 'boolean';
  }

  function getValueEl(value) {
    const type = getType(value);
    switch (type) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'null':
      case 'undefined':
        return _(`span.attr-val.val-${type}`, String(value));
      case 'object':
        return _(`span.attr-val.val-${type}`, `(properties: ${Object.keys(value).length})`);
      case 'array':
        return _(`span.attr-val.val-${type}`, `(items: ${value.length})`);
      case 'map':
        return _(`span.attr-val.val-${type}`, `(size:  ${value.size}})`);
      case 'function':
      case 'other':
        return _(`span.attr-val.val-${type}`);
      case 'empty array':
      case 'empty object':
      case 'empty map':
        return _(`span.attr-val.val-${type.replace(' ', '-')}`, type);
    }
  }

  /**
   * @param {string} value
   * @returns {[HTMLElement, () => string]}
   */
  function getStringInput(value) {
    const _input = _('input', { type: 'text', value, autofocus: true });
    const getValue = () => _input.value;
    return [_input, getValue];
  }

  /**
   * @param {number} value
   * @returns {[HTMLElement, () => number]}
   */
  function getNumberInput(value) {
    /**
     * @type {HTMLInputElement}
     */
    const _input = _('input', { type: 'number', value, autofocus: true });
    const getValue = () => _input.valueAsNumber;
    const getBtn = (text, mult) =>
      _('button', text, {
        onclick: () => {
          _input.value = getValue() * mult;
        },
      });

    const _el = _('div.edit-number', [
      getBtn('÷100', 1 / 100),
      getBtn('÷10', 1 / 10),
      getBtn('÷5', 1 / 5),
      getBtn('÷2', 1 / 2),
      _input,
      getBtn('×2', 2),
      getBtn('×5', 5),
      getBtn('×10', 10),
      getBtn('×100', 100),
    ]);
    return [_el, getValue];
  }

  /**
   * @param {boolean} checked
   * @returns {[HTMLElement, () => boolean]}
   */
  function getBooleanInput(checked) {
    const _input = _('input', { type: 'checkbox', autofocus: true });
    if (checked) _input.checked = true;
    const _label = _('label.toggle-input');
    const getValue = () => _input.checked;
    return [_label, getValue];
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  function valueLine(key, value, setter, itemPath) {
    const type = getType(value);
    const typeClass = type.replace('empty ', '');
    const expandEl = !canExpand(value) ? _('span') : _('button.toggle-btn');

    const el = _(
      `div.attr.attr-type-${typeClass}`,
      [expandEl, _(`span.attr-key`, key), getValueEl(value)],
      _('button.ignore-btn', {
        title: 'Ignore',
        onclick: (e) => {
          addIgnorePath(itemPath);
          el.remove();
          e.stopPropagation();
          return false;
        },
      }),
    );
    if (canExpand(value)) {
      el.classList.add('hh__can-toggle', 'hh__obj-collapsed');
      el.addEventListener('click', () => {
        el.classList.toggle('hh__obj-collapsed');
        el.classList.toggle('hh__obj-expanded');

        if (el.classList.contains('hh__obj-expanded')) {
          /** @type {HTMLElement} */
          const parent = el.parentElement;
          const childTree = _('div.subtree', type === 'map' ? mapToTree(value) : objectToTree(value));
          parent.insertBefore(childTree, el.nextSibling);
        } else {
          el.nextSibling.remove();
        }
      });
    }
    if (canEdit(value)) {
      el.classList.add('hh__can-edit');
      el.addEventListener('click', () => {
        const [_input, getValue] =
          type === 'number'
            ? getNumberInput(value)
            : type === 'boolean'
            ? getBooleanInput(value)
            : getStringInput(value);

        const _modal = __(
          'div.modal-backdrop',
          _('div.modal', [
            _('div.modal-title', ['Set: ', _('span.monospace', itemPath)]),
            _('div.modal-body', _input),
            _('div.modal-actions', [_('button.btn-cancel', 'Cancel'), _('button.btn-save', 'Save')]),
          ]),
        );

        function Save() {
          setter(getValue());
          value = getValue();
          el.replaceChild(getValueEl(value), el.lastChild);
          _modal.remove();
          window.removeEventListener('keydown', onWindowKey);
        }

        function Cancel() {
          _modal.remove();
          window.removeEventListener('keydown', onWindowKey);
        }

        /**
         * @param {KeyboardEvent} e
         */
        function onWindowKey(e) {
          if (e.key === 'Enter') return Save();
          if (e.key === 'Escape') return Cancel();
        }

        _modal.querySelector('.hh__btn-save').addEventListener('click', Save);
        _modal.querySelector('.hh__btn-cancel').addEventListener('click', Cancel);
        window.addEventListener('keydown', onWindowKey);
      });
      // on click -> modal
    }
    return el;
  }

  /**
   * @param {Map<string, unknown>} map
   * @returns {HTMLElement}
   */
  function mapToTree(map, path) {
    const keys = [...map.keys()];
    return _(
      'div',
      { class: 'obj' },
      ...keys
        .map((key) => {
          const itemPath = path + `.get('${key}')`;
          if (getIgnoredPaths().includes(itemPath)) return [];
          const setter = (val) => {
            map.set(key, val);
          };
          return valueLine(key, map.get(key), setter, itemPath);
        })
        .flat(),
    );
  }

  /**
   * @param {Record<string, unknown>} obj
   * @param {string} path
   * @returns {HTMLElement}
   */
  function objectToTree(obj, path) {
    const keys = Object.keys(obj);
    return _(
      'div',
      { class: 'obj' },
      ...keys
        .map((key) => {
          const setter = (val) => {
            obj[key] = val;
          };
          let itemPath = path;
          if (path) {
            if (Array.isArray(obj)) itemPath += `[${key}]`;
            else if (isSimpleObjectKey(key)) itemPath += `.${key}`;
            else itemPath += `['${key}']`;
          } else {
            itemPath = key;
          }
          if (getIgnoredPaths().includes(itemPath)) return [];
          return valueLine(key, obj[key], setter, itemPath);
        })
        .flat(),
    );
  }

  // Init
  __('div', { class: 'root' }, _('div.variables', objectToTree(Harlowe.API_ACCESS.STATE.variables, '')));
  // trackDiffs();
})();
