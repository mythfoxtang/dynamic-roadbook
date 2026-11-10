import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TravelError } from "./travel-core.mjs";
export const TRAVEL_COOKIE = "roadbook_travel_account";
const directory = path.join(process.cwd(), ".automation", "travel-private");
const store = globalThis.__travelAccounts || (globalThis.__travelAccounts = new Map());
let loadedVersion = null;
function encryptionKey() {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "key.bin");
  if (!fs.existsSync(file)) { try { fs.writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 }); } catch (e) { if (e.code !== "EEXIST") throw e; } }
  return fs.readFileSync(file);
}
function load() {
  const file = path.join(directory, "sessions.enc");
  const version = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  if (loadedVersion === version) return;
  loadedVersion = version; store.clear();
  if (!version) return;
  try {
    const raw = fs.readFileSync(file); const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12)); decipher.setAuthTag(raw.subarray(12, 28));
    const sessions = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
    for (const [id, data] of sessions) if (data.expiresAt > Date.now()) store.set(id, data);
  } catch { /* Invalid local vault requires reconnection; never expose its contents. */ }
}
export function writeTravelPrivate(name, value) {
  if (!/^[a-z-]+$/.test(name)) throw new Error("Invalid vault name");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tmp = path.join(directory, `sessions-${randomBytes(6).toString("hex")}.tmp`);
  fs.writeFileSync(tmp, Buffer.concat([iv, cipher.getAuthTag(), body]), { mode: 0o600 });
  fs.renameSync(tmp, path.join(directory, `${name}.enc`));
}
function persist() { writeTravelPrivate("sessions", [...store]); }
export function readTravelPrivate(name, fallback) {
  if (!/^[a-z-]+$/.test(name)) throw new Error("Invalid vault name");
  try {
    const raw = fs.readFileSync(path.join(directory, `${name}.enc`));
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12)); decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
  } catch { return fallback; }
}
export function saveTravelAccount(credential, previousId) {
  load(); for (const [id, account] of store) if (account.expiresAt <= Date.now()) store.delete(id);
  if (previousId) store.delete(previousId);
  if (store.size >= 100) throw new TravelError("连接会话过多", 429);
  const id = randomBytes(32).toString("hex");
  store.set(id, { credential, expiresAt: Math.min(Date.now() + 12 * 3600000, credential.tokenExpiresAt || Infinity) }); persist(); return id;
}
export function getTravelAccount(id) {
  load(); const account = store.get(id);
  if (account?.expiresAt > Date.now()) return account;
  if (process.env.TUNIU_API_KEY && !process.env.TUNIU_API_KEY.startsWith("your_")) return { credential: { type: "apiKey", secret: process.env.TUNIU_API_KEY, fromEnvironment: true }, expiresAt: null, fromEnvironment: true };
  return null;
}
export function deleteTravelAccount(id) { load(); if (store.delete(id)) persist(); }
