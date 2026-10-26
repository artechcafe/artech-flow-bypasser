// Artech Flow — click a tagged reference in the prompt box to swap it.
//
// Flow's prompt box is a ProseMirror editor. A tagged reference is a
// non-editable span.mention-chip whose data-mention-id is the asset id, and
// typing "@" opens Flow's own asset picker at the caret. A swap is therefore:
//   1. put the caret right after the clicked chip and type "@" (picker opens)
//   2. wait for the user to add a reference — it lands right after the old one
//   3. delete the old chip, and drop its image from the ingredient bar above
//      the prompt if nothing in the prompt mentions it any more.
// Edits go through execCommand so ProseMirror treats them as normal typing.
(() => {
  "use strict";

  const EDITOR = ".ProseMirror[contenteditable='true']";
  const CHIP = "span.mention-chip";
  const PICKER = ".cdk-overlay-pane .asset-list-viewport";
  const INGREDIENT = "flow-ingredient-chip";
  const PICKER_WAIT_MS = 1500;
  const POLL_MS = 250;

  let swap = null;
  let ring = null;

  // ---- editing helpers ----

  function select(range) {
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function caretAfter(node, editor) {
    editor.focus();
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    select(range);
  }

  function deleteRange(editor, range) {
    editor.focus();
    select(range);
    document.execCommand("delete");
  }

  // Text node directly following a chip, if any.
  function textAfter(chip) {
    const next = chip.nextSibling;
    return next && next.nodeType === Node.TEXT_NODE ? next : null;
  }

  function removeLeadingMatch(editor, chip, pattern) {
    const text = textAfter(chip);
    const match = text && pattern.exec(text.data);
    if (!match) return;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, match[0].length);
    deleteRange(editor, range);
  }

  function chipsIn(editor) {
    return [...editor.querySelectorAll(CHIP)];
  }

  // ---- highlight ring ----

  function showRing(chip, label, pending) {
    if (!ring) {
      ring = document.createElement("div");
      ring.className = "artech-chip-ring";
      document.body.append(ring);
    }
    const r = chip.getBoundingClientRect();
    Object.assign(ring.style, {
      left: r.left - 3 + "px",
      top: r.top - 3 + "px",
      width: r.width + 6 + "px",
      height: r.height + 6 + "px",
    });
    ring.dataset.label = label;
    ring.classList.toggle("is-pending", pending);
    ring.classList.add("is-visible");
  }

  function hideRing() {
    ring?.classList.remove("is-visible", "is-pending");
  }

  // ---- swap lifecycle ----

  function begin(chip) {
    if (swap) finish();
    const editor = chip.closest(EDITOR);
    const chips = chipsIn(editor);
    swap = {
      editor,
      id: chip.dataset.mentionId,
      index: chips.indexOf(chip),
      count: chips.length,
      startedAt: Date.now(),
      pickerSeen: false,
      closedTicks: 0,
      timer: 0,
    };

    // "@" glued to a following word would be read as a search query, so keep a space after it.
    const next = textAfter(chip);
    if (!next || !/^\s/.test(next.data)) {
      caretAfter(chip, editor);
      document.execCommand("insertText", false, " ");
    }
    caretAfter(chip, editor);
    if (!document.execCommand("insertText", false, "@")) {
      swap = null;
      ArtechFlow.toast("باز کردن انتخابگر رفرنس ممکن نشد.");
      return;
    }

    showRing(chip, "یک رفرنس جدید انتخاب کنید", true);
    swap.timer = setInterval(tick, POLL_MS);
  }

  function tick() {
    const s = swap;
    if (!s.editor.isConnected) return finish();

    const chips = chipsIn(s.editor);
    if (chips.length > s.count) return complete(chips);

    if (document.querySelector(PICKER)) {
      s.pickerSeen = true;
      s.closedTicks = 0;
    } else if (s.pickerSeen || Date.now() - s.startedAt > PICKER_WAIT_MS) {
      // Picker closed (or never opened) without a new reference: cancelled.
      if (++s.closedTicks >= 2) return finish();
    }

    const old = chips[s.index];
    if (old) showRing(old, "یک رفرنس جدید انتخاب کنید", true);
  }

  function complete(chips) {
    const s = swap;
    const old = chips[s.index]?.dataset.mentionId === s.id ? chips[s.index] : null;
    const added = old ? chips[s.index + 1] : null;

    if (old) {
      const range = document.createRange();
      range.selectNode(old);
      deleteRange(s.editor, range);
      // Old and new chip each brought a trailing space; keep one.
      if (added?.isConnected) removeLeadingMatch(s.editor, added, /^[  ](?=[  ])/);
      if (added?.isConnected) caretAfter(added, s.editor);
      dropUnusedIngredient(s.editor, s.id);
    } else {
      ArtechFlow.toast("رفرنس جدید اضافه شد؛ رفرنس قبلی را دستی پاک کنید.");
    }
    finish(true);
  }

  // Ends the swap. On cancel, removes the "@" (and any typed search) we left behind.
  function finish(done = false) {
    const s = swap;
    if (!s) return;
    swap = null;
    clearInterval(s.timer);
    hideRing();
    if (done || !s.editor.isConnected) return;

    const old = chipsIn(s.editor)[s.index];
    if (old?.dataset.mentionId === s.id) removeLeadingMatch(s.editor, old, /^@[^\s]*/);
  }

  function dropUnusedIngredient(editor, id) {
    if (!id || chipsIn(editor).some((c) => c.dataset.mentionId === id)) return;
    for (const ingredient of document.querySelectorAll(INGREDIENT)) {
      const src = ingredient.querySelector("img")?.src || "";
      if (!src.includes("/" + id)) continue;
      ingredient.querySelector("button.chip-container")?.click();
      return;
    }
  }

  // ---- events ----

  function chipFrom(target) {
    const chip = target instanceof Element ? target.closest(CHIP) : null;
    return chip && chip.closest(EDITOR) ? chip : null;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const chip = chipFrom(e.target);
    if (!chip) return;
    e.preventDefault();
    e.stopPropagation();
    begin(chip);
  }

  function onClick(e) {
    if (!chipFrom(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseOver(e) {
    if (swap) return;
    const chip = chipFrom(e.target);
    chip ? showRing(chip, "کلیک برای تعویض", false) : hideRing();
  }

  ArtechFlow.define("refSwap", {
    start() {
      document.addEventListener("mousedown", onMouseDown, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("mouseover", onMouseOver, true);
    },
    stop() {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseover", onMouseOver, true);
      finish();
      ring?.remove();
      ring = null;
    },
  });
})();
