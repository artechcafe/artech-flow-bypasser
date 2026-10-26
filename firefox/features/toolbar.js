// Artech Flow — a row of small buttons inside Flow's prompt box, between the
// "Agent" chip and the model settings. Tools add/remove their own button:
//   ArtechFlow.toolbar.add({ id, order, icon, title, onClick(button) })
//   ArtechFlow.toolbar.remove(id)
(() => {
  "use strict";

  const items = new Map();
  let bar = null;
  let unwatch = null;

  function render() {
    bar.replaceChildren(
      ...[...items.values()]
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const btn = ArtechFlow.h("button.artech-bar-btn", {
            type: "button",
            title: item.title,
            "aria-label": item.title,
          });
          btn.append(item.icon());
          btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep the prompt's caret
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            item.onClick(btn);
          });
          return btn;
        })
    );
  }

  function mount() {
    const host = document.querySelector(".base-prompt-box .bottom-controls");
    if (!host || bar.parentElement === host) return;
    host.insertBefore(bar, host.querySelector(".submit-controls"));
  }

  function sync() {
    if (items.size && !bar) {
      bar = ArtechFlow.h("div.artech-bar");
      unwatch = ArtechFlow.watch(mount);
    }
    if (!items.size && bar) {
      unwatch();
      bar.remove();
      bar = null;
      ArtechFlow.closePopover();
      return;
    }
    if (bar) render();
  }

  ArtechFlow.toolbar = {
    add(item) {
      items.set(item.id, item);
      sync();
    },
    remove(id) {
      items.delete(id);
      sync();
    },
  };

  // Shared icons (24px viewBox, stroke = currentColor). Built with DOM calls,
  // not innerHTML: Flow enforces Trusted Types.
  const NS = "http://www.w3.org/2000/svg";
  const svg = (shapes) => () => {
    const root = document.createElementNS(NS, "svg");
    const attrs = { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 1.9, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
    for (const [tag, props] of shapes) {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(props)) el.setAttribute(k, v);
      root.append(el);
    }
    return root;
  };

  ArtechFlow.icons = {
    translate: svg([["path", { d: "M4 5h8M8 3v2M6 5c0 4 3 7 6 8M10 5c-1 4-3 7-6 8" }], ["path", { d: "M13 21l4-9 4 9M14.5 18h5" }]]),
    negative: svg([["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M5.6 5.6l12.8 12.8" }]]),
  };
})();
