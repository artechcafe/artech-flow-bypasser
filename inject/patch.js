// Artech Flow Bypasser — runs in Flow's own page world at document_start.
//
// Flow asks its backend (Google's batchexecute RPC endpoint) whether the
// visitor's region is allowed. The answers come back as "wrb.fr" envelopes
// whose third field is a JSON-encoded payload. We rewrite the region-related
// payloads to their "allowed" form before Flow's scripts read them.
// Nothing leaves the browser: no network calls, no storage, no telemetry.
(() => {
  "use strict";

  const STATE_KEY = "__artechFlow";
  if (window[STATE_KEY]) return;

  const ENDPOINT = "/_/AiSandboxAngularFrontend/data/batchexecute";
  const ENVELOPE = "wrb.fr";
  const BLOCKED_CODES = new Set([4, 5, 6, 7, 8]);
  const ALLOWED_CODE = 1;

  const state = {
    version: "1.5.1",
    patched: 0,
    inspected: 0,
    lastPatchAt: 0,
    errors: 0,
  };
  Object.defineProperty(window, STATE_KEY, { value: state });

  // ---- payload patchers: return true only when the payload was changed ----

  function grow(list, index) {
    while (list.length <= index) list.push(null);
  }

  function forceFlag(index) {
    return (payload) => {
      if (payload[index] === true) return false;
      grow(payload, index);
      payload[index] = true;
      return true;
    };
  }

  function forceAllowedStatus(index) {
    return (payload) => {
      const code = payload[index];
      if (code != null && !BLOCKED_CODES.has(code)) return false;
      grow(payload, index);
      payload[index] = ALLOWED_CODE;
      return true;
    };
  }

  // RPC id -> how to turn its answer into "allowed". Indexes are array
  // positions: proto field N sits at index N - 1.
  const PATCHERS = {
    // GetFlowAppConfig: field 31 is "region supported" (else /unsupported-country).
    cPZSdc: forceFlag(30),
    // CheckToolAvailability / CheckAppAvailability: field 1 is the status;
    // 4, 5, 6 and 8 send Flow to /unavailable, 7 to /age-restricted.
    KV2T2d: forceAllowedStatus(0),
    cO7JOb: forceAllowedStatus(0),
  };

  // ---- batchexecute body rewriting ----

  const encoder = new TextEncoder();
  const charLength = (s) => s.length;
  const byteLength = (s) => encoder.encode(s).length;

  // Chunked responses put the chunk's length on the line before it. Flow has
  // served this in both UTF-16 units and UTF-8 bytes, so adjust it in
  // whichever unit the original number actually matches.
  function adjustLengthLine(lines, at, before, after) {
    if (at < 0) return;
    const match = /^(\s*)(\d+)(\s*)$/.exec(lines[at]);
    if (!match) return;
    const declared = Number(match[2]);
    const near = (n) => Math.abs(declared - n) <= 2;
    const measure = !near(byteLength(before)) && near(charLength(before)) ? charLength : byteLength;
    lines[at] = match[1] + (declared + measure(after) - measure(before)) + match[3];
  }

  function patchChunk(line) {
    let chunk;
    try {
      chunk = JSON.parse(line);
    } catch {
      return null;
    }
    if (!Array.isArray(chunk)) return null;

    let hits = 0;
    for (const envelope of chunk) {
      if (!Array.isArray(envelope) || envelope[0] !== ENVELOPE) continue;
      const patch = PATCHERS[envelope[1]];
      if (!patch || typeof envelope[2] !== "string") continue;

      let payload;
      try {
        payload = JSON.parse(envelope[2]);
      } catch {
        continue;
      }
      if (!Array.isArray(payload)) continue;

      state.inspected++;
      if (patch(payload)) {
        envelope[2] = JSON.stringify(payload);
        hits++;
      }
    }
    return hits ? { text: JSON.stringify(chunk), hits } : null;
  }

  function rewriteBody(body) {
    if (typeof body !== "string" || !body.includes(ENVELOPE)) return body;

    const lines = body.split("\n");
    let hits = 0;

    for (let i = 0; i < lines.length; i++) {
      const cr = lines[i].endsWith("\r");
      const line = cr ? lines[i].slice(0, -1) : lines[i];
      if (!line.startsWith("[[")) continue;

      const result = patchChunk(line);
      if (!result) continue;

      adjustLengthLine(lines, i - 1, line, result.text);
      lines[i] = result.text + (cr ? "\r" : "");
      hits += result.hits;
    }

    if (!hits) return body;
    state.patched += hits;
    state.lastPatchAt = Date.now();
    console.info("[Artech Flow] region check patched (" + hits + ")");
    return lines.join("\n");
  }

  function safeRewrite(body) {
    try {
      return rewriteBody(body);
    } catch (err) {
      state.errors++;
      console.warn("[Artech Flow] rewrite skipped:", err);
      return body;
    }
  }

  function isTarget(url) {
    if (!url) return false;
    try {
      const u = new URL(url, location.href);
      return u.origin === location.origin && u.pathname.includes(ENDPOINT);
    } catch {
      return false;
    }
  }

  // ---- XMLHttpRequest ----

  const XHR = XMLHttpRequest.prototype;
  const requestUrl = new WeakMap();
  const rewritten = new WeakMap();

  const nativeOpen = XHR.open;
  XHR.open = function (method, url) {
    requestUrl.set(this, url == null ? "" : String(url));
    rewritten.delete(this); // the same XHR object may be reused
    return nativeOpen.apply(this, arguments);
  };

  function hookGetter(prop, isTextual) {
    const desc = Object.getOwnPropertyDescriptor(XHR, prop);
    if (!desc || !desc.get) return;
    const nativeGet = desc.get;
    Object.defineProperty(XHR, prop, {
      ...desc,
      get() {
        const value = nativeGet.call(this);
        if (this.readyState !== 4 || !isTextual(this) || !isTarget(requestUrl.get(this))) return value;
        if (!rewritten.has(this)) rewritten.set(this, safeRewrite(value));
        return rewritten.get(this);
      },
    });
  }

  hookGetter("responseText", () => true);
  hookGetter("response", (xhr) => xhr.responseType === "" || xhr.responseType === "text");

  // ---- fetch ----

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function (input) {
      const pending = nativeFetch.apply(this, arguments);
      const url = input instanceof Request ? input.url : String(input);
      return isTarget(url) ? pending.then(rewriteResponse) : pending;
    };
  }

  async function rewriteResponse(res) {
    try {
      const original = await res.clone().text();
      const body = safeRewrite(original);
      if (body === original) return res;

      const headers = new Headers(res.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      const copy = new Response(body, { status: res.status, statusText: res.statusText, headers });
      Object.defineProperties(copy, {
        url: { value: res.url },
        redirected: { value: res.redirected },
      });
      return copy;
    } catch {
      return res;
    }
  }
})();
