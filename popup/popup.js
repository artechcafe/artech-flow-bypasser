import { BLOCKED_PATH, DOWNLOAD_URL, FLOW_URL, checkForUpdate, getTools, isEnabled, setEnabled, setTool } from "../shared.js";

const $ = (id) => document.getElementById(id);
const ui = {
  card: $("card"),
  power: $("power"),
  status: $("status"),
  statusText: $("status-text"),
  count: $("count"),
  open: $("open"),
  reload: $("reload"),
  error: $("error"),
  version: $("version"),
};

const MESSAGES = {
  off: ["idle", "خاموش است. ممکن است Flow صفحهٔ «کشور پشتیبانی نمی‌شود» را نشان دهد."],
  on: ["ok", "روشن است. یک تب Google Flow باز کنید یا آن را دوباره بارگذاری کنید."],
  saved: ["ok", "ذخیره شد. تب‌های باز Flow را دوباره بارگذاری کنید."],
  active: ["ok", "روی این تب فعال است و محدودیت منطقه برداشته شد."],
  waiting: ["wait", "آماده است و منتظر پاسخ تنظیمات Flow…"],
  reload: ["warn", "برای اعمال تغییر، این تب Flow را دوباره بارگذاری کنید."],
  blocked: ["warn", "روی صفحهٔ محدودیت هستید. «بارگذاری دوبارهٔ تب» را بزنید."],
};

let tab = null;

function show(key) {
  const [tone, text] = MESSAGES[key];
  ui.status.dataset.tone = tone;
  ui.statusText.textContent = text;
}

function paintSwitch(on) {
  ui.power.setAttribute("aria-checked", String(on));
  ui.card.classList.toggle("is-on", on);
}

const isFlowTab = (t) => typeof t?.url === "string" && t.url.startsWith(FLOW_URL);
const onBlockedPage = (t) => new URL(t.url).pathname.endsWith(BLOCKED_PATH);

// Reads the counter the page-world patch keeps; null means it is not loaded there.
async function probe(tabId) {
  try {
    const [hit] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const s = window.__artechFlow;
        return s ? { patched: s.patched } : null;
      },
    });
    return hit?.result ?? null;
  } catch {
    return null;
  }
}

async function refresh() {
  const enabled = await isEnabled();
  paintSwitch(enabled);

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const flow = isFlowTab(tab);
  ui.reload.hidden = !flow;
  ui.count.hidden = true;

  if (!enabled) return show("off");
  if (!flow) return show("on");
  if (onBlockedPage(tab)) return show("blocked");

  const patch = await probe(tab.id);
  if (!patch) return show("reload");
  if (!patch.patched) return show("waiting");

  show("active");
  ui.count.hidden = false;
  ui.count.textContent = patch.patched.toLocaleString("fa-IR") + " پاسخ اصلاح شد";
}

ui.power.addEventListener("click", async () => {
  const next = ui.power.getAttribute("aria-checked") !== "true";
  ui.power.disabled = true;
  ui.error.textContent = "";
  try {
    await setEnabled(next);
    paintSwitch(next);
    ui.count.hidden = true;
    show(next ? "saved" : "off");
    ui.reload.classList.toggle("is-hint", isFlowTab(tab));
  } catch (err) {
    ui.error.textContent = "ذخیرهٔ تنظیم انجام نشد: " + err.message;
  } finally {
    ui.power.disabled = false;
  }
});

ui.open.addEventListener("click", () => {
  chrome.tabs.create({ url: FLOW_URL });
  window.close();
});

ui.reload.addEventListener("click", async () => {
  try {
    const current = await chrome.tabs.get(tab.id);
    if (!isFlowTab(current)) throw new Error("ابتدا به تب Google Flow بروید.");
    if (onBlockedPage(current)) {
      // Reloading the block page would just show it again — go back to the app.
      const url = new URL(current.url);
      url.pathname = url.pathname.slice(0, -BLOCKED_PATH.length) || "/";
      url.search = "";
      await chrome.tabs.update(current.id, { url: url.href });
    } else {
      await chrome.tabs.reload(current.id);
    }
    window.close();
  } catch (err) {
    ui.error.textContent = err.message;
  }
});

