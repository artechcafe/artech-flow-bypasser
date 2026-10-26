// Artech Flow — small runtime for the in-page tools (isolated content-script world).
// Each tool registers itself with define(name, { start, stop }); the popup's
// switches live in chrome.storage and are applied live, without a reload.
(() => {
  "use strict";

  // Keep in sync with TOOL_DEFAULTS in shared.js.
  const DEFAULTS = {
    refSwap: true,
    refPreview: true,
    rtlPrompt: true,
    translate: true,
    negative: true,
    notify: true,
    autoRetry: false,
  };

  const tools = new Map();
  const running = new Set();
  let saved = null; // null until storage has been read

  function apply(next) {
    saved = next;
    const wanted = { ...DEFAULTS, ...saved };
    for (const [name, tool] of tools) {
      const on = !!wanted[name];
      if (on === running.has(name)) continue;
      try {
        on ? tool.start() : tool.stop();
        on ? running.add(name) : running.delete(name);
      } catch (err) {
        console.warn("[Artech Flow] tool '" + name + "' failed:", err);
      }
    }
  }

  // ---- toast ----

  let toastEl = null;
  let toastTimer = 0;

  function toast(text, ms = 2600) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "artech-toast";
      toastEl.setAttribute("role", "status");
      document.body.append(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), ms);
  }

  // ---- DOM watching: one shared, frame-throttled MutationObserver ----

  const watchers = new Set();
  let observer = null;
  let scheduled = false;

  function runWatchers() {
    scheduled = false;
    for (const fn of watchers) {
      try {
        fn();
      } catch (err) {
        console.warn("[Artech Flow] watcher failed:", err);
      }
    }
  }

  function watch(fn) {
    watchers.add(fn);
    if (!observer) {
      observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(runWatchers);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    fn();
    return () => {
      watchers.delete(fn);
      if (!watchers.size) {
        observer.disconnect();
        observer = null;
      }
    };
  }

  // ---- prompt editor (Flow's prompt box is a ProseMirror editor) ----
  // Edits go through execCommand so ProseMirror treats them as normal typing.

  function editor() {
    return (
      document.querySelector(".base-prompt-box .ProseMirror[contenteditable='true']") ||
      document.querySelector(".ProseMirror[contenteditable='true']")
    );
  }

  function select(range) {
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Caret right after the last word or reference chip of the prompt, before
  // any trailing whitespace. Nothing is deleted: removing the space after a
  // chip can take the (non-editable) chip with it.
  function caretAtContentEnd(ed) {
    ed.focus();
    const block = ed.lastElementChild || ed;
    let node = block.lastChild;
    while (node && (node.nodeName === "BR" || (node.nodeType === Node.TEXT_NODE && !node.data.trim() && node.previousSibling))) {
      node = node.previousSibling;
    }
    const range = document.createRange();
    if (!node) range.setStart(block, 0);
    else if (node.nodeType === Node.TEXT_NODE) range.setStart(node, node.data.trimEnd().length);
    else range.setStartAfter(node);
    range.collapse(true);
    select(range);
  }

  function promptText(ed = editor()) {
    return ed ? ed.textContent.replace(/ /g, " ") : "";
  }

  // Adds text as its own line (a new paragraph) at the end of the prompt.
  function appendLine(text) {
    const ed = editor();
    if (!ed) {
      toast("باکس پرامپت پیدا نشد.");
      return false;
    }
    caretAtContentEnd(ed);
    if (promptText(ed).trim()) document.execCommand("insertParagraph");
    document.execCommand("insertText", false, text);
    return true;
  }

  // ---- popover panel anchored above a button ----

  let pop = null;

  function closePopover() {
    if (!pop) return;
    pop.el.remove();
    document.removeEventListener("mousedown", pop.outside, true);
    document.removeEventListener("keydown", pop.escape, true);
    pop.anchor.classList.remove("is-open");
    pop = null;
  }

  function openPopover(anchor, build) {
    const same = pop?.anchor === anchor;
    closePopover();
    if (same) return null;

    const el = document.createElement("div");
    el.className = "artech-pop";
    el.dir = "rtl";
    // Keep the prompt box focused while clicking chips in the panel.
    el.addEventListener("mousedown", (e) => {
      if (!e.target.closest("input, textarea, select")) e.preventDefault();
    });
    el.style.visibility = "hidden";
    document.body.append(el);

    // build may be async (reads storage); place the panel once it has content,
    // above the whole prompt box so it never covers what is being written.
    Promise.resolve(build(el)).then(() => {
      const r = anchor.getBoundingClientRect();
      const top = (anchor.closest(".base-prompt-box") || anchor).getBoundingClientRect().top;
      const width = el.offsetWidth;
      el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, innerWidth - width - 8)) + "px";
      el.style.bottom = innerHeight - top + 10 + "px";
      el.style.visibility = "";
    });

    const outside = (e) => {
      if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover();
    };
    const escape = (e) => {
      if (e.key === "Escape") closePopover();
    };
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", escape, true);
    anchor.classList.add("is-open");
    pop = { el, anchor, outside, escape };
    return el;
  }

  // Small element builder: h("button.cls", { text, title, onclick }, children)
  function h(spec, props = {}, children = []) {
    const [tag, ...classes] = spec.split(".");
    const el = document.createElement(tag);
    if (classes.length) el.className = classes.join(" ");
    for (const [k, v] of Object.entries(props)) {
      if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v);
    }
    el.append(...children);
    return el;
  }

  self.ArtechFlow = {
    define(name, tool) {
      tools.set(name, tool);
      if (saved) apply(saved); // defined after startup: start it right away
    },
    toast,
    watch,
    editor,
    promptText,
    appendLine,
    openPopover,
    closePopover,
    h,
  };

  setTimeout(async () => {
    const { tools: stored = {} } = await chrome.storage.local.get("tools");
    apply(stored);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.tools) apply(changes.tools.newValue || {});
    });
  }, 0);
})();
