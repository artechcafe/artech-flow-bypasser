// Shared between the service worker and the popup: the on/off switch is just
// "is the page-world patch registered as a content script or not".

export const FLOW_ORIGIN = "https://flow.google.com";
export const FLOW_URL = FLOW_ORIGIN + "/";
export const BLOCKED_PATH = "/unsupported-country";

const PATCH_SCRIPT = {
  id: "artech-flow-patch",
  matches: [FLOW_ORIGIN + "/*"],
  js: ["inject/patch.js"],
  runAt: "document_start",
  world: "MAIN",
  allFrames: false,
  persistAcrossSessions: true,
};

export async function isEnabled() {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  return enabled;
}

export async function isRegistered() {
  const found = await chrome.scripting.getRegisteredContentScripts({ ids: [PATCH_SCRIPT.id] });
  return found.length > 0;
}

// Calls are chained so overlapping toggles can never register the script twice.
let queue = Promise.resolve();

export function applyRegistration(on) {
  queue = queue.catch(() => {}).then(async () => {
    const registered = await isRegistered();
    if (on && !registered) await chrome.scripting.registerContentScripts([PATCH_SCRIPT]);
    if (!on && registered) await chrome.scripting.unregisterContentScripts({ ids: [PATCH_SCRIPT.id] });
  });
  return queue;
}

export async function setEnabled(on) {
  await chrome.storage.local.set({ enabled: on });
  await applyRegistration(on);
}

// In-page tools (features/*.js). Keep in sync with DEFAULTS in features/core.js.
export const TOOL_DEFAULTS = {
  refSwap: true,
  refPreview: true,
  rtlPrompt: true,
  translate: true,
  negative: true,
  notify: true,
  autoRetry: false,
};

export async function getTools() {
  const { tools = {} } = await chrome.storage.local.get("tools");
  return { ...TOOL_DEFAULTS, ...tools };
}

export async function setTool(name, on) {
  const tools = await getTools();
  await chrome.storage.local.set({ tools: { ...tools, [name]: on } });
}

// Update check: the published manifest on GitHub says which version is the
// latest. raw.githubusercontent.com allows cross-origin reads, so no extra
// permission is needed. Results are cached for a few hours.
export const REPO_URL = "https://github.com/artechcafe/artech-flow-bypasser";
export const DOWNLOAD_URL = REPO_URL + "/archive/refs/heads/main.zip";
const LATEST_MANIFEST = "https://raw.githubusercontent.com/artechcafe/artech-flow-bypasser/main/manifest.json";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function newer(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

// Returns the newer version number, or null when this copy is up to date.
export async function checkForUpdate({ force = false } = {}) {
  const current = chrome.runtime.getManifest().version;
  const { update } = await chrome.storage.local.get("update");
  let latest = update?.latest;
  if (force || !update || Date.now() - update.checkedAt > CHECK_EVERY_MS) {
    try {
      const res = await fetch(LATEST_MANIFEST, { cache: "no-store", credentials: "omit" });
      if (res.ok) {
        latest = (await res.json()).version;
        await chrome.storage.local.set({ update: { latest, checkedAt: Date.now() } });
      }
    } catch {
      // Offline or GitHub unreachable: keep the last known answer.
    }
  }
  const available = latest && newer(latest, current) ? latest : null;
  await chrome.action.setBadgeText({ text: available ? "NEW" : "" });
  if (available) await chrome.action.setBadgeBackgroundColor({ color: "#c95e62" });
  return available;
}
