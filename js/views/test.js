/* Test: Fragen zusammenstellen, abgeben, Note nach Schweizer Skala (1–6) */
(function () {
  'use strict';
  const VT = window.VT;
  const h = VT.h;

  const TYPES = [
    { key: 'tf', label: 'Richtig oder falsch' },
    { key: 'mc', label: 'Multiple Choice' },
    { key: 'match', label: 'Zuordnen' },
    { key: 'written', label: 'Schriftlich' },
  ];
  const TYPE_LABEL = { tf: 'Richtig oder falsch', mc: 'Multiple Choice', matchItem: 'Zuordnen', written: 'Schriftlich' };
  const BLOCK = 5; // höchstens so viele Karten pro Zuordnen-Aufgabe

  VT.views.test = function (root, id) {
    const set = VT.store.getSet(id);
    if (!set) return VT.views.notFound(root, 'Dieses Set gibt es nicht (mehr).');
    VT.setTitle('Test · ' + set.title);
    const base = '#/set/' + encodeURIComponent(set.id);
    const total = set.cards.length;
    const opts = VT.store.options('test', { count: 20, answerWith: 'def', tf: true, mc: true, match: true, written: true });
    const langOf = (side) => (side === 'term' ? set.termLang : set.defLang);
    const main = h('div', { class: 'test-main' });

    let sections = []; // [{ key, label, qs }]
    let questions = []; // alle bewerteten Fragen der Reihe nach

    VT.append(root, VT.ui.topbar({ back: base, title: 'Test', subtitle: set.title }), main);
    setup();

    function setup() {
      const count = h('input', { type: 'range', min: '1', max: String(total), value: String(VT.clamp(opts.count, 1, total)), 'aria-label': 'Anzahl Fragen' });
      const countOut = h('output');
      const syncCount = () => (countOut.textContent = `${count.value} von ${total}`);
      count.addEventListener('input', syncCount);
      syncCount();

      const error = h('p', { class: 'form-error', role: 'alert' });
      const startBtn = h('button', { type: 'submit', class: 'btn primary wide' }, 'Test starten');
      const check = () => {
        const ok = TYPES.some((t) => opts[t.key]);
        startBtn.disabled = !ok;
        error.textContent = ok ? '' : 'Wähle mindestens einen Fragetyp.';
      };
      check();

      VT.fill(main, h('form', {
        class: 'panel test-setup',
        onsubmit: (e) => {
          e.preventDefault();
          opts.count = Number(count.value);
          VT.store.saveOptions('test', opts);
          build(VT.sample(set.cards, opts.count));
        },
      },
        h('h1', null, 'Test einrichten'),
        VT.ui.field('Anzahl Fragen', h('div', { class: 'range-row' }, count, countOut)),
        VT.ui.field('Antworten auf', VT.ui.seg(
          [
            { value: 'def', label: VT.langName(set.defLang) },
            { value: 'term', label: VT.langName(set.termLang) },
            { value: 'both', label: 'Beides' },
          ],
          opts.answerWith,
          (v) => (opts.answerWith = v))),
        VT.ui.field('Fragetypen', TYPES.map((t) => VT.ui.switchRow(t.label, opts[t.key], (v) => {
          opts[t.key] = v;
          check();
        }))),
        error,
        startBtn));
    }

    function direction() {
      const answerSide = opts.answerWith === 'both' ? (Math.random() < 0.5 ? 'def' : 'term') : opts.answerWith;
      const promptSide = answerSide === 'def' ? 'term' : 'def';
      return { promptSide, answerSide, promptLang: langOf(promptSide), answerLang: langOf(answerSide) };
    }

    function makeQuestion(type, card) {
      const q = Object.assign({ type, card, user: null }, direction());
      if (type === 'tf') {
        const wrong = VT.distractors(set.cards, card, q.answerSide, 1)[0];
        q.isTrue = !wrong || Math.random() < 0.5;
        q.shown = q.isTrue ? card[q.answerSide] : wrong;
      } else if (type === 'mc') {
        q.options = VT.shuffle([card[q.answerSide], ...VT.distractors(set.cards, card, q.answerSide, 3)]);
      } else {
        q.user = '';
      }
      return q;
    }

    /** Verteilt die Karten gleichmässig auf die gewählten Fragetypen */
    function build(cards) {
      let types = TYPES.map((t) => t.key).filter((k) => opts[k]);
      if (total < 2 || !types.length) types = ['written']; // Auswahlfragen brauchen andere Karten
      const buckets = {};
      types.forEach((k) => (buckets[k] = []));
      VT.shuffle(cards).forEach((c, i) => buckets[types[i % types.length]].push(c));

      // Zuordnen: Blöcke mit eindeutigen Antworten; was nicht passt, wird zur Auswahlfrage
      const blocks = [];
      const leftovers = [];
      if (buckets.match && buckets.match.length) {
        const n = buckets.match.length;
        const size = Math.ceil(n / Math.ceil(n / BLOCK));
        let block = null;
        for (const c of buckets.match) {
          if (!block || block.cards.length >= size) {
            block = Object.assign({ cards: [], keys: new Set() }, direction());
            blocks.push(block);
          }
          const key = VT.normalize(c[block.answerSide]);
          if (block.keys.has(key)) leftovers.push(c);
          else {
            block.keys.add(key);
            block.cards.push(c);
          }
        }
        for (const b of blocks.filter((x) => x.cards.length < 2)) leftovers.push(...b.cards);
        if (leftovers.length) {
          const target = types.includes('mc') || !types.includes('written') ? 'mc' : 'written';
          (buckets[target] = buckets[target] || []).push(...leftovers);
        }
      }

      sections = [];
      for (const t of TYPES) {
        let qs;
        if (t.key === 'match') {
          qs = blocks.filter((b) => b.cards.length >= 2).map((b) => ({
            type: 'match',
            answers: VT.shuffle(b.cards.map((c) => c[b.answerSide])),
            items: b.cards.map((c) => ({
              type: 'matchItem', card: c, user: '',
              promptSide: b.promptSide, answerSide: b.answerSide, promptLang: b.promptLang, answerLang: b.answerLang,
            })),
            answerLang: b.answerLang,
          }));
        } else {
          qs = (buckets[t.key] || []).map((c) => makeQuestion(t.key, c));
        }
        if (qs.length) sections.push(Object.assign({ qs }, t));
      }
      questions = sections.flatMap((s) => s.qs.flatMap((q) => (q.type === 'match' ? q.items : [q])));
      renderTest();
    }

    function renderTest() {
      let nr = 0;
      const radio = (name, label, onPick, lang) =>
        h('label', { class: 'choice' }, h('input', { type: 'radio', name, onchange: onPick }), h('span', { lang }, label));

      // Enter in einem Textfeld springt zum nächsten Feld statt den Test abzugeben
      const nextField = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const fields = [...main.querySelectorAll('input[type="text"], select')];
        const next = fields[fields.indexOf(e.target) + 1];
        if (next) next.focus();
      };

      function renderQ(q) {
        const n = ++nr;
        const name = 'q' + n;
        const head = h('div', { class: 'q-head' }, h('span', null, `Frage ${n}`), h('span', null, TYPE_LABEL[q.type]));
        if (q.type === 'tf') {
          return h('article', { class: 'panel q' }, head,
            h('div', { class: 'tf-pair' },
              h('div', { class: 'q-prompt', lang: q.promptLang }, q.card[q.promptSide]),
              h('div', { class: 'tf-eq', 'aria-hidden': 'true' }, '='),
              h('div', { class: 'q-prompt alt', lang: q.answerLang }, q.shown)),
            h('div', { class: 'choices' },
              radio(name, 'Richtig', () => (q.user = true)),
              radio(name, 'Falsch', () => (q.user = false))));
        }
        if (q.type === 'mc') {
          return h('article', { class: 'panel q' }, head,
            h('div', { class: 'q-prompt', lang: q.promptLang }, q.card[q.promptSide]),
            h('div', { class: 'choices' }, q.options.map((o, i) => radio(name, o, () => (q.user = i), q.answerLang))));
        }
        return h('article', { class: 'panel q' }, head,
          h('label', { class: 'q-prompt', for: name, lang: q.promptLang }, q.card[q.promptSide]),
          h('input', {
            id: name, class: 'input', type: 'text', lang: q.answerLang, autocomplete: 'off', autocapitalize: 'off',
            spellcheck: 'false', placeholder: `Antwort auf ${VT.langName(q.answerLang)}`,
            oninput: (e) => (q.user = e.target.value), onkeydown: nextField,
          }));
      }

      function renderMatch(block) {
        const first = nr + 1;
        const rows = block.items.map((it) => {
          const n = ++nr;
          return h('div', { class: 'match-row' },
            h('span', { class: 'num' }, n),
            h('span', { class: 'q-prompt small', lang: it.promptLang }, it.card[it.promptSide]),
            h('select', {
              class: 'select', lang: block.answerLang, 'aria-label': `Antwort zu Frage ${n}`,
              onchange: (e) => (it.user = e.target.value), onkeydown: nextField,
            },
              h('option', { value: '' }, '– wählen –'),
              block.answers.map((a) => h('option', { value: a }, a))));
        });
        return h('article', { class: 'panel q' },
          h('div', { class: 'q-head' }, h('span', null, `Fragen ${first}–${nr}`), h('span', null, 'Passende Antwort wählen')),
          rows);
      }

      const form = h('form', { class: 'test-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } });
      for (const s of sections) {
        form.append(h('h2', { class: 'section-title' }, s.label));
        for (const q of s.qs) form.append(q.type === 'match' ? renderMatch(q) : renderQ(q));
      }
      form.append(h('div', { class: 'test-submit' },
        h('p', { class: 'muted' }, 'Fertig? Gib den Test ab, um deine Note zu sehen.'),
        h('button', { type: 'submit', class: 'btn primary wide' }, 'Test abgeben')));
      VT.fill(main, h('div', { class: 'test-intro' }, h('h1', null, set.title), h('p', { class: 'muted' }, `${questions.length} Fragen`)), form);
      window.scrollTo(0, 0);
    }

    function submit() {
      const open = questions.filter((q) => q.user == null || q.user === '').length;
      if (open && !confirm(open === 1 ? 'Eine Frage ist noch offen. Trotzdem abgeben?' : `${open} Fragen sind noch offen. Trotzdem abgeben?`)) return;
      renderResults();
      window.scrollTo(0, 0);
    }

    function isCorrect(q) {
      const right = q.card[q.answerSide];
      switch (q.type) {
        case 'tf':
          return q.user === q.isTrue;
        case 'mc':
          return q.user != null && VT.normalize(q.options[q.user]) === VT.normalize(right);
        case 'written':
          return !!q.override || VT.checkAnswer(q.user || '', right).correct;
        case 'matchItem':
          return !!q.user && VT.normalize(q.user) === VT.normalize(right);
      }
      return false;
    }

    function verdict(grade) {
      if (grade >= 5.5) return 'Hervorragend!';
      if (grade >= 5) return 'Sehr gut gemacht!';
      if (grade >= 4) return 'Bestanden!';
      return 'Weiter üben – das wird!';
    }

    function renderResults() {
      const right = questions.filter(isCorrect).length;
      const n = questions.length;
      const ratio = n ? right / n : 0;
      const grade = 1 + 5 * ratio; // Schweizer Notenskala
      const wrongCards = [...new Set(questions.filter((q) => !isCorrect(q)).map((q) => q.card))];

      VT.fill(main,
        h('section', { class: 'panel result-head' },
          h('div', { class: 'grade ' + (grade >= 4 ? 'pass' : 'fail') }, h('small', null, 'Note'), grade.toFixed(1)),
          h('div', { class: 'result-text' },
            h('h1', null, verdict(grade)),
            h('p', null, `${right} von ${n} richtig (${Math.round(ratio * 100)} %)`),
            VT.ui.bar({ mastered: right }, n, 'richtig'),
            h('p', { class: 'muted small' }, 'Note = 1 + 5 × Anteil richtig'))),
        h('div', { class: 'btn-row' },
          wrongCards.length
            ? h('button', { type: 'button', class: 'btn primary', onclick: () => build(wrongCards) }, `Fehler wiederholen (${wrongCards.length})`)
            : null,
          h('button', { type: 'button', class: wrongCards.length ? 'btn' : 'btn primary', onclick: setup }, 'Neuer Test'),
          h('a', { class: 'btn ghost', href: base }, 'Zurück zum Set')),
        h('h2', { class: 'section-title' }, 'Auswertung'),
        questions.map((q, i) => review(q, i + 1)));
    }

    function review(q, n) {
      const ok = isCorrect(q);
      const right = q.card[q.answerSide];
      let given = q.user || null;
      if (q.type === 'tf') given = q.user == null ? null : q.user ? 'Richtig' : 'Falsch';
      if (q.type === 'mc') given = q.user == null ? null : q.options[q.user];
      const prompt = q.type === 'tf' ? `${q.card[q.promptSide]} = ${q.shown}` : q.card[q.promptSide];
      const solution = q.type === 'tf' ? (q.isTrue ? 'Richtig' : `Falsch – richtig wäre: ${right}`) : right;

      return h('article', { class: 'panel q review ' + (ok ? 'ok' : 'no') },
        h('div', { class: 'q-head' },
          h('span', null, `Frage ${n} · ${TYPE_LABEL[q.type]}`),
          h('span', { class: ok ? 'right' : 'wrong-label' }, ok ? 'Richtig' : 'Falsch')),
        h('div', { class: 'q-prompt' }, prompt),
        h('div', { class: 'yours' }, 'Deine Antwort: ',
          given == null ? h('em', { class: 'muted' }, 'keine') : h('span', { class: ok ? 'right' : 'wrong-ans' }, given)),
        ok ? null : h('div', null, 'Lösung: ', h('strong', { class: 'right' }, solution)),
        !ok && q.type === 'written' && given
          ? h('button', {
              type: 'button',
              class: 'btn ghost',
              onclick: () => {
                q.override = true;
                const y = window.scrollY;
                renderResults();
                window.scrollTo(0, y);
              },
            }, 'Ich hatte recht')
          : null);
    }
  };
})();
