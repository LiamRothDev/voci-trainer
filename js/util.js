/* Voci-Trainer – kleine Helfer, die alle Ansichten brauchen */
(function () {
  'use strict';
  const VT = (window.VT = window.VT || {});
  VT.views = VT.views || {};

  /** Hängt Kinder an; null/false werden übersprungen, Texte bleiben immer Text. */
  VT.append = (el, ...children) => {
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      el.append(child instanceof Node ? child : String(child));
    }
    return el;
  };

  VT.fill = (el, ...children) => {
    el.replaceChildren();
    return VT.append(el, ...children);
  };

  /**
   * Baut ein DOM-Element. Inhalte aus den Vokabeln werden nie als HTML
   * eingefügt – nur die eigenen SVG-Icons nutzen `html`.
   */
  VT.h = function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    const props = {};
    for (const [key, val] of Object.entries(attrs || {})) {
      if (val == null || val === false) continue;
      if (key === 'class') el.className = val;
      else if (key === 'html') el.innerHTML = val;
      else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2), val);
      else if (key === 'value' || key === 'checked') props[key] = val;
      else el.setAttribute(key, val === true ? '' : val);
    }
    VT.append(el, ...children);
    Object.assign(el, props); // erst nach den Kindern, damit <select>-Werte greifen
    return el;
  };

  VT.setTitle = (text) => {
    document.title = text ? `${text} · Voci-Trainer` : 'Voci-Trainer';
  };

  VT.shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  VT.sample = (list, n) => VT.shuffle(list).slice(0, n);
  VT.clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  /** Kurzer, stabiler Hash (FNV-1a) für Karten-IDs */
  VT.hash = (str) => {
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      x ^= str.charCodeAt(i);
      x = Math.imul(x, 0x01000193);
    }
    return (x >>> 0).toString(36);
  };

  VT.formatTime = (ms) => (ms / 1000).toFixed(1) + ' s';

  /** true, wenn gerade in ein Feld getippt wird – dann keine Tastenkürzel */
  VT.isTyping = (e) => {
    const t = e.target;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  };

  const LANGS = { en: 'Englisch', de: 'Deutsch', fr: 'Französisch', it: 'Italienisch', es: 'Spanisch' };
  VT.langName = (code) => LANGS[String(code || '').slice(0, 2).toLowerCase()] || 'Sprache';

  // ---- Antworten prüfen ------------------------------------------------------

  VT.normalize = (s) =>
    String(s)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/ß/g, 'ss') // Schweizer Schreibweise
      .replace(/[’‘`´]/g, "'")
      .replace(/\bsomething\b/g, 'sth')
      .replace(/\b(?:somebody|someone)\b/g, 'sb')
      .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Platzhalter, die beim Schreiben fehlen dürfen
  const PLACEHOLDER = /\b(?:sb|sth|etw|jmdn|jmdm|jmds|etwas|jemanden|jemandem|jemandes)(?:'s)?\b/g;
  // Wörter, mit denen ein Nebensatz beginnt – dann ist das Komma keine Aufzählung
  const LEAD_WORDS = new Set(['der', 'die', 'das', 'dass', 'um', 'wie', 'was', 'zu', 'wo', 'wenn', 'weil', 'als',
    'etw', 'etwas', 'jmdn', 'jmdm', 'jemanden', 'jemandem', 'sich', 'sb', 'sth', 'which', 'who', 'that']);
  const ARTICLES = new Set(['der', 'die', 'das']);

  /** «Kollege, Kollegin» → beide einzeln richtig; «Mühe haben, etwas zu tun» bleibt ganz */
  function listParts(text) {
    const parts = text.split(/\s*[;,]\s*|\s+=\s+|\s+syn\.?\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return [];
    // Klammerinhalt zählt nicht: bei «(sich an etwas) anpassen» ist «anpassen» das erste Wort
    const firstWord = (p) => VT.normalize(p.replace(/\([^)]*\)/g, ' ')).replace(/^hier /, '').split(' ')[0];
    const lead = firstWord(parts[0]);
    const ok = parts.every((p, i) => {
      if (/-$/.test(p)) return true; // «Stellen-, …» ist nur ein Wortteil – wird unten weggelassen
      const w = firstWord(p);
      if (VT.normalize(p).split(' ').length > 5) return false;
      if (i === 0 || !LEAD_WORDS.has(w)) return true;
      return w === lead || (ARTICLES.has(w) && ARTICLES.has(lead));
    });
    return ok ? parts.filter((p) => !/-$/.test(p)) : [];
  }

  /** «sich brennend / leidenschaftlich für etw …» → beide Varianten */
  function slashVariants(text, depth = 0) {
    const m = depth < 3 ? text.match(/(\S+?)\s*\/\s*(\S+)/) : null;
    if (!m) return [text];
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    const out = [];
    for (const alt of [m[1], m[2]]) {
      if (!/^-|-$/.test(alt)) out.push(...slashVariants(before + alt + after, depth + 1));
    }
    return out.length ? out : [text];
  }

  /**
   * Alle Schreibweisen, die als richtig zählen: Klammerinhalt optional, Aufzählungen
   * und Schrägstrich-Varianten einzeln, «/-in» mit oder ohne, «to», «hier:» und
   * Platzhalter wie sb/sth/etw./jmdn. dürfen fehlen.
   */
  function acceptedForms(answer) {
    const forms = new Set();
    const add = (s) => {
      const n = VT.normalize(s);
      if (n) forms.add(n);
    };
    const raw = String(answer);
    const gender = /\/-\s?(innen|in|r|n)\b/g;
    for (const base of new Set([raw, raw.replace(gender, ''), raw.replace(gender, '$1')])) {
      for (const part of [base, ...listParts(base)]) {
        for (const v of slashVariants(part)) {
          add(v);
          add(v.replace(/\([^)]*\)/g, ' '));
          add(v.replace(/[()]/g, ' '));
        }
      }
    }
    for (const f of [...forms]) {
      const bare = f.replace(PLACEHOLDER, ' ').replace(/\s+/g, ' ').trim();
      if (bare && bare !== 'to') forms.add(bare);
    }
    for (const f of [...forms]) if (f.startsWith('hier ')) forms.add(f.slice(5));
    for (const f of [...forms]) if (f.startsWith('to ')) forms.add(f.slice(3));
    return forms;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /** Prüft eine getippte Antwort. `close` = knapp daneben (Tippfehler). */
  VT.checkAnswer = (input, answer) => {
    const given = VT.normalize(input);
    if (!given) return { correct: false, close: false };
    const forms = acceptedForms(answer);
    if (forms.has(given) || forms.has(given.replace(/^to /, ''))) return { correct: true, close: false };
    let best = Infinity;
    for (const f of forms) best = Math.min(best, levenshtein(given, f));
    return { correct: false, close: given.length >= 4 && best <= (given.length >= 9 ? 2 : 1) };
  };

  // «to …», «der/die/das …» usw. – ähnliche falsche Antworten machen Auswahlfragen fairer
  function kind(s) {
    const m = VT.normalize(s).match(/^(to|der|die|das|the|a|an|sich) /);
    return m ? m[1] : '';
  }

  /** Bis zu n falsche Antworten aus anderen Karten, ohne Doppelte */
  VT.distractors = (cards, card, side, n) => {
    const target = card[side];
    const targetKind = kind(target);
    const targetWords = VT.normalize(target).split(' ').length;
    const seen = new Set([VT.normalize(target)]);
    const scored = [];
    for (const c of cards) {
      const key = VT.normalize(c[side]);
      if (c.id === card.id || seen.has(key)) continue;
      seen.add(key);
      const words = key.split(' ').length;
      const score = Math.random() + (kind(c[side]) === targetKind ? 1 : 0) + (Math.abs(words - targetWords) <= 1 ? 0.5 : 0);
      scored.push([score, c[side]]);
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
  };

  // ---- Listen einlesen ("Begriff <Trennzeichen> Bedeutung") -------------------

  const SEPARATORS = {
    tab: /\t+/,
    dash: /\s+[-–—]\s+/,
    eq: /\s*=\s*/,
    semi: /\s*;\s*/,
    comma: /\s*,\s*/,
  };

  VT.parseCards = (text, mode = 'auto') => {
    const cards = [];
    let skipped = 0;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const re = mode === 'auto' ? Object.values(SEPARATORS).find((r) => r.test(line)) : SEPARATORS[mode];
      const m = re ? line.match(re) : null;
      const term = m ? line.slice(0, m.index).trim() : '';
      const def = m ? line.slice(m.index + m[0].length).trim() : '';
      if (term && def) cards.push({ term, def });
      else skipped++;
    }
    return { cards, skipped };
  };
})();
