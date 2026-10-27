import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
const id = () => uuid("id").defaultRandom().primaryKey();
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updated = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
export const roleEnum = pgEnum("user_role", [
  "super_admin",
  "doctor",
  "staff",
  "patient",
]);
export const appointmentEnum = pgEnum("appointment_state", [
  "draft",
  "awaiting_payment",
  "awaiting_verification",
  "awaiting_scheduling",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "rejected",
  "expired",
]);
export const paymentEnum = pgEnum("payment_state", [
  "awaiting_payment",
  "receipt_submitted",
  "under_review",
  "approved",
  "rejected",
  "additional_information_required",
  "expired",
  "refunded",
]);
export const users = pgTable("users", {
  id: id(),
  phone: varchar("phone", { length: 11 }).notNull().unique(),
  name: varchar("name", { length: 100 }),
  role: roleEnum("role").default("patient").notNull(),
  disabled: boolean("disabled").default(false).notNull(),
  createdAt: created(),
  updatedAt: updated(),
});
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    adminPasswordVerified: boolean("admin_password_verified")
      .default(false)
      .notNull(),
    createdAt: created(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const adminCredentials = pgTable("admin_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  totpSecret: text("totp_secret"),
  pendingTotpSecret: text("pending_totp_secret"),
  updatedAt: updated(),
});
export const integrationSecrets = pgTable("integration_secrets", {
  key: text("key").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  updatedAt: updated(),
});
export const adminMfaChallenges = pgTable("admin_mfa_challenges", {
  sessionHash: text("session_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});
export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: id(),
    phone: varchar("phone", { length: 11 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
);
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
});
export const patientProfiles = pgTable("patient_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  locale: varchar("locale", { length: 2 }).default("fa").notNull(),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  updatedAt: updated(),
});
export const doctorProfiles = pgTable("doctor_profiles", {
  id: id(),
  userId: uuid("user_id")
    .references(() => users.id)
    .unique(),
  fullName: jsonb("full_name").notNull(),
  biography: jsonb("biography"),
  education: jsonb("education"),
  experience: jsonb("experience"),
  registrationNumber: text("registration_number"),
  portraitKey: text("portrait_key"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  updatedAt: updated(),
});
export const roles = pgTable("roles", {
  id: id(),
  key: text("key").notNull().unique(),
  name: jsonb("name").notNull(),
});
export const permissions = pgTable("permissions", {
  id: id(),
  key: text("key").notNull().unique(),
});
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .references(() => roles.id)
      .notNull(),
    permissionId: uuid("permission_id")
      .references(() => permissions.id)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
export const medicalServices = pgTable("medical_services", {
  id: id(),
  slug: text("slug").notNull().unique(),
  content: jsonb("content").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: updated(),
});
export const consultationTypes = pgTable(
  "consultation_types",
  {
    id: id(),
    key: text("key").notNull().unique(),
    name: jsonb("name").notNull(),
    priceRial: integer("price_rial").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    bufferMinutes: integer("buffer_minutes").default(0).notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    instructions: jsonb("instructions"),
    updatedAt: updated(),
  },
  (t) => [
    check("price_nonnegative", sql`${t.priceRial} >= 0`),
    check("duration_positive", sql`${t.durationMinutes} > 0`),
  ],
);
export const messagingPlatforms = pgTable("messaging_platforms", {
  id: id(),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  contactNumber: text("contact_number"),
  username: text("username"),
  link: text("link"),
  instructions: jsonb("instructions"),
  updatedAt: updated(),
});
export const doctorAvailability = pgTable(
  "doctor_availability",
  {
    id: id(),
    consultationTypeId: uuid("consultation_type_id")
      .references(() => consultationTypes.id)
      .notNull(),
    weekday: integer("weekday").notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    timezone: text("timezone").default("Asia/Tehran").notNull(),
    capacity: integer("capacity").default(1).notNull(),
  },
  (t) => [check("valid_weekday", sql`${t.weekday} between 0 and 6`)],
);
export const blockedDates = pgTable("blocked_dates", {
  id: id(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
});
export const appointmentSlots = pgTable(
  "appointment_slots",
  {
    id: id(),
    consultationTypeId: uuid("consultation_type_id")
      .references(() => consultationTypes.id)
      .notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
  },
  (t) => [
    uniqueIndex("slot_type_start_unique").on(t.consultationTypeId, t.startsAt),
    check("slot_end_after_start", sql`${t.endsAt}>${t.startsAt}`),
  ],
);
export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    patientId: uuid("patient_id")
      .references(() => users.id)
      .notNull(),
    consultationTypeId: uuid("consultation_type_id")
      .references(() => consultationTypes.id)
      .notNull(),
    typeSnapshot: jsonb("type_snapshot").notNull(),
    platformSnapshot: jsonb("platform_snapshot"),
    priceRial: integer("price_rial").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    slotId: uuid("slot_id").references(() => appointmentSlots.id),
    schedulingMode: text("scheduling_mode").notNull(),
    status: appointmentEnum("status").default("awaiting_payment").notNull(),
    paymentStatus: paymentEnum("payment_status")
      .default("awaiting_payment")
      .notNull(),
    trackingCode: text("tracking_code").notNull().unique(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("patient_idempotency_unique").on(t.patientId, t.idempotencyKey),
    uniqueIndex("active_slot_unique")
      .on(t.slotId)
      .where(sql`${t.status} not in ('cancelled','rejected','expired')`),
    index("appointments_patient_idx").on(t.patientId, t.createdAt),
    check("appointment_price_nonnegative", sql`${t.priceRial}>=0`),
    check(
      "confirmed_appointment_integrity",
      sql`${t.status} not in ('confirmed','in_progress','completed') or (${t.slotId} is not null and ${t.confirmedAt} is not null and ${t.paymentStatus} in ('approved','refunded'))`,
    ),
  ],
);
export const appointmentStatusHistory = pgTable("appointment_status_history", {
  id: id(),
  appointmentId: uuid("appointment_id")
    .references(() => appointments.id)
    .notNull(),
  actorId: uuid("actor_id")
    .references(() => users.id)
    .notNull(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  note: text("note"),
  createdAt: created(),
});
export const bankAccounts = pgTable("bank_accounts", {
  id: id(),
  bankName: text("bank_name").notNull(),
  holderName: text("holder_name").notNull(),
  cardNumber: varchar("card_number", { length: 16 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedAt: updated(),
});
export const paymentSubmissions = pgTable("payment_submissions", {
  id: id(),
  appointmentId: uuid("appointment_id")
    .references(() => appointments.id)
    .notNull(),
  bankAccountId: uuid("bank_account_id")
    .references(() => bankAccounts.id)
    .notNull(),
  status: paymentEnum("status").default("receipt_submitted").notNull(),
  transactionReference: varchar("transaction_reference", { length: 100 }),
  disputeActive: boolean("dispute_active").default(false).notNull(),
  retentionHold: boolean("retention_hold").default(false).notNull(),
  legalRetentionUntil: timestamp("legal_retention_until", {
    withTimezone: true,
  }),
  createdAt: created(),
});
export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: id(),
    paymentId: uuid("submission_id")
      .references(() => paymentSubmissions.id)
      .notNull(),
    objectKey: text("object_key").notNull().unique(),
    patientId: uuid("patient_id")
      .references(() => users.id)
      .notNull(),
    provider: text("provider").default("legacy_s3").notNull(),
    blobPathname: text("blob_pathname").unique(),
    originalFilename: text("original_filename").default("receipt").notNull(),
    verificationStatus: text("verification_status")
      .default("under_review")
      .notNull(),
    deletionStatus: text("deletion_status").default("active").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionAttempts: integer("deletion_attempts").default(0).notNull(),
    lastDeletionError: text("last_deletion_error"),
    nextDeletionAttemptAt: timestamp("next_deletion_attempt_at", {
      withTimezone: true,
    }),
    retentionHold: boolean("retention_hold").default(false).notNull(),
    legalRetentionHold: boolean("legal_retention_hold")
      .default(false)
      .notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
    tokenIssueCount: integer("token_issue_count").default(0).notNull(),
    uploadIdempotencyKey: uuid("upload_idempotency_key").unique(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    scanStatus: text("scan_status").default("pending").notNull(),
    retainedUntil: timestamp("retained_until", {
      withTimezone: true,
    }).notNull(),
    createdAt: created(),
  },
  (t) => [
    index("receipt_patient_idx").on(t.patientId),
    index("receipt_cleanup_idx").on(t.deletionStatus, t.uploadedAt),
    index("receipt_payment_idx").on(t.paymentId),
    check(
      "receipt_size_limit",
      sql`${t.fileSize}>0 and ${t.fileSize}<=5242880`,
    ),
  ],
);
export const receiptCleanupRuns = pgTable("receipt_cleanup_runs", {
  id: id(),
  startedAt: created(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  dryRun: boolean("dry_run").notNull(),
  status: text("status").notNull(),
  scanned: integer("scanned").default(0).notNull(),
  eligible: integer("eligible").default(0).notNull(),
  deleted: integer("deleted").default(0).notNull(),
  errors: integer("errors").default(0).notNull(),
  blockedReasons: jsonb("blocked_reasons"),
  errorCode: text("error_code"),
});
export const paymentVerificationEvents = pgTable(
  "payment_verification_events",
  {
    id: id(),
    appointmentId: uuid("appointment_id")
      .references(() => appointments.id)
      .notNull(),
    actorId: uuid("actor_id")
      .references(() => users.id)
      .notNull(),
    action: text("action").notNull(),
    bankDepositVerified: boolean("bank_deposit_verified")
      .default(false)
      .notNull(),
    note: text("note"),
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    createdAt: created(),
  },
);
export const appointmentRequests = pgTable("appointment_requests", {
  id: id(),
  appointmentId: uuid("appointment_id")
    .references(() => appointments.id)
    .notNull(),
  patientId: uuid("patient_id")
    .references(() => users.id)
    .notNull(),
  kind: text("kind").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: created(),
});
export const smsTemplates = pgTable("sms_templates", {
  id: id(),
  key: text("key").notNull().unique(),
  content: jsonb("content").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: updated(),
});
export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  event: text("event").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  status: text("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  providerId: text("provider_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: created(),
});
export const articleCategories = pgTable("article_categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: jsonb("name").notNull(),
});
export const articles = pgTable("articles", {
  id: id(),
  slug: text("slug").notNull().unique(),
  categoryId: uuid("category_id").references(() => articleCategories.id),
  status: text("status").default("draft").notNull(),
  authorId: uuid("author_id").references(() => users.id),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  imageKey: text("image_key"),
  tags: jsonb("tags"),
  createdAt: created(),
  updatedAt: updated(),
});
export const articleTranslations = pgTable(
  "article_translations",
  {
    id: id(),
    articleId: uuid("article_id")
      .references(() => articles.id)
      .notNull(),
    locale: varchar("locale", { length: 2 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    seoTitle: text("seo_title"),
    description: text("description"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("article_locale_unique").on(t.articleId, t.locale)],
);
export const articleRevisions = pgTable("article_revisions", {
  id: id(),
  translationId: uuid("translation_id")
    .references(() => articleTranslations.id)
    .notNull(),
  editorId: uuid("editor_id")
    .references(() => users.id)
    .notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: created(),
});
export const medicalReferences = pgTable("medical_references", {
  id: id(),
  articleId: uuid("article_id")
    .references(() => articles.id)
    .notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  publicationDate: text("publication_date"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
});
export const mediaAssets = pgTable("media_assets", {
  id: id(),
  objectKey: text("object_key").notNull().unique(),
  ownerId: uuid("owner_id")
    .references(() => users.id)
    .notNull(),
  purpose: text("purpose").notNull(),
  mimeType: text("mime_type").notNull(),
  private: boolean("private").default(true).notNull(),
  createdAt: created(),
});
export const websiteSettings = pgTable("website_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: updated(),
});
export const localizedContent = pgTable(
  "localized_content",
  {
    id: id(),
    key: text("key").notNull(),
    locale: varchar("locale", { length: 2 }).notNull(),
    value: jsonb("value").notNull(),
    published: boolean("published").default(false).notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("content_locale_unique").on(t.key, t.locale)],
);
export const seoMetadata = pgTable(
  "seo_metadata",
  {
    id: id(),
    path: text("path").notNull(),
    locale: varchar("locale", { length: 2 }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    canonical: text("canonical"),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("seo_path_locale_unique").on(t.path, t.locale)],
);
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: created(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
