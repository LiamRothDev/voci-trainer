/* Startseite mit allen Sets – und die «Nicht gefunden»-Seite */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;

  VT.views.home = function (root) {
    VT.setTitle('');
    VT.append(root,
      h('header', { class: 'home-head' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark', html: VT.icon('cards') }), 'Voci-Trainer'),
        VT.ui.themeButton()),
      h('h1', { class: 'home-title' }, 'Deine Sets'),
      h('div', { class: 'set-grid' },
        VT.store.sets().map((set) => setCard(set)),
        h('a', { class: 'set-card new', href: '#/neu' },
          VT.ic('plus', 'big'),
          h('strong', null, 'Neues Set erstellen'),
          h('small', { class: 'muted' }, 'Vokabelliste einfügen oder abtippen'))),
      h('p', { class: 'muted small footer-note' }, 'Dein Lernfortschritt wird nur in diesem Browser gespeichert.'));
  };

  function setCard(set) {
    const stats = new VT.Progress(set.id).stats(set.cards);
    return h('a', { class: 'set-card', href: '#/set/' + encodeURIComponent(set.id) },
      h('strong', { class: 'set-title' }, set.title),
      h('span', { class: 'muted small' }, `${set.cards.length} Begriffe`, set.custom ? h('span', { class: 'badge' }, 'Eigenes Set') : null),
      VT.ui.bar(stats, set.cards.length),
      h('span', { class: 'muted small' }, `${stats.mastered} von ${set.cards.length} gemeistert`));
  }

  VT.views.notFound = function (root, message) {
    VT.setTitle('Nicht gefunden');
    VT.append(root,
      VT.ui.topbar({ back: '#/' }),
      h('div', { class: 'panel done' },
        h('h1', null, 'Nicht gefunden'),
        h('p', { class: 'muted' }, message || 'Diese Seite gibt es nicht.'),
        h('a', { class: 'btn primary', href: '#/' }, 'Zur Startseite')));
  };
})();
