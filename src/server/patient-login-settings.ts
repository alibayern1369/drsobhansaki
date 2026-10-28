import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { integrationSecrets, websiteSettings } from "@/db/schema";
import { resolvePatientTestMode } from "@/lib/test-login";

export async function patientTestMode(
  db: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
) {
  const [setting] = await db
    .select({ value: websiteSettings.value })
    .from(websiteSettings)
    .where(eq(websiteSettings.key, "patientTestLogin"));
  if (setting) return resolvePatientTestMode(setting.value, false);
  const [saved] = await db
    .select({ key: integrationSecrets.key })
    .from(integrationSecrets)
    .where(eq(integrationSecrets.key, "melipayamak"));
  const configured =
    !!saved ||
    !!(process.env.SMS_API_URL && process.env.SMS_API_KEY) ||
    !!(
      process.env.SMS_PROVIDER === "melipayamak" &&
      process.env.MELIPAYAMAK_USERNAME &&
      process.env.MELIPAYAMAK_PASSWORD &&
      process.env.MELIPAYAMAK_OTP_BODY_ID
    );
  return resolvePatientTestMode(undefined, configured);
}
