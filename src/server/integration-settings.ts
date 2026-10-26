import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { integrationSecrets } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/admin-crypto";
export type SmsSettings = {
  username: string;
  password: string;
  otpBodyId: string;
  from: string;
};
export function settingsKey() {
  const key = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error("SETTINGS_KEY_NOT_CONFIGURED");
  return key;
}
export async function storedSmsSettings(): Promise<SmsSettings | null> {
  const [row] = await getDb()
    .select()
    .from(integrationSecrets)
    .where(eq(integrationSecrets.key, "melipayamak"));
  return row ? JSON.parse(decryptSecret(row.ciphertext, settingsKey())) : null;
}
export async function saveSmsSettings(value: SmsSettings) {
  const ciphertext = encryptSecret(JSON.stringify(value), settingsKey());
  await getDb()
    .insert(integrationSecrets)
    .values({ key: "melipayamak", ciphertext })
    .onConflictDoUpdate({
      target: integrationSecrets.key,
      set: { ciphertext, updatedAt: new Date() },
    });
}
