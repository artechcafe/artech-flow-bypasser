// Artech Flow Bypasser — region-check rewriting (Firefox build).
//
// Flow asks its backend (Google's batchexecute RPC endpoint) whether the
// visitor's region is allowed. The answers come back as "wrb.fr" envelopes
// whose third field is a JSON-encoded payload. background.js passes each
// response body through rewriteBody() before Flow's page receives it.

const ENVELOPE = "wrb.fr";
const BLOCKED_CODES = new Set([4, 5, 6, 7, 8]);
const ALLOWED_CODE = 1;

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

    if (patch(payload)) {
      envelope[2] = JSON.stringify(payload);
      hits++;
    }
  }
  return hits ? { text: JSON.stringify(chunk), hits } : null;
}

// Returns { body, hits }; body is unchanged when nothing needed patching.
export function rewriteBody(body) {
  if (typeof body !== "string" || !body.includes(ENVELOPE)) return { body, hits: 0 };

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

  return hits ? { body: lines.join("\n"), hits } : { body, hits: 0 };
}