// Extra tools (features/*.js), in the order shown. They apply live on open
// Flow tabs because features/core.js listens to storage.
const TOOLS = [
  ["refSwap", "تعویض رفرنس با کلیک", "روی رفرنس تگ‌شده در پرامپت کلیک کنید تا یکی دیگر جایش بنشیند."],
  ["refPreview", "پیش‌نمایش رفرنس", "با بردن موس روی رفرنس تگ‌شده، تصویرش نمایش داده می‌شود."],
  ["rtlPrompt", "پرامپت فارسی راست‌چین", "متن فارسی در پرامپت و تاریخچه، راست‌چین و با ترتیب درست."],
  ["translate", "ترجمهٔ فارسی به انگلیسی", "متن فارسی پرامپت با Google Translate ترجمه می‌شود؛ رفرنس‌های تگ‌شده دست نمی‌خورند."],
  ["negative", "پرامپت منفی", "چیزهایی که نمی‌خواهید، با یک کلیک در خط آخر پرامپت اضافه می‌شود."],
  ["notify", "اعلان پایان ساخت", "وقتی در تب دیگری هستید، با اعلان و صدا خبر می‌دهد."],
  ["autoRetry", "تلاش دوبارهٔ خودکار", "ساخت ناموفق را تا ۲ بار دوباره امتحان می‌کند."],
];

function renderCount(tools) {
  const on = TOOLS.filter(([id]) => tools[id]).length;
  $("tools-count").textContent = on.toLocaleString("fa-IR") + " از " + TOOLS.length.toLocaleString("fa-IR") + " فعال";
}

async function initTools() {
  const tools = await getTools();
  const list = $("tool-list");
  const head = $("tools-toggle");

  head.addEventListener("click", () => {
    const open = head.getAttribute("aria-expanded") !== "true";
    head.setAttribute("aria-expanded", String(open));
    list.hidden = !open;
  });

  for (const [id, title, desc] of TOOLS) {
    const sw = document.createElement("button");
    sw.className = "switch switch-sm";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", title);
    sw.setAttribute("aria-checked", String(!!tools[id]));
    sw.innerHTML = '<span class="knob"></span>';
    sw.addEventListener("click", async () => {
      const next = sw.getAttribute("aria-checked") !== "true";
      sw.disabled = true;
      try {
        await setTool(id, next);
        sw.setAttribute("aria-checked", String(next));
        tools[id] = next;
        renderCount(tools);
      } catch (err) {
        ui.error.textContent = "ذخیرهٔ تنظیم انجام نشد: " + err.message;
      } finally {
        sw.disabled = false;
      }
    });

    const text = document.createElement("div");
    text.className = "tool-text";
    text.append(Object.assign(document.createElement("strong"), { textContent: title }));
    text.append(Object.assign(document.createElement("span"), { textContent: desc }));

    const row = document.createElement("div");
    row.className = "tool";
    row.append(text, sw);
    list.append(row);
  }
  renderCount(tools);
}

initTools().catch((err) => {
  ui.error.textContent = err.message;
});

// Help panel: covers the popup, Esc or the × closes it.
const help = $("help");
const helpOpen = $("help-open");

function toggleHelp(open) {
  help.hidden = !open;
  helpOpen.setAttribute("aria-expanded", String(open));
  if (open) help.querySelector(".help-body").scrollTop = 0;
}

helpOpen.addEventListener("click", () => toggleHelp(help.hidden));
$("help-close").addEventListener("click", () => toggleHelp(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !help.hidden) {
    e.preventDefault();
    toggleHelp(false);
  }
});

// Update banner, from the version published on GitHub (cached for hours).
// Open popup.html?demo-update in a tab to see it without a real update.
const updateToggle = $("update-toggle");

function foldSteps(folded) {
  $("update").classList.toggle("is-folded", folded);
  updateToggle.setAttribute("aria-expanded", String(!folded));
  const label = folded ? "باز کردن راهنمای آپدیت" : "بستن راهنمای آپدیت";
  updateToggle.title = label;
  updateToggle.setAttribute("aria-label", label);
}

updateToggle.addEventListener("click", () => {
  const folded = !$("update").classList.contains("is-folded");
  foldSteps(folded);
  chrome.storage.local.set({ updateStepsFolded: folded });
});

async function showUpdate() {
  const demo = new URLSearchParams(location.search).has("demo-update");
  const latest = demo ? "9.9.9" : await checkForUpdate();
  if (!latest) return;
  const { updateStepsFolded = false } = await chrome.storage.local.get("updateStepsFolded");
  foldSteps(updateStepsFolded);
  $("update-version").textContent = "v" + latest;
  $("update-download").href = DOWNLOAD_URL;
  $("update").hidden = false;
}

showUpdate().catch(() => {});

ui.version.textContent = "v" + chrome.runtime.getManifest().version;

refresh()
  .catch((err) => {
    ui.error.textContent = err.message;
  })
  .finally(() => {
    ui.power.disabled = false;
  });
