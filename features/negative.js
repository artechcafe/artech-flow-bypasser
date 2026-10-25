// Artech Flow — negative prompt.
// Flow has no "avoid" field, so the saved list is written into the prompt as
// its own last line, "Avoid: …", when the user clicks the button — never twice.
(() => {
  "use strict";

  const { h } = ArtechFlow;
  let text = "";

  async function load() {
    const { negative } = await chrome.storage.local.get("negative");
    text = negative?.text || "";
  }

  const line = () => "Avoid: " + text.trim().replace(/[.\s]+$/, "") + ".";

  function build(el) {
    const input = h("textarea.artech-input.artech-textarea", {
      placeholder: "blurry, text, watermark, extra fingers",
      dir: "ltr",
      value: text,
    });
    const save = async () => {
      text = input.value;
      await chrome.storage.local.set({ negative: { text } });
    };
    input.addEventListener("change", save);

    el.append(
      h("div.artech-pop-title", { text: "پرامپت منفی" }),
      h("p.artech-muted", { text: "چیزهایی که نمی‌خواهید در خروجی باشد (به انگلیسی، با کاما جدا کنید). در خط جداگانه‌ای به انتهای پرامپت اضافه می‌شود." }),
      input,
      h("div.artech-row", {}, [
        h("button.artech-btn", {
          type: "button",
          text: "افزودن به پرامپت",
          onclick: async () => {
            await save();
            if (!text.trim()) return ArtechFlow.toast("اول متن را بنویسید.");
            if (ArtechFlow.promptText().includes(line())) return ArtechFlow.toast("قبلاً در پرامپت هست.");
            if (ArtechFlow.appendLine(line())) {
              ArtechFlow.closePopover();
              ArtechFlow.toast("پرامپت منفی اضافه شد.", 1600);
            }
          },
        }),
      ])
    );
  }

  ArtechFlow.define("negative", {
    start() {
      ArtechFlow.toolbar.add({
        id: "negative",
        order: 50,
        icon: ArtechFlow.icons.negative,
        title: "پرامپت منفی",
        onClick: (btn) => ArtechFlow.openPopover(btn, async (el) => {
          await load();
          build(el);
        }),
      });
    },
    stop() {
      ArtechFlow.toolbar.remove("negative");
    },
  });
})();
