/* Voci-Trainer – Start, Hash-Routing und Offline-Unterstützung */
(function () {
  'use strict';
  const VT = window.VT;
  const root = document.getElementById('app');

  const ROUTES = [
    [/^#?\/?$/, 'home'],
    [/^#\/neu$/, 'editor'],
    [/^#\/set\/([^/]+)$/, 'set'],
    [/^#\/set\/([^/]+)\/karteikarten$/, 'flashcards'],
    [/^#\/set\/([^/]+)\/lernen$/, 'learn'],
    [/^#\/set\/([^/]+)\/test$/, 'test'],
    [/^#\/set\/([^/]+)\/zuordnen$/, 'match'],
    [/^#\/set\/([^/]+)\/bearbeiten$/, 'editor'],
  ];

  let cleanup = null;

  function render() {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    VT.speech.stop();
    document.querySelectorAll('dialog').forEach((d) => d.remove());

    const page = VT.h('div', { class: 'wrap' });
    root.replaceChildren(page);
    try {
      const hash = location.hash || '#/';
      let view = 'notFound';
      let params = [];
      for (const [re, name] of ROUTES) {
        const m = hash.match(re);
        if (m) {
          view = name;
          params = m.slice(1).map(decodeURIComponent);
          break;
        }
      }
      cleanup = VT.views[view](page, ...params);
    } catch (err) {
      console.error(err);
      VT.fill(page, VT.h('div', { class: 'panel done' },
        VT.h('h1', null, 'Hoppla'),
        VT.h('p', null, 'Da ist etwas schiefgelaufen. Lade die Seite neu.'),
        VT.h('a', { class: 'btn primary', href: '#/' }, 'Zur Startseite')));
    }
    window.scrollTo(0, 0);
    root.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', render);
  render();

  // Offline-Cache – funktioniert nur über http(s), nicht beim Öffnen als Datei
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
