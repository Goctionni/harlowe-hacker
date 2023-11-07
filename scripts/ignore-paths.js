(() => {
  if (!('Harlowe' in window)) return;
  if (!('HarloweHacker' in window)) window['HarloweHacker'] = {};

  /**
   * @type {string[]} ignoredPaths
   */
  const ignoredPaths = JSON.parse(localStorage['HH__IgnorePaths'] || '[]');

  window.HarloweHacker.getIgnoredPaths = () => ignoredPaths;
  /**
   * @param {string} path
   */
  window.HarloweHacker.addIgnorePath = (path) => {
    ignoredPaths.push(path);
    localStorage['HH__IgnorePaths'] = JSON.stringify(ignoredPaths);
  };
})();
