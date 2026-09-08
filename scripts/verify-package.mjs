import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const requiredFiles = [
  "LICENSE",
  "RELAYWA_PROVENANCE.md",
  "WAProto/index.js",
  "lib/index.js",
  "lib/index.d.ts",
];

for (const file of requiredFiles) {
  const contents = await readFile(new URL(`../${file}`, import.meta.url));
  if (!contents.length) throw new Error(`${file} is empty`);
}

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

if (packageJson.name !== "@workflo/relaywa-baileys") {
  throw new Error("Unexpected package name");
}

const entrypoint = await readFile(new URL("../lib/index.js", import.meta.url));
console.log(`Verified ${packageJson.name}@${packageJson.version}`);
console.log(`Entrypoint SHA-256: ${createHash("sha256").update(entrypoint).digest("hex")}`);
