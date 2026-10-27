import {
  test,
  expect as baseExpect,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import { Pool } from "pg";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { curlUploadTransport } from "./curl-upload-transport";
// Fixtures are permitted only on an explicitly isolated database. No SMS is sent.
const enabled =
  process.env.PORTAL_TEST_ISOLATED === "true" &&
  !!process.env.PORTAL_TEST_DATABASE_URL_FILE;
const expect = baseExpect.configure({ timeout: 15000 });
test.skip(
  !enabled,
  "Requires an isolated branch and the matching application deployment",
);
test.setTimeout(300000);
let pool: Pool;
let patient: { id: string; phone: string },
  other: { id: string; token: string },
  admin: { id: string; token: string };
let phoneType: { id: string; price_rial: number },
  textType: { id: string; price_rial: number };
let slots: { id: string; consultation_type_id: string }[], platformId: string;
const code = "728419";
const receiptPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jW3cAAAAASUVORK5CYII=",
  "base64",
);
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
async function navigate(page: Page, url: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(url);
      return;
    } catch (error) {
      if (
        attempt >= 2 ||
        !(error instanceof Error) ||
        !error.message.includes("net::ERR_SSL_")
      )
        throw error;
    }
  }
}
async function authorizeDeployment(context: BrowserContext, baseURL: string) {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
    await context.route(
      (url) => url.origin === new URL(baseURL).origin,
      (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-vercel-protection-bypass":
              process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
          },
        }),
    );
}
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await fetch(path, {
            method: body === undefined ? "GET" : "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept-Language": "fa",
            },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          return { status: r.status, data: await r.json() };
        } catch (error) {
          // Retry transport failures only. Mutation retries retain their original idempotency key.
          if (attempt >= 2) throw error;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    },
    { path, body },
  );
}
test.beforeAll(async () => {
  if (!enabled) return;
  const database = readFileSync(
    process.env.PORTAL_TEST_DATABASE_URL_FILE!,
    "utf8",
  ).trim();
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (!env.DATABASE_URL || !env.AUTH_SECRET)
    throw new Error("Local test environment is not configured");
  expect(new URL(database).hostname.replace("-pooler", "")).not.toBe(
    new URL(env.DATABASE_URL).hostname.replace("-pooler", ""),
  );
  pool = new Pool({ connectionString: database, max: 3 });
  // The test branch inherits the real schema and settings, but test identities and times stay on that branch.
  const suffix = String(Date.now()).slice(-7);
  const makeUser = async (phone: string, role = "patient") =>
    (
      await pool.query(
        "insert into users(phone,name,role) values($1,$2,$3) returning id,phone",
        [phone, "آزمون یکپارچه پنل", role],
      )
    ).rows[0];
  patient = await makeUser("0901" + suffix);
  const otherUser = await makeUser("0902" + suffix),
    adminUser = await makeUser("0903" + suffix, "doctor");
  other = { id: otherUser.id, token: randomBytes(32).toString("hex") };
  admin = { id: adminUser.id, token: randomBytes(32).toString("hex") };
  await pool.query(
    "insert into admin_credentials(user_id,username,password_hash) values($1,$2,'fixture-unused')",
    [admin.id, "portal_" + suffix],
  );
  for (const u of [other, admin])
    await pool.query(
      "insert into sessions(user_id,token_hash,expires_at,admin_password_verified) values($1,$2,now()+interval '1 day',$3)",
      [u.id, digest(u.token), u.id === admin.id],
    );
  await pool.query(
    "insert into otp_challenges(phone,code_hash,expires_at) values($1,$2,now()+interval '30 minutes')",
    [
      patient.phone,
      createHmac("sha256", env.AUTH_SECRET)
        .update(`${patient.phone}:${code}`)
        .digest("hex"),
    ],
  );
  await pool.query(
    "update consultation_types set enabled=true where key in ('phone','text')",
  );
  await pool.query(
    "update sms_templates set enabled=true where key='appointment_confirmed'",
  );
  phoneType = (
    await pool.query(
      "select id,price_rial from consultation_types where key='phone'",
    )
  ).rows[0];
  textType = (
    await pool.query(
      "select id,price_rial from consultation_types where key='text'",
    )
  ).rows[0];
  await pool.query("update website_settings set value=$1 where key='booking'", [
    { enabled: true, patientScheduling: true, doctorScheduling: true },
  ]);
  await pool.query(
    "insert into website_settings(key,value) values('consultationContact',$1) on conflict(key) do update set value=excluded.value",
    [
      {
        phoneInstructions: {
          fa: "راهنمای آزمون: پزشک در ساعت نوبت با شما تماس می‌گیرد.",
          en: "Test instruction: doctor calls at appointment time.",
        },
      },
    ],
  );
  platformId = (
    await pool.query(
      "update messaging_platforms set enabled=true,link='https://t.me/fixture_doctor' where key='telegram' returning id",
    )
  ).rows[0].id;
  slots = [];
  const testStart =
    Date.now() + (60 + Math.floor(Math.random() * 1000)) * 86400000;
  for (let i = 0; i < 4; i++) {
    const type = i === 3 ? textType : phoneType;
    const start = new Date(testStart + i * 2 * 3600000),
      end = new Date(start.getTime() + 60 * 60000);
    slots.push(
      (
        await pool.query(
          "insert into appointment_slots(consultation_type_id,starts_at,ends_at) values($1,$2,$3) returning id,consultation_type_id",
          [type.id, start, end],
        )
      ).rows[0],
    );
  }
});
test.afterAll(async () => {
  if (pool) await pool.end();
});

