// Artech Flow — retry failed generations automatically.
// A failed generation is a <flow-error-tile>; when Flow allows a retry it has
// a button with the "refresh" icon (Flow's own Retry). Cancelled generations
// ("This generation was cancelled") are left alone. Each tile is retried at
// most twice, and never more than a few times in ten minutes overall, so a
// prompt that keeps failing cannot burn through credits.
(() => {
  "use strict";

  const PER_TILE = 2;
  const BUDGET = 5;
  const WINDOW_MS = 10 * 60 * 1000;
  const DELAY_MS = 4000;

  const attempts = new WeakMap();
  const queued = new WeakSet();
  let history = [];
  let unwatch = null;

  function retryButton(tile) {
    return [...tile.querySelectorAll("button")].find((b) => b.querySelector("mat-icon")?.textContent.trim() === "refresh");
  }

  function check() {
    for (const tile of document.querySelectorAll("flow-error-tile")) {
      if (queued.has(tile)) continue;
      const title = tile.querySelector(".error-title")?.textContent || "";
      if (/cancel/i.test(title) || !retryButton(tile)) continue;

      const key = tile.closest("flow-grid-tile-container") || tile;
      const tries = attempts.get(key) || 0;
      if (tries >= PER_TILE) continue;

      history = history.filter((t) => Date.now() - t < WINDOW_MS);
      if (history.length >= BUDGET) return;

      queued.add(tile);
      setTimeout(() => {
        const button = tile.isConnected && retryButton(tile);
        if (!button) return;
        attempts.set(key, tries + 1);
        history.push(Date.now());
        button.click();
        ArtechFlow.toast("ساخت ناموفق دوباره امتحان شد (" + (tries + 1).toLocaleString("fa-IR") + " از " + PER_TILE.toLocaleString("fa-IR") + ").");
      }, DELAY_MS);
    }
  }

  ArtechFlow.define("autoRetry", {
    start() {
      unwatch = ArtechFlow.watch(check);
    },
    stop() {
      unwatch?.();
    },
  });
})();
