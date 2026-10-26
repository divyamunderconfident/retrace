// Prints the browser fingerprint of every step in a run file, one per line. Used by tests/test_site_fingerprint.py.
// Usage: node site/scripts/fingerprints.mjs <run.json>
import { readFileSync } from "node:fs";
import { stepFingerprint } from "../lib/fingerprint.ts";

const run = JSON.parse(readFileSync(process.argv[2], "utf-8"));
for (const step of run.steps) console.log(await stepFingerprint(step.type, step.name, step.input));
