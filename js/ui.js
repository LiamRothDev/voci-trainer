/* Voci-Trainer – gemeinsame Bausteine: Icons, Kopfzeile, Schalter, Dialog, Meldungen */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;

  // Eigene, einfache Linien-Icons (24×24)
  const ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    prev: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
    cards: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h11a3 3 0 0 1 3 3v10"/>',
    learn: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    test: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8.5l1.5 1.5L12 7.5M8 15.5l1.5 1.5 2.5-2.5M14.5 9h2M14.5 16h2"/>',
    match: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    speaker: '<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    shuffle: '<path d="M3 7h3c2.2 0 3.4 1.1 4.6 3l2.8 4c1.2 1.9 2.4 3 4.6 3h3M3 17h3c1.4 0 2.4-.5 3.2-1.3M14.8 8.3c.8-.8 1.8-1.3 3.2-1.3h3M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M9 5.5v13M15 5.5v13"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    restart: '<path d="M4 4v6h6"/><path d="M5 15a8 8 0 1 0 2-8.6L4 10"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5"/>',
  };

  VT.icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  VT.ic = (name, extra) => h('span', { class: 'ic' + (extra ? ' ' + extra : ''), html: VT.icon(name) });

  VT.ui = {
    topbar({ back, title, subtitle, actions = [] }) {
      return h('header', { class: 'topbar' },
        back ? h('a', { class: 'icon-btn', href: back, 'aria-label': 'Zurück', title: 'Zurück', html: VT.icon('back') }) : h('span'),
        h('div', { class: 'title' }, title ? h('strong', null, title) : null, subtitle ? h('small', null, subtitle) : null),
        h('div', { class: 'actions' }, actions));
    },

    iconButton(icon, label, onclick, extraClass) {
      return h('button', {
        type: 'button',
        class: 'icon-btn' + (extraClass ? ' ' + extraClass : ''),
        'aria-label': label,
        title: label,
        html: VT.icon(icon),
        onclick,
      });
    },

    /** Stern zum Markieren. btn.sync() aktualisiert die Anzeige. */
    starButton(progress, id, onChange) {
      const btn = h('button', { type: 'button', class: 'icon-btn star-btn', html: VT.icon('star') });
      btn.sync = () => {
        const on = progress.starred(id);
        const label = on ? 'Markierung entfernen (S)' : 'Markieren (S)';
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', label);
        btn.title = label;
      };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        progress.toggleStar(id);
        btn.sync();
        if (onChange) onChange();
      });
      btn.sync();
      return btn;
    },

    themeButton() {
      const root = document.documentElement;
      const isDark = () =>
        root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      const btn = VT.ui.iconButton(isDark() ? 'sun' : 'moon', 'Hell/Dunkel umschalten', () => {
        const next = isDark() ? 'light' : 'dark';
        root.dataset.theme = next;
        try {
          localStorage.setItem('vt:theme', next);
        } catch (e) {
          /* dann gilt es nur bis zum Neuladen */
        }
        btn.innerHTML = VT.icon(next === 'dark' ? 'sun' : 'moon');
      });
      return btn;
    },

    /** Fortschrittsbalken (gemeistert + am Lernen). el.update(stats) aktualisiert ihn. */
    bar(stats, total, label = 'gemeistert') {
      const el = h('div', { class: 'bar', role: 'img' }, h('span', { class: 's-mastered' }), h('span', { class: 's-learning' }));
      el.update = (s) => {
        const pct = (n) => (total ? (n / total) * 100 : 0) + '%';
        el.children[0].style.width = pct(s.mastered || 0);
        el.children[1].style.width = pct(s.learning || 0);
        el.setAttribute('aria-label', `${s.mastered || 0} von ${total} ${label}`);
      };
      el.update(stats);
      return el;
    },

    field(label, control, forId) {
      return h('div', { class: 'field' },
        forId ? h('label', { class: 'field-label', for: forId }, label) : h('span', { class: 'field-label' }, label),
        control);
    },

    /** Umschalter mit mehreren Knöpfen, z. B. Deutsch | Englisch */
    seg(options, value, onChange) {
      const buttons = options.map((o) => {
        const b = h('button', { type: 'button', 'aria-pressed': String(o.value === value) }, o.label);
        b.addEventListener('click', () => {
          buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          onChange(o.value);
        });
        return b;
      });
      return h('div', { class: 'seg', role: 'group' }, buttons);
    },

    /** Ein/Aus-Schalter. onChange(wert, input) */
    switchRow(label, checked, onChange, hint, disabled) {
      const input = h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: !!checked, disabled: !!disabled });
      input.addEventListener('change', () => onChange(input.checked, input));
      return h('label', { class: 'switch-row' + (disabled ? ' disabled' : '') },
        h('span', null, h('span', { class: 'switch-label' }, label), hint ? h('small', { class: 'muted' }, hint) : null),
        input);
    },

    dialog(title, content) {
      const dlg = h('dialog', { class: 'dlg', 'aria-label': title },
        h('div', { class: 'dlg-head' }, h('h2', null, title), VT.ui.iconButton('x', 'Schliessen', () => dlg.close())),
        h('div', { class: 'dlg-body' }, content));
      dlg.addEventListener('close', () => dlg.remove());
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) dlg.close(); // Klick neben das Fenster
      });
      document.body.append(dlg);
      dlg.showModal();
      return dlg;
    },

    toast(message) {
      let el = document.querySelector('.toast');
      if (!el) {
        el = h('div', { class: 'toast', role: 'status' });
        document.body.append(el);
      }
      el.textContent = message;
      el.classList.add('show');
      clearTimeout(el.hideTimer);
      el.hideTimer = setTimeout(() => el.classList.remove('show'), 2200);
    },
  };
})();