test("real sessions, booking locks, receipt review, patient ownership, profile, notifications and logout", async ({
  page,
  browser,
  baseURL,
}) => {
  await authorizeDeployment(page.context(), baseURL!);
  await curlUploadTransport(page, receiptPng);
  page.setDefaultTimeout(20000);
  // Only the SMS send step is a fixture. OTP verification, cookies and all following APIs are real.
  await page.route("**/api/auth/otp", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await navigate(page, "/fa/booking");
  await expect(page.locator(".choice")).toHaveCount(2);
  await expect(page.locator(".wizard-progress li")).toHaveCount(3);
  await expect(page.locator(".booking-sidebar")).toContainText("تومان");
  await page.getByRole("button", { name: "ادامه و ورود به حساب" }).click();
  await expect(page).toHaveURL(/login\?next=/);
  await page
    .locator("#login-phone")
    .fill(patient.phone.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]));
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await expect(
    page.getByRole("button", { name: /ارسال مجدد تا/ }),
  ).toBeDisabled();
  await page.locator("#otp-code").fill(code);
  await page.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(page).toHaveURL(/booking\?resume=1/);
  await expect(page.locator(".wizard-progress .current")).toContainText(
    "انتخاب زمان نوبت",
  );
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "medical_session",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  expect(await api(page, "/api/admin/overview")).toMatchObject({ status: 403 });
  await expect(page.locator(".account-trigger")).toContainText(
    "آزمون یکپارچه پنل",
  );
  await navigate(page, page.url());
  await expect(page.locator(".booking-calendar")).toBeVisible();
  await page.locator(".calendar-days button.available").first().click();
  await page.locator(".slot-cards button").first().click();
  await page.locator('.live-booking-form input[type="checkbox"]').check();
  await page
    .getByRole("button", { name: "ثبت درخواست و ادامه پرداخت" })
    .click();
  await expect(page).toHaveURL(/booking\?appointment=/);
  const id = new URL(page.url()).searchParams.get("appointment")!;
  const before = await api(page, `/api/patient/appointments/${id}`);
  expect(before.status).toBe(200);
  expect(before.data.appointment.paymentStatus).toBe("awaiting_payment");
  expect(await api(page, `/api/appointments/${id}/contact`)).toMatchObject({
    status: 403,
  });
  // A second patient's requests cannot read this appointment or its contacts.
  const otherContext = await browser.newContext();
  await authorizeDeployment(otherContext, baseURL!);
  await otherContext.addCookies([
    { name: "medical_session", value: other.token, url: baseURL! },
  ]);
  const otherPage = await otherContext.newPage();
  await navigate(otherPage, "/fa");
  expect(await api(otherPage, `/api/patient/appointments/${id}`)).toMatchObject(
    { status: 404 },
  );
  expect(await api(otherPage, `/api/appointments/${id}/contact`)).toMatchObject(
    { status: 404 },
  );
  // True transaction locking: two simultaneous patients compete for one real slot on the test branch.
  const booking = {
    consultationTypeId: phoneType.id,
    expectedPriceRial: phoneType.price_rial,
    schedulingMode: "patient",
    slotId: slots[1].id,
    consent: true,
    idempotencyKey: randomUUID(),
  };
  const raced = await Promise.all([
    api(page, "/api/appointments", booking),
    api(otherPage, "/api/appointments", {
      ...booking,
      idempotencyKey: randomUUID(),
    }),
  ]);
  expect(raced.map((r) => r.status).sort()).toEqual([201, 409]);
  const repeat = await api(page, "/api/appointments", {
    ...booking,
    slotId: slots[2].id,
    idempotencyKey: randomUUID(),
  });
  expect(repeat.status).toBe(201);
  const savedKey = repeat.data.idempotencyKey;
  const repeated = await Promise.all([
    api(page, "/api/appointments", {
      ...booking,
      slotId: slots[2].id,
      idempotencyKey: savedKey,
    }),
    api(page, "/api/appointments", {
      ...booking,
      slotId: slots[2].id,
      idempotencyKey: savedKey,
    }),
  ]);
  expect(
    repeated.every((r) => r.status === 201 && r.data.id === repeat.data.id),
  ).toBe(true);
  const config = await api(page, "/api/config");
  expect(
    config.data.slots.some(
      (s: { id: string }) => s.id === before.data.appointment.slotId,
    ),
  ).toBe(false);
  const png = receiptPng;
  await page.locator(`#reference-${id}`).fill("۱۲۳۴۵۶۷۸۹");
  await page.locator(`#file-${id}`).setInputFiles({
    name: "portal-integration-receipt.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.locator(".receipt-file-preview img")).toBeVisible();
  await page.getByRole("button", { name: "ارسال رسید برای بررسی" }).click();
  const uploadEnabled = process.env.PORTAL_TEST_REAL_UPLOAD === "true";
  if (uploadEnabled) {
    await expect(
      page.getByRole("heading", { name: "رسید شما برای بررسی ثبت شد" }),
    ).toBeVisible({ timeout: 60000 });
  } else {
    await expect(
      page.getByRole("status").filter({ hasText: "فضای خصوصی رسید" }),
    ).toBeVisible();
    // Receipt fixtures allow the real review state machine to be tested separately from external storage.
    const bank = (
      await pool.query(
        "select id from bank_accounts where enabled=true limit 1",
      )
    ).rows[0];
    const payment = (
      await pool.query(
        "insert into payment_submissions(appointment_id,bank_account_id,status,transaction_reference) values($1,$2,'under_review','123456789') returning id",
        [id, bank.id],
      )
    ).rows[0];
    await pool.query(
      "insert into payment_receipts(submission_id,object_key,patient_id,provider,mime_type,size_bytes,sha256,retained_until,verification_status,scan_status) values($1,$2,$3,'fixture','image/png',68,$4,now()+interval '30 days','under_review','signature_verified_not_malware_scanned')",
      [
        payment.id,
        "isolated-fixture/" + randomUUID(),
        patient.id,
        "0".repeat(64),
      ],
    );
    await pool.query(
      "update appointments set status='awaiting_verification',payment_status='under_review' where id=$1",
      [id],
    );
  }
  expect(
    (await api(page, `/api/patient/appointments/${id}`)).data.appointment
      .paymentStatus,
  ).toBe("under_review");
  const adminContext = await browser.newContext();
  await authorizeDeployment(adminContext, baseURL!);
  await adminContext.addCookies([
    { name: "medical_session", value: admin.token, url: baseURL! },
  ]);
  const adminPage = await adminContext.newPage();
  await navigate(adminPage, "/fa/admin");
  expect(
    await api(adminPage, `/api/admin/appointments/${id}/payment`, {
      action: "reject",
      idempotencyKey: randomUUID(),
    }),
  ).toMatchObject({ status: 400 });
  const reason = "شماره پیگیری روی رسید خوانا نیست؛ رسید واضح ارسال کنید.";
  expect(
    await api(adminPage, `/api/admin/appointments/${id}/payment`, {
      action: "reject",
      note: reason,
      idempotencyKey: randomUUID(),
    }),
  ).toMatchObject({ status: 200 });
  await navigate(page, `/fa/dashboard?view=payments&appointment=${id}`);
  await expect(
    page.locator(".patient-detail .appointment-status.red"),
  ).toBeVisible();
  await expect(page.locator(".patient-detail")).toContainText(reason);
  if (uploadEnabled) {
    await page.locator(`#reference-${id}`).fill("987654321");
    await page.locator(`#file-${id}`).setInputFiles({
      name: "portal-integration-corrected.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.getByRole("button", { name: "ارسال رسید برای بررسی" }).click();
    await expect(
      page.locator(".patient-detail .appointment-status.yellow"),
    ).toBeVisible({ timeout: 60000 });
    const receipts = await api(page, `/api/appointments/${id}/receipts`);
    expect(receipts.data).toHaveLength(2);
    const receiptId = receipts.data.at(-1).id;
    expect(await api(otherPage, `/api/receipts/${receiptId}`)).toMatchObject({
      status: 404,
    });
  } else {
    await pool.query(
      "update payment_submissions set status='under_review' where appointment_id=$1",
      [id],
    );
    await pool.query(
      "update payment_receipts set verification_status='under_review' where submission_id in(select id from payment_submissions where appointment_id=$1)",
      [id],
    );
    await pool.query(
      "update appointments set payment_status='under_review' where id=$1",
      [id],
    );
  }
  const approve = {
    action: "approve",
    bankDepositVerified: true,
    idempotencyKey: randomUUID(),
  };
  expect(
    await api(adminPage, `/api/admin/appointments/${id}/payment`, approve),
  ).toMatchObject({ status: 200 });
  expect(
    await api(adminPage, `/api/admin/appointments/${id}/payment`, approve),
  ).toMatchObject({ status: 200 });
  const confirmed = await api(page, `/api/patient/appointments/${id}`);
  expect(confirmed.data.appointment).toMatchObject({
    status: "confirmed",
    paymentStatus: "approved",
  });
  expect(
    confirmed.data.reviews.filter(
      (r: { action: string }) => r.action === "approve",
    ),
  ).toHaveLength(1);
  expect(await api(page, `/api/appointments/${id}/contact`)).toMatchObject({
    status: 200,
    data: { type: "phone" },
  });
  const queued = await pool.query(
    "select status,provider_id from notifications where appointment_id=$1 and event='appointment_confirmed'",
    [id],
  );
  expect(queued.rows).toHaveLength(1);
  expect(queued.rows[0].provider_id).toBeNull();
  expect(queued.rows[0].status).not.toBe("sent"); // Sending is intentionally unconfigured on the isolated branch.
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            "select last_error from notifications where appointment_id=$1 and event='appointment_confirmed'",
            [id],
          )
        ).rows[0]?.last_error,
    )
    .toBe("SMS_NOT_CONFIGURED");
  await navigate(page, page.url());
  await expect(
    page.locator(".patient-detail .appointment-status.green"),
  ).toBeVisible();
  const textBooking = await api(page, "/api/appointments", {
    ...booking,
    consultationTypeId: textType.id,
    expectedPriceRial: textType.price_rial,
    slotId: slots[3].id,
    platformId,
    idempotencyKey: randomUUID(),
  });
  expect(textBooking.status).toBe(201);
  expect(textBooking.data.platformSnapshot).toEqual({ key: "telegram" });
  expect(
    await api(page, `/api/appointments/${textBooking.data.id}/contact`),
  ).toMatchObject({ status: 403 });
  // Exercise text consultation confirmation independently of the storage transport.
  // Receipt fixtures and financial states exist only on the isolated test branch.
  const textBank = (
    await pool.query("select id from bank_accounts where enabled=true limit 1")
  ).rows[0];
  const textPayment = (
    await pool.query(
      "insert into payment_submissions(appointment_id,bank_account_id,status,transaction_reference) values($1,$2,'under_review','TEXT-FIXTURE') returning id",
      [textBooking.data.id, textBank.id],
    )
  ).rows[0];
  await pool.query(
    "insert into payment_receipts(submission_id,object_key,patient_id,provider,mime_type,size_bytes,sha256,retained_until,verification_status,scan_status) values($1,$2,$3,'fixture','image/png',68,$4,now()+interval '30 days','under_review','signature_verified_not_malware_scanned')",
    [
      textPayment.id,
      "isolated-text-fixture/" + randomUUID(),
      patient.id,
      "0".repeat(64),
    ],
  );
  await pool.query(
    "update appointments set status='awaiting_verification',payment_status='under_review' where id=$1",
    [textBooking.data.id],
  );
  expect(
    await api(
      adminPage,
      `/api/admin/appointments/${textBooking.data.id}/payment`,
      {
        action: "approve",
        bankDepositVerified: true,
        idempotencyKey: randomUUID(),
      },
    ),
  ).toMatchObject({ status: 200 });
  const textContact = await api(
    page,
    `/api/appointments/${textBooking.data.id}/contact`,
  );
  expect(textContact.status).toBe(200);
  expect(textContact.data.channels).toHaveLength(1);
  expect(textContact.data.channels[0]).toMatchObject({
    key: "telegram",
    url: "https://t.me/fixture_doctor",
  });
  const badPrice = await api(page, "/api/appointments", {
    ...booking,
    expectedPriceRial: 1,
    idempotencyKey: randomUUID(),
  });
  expect(badPrice.status).toBe(409);
  // Expiring a real temporary hold releases capacity and preserves its history.
  await pool.query(
    "update appointments set expires_at=now()-interval '1 minute' where id=$1",
    [repeat.data.id],
  );
  await api(page, "/api/config");
  expect(
    (await api(page, `/api/patient/appointments/${repeat.data.id}`)).data
      .appointment.status,
  ).toBe("expired");
  expect(
    (await api(page, "/api/config")).data.slots.some(
      (s: { id: string }) => s.id === slots[2].id,
    ),
  ).toBe(true);
  const blockedStart = new Date(Date.now() + 1400 * 86400000);
  const blockedEnd = new Date(blockedStart.getTime() + 60 * 60000);
  const blockedSlot = (
    await pool.query(
      "insert into appointment_slots(consultation_type_id,starts_at,ends_at) values($1,$2,$3) returning id",
      [phoneType.id, blockedStart, blockedEnd],
    )
  ).rows[0];
  await pool.query(
    "insert into blocked_dates(starts_at,ends_at,reason) values($1,$2,'Isolated integration fixture')",
    [blockedStart, blockedEnd],
  );
  expect(
    (await api(page, "/api/config")).data.slots.some(
      (s: { id: string }) => s.id === blockedSlot.id,
    ),
  ).toBe(false);
  expect(
    await api(page, "/api/appointments", {
      ...booking,
      slotId: blockedSlot.id,
      idempotencyKey: randomUUID(),
    }),
  ).toMatchObject({ status: 409 });
  // Pagination is enforced by the real server, using fixtures only on the isolated branch.
  const prefix = `PORTAL-PAGE-${randomUUID()}`;
  for (let i = 0; i < 9; i++)
    await pool.query(
      "insert into appointments(patient_id,consultation_type_id,type_snapshot,price_rial,duration_minutes,scheduling_mode,status,tracking_code,idempotency_key,expires_at,consent_at) values($1,$2,$3,$4,20,'doctor','draft',$5,$6,now()+interval '1 day',now())",
      [
        patient.id,
        phoneType.id,
        { key: "phone" },
        phoneType.price_rial,
        `${prefix}-${i}`,
        randomUUID(),
      ],
    );
  const paged = await api(page, `/api/patient/appointments?q=${prefix}&page=1`);
  expect(paged.data.total).toBe(9);
  expect(paged.data.items).toHaveLength(8);
  expect(
    (await api(page, `/api/patient/appointments?q=${prefix}&page=2`)).data
      .items,
  ).toHaveLength(1);
  await navigate(page, "/fa/dashboard?view=profile");
  await page.locator("#patient-name").fill("نام به‌روز بیمار آزمون");
  await page.getByRole("button", { name: "ذخیره اطلاعات" }).click();
  await expect(page.locator(".account-trigger")).toContainText(
    "نام به‌روز بیمار آزمون",
  );
  await navigate(page, "/fa/dashboard?view=notifications");
  await expect(page.locator(".patient-notification")).not.toHaveCount(0);
  await page
    .getByRole("button", { name: "خوانده شد", exact: true })
    .first()
    .click();
  await expect
    .poll(async () => {
      const notices = await api(page, "/api/patient/notifications");
      return notices.data.items.some(
        (n: { readAt: string | null }) => !!n.readAt,
      );
    })
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(page, "/en/dashboard?view=appointments");
  await expect(
    page.getByRole("heading", { name: "My appointments", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator(".account-trigger").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/login/);
  expect(await api(page, "/api/patient/summary")).toMatchObject({
    status: 401,
  });
  expect(
    (await page.context().cookies()).some((c) => c.name === "medical_session"),
  ).toBe(false);
  await pool.query(
    "update sessions set expires_at=now()-interval '1 minute' where token_hash=$1",
    [digest(other.token)],
  );
  await navigate(otherPage, "/fa/dashboard?view=history");
  await expect(otherPage).toHaveURL(/\/fa\/login\?next=/);
  expect((await api(otherPage, "/api/session")).data.user).toBeNull();
  await otherContext.close();
  await adminContext.close();
});
