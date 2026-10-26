// Browser port of retrace.recorder.step_hash: sha256 of json.dumps({"type", "name", "input"}, sort_keys=True).
// It must stay byte-identical to Python; tests/test_site_fingerprint.py checks it against every exported step.

/** A string exactly as Python's json.dumps writes it (ensure_ascii=True). */
function pyString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

/** JSON text exactly as Python's json.dumps(value, sort_keys=True) writes it. */
export function pyJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  // shortcut: a float like 3.0 prints as "3" here but "3.0" in Python; recorded inputs are strings and ints, so fine
  // until a tool takes float arguments.
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyString(value);
  if (Array.isArray(value)) return `[${value.map(pyJson).join(", ")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${pyString(k)}: ${pyJson(obj[k])}`).join(", ")}}`;
}

export async function stepFingerprint(type: string, name: string, input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(pyJson({ type, name, input }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
