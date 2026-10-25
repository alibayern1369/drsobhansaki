import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as s from "../src/db/schema";
import { medicalDrafts } from "../src/lib/medical-drafts";
import { services, copy } from "../src/lib/content";
async function main() {
  if (
    process.env.ALLOW_DEV_SEED !== "true" ||
    process.env.NEON_BRANCH === "production"
  )
    throw new Error(
      "Seeding is restricted to an explicitly authorized development database.",
    );
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    await db.transaction(async (tx) => {
      for (const key of ["phone", "text"])
        await tx
          .insert(s.consultationTypes)
          .values({
            key,
            name: {
              fa: key === "phone" ? "مشاوره تلفنی" : "مشاوره متنی",
              en: key === "phone" ? "Phone consultation" : "Text consultation",
            },
            priceRial: 0,
            durationMinutes: 20,
            enabled: false,
          })
          .onConflictDoNothing();
      for (const key of ["whatsapp", "telegram", "bale"])
        await tx
          .insert(s.messagingPlatforms)
          .values({ key, enabled: false })
          .onConflictDoNothing();
      await tx
        .insert(s.websiteSettings)
        .values({
          key: "booking",
          value: {
            enabled: false,
            patientScheduling: false,
            doctorScheduling: false,
          },
        })
        .onConflictDoNothing();
      for (const locale of ["fa", "en"] as const)
        await tx
          .insert(s.localizedContent)
          .values({
            key: "homepage",
            locale,
            value: copy[locale],
            published: false,
          })
          .onConflictDoNothing();
      for (const service of services)
        await tx
          .insert(s.medicalServices)
          .values({
            slug: service.slug,
            content: { fa: service.desc, en: service.enDesc },
            enabled: false,
          })
          .onConflictDoNothing();
      for (const draft of medicalDrafts) {
        const [a] = await tx
          .insert(s.articles)
          .values({ slug: draft.slug, status: "draft" })
          .onConflictDoNothing()
          .returning();
        if (!a) continue;
        for (const locale of ["fa", "en"] as const)
          await tx.insert(s.articleTranslations).values({
            articleId: a.id,
            locale,
            title: locale === "fa" ? draft.title : draft.enTitle,
            body: locale === "fa" ? draft.body : draft.enBody,
            description: locale === "fa" ? draft.title : draft.enTitle,
          });
        await tx.insert(s.medicalReferences).values({
          articleId: a.id,
          title: draft.sourceTitle,
          url: draft.source,
          publicationDate: draft.sourceDate,
          checkedAt: new Date("2026-10-25T00:00:00Z"),
        });
      }
    });
    console.log(
      "Development seed complete: services disabled, booking closed, all articles draft.",
    );
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    "Development seed failed.",
    error instanceof Error ? error.name : "Unknown error",
  );
  process.exitCode = 1;
});
