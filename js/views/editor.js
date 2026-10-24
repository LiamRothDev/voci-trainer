/* Eigenes Set erstellen oder bearbeiten: Liste einfügen, Vorschau, speichern */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;

  const LANG_OPTIONS = [
    ['en-GB', 'Englisch'],
    ['de-DE', 'Deutsch'],
    ['fr-FR', 'Französisch'],
    ['it-IT', 'Italienisch'],
    ['es-ES', 'Spanisch'],
  ];
  const SEPARATOR_OPTIONS = [
    ['auto', 'Automatisch erkennen'],
    ['tab', 'Tabulator'],
    ['dash', 'Bindestrich ( - )'],
    ['eq', 'Gleichheitszeichen ( = )'],
    ['semi', 'Semikolon ( ; )'],
    ['comma', 'Komma ( , )'],
  ];

  VT.views.editor = function (root, id) {
    const existing = id ? VT.store.getSet(id) : null;
    if (id && (!existing || !existing.custom)) {
      return VT.views.notFound(root, 'Dieses Set kann hier nicht bearbeitet werden.');
    }
    VT.setTitle(existing ? 'Set bearbeiten' : 'Neues Set');
    const backHref = existing ? '#/set/' + encodeURIComponent(existing.id) : '#/';

    const select = (options, value, elId) =>
      h('select', { class: 'select', id: elId }, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));

    const title = h('input', {
      class: 'input', id: 'f-title', required: true, maxlength: '120', autocomplete: 'off',
      placeholder: 'z. B. Englisch Unit 5', value: existing ? existing.title : '',
    });
    const desc = h('input', {
      class: 'input', id: 'f-desc', maxlength: '300', autocomplete: 'off',
      placeholder: 'optional', value: existing ? existing.description : '',
    });
    const termLang = select(LANG_OPTIONS, existing ? existing.termLang : 'en-GB', 'f-term');
    const defLang = select(LANG_OPTIONS, existing ? existing.defLang : 'de-DE', 'f-def');
    const sep = select(SEPARATOR_OPTIONS, 'auto', 'f-sep');
    const text = h('textarea', {
      class: 'input', id: 'f-cards', rows: '12', spellcheck: 'false',
      placeholder: 'house - das Haus\nto run - rennen, laufen\nbeautiful = schön',
      value: existing ? existing.cards.map((c) => `${c.term}\t${c.def}`).join('\n') : '',
    });
    const preview = h('div', { class: 'import-preview', 'aria-live': 'polite' });
    const saveBtn = h('button', { type: 'submit', class: 'btn primary' }, existing ? 'Änderungen speichern' : 'Set erstellen');

    function update() {
      const { cards, skipped } = VT.parseCards(text.value, sep.value);
      saveBtn.disabled = !cards.length;
      VT.fill(preview,
        h('p', { class: 'hint' },
          cards.length === 1 ? '1 Karte erkannt' : `${cards.length} Karten erkannt`,
          skipped ? ` · ${skipped} Zeile${skipped === 1 ? '' : 'n'} ohne Trennzeichen übersprungen` : ''),
        cards.length
          ? h('table', null, h('tbody', null, cards.slice(0, 6).map((c) => h('tr', null, h('td', null, c.term), h('td', null, c.def)))))
          : null,
        cards.length > 6 ? h('p', { class: 'hint' }, `… und ${cards.length - 6} weitere`) : null);
    }

    function save(e) {
      e.preventDefault();
      const { cards } = VT.parseCards(text.value, sep.value);
      if (!title.value.trim()) return title.focus();
      if (!cards.length) return text.focus();
      const data = {
        id: existing ? existing.id : 'eigen-' + Date.now().toString(36),
        title: title.value.trim(),
        description: desc.value.trim(),
        termLang: termLang.value,
        defLang: defLang.value,
        cards,
      };
      if (!VT.store.saveCustomSet(data)) {
        VT.ui.toast('Speichern hat nicht geklappt – ist der Browser-Speicher voll oder gesperrt?');
        return;
      }
      location.hash = '#/set/' + encodeURIComponent(data.id);
    }

    text.addEventListener('input', update);
    sep.addEventListener('change', update);
    update();

    VT.append(root,
      VT.ui.topbar({ back: backHref, title: existing ? 'Set bearbeiten' : 'Neues Set' }),
      h('form', { class: 'panel editor', onsubmit: save },
        VT.ui.field('Titel', title, 'f-title'),
        VT.ui.field('Beschreibung', desc, 'f-desc'),
        h('div', { class: 'two-col' },
          VT.ui.field('Sprache der Begriffe', termLang, 'f-term'),
          VT.ui.field('Sprache der Bedeutungen', defLang, 'f-def')),
        VT.ui.field('Karten – eine pro Zeile: Begriff, Trennzeichen, Bedeutung', text, 'f-cards'),
        h('p', { class: 'hint' }, 'Tipp: Listen aus Excel, Word oder einer Vokabel-App (mit Tabulator getrennt) kannst du direkt einfügen.'),
        VT.ui.field('Trennzeichen', sep, 'f-sep'),
        preview,
        h('div', { class: 'btn-row start' }, saveBtn, h('a', { class: 'btn ghost', href: backHref }, 'Abbrechen'))));
  };
})();
