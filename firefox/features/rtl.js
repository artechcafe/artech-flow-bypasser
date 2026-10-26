// Artech Flow — right-to-left Persian prompts.
//
// Flow forces its prompt box to LTR, so a Persian prompt is left-aligned and
// mixed Persian/English runs (e.g. "نمای 35mm سینمایی.") come out scrambled.
// The fix is pure CSS (see tools.css): each paragraph takes its direction from
// its first strong character. This file only switches that CSS on and off, so
// the editor's own DOM is never touched.
(() => {
  "use strict";

  const CLASS = "artech-rtl";

  ArtechFlow.define("rtlPrompt", {
    start() {
      document.documentElement.classList.add(CLASS);
    },
    stop() {
      document.documentElement.classList.remove(CLASS);
    },
  });
})();
