(() => {
  if (!('Harlowe' in window)) return;
  if (!('HarloweHacker' in window)) window['HarloweHacker'] = {};

  /**
   * @type {Array<{event: string, callback: (data: unknown) => any}>}
   */
  let listeners = [];
  /**
   * @param {string} event
   * @param {unknown} data
   */
  function emit(event, data) {
    listeners
      .filter((listener) => listener.event === event)
      .forEach(({ callback }) => {
        callback(data);
      });
  }
  /**
   * @param {string} event
   * @param {(data: unknown) => any} listener
   */
  function addListener(event, listener) {
    listeners.push({ event, callback: listener });
  }

  function removeListener(event, listener) {
    listeners = listeners.filter((item) => {
      if (event === item.event) return false;
      if (listener && listener === item.listener) return false;
      return true;
    });
  }

  window.HarloweHacker.emit = emit;
  window.HarloweHacker.addListener = addListener;
  window.HarloweHacker.removeListener = removeListener;
})();
