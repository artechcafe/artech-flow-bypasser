import { checkForUpdate, isEnabled } from "./shared.js";
import { rewriteBody } from "./rewrite.js";

chrome.runtime.onInstalled.addListener(() => {
  checkForUpdate({ force: true });
});
chrome.runtime.onStartup.addListener(() => {
  checkForUpdate();
});

// ---- region fix ----
// Firefox can rewrite a response before the page sees it
// (webRequest.filterResponseData). Only the batchexecute calls that carry a
// region check are buffered; everything else streams through untouched.
// The listener is registered at top level so it survives the background
// page being suspended; the on/off switch is read when the response ends.

const ENDPOINT = "https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute*";
const REGION_RPCS = new Set(["cPZSdc", "KV2T2d", "cO7JOb"]);

function carriesRegionCheck(url) {
  const ids = new URL(url).searchParams.get("rpcids") || "";
  return ids.split(",").some((id) => REGION_RPCS.has(id));
}

// Per-tab count of patched answers, shown in the popup.
async function countPatched(tabId, hits) {
  if (tabId < 0) return;
  const key = "patched-" + tabId;
  const { [key]: count = 0 } = await chrome.storage.session.get(key);
  await chrome.storage.session.set({ [key]: count + hits });
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!carriesRegionCheck(details.url)) return;
    const filter = browser.webRequest.filterResponseData(details.requestId);
    const parts = [];
    filter.ondata = (event) => parts.push(new Uint8Array(event.data));
    filter.onstop = async () => {
      const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let at = 0;
      for (const p of parts) {
        bytes.set(p, at);
        at += p.length;
      }
      try {
        if (await isEnabled()) {
          const { body, hits } = rewriteBody(new TextDecoder().decode(bytes));
          if (hits) {
            filter.write(new TextEncoder().encode(body));
            filter.close();
            console.info("[Artech Flow] region check patched (" + hits + ")");
            countPatched(details.tabId, hits);
            return;
          }
        }
      } catch (err) {
        console.warn("[Artech Flow] rewrite skipped:", err);
      }
      filter.write(bytes);
      filter.close();
    };
    filter.onerror = () => {
      console.warn("[Artech Flow] response filter failed:", filter.error);
    };
  },
  { urls: [ENDPOINT] },
  ["blocking"]
);

// A fresh page load starts a fresh count.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") chrome.storage.session.remove("patched-" + tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove("patched-" + tabId));

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "artech-status" || sender.id !== chrome.runtime.id) return;
  const key = "patched-" + msg.tabId;
  chrome.storage.session.get(key).then((got) => reply({ patched: got[key] || 0 }));
  return true;
});

// "Generation finished" notifications from features/notify.js. The tab id is
// kept in the notification id so a click can bring that tab back, even after
// the background page has been suspended.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "artech-notify" || !sender.tab) return;
  chrome.notifications.create("artech-" + sender.tab.id + "-" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: String(msg.title).slice(0, 80),
    message: String(msg.message).slice(0, 200),
  });
});

// Persian→English for features/translate.js (Firefox has no on-device
// Persian translator). Only the prompt text being translated is sent.
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
