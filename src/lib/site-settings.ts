import { z } from "zod";
const localized = z.object({
  fa: z.string().max(10000).default(""),
  en: z.string().max(10000).default(""),
});
const asset = z
  .string()
  .max(2048)
  .refine((v) => !v || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v));
const schemas = {
  consultationContact: z.object({
    phone: z.string().max(30).default(""),
    phoneInstructions: localized.optional(),
  }),
  branding: z
    .object({
      primaryColor: z
        .string()
        .regex(/^#[\da-f]{6}$/i)
        .optional(),
      doctorImageUrl: asset.optional(),
      consultationImageUrl: asset.optional(),
      medicalImageUrl: asset.optional(),
      logoUrl: asset.nullable().optional(),
      lightFaviconUrl: asset.nullable().optional(),
      darkFaviconUrl: asset.nullable().optional(),
      socialImageUrl: asset.nullable().optional(),
      appleTouchIconUrl: asset.nullable().optional(),
    })
    .passthrough(),
  booking: z
    .object({
      enabled: z.boolean(),
      patientScheduling: z.boolean(),
      doctorScheduling: z.boolean(),
    })
    .refine((v) => !v.enabled || v.patientScheduling || v.doctorScheduling),
  seo: z
    .object({
      title: localized.optional(),
      description: localized.optional(),
      googleSiteVerification: z
        .string()
        .max(200)
        .regex(/^[a-zA-Z0-9_-]*$/)
        .optional(),
      siteUrl: z
        .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
        .optional(),
    })
    .passthrough(),
  contact: z
    .object({
      phone: z.string().max(100).optional(),
      email: z.union([z.literal(""), z.email()]).optional(),
      address: localized.optional(),
      showOfficeAddress: z.boolean().optional(),
      hours: localized.optional(),
      education: localized.optional(),
      registration: localized.optional(),
      interests: localized.optional(),
    })
    .passthrough(),
  social: z.object({
    phone: z.string().max(100).optional(),
    whatsapp: z
      .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
      .optional(),
    telegram: z
      .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
      .optional(),
    instagram: z
      .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
      .optional(),
    bale: z
      .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
      .optional(),
  }),
  policies: z
    .object({ privacy: localized.optional(), terms: localized.optional() })
    .passthrough(),
};
export function validateSiteSettings(
  key: keyof typeof schemas,
  value: unknown,
) {
  return schemas[key].parse(value);
}
