/* Zuordnen: Begriffe und Bedeutungen so schnell wie möglich paaren */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;
  const PAIRS = 6;
  const PENALTY = 1000; // ms pro falschem Paar

  VT.views.match = function (root, id) {
    const set = VT.store.getSet(id);
    if (!set) return VT.views.notFound(root, 'Dieses Set gibt es nicht (mehr).');
    VT.setTitle('Zuordnen · ' + set.title);
    const base = '#/set/' + encodeURIComponent(set.id);
    const progress = new VT.Progress(set.id);
    const main = h('div', { class: 'match-main' });

    let raf = 0;
    let timeouts = [];
    let startedAt = 0;
    let penalty = 0;
    let selected = null;
    let left = 0;
    let penaltyEl = null;

    VT.append(root, VT.ui.topbar({ back: base, title: 'Zuordnen', subtitle: set.title }), main);
    intro();
    return stop;

    function stop() {
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      timeouts = [];
    }

    function later(fn, ms) {
      timeouts.push(setTimeout(fn, ms));
    }

    function elapsed() {
      return performance.now() - startedAt + penalty;
    }

    function intro() {
      if (set.cards.length < 2) {
        VT.fill(main, h('div', { class: 'panel done' }, h('p', null, 'Für Zuordnen braucht das Set mindestens zwei Karten.')));
        return;
      }
      const best = progress.matchBest();
      VT.fill(main, h('div', { class: 'panel intro' },
        VT.ic('match', 'big'),
        h('h1', null, 'Bereit?'),
        h('p', { class: 'muted' }, 'Ordne alle Begriffe ihrer Bedeutung zu – so schnell du kannst. Ein falsches Paar kostet eine Sekunde.'),
        best ? h('p', { class: 'record' }, VT.ic('trophy'), ` Dein Rekord: ${VT.formatTime(best)}`) : null,
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn primary', onclick: play }, 'Spiel starten'))));
    }

    /** Zufällige Karten, deren Begriffe und Bedeutungen sich nicht doppeln */
    function pickCards() {
      const terms = new Set();
      const defs = new Set();
      const out = [];
      for (const c of VT.shuffle(set.cards)) {
        const t = VT.normalize(c.term);
        const d = VT.normalize(c.def);
        if (terms.has(t) || defs.has(d)) continue;
        terms.add(t);
        defs.add(d);
        out.push(c);
        if (out.length === PAIRS) break;
      }
      return out;
    }

    function play() {
      stop();
      const cards = pickCards();
      left = cards.length;
      penalty = 0;
      selected = null;

      const timer = h('span', { class: 'timer' }, VT.formatTime(0));
      penaltyEl = h('span', { class: 'penalty', 'aria-hidden': 'true' }, '+1 s');
      const tiles = VT.shuffle(cards.flatMap((card) => ['term', 'def'].map((side) => ({ card, side }))));
      const grid = h('div', { class: 'match-grid' }, tiles.map((t) => {
        const text = t.card[t.side];
        t.el = h('button', {
          type: 'button',
          class: 'tile' + (text.length > 38 ? ' small' : ''),
          lang: t.side === 'term' ? set.termLang : set.defLang,
          onclick: () => pick(t),
        }, text);
        return t.el;
      }));
      VT.fill(main, h('div', { class: 'match-head' }, timer, penaltyEl, h('span', { class: 'muted' }, `${cards.length} Paare`)), grid);

      startedAt = performance.now();
      const tick = () => {
        timer.textContent = VT.formatTime(elapsed());
        raf = requestAnimationFrame(tick);
      };
      tick();
    }

    function pick(t) {
      if (t.done) return;
      if (!selected) {
        selected = t;
        t.el.classList.add('selected');
        return;
      }
      if (selected === t) {
        t.el.classList.remove('selected');
        selected = null;
        return;
      }
      const a = selected;
      selected = null;
      a.el.classList.remove('selected');
      if (a.card.id === t.card.id) {
        a.done = t.done = true;
        for (const x of [a, t]) {
          x.el.classList.add('matched');
          x.el.disabled = true;
        }
        later(() => {
          a.el.classList.add('gone');
          t.el.classList.add('gone');
        }, 200);
        left--;
        if (!left) finish();
      } else {
        penalty += PENALTY;
        for (const x of [a, t]) x.el.classList.add('wrong');
        penaltyEl.classList.add('show');
        later(() => {
          for (const x of [a, t]) x.el.classList.remove('wrong');
          penaltyEl.classList.remove('show');
        }, 450);
      }
    }

    function finish() {
      const time = elapsed();
      cancelAnimationFrame(raf);
      const best = progress.matchBest();
      const record = !best || time < best;
      if (record) progress.setMatchBest(time);
      later(() => {
        VT.fill(main, h('div', { class: 'panel intro' },
          VT.ic('trophy', 'big'),
          h('h1', null, record ? 'Neuer Rekord!' : 'Geschafft!'),
          h('p', { class: 'timer big' }, VT.formatTime(time)),
          best ? h('p', { class: 'muted' }, record ? `Bisheriger Rekord: ${VT.formatTime(best)}` : `Dein Rekord: ${VT.formatTime(best)}`) : null,
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn primary', onclick: play }, 'Nochmal spielen'),
            h('a', { class: 'btn', href: base }, 'Zurück zum Set'))));
      }, 450);
    }
  };
})();
