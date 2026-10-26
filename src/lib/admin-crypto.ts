import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const result = (await derive(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${result.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, digest] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{128}$/.test(digest || "")
  )
    return false;
  const result = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(result, Buffer.from(digest, "hex"));
}
function key(secret: string) {
  if (secret.length < 32) throw new Error("SETTINGS_KEY_NOT_CONFIGURED");
  return createHash("sha256").update(secret).digest();
}
export function encryptSecret(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptSecret(value: string, secret: string) {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1") throw new Error("INVALID_CIPHERTEXT");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export function newTotpSecret() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...randomBytes(20)]
    .map((x) => x.toString(2).padStart(8, "0"))
    .join("");
  return bits
    .match(/.{5}/g)!
    .map((x) => alphabet[parseInt(x, 2)])
    .join("");
}
export function totpCounter(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  if (!/^[A-Z2-7]{16,}$/.test(secret)) return null;
  const bits = [...secret]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((x) => parseInt(x, 2)));
  for (let drift = -1; drift <= 1; drift++) {
    const step = Math.floor(now / 30000) + drift;
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const mac = createHmac("sha1", bytes).update(counter).digest();
    const offset = mac[19] & 15;
    const expected = String(
      (mac.readUInt32BE(offset) & 0x7fffffff) % 1000000,
    ).padStart(6, "0");
    if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return step;
  }
  return null;
}
export function effectiveAdminVerification(
  passwordVerified: boolean,
  credential: { smsEnabled: boolean; totpEnabled: boolean } | null,
  verifiedAt: Date | null,
  now = new Date(),
) {
  if (!credential) return verifiedAt;
  if (!passwordVerified) return null;
  return credential.smsEnabled || credential.totpEnabled ? verifiedAt : now;
}
