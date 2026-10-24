/* Voci-Trainer – Speicher im Browser: eigene Sets, Lernfortschritt, Optionen */
(function () {
  'use strict';
  const VT = window.VT;
  const PREFIX = 'vt:';

  // localStorage kann gesperrt sein (privates Fenster) – dann einfach ohne Speichern weiter
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  function remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (e) {
      /* nichts zu tun */
    }
  }

  function prepareSet(raw, custom) {
    const used = new Set();
    const cards = (raw.cards || []).map((c, i) => {
      // Karten als [Begriff, Bedeutung] (data/sets.js) oder { term, def } (eigene Sets)
      const term = String(Array.isArray(c) ? c[0] : c.term).trim();
      const def = String(Array.isArray(c) ? c[1] : c.def).trim();
      // ID aus dem Inhalt: Fortschritt bleibt erhalten, auch wenn sich die Reihenfolge ändert
      let id = (!Array.isArray(c) && c.id) || VT.hash(term + '␟' + def);
      if (used.has(id)) id += '-' + i;
      used.add(id);
      return { id, term, def };
    });
    return {
      id: String(raw.id),
      title: raw.title || 'Ohne Titel',
      description: raw.description || '',
      source: raw.source || null,
      termLang: raw.termLang || 'en-GB',
      defLang: raw.defLang || 'de-DE',
      custom: !!custom,
      cards,
    };
  }

  VT.store = {
    sets() {
      const builtIn = (window.VOCI_SETS || []).map((s) => prepareSet(s, false));
      const custom = read('customSets', []).map((s) => prepareSet(s, true));
      return builtIn.concat(custom);
    },
    getSet(id) {
      return this.sets().find((s) => s.id === id) || null;
    },
    saveCustomSet(set) {
      const list = read('customSets', []);
      const i = list.findIndex((s) => s.id === set.id);
      if (i >= 0) list[i] = set;
      else list.push(set);
      return write('customSets', list);
    },
    deleteCustomSet(id) {
      write('customSets', read('customSets', []).filter((s) => s.id !== id));
      remove('progress:' + id);
    },
    options(name, defaults) {
      return Object.assign({}, defaults, read('opts:' + name, {}));
    },
    saveOptions(name, opts) {
      write('opts:' + name, opts);
    },
  };

  /**
   * Fortschritt eines Sets. Pro Karte:
   *   lv   – Lernen: 0 neu, 1 am Lernen, 2 gemeistert
   *   fc   – Karteikarten: 'known' | 'learning'
   *   star – markiert
   */
  class Progress {
    constructor(setId) {
      this.key = 'progress:' + setId;
      this.data = read(this.key, {});
      if (!this.data.cards) this.data.cards = {};
    }
    get(id) {
      return this.data.cards[id] || {};
    }
    update(id, patch) {
      this.data.cards[id] = Object.assign({}, this.data.cards[id], patch);
      this.save();
    }
    level(id) {
      return this.get(id).lv || 0;
    }
    flash(id) {
      return this.get(id).fc || null;
    }
    starred(id) {
      return !!this.get(id).star;
    }
    toggleStar(id) {
      const on = !this.starred(id);
      this.update(id, { star: on });
      return on;
    }
    stats(cards) {
      const s = { fresh: 0, learning: 0, mastered: 0 };
      for (const c of cards) {
        const lv = this.level(c.id);
        if (lv >= 2) s.mastered++;
        else if (lv === 1) s.learning++;
        else s.fresh++;
      }
      return s;
    }
    reset(field, cards) {
      for (const c of cards) if (this.data.cards[c.id]) delete this.data.cards[c.id][field];
      this.save();
    }
    matchBest() {
      return this.data.matchBest || null;
    }
    setMatchBest(ms) {
      this.data.matchBest = ms;
      this.save();
    }
    save() {
      write(this.key, this.data);
    }
  }
  VT.Progress = Progress;
})();
