/* Set-Übersicht: Lernmodi, Vorschau-Karte, Fortschritt und alle Begriffe */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;

  const MODES = [
    { path: 'karteikarten', icon: 'cards', label: 'Karteikarten', hint: 'Umdrehen und selbst prüfen' },
    { path: 'lernen', icon: 'learn', label: 'Lernen', hint: 'Erst auswählen, dann schreiben' },
    { path: 'test', icon: 'test', label: 'Test', hint: 'Mit Note am Schluss' },
    { path: 'zuordnen', icon: 'match', label: 'Zuordnen', hint: 'Paare gegen die Zeit' },
  ];

  VT.views.set = function (root, id) {
    const set = VT.store.getSet(id);
    if (!set) return VT.views.notFound(root, 'Dieses Set gibt es nicht (mehr).');
    VT.setTitle(set.title);
    const progress = new VT.Progress(set.id);
    const base = '#/set/' + encodeURIComponent(set.id);

    const actions = [];
    if (set.custom) {
      actions.push(h('a', { class: 'icon-btn', href: base + '/bearbeiten', 'aria-label': 'Set bearbeiten', title: 'Set bearbeiten', html: VT.icon('edit') }));
      actions.push(VT.ui.iconButton('trash', 'Set löschen', () => {
        if (!confirm(`«${set.title}» wirklich löschen? Der Lernfortschritt geht dabei verloren.`)) return;
        VT.store.deleteCustomSet(set.id);
        location.hash = '#/';
      }));
    }
    actions.push(VT.ui.themeButton());

    const terms = termsSection(set, progress);
    const preview = previewSection(set, progress, terms.refresh);

    VT.append(root,
      VT.ui.topbar({ back: '#/', actions }),
      h('section', { class: 'set-head' },
        h('h1', null, set.title),
        h('p', { class: 'muted' }, `${set.cards.length} Begriffe · ${VT.langName(set.termLang)} – ${VT.langName(set.defLang)}`),
        set.description ? h('p', null, set.description) : null),
      h('nav', { class: 'modes', 'aria-label': 'Lernmodi' },
        MODES.map((m) =>
          h('a', { class: 'mode', href: `${base}/${m.path}` }, VT.ic(m.icon), h('strong', null, m.label), h('small', null, m.hint)))),
      set.cards.length ? preview : null,
      progressSection(set, progress, base),
      terms.el,
      set.source
        ? h('p', { class: 'muted small source' }, 'Quelle der Vokabeln: ',
            h('a', { href: set.source.url, target: '_blank', rel: 'noopener noreferrer' }, set.source.label))
        : null);
  };

  /** Kleine Karteikarte zum Durchblättern direkt auf der Übersicht */
  function previewSection(set, progress, onStar) {
    const opts = VT.store.options('flashcards', { front: 'term' });
    let idx = 0;
    const card = new VT.FlipCard({ set, progress, onStar, onSwipe: (dir) => go(dir === 'left' ? 1 : -1) });
    const count = h('span', { class: 'fc-count' });
    const prev = VT.ui.iconButton('prev', 'Vorherige Karte', () => go(-1));
    const next = VT.ui.iconButton('next', 'Nächste Karte', () => go(1));

    function go(step) {
      const n = idx + step;
      if (n < 0 || n >= set.cards.length) return;
      idx = n;
      render(step > 0 ? 'next' : 'prev');
    }
    function render(enter) {
      card.show(set.cards[idx], { frontSide: opts.front, enter });
      count.textContent = `${idx + 1} / ${set.cards.length}`;
      prev.disabled = idx === 0;
      next.disabled = idx === set.cards.length - 1;
    }
    if (set.cards.length) render(null);

    return h('section', { class: 'section preview', 'aria-label': 'Vorschau der Karteikarten' },
      h('div', { class: 'fc-stage' }, card.el),
      h('div', { class: 'fc-controls' }, prev, count, next));
  }

  function progressSection(set, progress, base) {
    const s = progress.stats(set.cards);
    return h('section', { class: 'section' },
      h('div', { class: 'section-head' },
        h('h2', null, 'Dein Fortschritt'),
        h('a', { class: 'btn ghost', href: base + '/lernen' }, s.mastered || s.learning ? 'Weiterlernen' : 'Jetzt lernen')),
      h('div', { class: 'panel' },
        VT.ui.bar(s, set.cards.length),
        h('div', { class: 'legend' },
          h('span', { class: 'l-new' }, `Neu: ${s.fresh}`),
          h('span', { class: 'l-learning' }, `Am Lernen: ${s.learning}`),
          h('span', { class: 'l-mastered' }, `Gemeistert: ${s.mastered}`))));
  }

  function termsSection(set, progress) {
    let filter = 'all';
    const tabs = h('div');
    const list = h('div', { class: 'term-list' });

    const starredCount = () => set.cards.filter((c) => progress.starred(c.id)).length;

    function renderTabs() {
      VT.fill(tabs, VT.ui.seg(
        [
          { value: 'all', label: `Alle (${set.cards.length})` },
          { value: 'star', label: `Markiert (${starredCount()})` },
        ],
        filter,
        (v) => {
          filter = v;
          renderList();
        }));
    }

    function renderList() {
      const cards = filter === 'star' ? set.cards.filter((c) => progress.starred(c.id)) : set.cards;
      if (!cards.length) {
        VT.fill(list, h('p', { class: 'muted empty' }, 'Noch keine Karten markiert. Tippe bei einer Karte auf den Stern.'));
        return;
      }
      VT.fill(list, cards.map((c) =>
        h('div', { class: 'term-row' },
          h('div', { class: 't', lang: set.termLang }, c.term),
          h('div', { class: 'd', lang: set.defLang }, c.def),
          h('div', { class: 'row-tools' },
            VT.speech.supported ? VT.ui.iconButton('speaker', 'Vorlesen', () => VT.speech.speak(c.term, set.termLang)) : null,
            VT.ui.starButton(progress, c.id, refresh)))));
    }

    function refresh() {
      renderTabs();
      if (filter === 'star') renderList();
    }

    renderTabs();
    renderList();
    const el = h('section', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', null, 'Begriffe in diesem Set'), tabs),
      list);
    return { el, refresh };
  }
})();
