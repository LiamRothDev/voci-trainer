/* Voci-Trainer – Vorlesen mit der Sprachausgabe des Browsers */
(function () {
  'use strict';
  const VT = window.VT;
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voices = [];

  function loadVoices() {
    voices = synth ? synth.getVoices() : [];
  }
  if (synth) {
    loadVoices();
    synth.onvoiceschanged = loadVoices; // Chrome lädt die Stimmen erst später
  }

  function pickVoice(lang) {
    const want = lang.toLowerCase();
    const base = want.split('-')[0];
    const norm = (v) => v.lang.toLowerCase().replace('_', '-');
    return voices.find((v) => norm(v) === want) || voices.find((v) => norm(v).startsWith(base)) || null;
  }

  VT.speech = {
    supported: !!synth,
    speak(text, lang) {
      if (!synth || !text) return;
      synth.cancel();
      let spoken = String(text);
      if (lang.startsWith('en')) {
        spoken = spoken.replace(/\bsb\b\.?/g, 'somebody').replace(/\bsth\b\.?/g, 'something');
      }
      const u = new SpeechSynthesisUtterance(spoken);
      u.lang = lang;
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      u.rate = 0.95;
      synth.speak(u);
    },
    stop() {
      if (synth) synth.cancel();
    },
  };
})();
