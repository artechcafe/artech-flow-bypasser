// Artech Flow — translate the Persian parts of the prompt to English.
// The browser's on-device Translator API is used when it supports Persian
// (Firefox has none); otherwise the background script asks Google Translate.
// Tagged references stay untouched: only the text between them is translated,
// each run replaced in place through the editor so Ctrl+Z still works.
(() => {
  "use strict";

  const PERSIAN = /[؀-ۿ]/;
  const OPTIONS = { sourceLanguage: "fa", targetLanguage: "en" };
  let translator = null;
  let busy = false;

  async function onDevice() {
    if (translator) return translator;
    if (!("Translator" in self)) return null;
    const state = await Translator.availability(OPTIONS).catch(() => "unavailable");
    if (state === "unavailable") return null;
    if (state !== "available") ArtechFlow.toast("در حال دانلود بستهٔ ترجمه (فقط بار اول)…", 8000);
    translator = await Translator.create(OPTIONS);
    return translator;
  }

  async function viaGoogle(text) {
    const res = await chrome.runtime.sendMessage({ type: "artech-translate", text });
    if (!res?.ok) throw new Error("ترجمه انجام نشد: " + (res?.error || "پاسخی نیامد"));
    return res.text;
  }

  async function getTranslator() {
    const local = await onDevice();
    return local ? { translate: (text) => local.translate(text) } : { translate: viaGoogle };
  }

  // Persian text runs outside reference chips, in document order.
  function persianRuns(ed) {
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        !n.parentElement.closest("[contenteditable='false']") && PERSIAN.test(n.data)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    const runs = [];
    while (walker.nextNode()) runs.push(walker.currentNode.data);
    return runs;
  }

  function replaceRun(ed, original, replacement) {
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.data !== original || node.parentElement.closest("[contenteditable='false']")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      ed.focus();
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("insertText", false, replacement);
      return true;
    }
    return false;
  }

  async function translatePrompt() {
    if (busy) return;
    const ed = ArtechFlow.editor();
    if (!ed) return ArtechFlow.toast("باکس پرامپت پیدا نشد.");
    const runs = persianRuns(ed);
    if (!runs.length) return ArtechFlow.toast("متن فارسی‌ای در پرامپت نیست.");

    busy = true;
    try {
      const t = await getTranslator();
      ArtechFlow.toast("در حال ترجمه…", 10000);
      const done = [];
      for (const run of runs) {
        const lead = run.match(/^\s*/)[0];
        const tail = run.match(/\s*$/)[0];
        const english = (await t.translate(run.trim())).trim();
        done.push([run, lead + english + tail]);
      }
      let replaced = 0;
      for (const [from, to] of done) if (replaceRun(ed, from, to)) replaced++;
      ArtechFlow.toast(replaced ? "ترجمه شد. با Ctrl+Z برمی‌گردد." : "متن پرامپت حین ترجمه تغییر کرد؛ دوباره امتحان کنید.");
    } catch (err) {
      ArtechFlow.toast(err.message || "ترجمه انجام نشد.", 5000);
    } finally {
      busy = false;
    }
  }

  ArtechFlow.define("translate", {
    start() {
      ArtechFlow.toolbar.add({
        id: "translate",
        order: 40,
        icon: ArtechFlow.icons.translate,
        title: "ترجمهٔ فارسی به انگلیسی",
        onClick: translatePrompt,
      });
    },
    stop() {
      ArtechFlow.toolbar.remove("translate");
    },
  });
})();
