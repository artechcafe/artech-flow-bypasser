import { applyRegistration, checkForUpdate, isEnabled } from "./shared.js";

// Keep the registered patch in step with the saved switch (default: on).
async function sync() {
  try {
    await applyRegistration(await isEnabled());
  } catch (err) {
    console.error("[Artech Flow] could not sync patch:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  sync();
  checkForUpdate({ force: true });
  // Data of tools removed in 1.4.0.
  chrome.storage.local.remove(["templates", "customStyles", "gridZoom"]);
});
chrome.runtime.onStartup.addListener(() => {
  sync();
  checkForUpdate();
});

// "Generation finished" notifications from features/notify.js. The tab id is
// kept in the notification id so a click can bring that tab back, even after
// the service worker has been restarted.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "artech-notify" || !sender.tab) return;
  chrome.notifications.create("artech-" + sender.tab.id + "-" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: String(msg.title).slice(0, 80),
    message: String(msg.message).slice(0, 200),
    priority: 1,
  });
});

// Persian→English for features/translate.js when Chrome's on-device
// translator has no Persian. Only the prompt text being translated is sent.
const TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single";

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "artech-translate" || sender.id !== chrome.runtime.id) return;
  const url = new URL(TRANSLATE_URL);
  url.search = new URLSearchParams({ client: "gtx", sl: "fa", tl: "en", dt: "t", q: String(msg.text).slice(0, 5000) });
  fetch(url, { credentials: "omit" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => reply({ ok: true, text: data[0].map((part) => part[0]).join("") }))
    .catch((err) => reply({ ok: false, error: err.message }));
  return true;
});

chrome.notifications.onClicked.addListener(async (id) => {
  const tabId = Number(id.split("-")[1]);
  chrome.notifications.clear(id);
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    // Tab was closed in the meantime.
  }
});
