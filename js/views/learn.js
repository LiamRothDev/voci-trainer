/* Lernen: zuerst Auswahlfragen, dann schriftlich – in kurzen Runden, bis alles sitzt */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;
  const ROUND_SIZE = 7;
  const MAX_REPEATS = 2; // so oft kommt eine falsch beantwortete Karte pro Runde nochmal
  const PRAISE = ['Richtig!', 'Super!', 'Genau!', 'Stark!', 'Perfekt!', 'Weiter so!'];

  VT.views.learn = function (root, id) {
    const set = VT.store.getSet(id);
    if (!set) return VT.views.notFound(root, 'Dieses Set gibt es nicht (mehr).');
    VT.setTitle('Lernen · ' + set.title);
    const base = '#/set/' + encodeURIComponent(set.id);
    const progress = new VT.Progress(set.id);
    const opts = VT.store.options('learn', { answerWith: 'def', mc: true, written: true });
    const total = set.cards.length;
    const langOf = (side) => (side === 'term' ? set.termLang : set.defLang);

    let round = []; // Karten dieser Runde
    let queue = []; // noch offene Fragen
    let results = new Map(); // Karte -> erste Antwort richtig?
    let repeats = new Map();
    let current = null;
    let state = 'idle'; // question | feedback | summary | done
    let slot = null; // Platz für die Rückmeldung
    let autoNext = null;
    let onNumber = null; // Tasten 1–4 für Auswahlfragen

    const bar = VT.ui.bar(progress.stats(set.cards), total);
    const barCount = h('span', { class: 'count' });
    const stage = h('div', { class: 'learn-stage' });

    VT.append(root,
      VT.ui.topbar({ back: base, title: 'Lernen', subtitle: set.title, actions: [VT.ui.iconButton('settings', 'Optionen', openOptions)] }),
      h('div', { class: 'learn-top' }, bar, barCount),
      stage);

    document.addEventListener('keydown', onKey);
    updateBar();
    if (total) nextRound();

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(autoNext);
    };

    function updateBar() {
      const s = progress.stats(set.cards);
      bar.update(s);
      barCount.textContent = `${s.mastered} / ${total} gemeistert`;
    }

    function nextRound() {
      const open = set.cards.filter((c) => progress.level(c.id) < 2);
      if (!open.length) return allDone();
      // angefangene Karten festigen und dazu neue einführen (neue in der Reihenfolge des Sets)
      const started = VT.shuffle(open.filter((c) => progress.level(c.id) === 1));
      const fresh = open.filter((c) => progress.level(c.id) === 0);
      const picked = started.slice(0, Math.ceil(ROUND_SIZE / 2));
      for (const c of fresh.concat(started)) {
        if (picked.length >= ROUND_SIZE) break;
        if (!picked.includes(c)) picked.push(c);
      }
      round = picked;
      queue = VT.shuffle(picked);
      results = new Map();
      repeats = new Map();
      ask(queue.shift());
    }

    function ask(card) {
      clearTimeout(autoNext);
      const answerSide = opts.answerWith === 'both' ? (Math.random() < 0.5 ? 'def' : 'term') : opts.answerWith;
      const promptSide = answerSide === 'def' ? 'term' : 'def';
      let type = !opts.written ? 'mc' : !opts.mc ? 'written' : progress.level(card.id) >= 1 ? 'written' : 'mc';
      if (type === 'mc' && total < 2) type = 'written';
      current = { card, type, promptSide, answerSide, promptLang: langOf(promptSide), answerLang: langOf(answerSide), answered: false };
      state = 'question';
      if (type === 'mc') renderChoice();
      else renderWritten();
    }

    function promptBlock(label) {
      const q = current;
      return [
        h('div', { class: 'q-label' },
          h('span', null, `${VT.langName(q.promptLang)} · ${label}`),
          VT.speech.supported ? VT.ui.iconButton('speaker', 'Vorlesen', () => VT.speech.speak(q.card[q.promptSide], q.promptLang)) : null),
        h('div', { class: 'prompt', lang: q.promptLang }, q.card[q.promptSide]),
      ];
    }

    function renderChoice() {
      const q = current;
      const right = q.card[q.answerSide];
      const options = VT.shuffle([right, ...VT.distractors(set.cards, q.card, q.answerSide, 3)]);
      const isRight = (i) => VT.normalize(options[i]) === VT.normalize(right);
      const buttons = options.map((text, i) =>
        h('button', { type: 'button', class: 'option', lang: q.answerLang, onclick: () => choose(i) },
          h('span', { class: 'key', 'aria-hidden': 'true' }, i + 1),
          h('span', null, text)));
      const dontKnow = h('button', { type: 'button', class: 'btn ghost dontknow', onclick: () => choose(-1) }, 'Weiss ich nicht');

      function choose(i) {
        if (q.answered) return;
        q.answered = true;
        onNumber = null;
        dontKnow.disabled = true;
        buttons.forEach((b, j) => {
          b.disabled = true;
          b.classList.add(isRight(j) ? 'correct' : j === i ? 'wrong' : 'dim');
        });
        answer(i >= 0 && isRight(i), i >= 0 ? options[i] : null, false);
      }
      onNumber = (n) => {
        if (n <= options.length) choose(n - 1);
      };

      slot = h('div', { 'aria-live': 'polite' });
      VT.fill(stage, h('div', { class: 'panel learn-card' },
        promptBlock('Wähle die richtige Antwort'),
        h('div', { class: 'options' }, buttons),
        dontKnow,
        slot));
    }

    function renderWritten() {
      const q = current;
      const input = h('input', {
        class: 'answer-input', type: 'text', lang: q.answerLang, autocomplete: 'off', autocapitalize: 'off',
        spellcheck: 'false', 'aria-label': 'Deine Antwort', placeholder: `Antwort auf ${VT.langName(q.answerLang)}`,
      });
      const submitBtn = h('button', { type: 'submit', class: 'btn primary' }, 'Antworten');
      const dontKnow = h('button', { type: 'button', class: 'btn ghost dontknow', onclick: () => submit(true) }, 'Weiss ich nicht');

      function submit(skip) {
        if (q.answered) return;
        const value = input.value.trim();
        if (!skip && !value) return input.focus();
        q.answered = true;
        input.disabled = submitBtn.disabled = dontKnow.disabled = true;
        const res = skip ? { correct: false, close: false } : VT.checkAnswer(value, q.card[q.answerSide]);
        answer(res.correct, skip ? null : value, res.close);
      }

      slot = h('div', { 'aria-live': 'polite' });
      VT.fill(stage, h('div', { class: 'panel learn-card' },
        promptBlock('Schreib die Antwort'),
        h('form', { class: 'answer-form', onsubmit: (e) => { e.preventDefault(); submit(false); } }, input, submitBtn),
        dontKnow,
        slot));
      setTimeout(() => input.focus(), 30);
    }

    function answer(ok, given, close) {
      const q = current;
      state = 'feedback';
      if (ok) levelUp(q.card);
      if (!results.has(q.card.id)) results.set(q.card.id, ok);
      if (!ok) requeue(q.card);
      updateBar();

      if (ok) {
        VT.fill(slot, h('div', { class: 'feedback good' }, VT.ic('check'), PRAISE[Math.floor(Math.random() * PRAISE.length)]));
        autoNext = setTimeout(cont, q.type === 'mc' ? 900 : 1200);
        return;
      }
      const right = q.card[q.answerSide];
      const contBtn = h('button', { type: 'button', class: 'btn primary', onclick: cont }, 'Weiter');
      VT.fill(slot, h('div', { class: 'feedback bad' },
        h('div', { class: 'fb-title' },
          given == null ? 'Kein Problem – merk dir:' : close ? 'Knapp daneben! Achte auf die Schreibweise:' : 'Nicht ganz. Richtig ist:'),
        h('div', { class: 'answer', lang: q.answerLang }, right),
        q.type === 'written' && given ? h('div', { class: 'muted small' }, 'Deine Antwort: ', h('span', { class: 'wrong-ans' }, given)) : null,
        h('div', { class: 'btn-row start' },
          contBtn,
          q.type === 'written' && given ? h('button', { type: 'button', class: 'btn ghost', onclick: override }, 'Ich hatte recht') : null,
          VT.speech.supported ? VT.ui.iconButton('speaker', 'Antwort vorlesen', () => VT.speech.speak(right, q.answerLang)) : null)));
      contBtn.focus();
    }

    function levelUp(card) {
      progress.update(card.id, { lv: Math.min(2, progress.level(card.id) + 1) });
    }

    function requeue(card) {
      const n = repeats.get(card.id) || 0;
      if (n >= MAX_REPEATS || queue.includes(card)) return;
      repeats.set(card.id, n + 1);
      // nicht sofort, sondern zwei, drei Fragen später nochmal
      queue.splice(Math.min(queue.length, 2 + Math.floor(Math.random() * 2)), 0, card);
    }

    function override() {
      const q = current;
      levelUp(q.card);
      results.set(q.card.id, true);
      const i = queue.lastIndexOf(q.card);
      if (i >= 0) queue.splice(i, 1);
      updateBar();
      cont();
    }

    function cont() {
      if (state !== 'feedback') return; // Enter und Klick dürfen nicht doppelt weiterschalten
      clearTimeout(autoNext);
      const nextCard = queue.shift();
      if (nextCard) ask(nextCard);
      else summary();
    }

    function summary() {
      state = 'summary';
      const s = progress.stats(set.cards);
      if (s.mastered === total) return allDone();
      const contBtn = h('button', { type: 'button', class: 'btn primary', onclick: nextRound }, 'Weiter lernen');
      VT.fill(stage, h('div', { class: 'panel summary' },
        h('h2', null, 'Runde geschafft!'),
        h('p', { class: 'muted' }, `${s.mastered} von ${total} gemeistert · ${s.learning} am Lernen · ${s.fresh} noch neu`),
        h('ul', { class: 'round-list' }, round.map((c) => {
          const ok = results.get(c.id);
          return h('li', null,
            h('span', { class: ok ? 'ok' : 'no', 'aria-label': ok ? 'richtig' : 'falsch' }, VT.ic(ok ? 'check' : 'x')),
            h('strong', { lang: set.termLang }, c.term),
            h('span', { lang: set.defLang }, c.def));
        })),
        h('div', { class: 'btn-row' }, contBtn)));
      contBtn.focus();
    }

    function allDone() {
      state = 'done';
      updateBar();
      VT.fill(stage, h('div', { class: 'panel done' },
        VT.ic('trophy', 'big'),
        h('h2', null, 'Alles gemeistert!'),
        h('p', { class: 'muted' }, `Du kannst alle ${total} Begriffe. Prüf dich jetzt im Test oder spiel Zuordnen.`),
        h('div', { class: 'btn-row' },
          h('a', { class: 'btn primary', href: base + '/test' }, 'Test machen'),
          h('a', { class: 'btn', href: base + '/zuordnen' }, 'Zuordnen spielen'),
          h('button', { type: 'button', class: 'btn ghost', onclick: restart }, VT.ic('restart'), 'Lernen neu starten'))));
    }

    function restart() {
      progress.reset('lv', set.cards);
      updateBar();
      nextRound();
    }

    function onKey(e) {
      if (document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey || VT.isTyping(e)) return;
      if (state === 'question' && onNumber && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        onNumber(Number(e.key));
      } else if (e.key === 'Enter' && state === 'feedback') {
        e.preventDefault();
        cont();
      } else if (e.key === 'Enter' && state === 'summary' && !e.target.closest('button, a')) {
        e.preventDefault();
        nextRound();
      }
    }

    function save() {
      VT.store.saveOptions('learn', opts);
    }

    function setType(key, on, input) {
      const other = key === 'mc' ? 'written' : 'mc';
      if (!on && !opts[other]) {
        input.checked = true;
        VT.ui.toast('Mindestens ein Fragetyp muss eingeschaltet sein.');
        return;
      }
      opts[key] = on;
      save();
    }

    function openOptions() {
      const dlg = VT.ui.dialog('Optionen', [
        VT.ui.field('Antworten auf', VT.ui.seg(
          [
            { value: 'def', label: VT.langName(set.defLang) },
            { value: 'term', label: VT.langName(set.termLang) },
            { value: 'both', label: 'Beides' },
          ],
          opts.answerWith,
          (v) => {
            opts.answerWith = v;
            save();
          })),
        VT.ui.field('Fragetypen', [
          VT.ui.switchRow('Multiple Choice', opts.mc, (v, input) => setType('mc', v, input)),
          VT.ui.switchRow('Schriftlich', opts.written, (v, input) => setType('written', v, input)),
        ]),
        h('button', {
          type: 'button',
          class: 'btn',
          onclick: () => {
            if (!confirm('Lernfortschritt für dieses Set zurücksetzen?')) return;
            dlg.close();
            restart();
          },
        }, VT.ic('restart'), 'Fortschritt zurücksetzen'),
      ]);
      // noch nicht beantwortete Frage mit den neuen Einstellungen neu stellen
      dlg.addEventListener('close', () => {
        if (state === 'question' && current && !current.answered) ask(current.card);
      });
    }
  };
})();
