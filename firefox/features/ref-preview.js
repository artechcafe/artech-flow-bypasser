// Artech Flow — hovering a tagged reference shows its image.
// A chip only carries the asset id (data-mention-id); Flow's own image URLs
// contain that id (ingredient bar, grid thumbnails), so the preview reuses one
// of those already-signed URLs instead of fetching anything.
(() => {
  "use strict";

  const CHIP = "span.mention-chip";
  let card = null;
  let current = null;

  function findImage(id) {
    for (const img of document.querySelectorAll("img")) {
      if (img.src.includes("/" + id) && img.naturalWidth) return img.src;
    }
    return null;
  }

  function show(chip) {
    const id = chip.dataset.mentionId;
    const src = id && findImage(id);
    if (!src) return hide();
    if (!card) {
      card = ArtechFlow.h("div.artech-preview", {}, [ArtechFlow.h("img", { alt: "" })]);
      document.body.append(card);
    }
    card.firstChild.src = src;
    const r = chip.getBoundingClientRect();
    card.style.left = Math.max(8, Math.min(r.left + r.width / 2 - 90, innerWidth - 188)) + "px";
    card.style.bottom = innerHeight - r.top + 34 + "px";
    card.classList.add("is-visible");
  }

  function hide() {
    card?.classList.remove("is-visible");
  }

  function onOver(e) {
    const chip = e.target instanceof Element ? e.target.closest(CHIP) : null;
    if (chip === current) return;
    current = chip;
    chip ? show(chip) : hide();
  }

  ArtechFlow.define("refPreview", {
    start() {
      document.addEventListener("mouseover", onOver, true);
      document.addEventListener("mousedown", hide, true);
    },
    stop() {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mousedown", hide, true);
      card?.remove();
      card = null;
      current = null;
    },
  });
})();
