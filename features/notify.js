// Artech Flow — tell the user when generations finish while they are away.
// Flow shows an in-progress generation as <flow-pending-tile>; when one goes
// away it has finished (or failed, which turns it into <flow-error-tile>).
// Only counted while the tab is in the background, so scrolling the grid
// (which re-renders tiles) never fires it.
(() => {
  "use strict";

  const PENDING = "flow-pending-tile";
  const FAILED = "flow-error-tile";

  let unwatch = null;
  let pending = 0;
  let failed = 0;
  let finished = 0;
  let baseTitle = "";
  let flushTimer = 0;
  let audio = null;

  const away = () => document.hidden || !document.hasFocus();

  function check() {
    const nowPending = document.querySelectorAll(PENDING).length;
    const nowFailed = document.querySelectorAll(FAILED).length;
    if (away() && nowPending < pending) {
      finished += pending - nowPending;
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => report(Math.max(0, nowFailed - failed)), 1500);
    } else if (!away()) {
      failed = nowFailed;
    }
    pending = nowPending;
  }

  function report(newFailures) {
    if (!finished) return;
    const ok = Math.max(0, finished - newFailures);
    const parts = [];
    if (ok) parts.push(ok.toLocaleString("fa-IR") + " ساخت تمام شد");
    if (newFailures) parts.push(newFailures.toLocaleString("fa-IR") + " ساخت ناموفق بود");
    chrome.runtime.sendMessage({
      type: "artech-notify",
      title: newFailures && !ok ? "ساخت در Google Flow ناموفق بود" : "ساخت در Google Flow آماده است",
      message: parts.join(" و ") + ".",
    });
    if (!baseTitle) baseTitle = document.title;
    document.title = "(" + finished.toLocaleString("fa-IR") + "✓) " + baseTitle;
    chime();
  }

  // A short two-note chime, made in the page (no audio file).
  function chime() {
    try {
      audio ||= new AudioContext();
      const t = audio.currentTime;
      [880, 1318].forEach((freq, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.18, t + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.35);
        osc.connect(gain).connect(audio.destination);
        osc.start(t + i * 0.16);
        osc.stop(t + i * 0.16 + 0.4);
      });
    } catch {}
  }

  function onBack() {
    if (away()) return;
    finished = 0;
    failed = document.querySelectorAll(FAILED).length;
    if (baseTitle) document.title = baseTitle;
    baseTitle = "";
  }

  // The chime needs an AudioContext unlocked by a user gesture.
  function unlock() {
    try {
      audio ||= new AudioContext();
      audio.resume();
    } catch {}
  }

  ArtechFlow.define("notify", {
    start() {
      pending = document.querySelectorAll(PENDING).length;
      failed = document.querySelectorAll(FAILED).length;
      unwatch = ArtechFlow.watch(check);
      document.addEventListener("visibilitychange", onBack);
      window.addEventListener("focus", onBack);
      document.addEventListener("pointerdown", unlock, { capture: true, once: true });
    },
    stop() {
      unwatch?.();
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
      if (baseTitle) document.title = baseTitle;
      baseTitle = "";
    },
  });
})();
