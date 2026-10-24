/* Karteikarten: umdrehen, blättern, mischen – optional mit «Gewusst / Noch am Lernen» */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;

  /** Eine umdrehbare Karte. Wird auch in der Set-Übersicht als Vorschau benutzt. */
  class FlipCard {
    constructor({ set, progress, onFlip, onSwipe, onStar }) {
      Object.assign(this, { set, progress, onFlip, onSwipe, onStar });
      this.card = null;
      this.flipped = false;
      this.frontSide = 'term';
      this.starBtns = [];
      this.front = h('div', { class: 'fc-face front' });
      this.back = h('div', { class: 'fc-face back' });
      this.inner = h('div', { class: 'fc-inner' }, this.front, this.back);
      this.el = h('div', { class: 'fc', tabindex: '0', 'aria-label': 'Karteikarte – klicken oder Leertaste zum Umdrehen' }, this.inner);

      this.el.addEventListener('click', (e) => {
        if (e.target.closest('button') || this.swiped) return;
        this.flip();
      });
      this.el.addEventListener('keydown', (e) => {
        if (e.target !== this.el || (e.key !== ' ' && e.key !== 'Enter')) return;
        e.preventDefault();
        e.stopPropagation(); // sonst dreht der globale Tastenkürzel-Handler gleich nochmal
        this.flip();
      });
      this.bindSwipe();
    }

    bindSwipe() {
      let x0 = 0;
      let y0 = 0;
      let active = false;
      this.el.addEventListener('touchstart', (e) => {
        active = e.touches.length === 1;
        if (!active) return;
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
      }, { passive: true });
      this.el.addEventListener('touchend', (e) => {
        if (!active || !this.onSwipe) return;
        active = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - x0;
        const dy = t.clientY - y0;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        this.swiped = true; // der folgende Klick soll die Karte nicht umdrehen
        setTimeout(() => (this.swiped = false), 350);
        this.onSwipe(dx > 0 ? 'right' : 'left');
      }, { passive: true });
    }

    show(card, { frontSide = this.frontSide, enter = null } = {}) {
      this.card = card;
      this.frontSide = frontSide;
      this.starBtns = [];
      this.fill(this.front, frontSide);
      this.fill(this.back, frontSide === 'term' ? 'def' : 'term');
      // ohne Dreh-Animation zurück auf die Vorderseite, dann neue Karte hereingleiten lassen
      this.el.classList.add('no-anim');
      this.setFlipped(false);
      void this.el.offsetWidth;
      this.el.classList.remove('no-anim', 'enter-next', 'enter-prev');
      if (enter) {
        void this.el.offsetWidth;
        this.el.classList.add('enter-' + enter);
      }
    }

    fill(face, side) {
      const lang = side === 'term' ? this.set.termLang : this.set.defLang;
      const text = this.card[side];
      const star = VT.ui.starButton(this.progress, this.card.id, () => {
        this.starBtns.forEach((b) => b.sync());
        if (this.onStar) this.onStar();
      });
      this.starBtns.push(star);
      face.classList.toggle('long', text.length > 60);
      VT.fill(face,
        h('span', { class: 'fc-lang' }, VT.langName(lang)),
        h('div', { class: 'fc-tools' },
          VT.speech.supported ? VT.ui.iconButton('speaker', 'Vorlesen', () => VT.speech.speak(text, lang)) : null,
          star),
        h('div', { class: 'fc-text', lang }, text));
    }

    flip() {
      if (!this.card) return;
      this.setFlipped(!this.flipped);
      if (this.onFlip) this.onFlip(this.flipped);
    }

    setFlipped(on) {
      this.flipped = on;
      this.el.classList.toggle('flipped', on);
      this.front.inert = on;
      this.back.inert = !on;
      this.front.setAttribute('aria-hidden', String(on));
      this.back.setAttribute('aria-hidden', String(!on));
    }

    toggleStar() {
      if (this.starBtns[0]) this.starBtns[0].click();
    }

    speakVisible() {
      if (!this.card) return;
      const side = this.flipped ? (this.frontSide === 'term' ? 'def' : 'term') : this.frontSide;
      VT.speech.speak(this.card[side], side === 'term' ? this.set.termLang : this.set.defLang);
    }
  }
  VT.FlipCard = FlipCard;

  VT.views.flashcards = function (root, id) {
    const set = VT.store.getSet(id);
    if (!set) return VT.views.notFound(root, 'Dieses Set gibt es nicht (mehr).');
    VT.setTitle('Karteikarten · ' + set.title);
    const base = '#/set/' + encodeURIComponent(set.id);
    const progress = new VT.Progress(set.id);
    const opts = VT.store.options('flashcards', { front: 'term', track: true, shuffle: false, starredOnly: false, autoSpeak: false });
    const saveOpts = () => VT.store.saveOptions('flashcards', opts);

    let scope = []; // Karten im aktuellen Filter (alle oder nur markierte)
    let deck = []; // Karten dieser Runde
    let idx = 0;
    let history = []; // für «Rückgängig»
    let timer = null; // automatisches Abspielen
    let inDeck = false;

    const card = new FlipCard({
      set,
      progress,
      onFlip: () => {
        if (opts.autoSpeak) card.speakVisible();
      },
      onSwipe: (dir) => {
        if (opts.track) sort(dir === 'right' ? 'known' : 'learning');
        else if (dir === 'left') next();
        else prev();
      },
    });

    const pos = h('span');
    const count = h('span', { class: 'fc-count', 'aria-live': 'polite' });
    const learningPill = h('span', { class: 'pill learning' });
    const knownPill = h('span', { class: 'pill known' });
    const prevBtn = VT.ui.iconButton('prev', 'Vorherige Karte (←)', () => prev());
    const nextBtn = VT.ui.iconButton('next', 'Nächste Karte (→)', () => next());
    const undoBtn = VT.ui.iconButton('undo', 'Rückgängig (Strg+Z)', () => undo());
    const playBtn = VT.ui.iconButton('play', 'Automatisch abspielen', () => (timer ? stopAutoplay() : startAutoplay()));
    const shuffleBtn = VT.ui.iconButton('shuffle', 'Mischen', () => toggleShuffle());
    const main = h('div', { class: 'fc-main' });

    VT.append(root,
      VT.ui.topbar({ back: base, title: 'Karteikarten', subtitle: set.title, actions: [VT.ui.iconButton('settings', 'Optionen', openOptions)] }),
      h('div', { class: 'pos-bar' }, pos),
      main);

    document.addEventListener('keydown', onKey);
    begin();

    return () => {
      document.removeEventListener('keydown', onKey);
      stopAutoplay();
    };

    function begin() {
      stopAutoplay();
      scope = set.cards;
      if (opts.starredOnly) {
        const starred = scope.filter((c) => progress.starred(c.id));
        if (starred.length) scope = starred;
      }
      const open = opts.track ? scope.filter((c) => progress.flash(c.id) !== 'known') : scope;
      if (!open.length) {
        deck = [];
        history = [];
        finish();
        return;
      }
      startRound(open);
    }

    function startRound(cards) {
      deck = opts.shuffle ? VT.shuffle(cards) : cards.slice();
      idx = 0;
      history = [];
      renderDeck();
      show(null);
    }

    function renderDeck() {
      inDeck = true;
      shuffleBtn.setAttribute('aria-pressed', String(opts.shuffle));
      VT.fill(main,
        opts.track ? h('div', { class: 'track-counts' }, learningPill, knownPill) : null,
        h('div', { class: 'fc-stage' }, card.el),
        opts.track
          ? [
              h('div', { class: 'fc-controls' }, undoBtn, count, shuffleBtn),
              h('div', { class: 'sort-row' },
                h('button', { type: 'button', class: 'btn sort learning', onclick: () => sort('learning') }, VT.ic('x'), 'Noch am Lernen'),
                h('button', { type: 'button', class: 'btn sort known', onclick: () => sort('known') }, VT.ic('check'), 'Gewusst')),
            ]
          : h('div', { class: 'fc-controls' }, shuffleBtn, prevBtn, count, nextBtn, playBtn),
        h('p', { class: 'kbd-hint' },
          h('kbd', null, 'Leertaste'), ' umdrehen · ',
          h('kbd', null, '←'), ' ', h('kbd', null, '→'), opts.track ? ' noch am Lernen / gewusst · ' : ' blättern · ',
          h('kbd', null, 'S'), ' markieren'));
    }

    function show(enter) {
      card.show(deck[idx], { frontSide: opts.front, enter });
      count.textContent = `${idx + 1} / ${deck.length}`;
      pos.style.width = `${(idx / deck.length) * 100}%`;
      prevBtn.disabled = idx === 0;
      undoBtn.disabled = history.length === 0;
      updateCounts();
      if (opts.autoSpeak) card.speakVisible();
    }

    function updateCounts(bump) {
      const known = scope.filter((c) => progress.flash(c.id) === 'known').length;
      const learning = scope.filter((c) => progress.flash(c.id) === 'learning').length;
      VT.fill(learningPill, VT.ic('x'), 'Noch am Lernen ', h('b', null, learning));
      VT.fill(knownPill, 'Gewusst ', h('b', null, known), VT.ic('check'));
      if (bump) {
        const pill = bump === 'known' ? knownPill : learningPill;
        pill.classList.remove('bump');
        void pill.offsetWidth;
        pill.classList.add('bump');
      }
    }

    function next() {
      if (!inDeck) return;
      if (idx < deck.length - 1) {
        idx++;
        show('next');
      } else {
        finish();
      }
    }

    function prev() {
      if (!inDeck || idx === 0) return;
      idx--;
      show('prev');
    }

    function sort(state) {
      if (!inDeck || !opts.track) return;
      const c = deck[idx];
      history.push({ idx, id: c.id, before: progress.flash(c.id) });
      progress.update(c.id, { fc: state });
      updateCounts(state);
      next();
    }

    function undo() {
      const last = history.pop();
      if (!last) return;
      progress.update(last.id, { fc: last.before });
      if (!inDeck) renderDeck();
      idx = last.idx;
      show('prev');
    }

    function finish() {
      inDeck = false;
      stopAutoplay();
      pos.style.width = '100%';
      if (!opts.track) {
        VT.fill(main, h('div', { class: 'panel done' },
          VT.ic('check', 'big'),
          h('h2', null, 'Alle Karten durchgesehen'),
          h('p', { class: 'muted' }, `Du hast dir alle ${deck.length} Karten angeschaut.`),
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn primary', onclick: begin }, 'Nochmal von vorne'),
            h('a', { class: 'btn', href: base + '/lernen' }, 'Im Lernen-Modus üben'))));
        return;
      }
      const known = scope.filter((c) => progress.flash(c.id) === 'known');
      const open = scope.filter((c) => progress.flash(c.id) !== 'known');
      VT.fill(main, h('div', { class: 'panel done' },
        VT.ic(open.length ? 'cards' : 'trophy', 'big'),
        h('h2', null, open.length ? 'Runde geschafft!' : 'Du weisst alle Karten!'),
        h('p', { class: 'muted' }, open.length
          ? `Gewusst: ${known.length} von ${scope.length}. Übe jetzt die ${open.length} Karten, die du noch lernst.`
          : `Alle ${scope.length} Karten sitzen. Prüf dich jetzt im Test oder spiel Zuordnen.`),
        VT.ui.bar({ mastered: known.length }, scope.length, 'gewusst'),
        h('div', { class: 'btn-row' },
          open.length
            ? h('button', { type: 'button', class: 'btn primary', onclick: () => startRound(open) }, `Weiter mit ${open.length} Karten`)
            : h('a', { class: 'btn primary', href: base + '/test' }, 'Test machen'),
          history.length ? h('button', { type: 'button', class: 'btn', onclick: undo }, VT.ic('undo'), 'Rückgängig') : null,
          h('button', { type: 'button', class: 'btn ghost', onclick: resetCards }, VT.ic('restart'), 'Karten zurücksetzen'))));
    }

    function resetCards() {
      progress.reset('fc', set.cards);
      begin();
    }

    function toggleShuffle() {
      opts.shuffle = !opts.shuffle;
      saveOpts();
      shuffleBtn.setAttribute('aria-pressed', String(opts.shuffle));
      VT.ui.toast(opts.shuffle ? 'Karten gemischt' : 'Ursprüngliche Reihenfolge');
      if (!inDeck) return;
      // die aktuelle Karte bleibt, nur die restlichen werden neu geordnet
      const seen = deck.slice(0, idx + 1);
      const rest = deck.slice(idx + 1);
      const ordered = opts.shuffle ? VT.shuffle(rest) : rest.sort((a, b) => set.cards.indexOf(a) - set.cards.indexOf(b));
      deck = seen.concat(ordered);
    }

    function startAutoplay() {
      if (!inDeck) return;
      setPlayButton(true);
      timer = setInterval(() => {
        if (!card.flipped) card.flip();
        else if (idx < deck.length - 1) next();
        else stopAutoplay();
      }, 2600);
    }

    function stopAutoplay() {
      clearInterval(timer);
      timer = null;
      setPlayButton(false);
    }

    function setPlayButton(playing) {
      const label = playing ? 'Pause' : 'Automatisch abspielen';
      playBtn.innerHTML = VT.icon(playing ? 'pause' : 'play');
      playBtn.setAttribute('aria-label', label);
      playBtn.setAttribute('aria-pressed', String(playing));
      playBtn.title = label;
    }

    function onKey(e) {
      if (!inDeck || VT.isTyping(e) || document.querySelector('dialog[open]') || e.altKey || e.metaKey) return;
      if (e.ctrlKey) {
        if (e.key.toLowerCase() === 'z' && opts.track) {
          e.preventDefault();
          undo();
        }
        return;
      }
      const onControl = e.target.closest && e.target.closest('button, a');
      switch (e.key) {
        case ' ':
        case 'Enter':
          if (onControl) return; // Knöpfe sollen sich normal bedienen lassen
          e.preventDefault();
          card.flip();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          card.flip();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (opts.track) sort('known');
          else next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (opts.track) sort('learning');
          else prev();
          break;
        case 's':
        case 'S':
          card.toggleStar();
          break;
      }
    }

    function openOptions() {
      stopAutoplay();
      const starred = set.cards.filter((c) => progress.starred(c.id)).length;
      const dlg = VT.ui.dialog('Optionen', [
        VT.ui.field('Vorderseite der Karte', VT.ui.seg(
          [
            { value: 'term', label: VT.langName(set.termLang) },
            { value: 'def', label: VT.langName(set.defLang) },
          ],
          opts.front,
          (v) => {
            opts.front = v;
            saveOpts();
            if (inDeck) show(null);
          })),
        VT.ui.switchRow('Fortschritt verfolgen', opts.track, (v) => {
          opts.track = v;
          saveOpts();
          begin();
        }, 'Jede Karte in «Gewusst» oder «Noch am Lernen» sortieren.'),
        VT.ui.switchRow('Karten mischen', opts.shuffle, (v) => {
          opts.shuffle = v;
          saveOpts();
          begin();
        }),
        VT.ui.switchRow('Nur markierte Karten', opts.starredOnly, (v) => {
          opts.starredOnly = v;
          saveOpts();
          begin();
        }, starred ? `${starred} Karten markiert` : 'Markiere zuerst Karten mit dem Stern.', !starred && !opts.starredOnly),
        VT.speech.supported
          ? VT.ui.switchRow('Automatisch vorlesen', opts.autoSpeak, (v) => {
              opts.autoSpeak = v;
              saveOpts();
            })
          : null,
        h('button', {
          type: 'button',
          class: 'btn',
          onclick: () => {
            if (!confirm('Fortschritt der Karteikarten zurücksetzen?')) return;
            resetCards();
            dlg.close();
          },
        }, VT.ic('restart'), 'Karten zurücksetzen'),
      ]);
    }
  };
})();
