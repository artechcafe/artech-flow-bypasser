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
