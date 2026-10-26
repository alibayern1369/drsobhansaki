import { test, expect } from "@playwright/test";
test.setTimeout(90000);
test("Persian prices, Jalali calendar and separate staff list", async ({
  page,
  request,
  context,
  baseURL,
}) => {
  test.skip(
    !process.env.ADMIN_E2E_USERNAME || !process.env.ADMIN_E2E_PASSWORD,
    "Local administrator credentials required",
  );
  const origin = process.env.ADMIN_E2E_ORIGIN || baseURL!;
  const login = await request.post("/api/admin-access/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.ADMIN_E2E_USERNAME,
      password: process.env.ADMIN_E2E_PASSWORD,
    },
  });
  expect(login.status()).toBe(200);
  await context.addCookies((await request.storageState()).cookies);
  try {
    const staff = await request.get("/api/admin/roles");
    expect(staff.ok()).toBeTruthy();
    expect(
      (await staff.json()).every((r: { role: string }) => r.role !== "patient"),
    ).toBeTruthy();
    const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
    await page.route("**/api/admin/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.continue();
        return;
      }
      writes.push({
        path: new URL(route.request().url()).pathname,
        data: route.request().postDataJSON(),
      });
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto("/fa/admin");
    await expect(page.locator(".dashboard-nav")).toBeVisible();
    await page.locator('.dashboard-nav > a[href="#consultations"]').click();
    const fee = page.locator(".fee-editor").first();
    await expect(fee).toBeVisible();
    await fee.locator('[name="price"]').fill("۳۰۰٬۰۰۰");
    await fee.locator('[name="duration"]').fill("۲۰");
    await fee.locator('[name="buffer"]').fill("۵");
    await fee.getByRole("button", { name: "ذخیره تعرفه" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].data.priceRial).toBe(3000000);
    expect(writes[0].data.durationMinutes).toBe(20);
    expect(writes[0].data.bufferMinutes).toBe(5);
    await page.locator('.dashboard-nav > a[href="#calendar"]').click();
    await expect(page.locator("#batch-date")).toBeVisible();
    await expect(
      page.locator('input[type="date"],input[type="datetime-local"]'),
    ).toHaveCount(0);
    await page.locator("#batch-date").click();
    const calendar = page.getByRole("dialog", { name: "تقویم هجری شمسی" });
    await expect(calendar).toBeVisible();
    await calendar.getByLabel("سال شمسی").selectOption("1405");
    await calendar.getByLabel("ماه شمسی").selectOption("1");
    await calendar
      .getByRole("button", { name: "۱ فروردین ۱۴۰۵", exact: true })
      .click();
    await expect(page.locator("#batch-date")).toHaveValue("۱ فروردین ۱۴۰۵");
    await page.locator("#batch-start").fill("۰۹:۰۰");
    await page.locator("#batch-end").fill("۱۰:۰۰");
    await page.getByRole("button", { name: "ساخت زمان‌های قابل رزرو" }).click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].data.date).toBe("2026-03-21");
    expect(writes[1].data.startTime).toBe("09:00");
    expect(writes[1].data.endTime).toBe("10:00");
    await page.locator("#slot-start").click();
    await page
      .getByRole("dialog", { name: "تقویم هجری شمسی" })
      .getByRole("button", { name: "امروز", exact: true })
      .click();
    await page.locator("#slot-start").click();
    await page.locator("#slot-start-time").fill("۲۴:۰۰");
    expect(
      await page
        .locator("#slot-start")
        .evaluate((el: HTMLInputElement) => el.validity.customError),
    ).toBeTruthy();
    await page.locator("#slot-start-time").fill("۱۲:۳۰");
    expect(
      await page
        .locator("#slot-start")
        .evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBeTruthy();
    await page.locator("#slot-start-time").press("Escape");
    await expect(page.locator("#slot-start")).toHaveValue(/۱۲:۳۰/);
    await page.locator('.dashboard-nav > a[href="#contact"]').click();
    await expect(
      page.getByLabel("نمایش نشانی مطب", { exact: false }),
    ).not.toBeChecked();
    await page.locator('.dashboard-nav > a[href="#seo"]').click();
    await expect(
      page.getByLabel("کد Google Search Console", { exact: false }),
    ).toBeVisible();
    const overview = await (await request.get("/api/admin/overview")).json();
    const receiptId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    overview.appointments = [
      {
        id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        trackingCode: "TEST-RECEIPT",
        status: "awaiting_verification",
        paymentStatus: "under_review",
        priceRial: 3000000,
        consultationTypeId: overview.consultations[0].id,
        patientName: "نمونه آزمایشی",
        patientPhone: "09120000000",
      },
    ];
    await page.route("**/api/admin/overview", (route) =>
      route.fulfill({ json: overview }),
    );
    await page.route("**/api/admin/payment-details/**", (route) =>
      route.fulfill({
        json: [
          {
            id: receiptId,
            mimeType: "image/jpeg",
            scanStatus: "signature_verified_not_malware_scanned",
            retentionHold: false,
            legalRetentionHold: false,
            disputeActive: false,
            legalRetentionUntil: null,
          },
        ],
      }),
    );
    await page.route(`**/api/receipts/${receiptId}/download?view=1`, (route) =>
      route.fulfill({
        path: "public/images/doctor.jpg",
        contentType: "image/jpeg",
      }),
    );
    await page.reload();
    await page.locator('.dashboard-nav > a[href="#appointments"]').click();
    await page.getByRole("button", { name: "رسیدها و زمان‌بندی" }).click();
    await expect(page.locator(".receipt-preview")).toBeVisible();
    await expect(page.locator(".receipt-preview")).toHaveAttribute(
      "src",
      `/api/receipts/${receiptId}/download?view=1`,
    );
    await expect(
      page.getByRole("link", { name: "مشاهده رسید در اندازه کامل" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  } finally {
    await request.post("/api/auth/logout", {
      headers: { Origin: origin },
      data: {},
    });
  }
});
test("public images, articles, legal pages and private receipt protection", async ({
  page,
  request,
}) => {
  await page.goto("/fa");
  await expect(page.locator(".photo-label")).toHaveCount(0);
  const floating = await page.locator(".consult-floating").boundingBox();
  const caption = await page.locator(".doctor-caption").boundingBox();
  if (floating && caption)
    expect(floating.y + floating.height).toBeLessThan(caption.y);
  await page.goto("/fa/contact");
  await expect(page.getByText("نشانی مطب", { exact: true })).toHaveCount(0);
  await page.goto("/fa/articles/workplace-heat-stress-prevention");
  await expect(page.locator(".article-cover")).toBeVisible();
  await expect(page.locator(".article-content h2")).toHaveCount(7);
  await expect(page.locator('a[href*="who.int"]').first()).toBeVisible();
  await page.goto("/fa/privacy");
  expect(await page.locator(".article-content").innerText()).toContain("کوکی");
  await page.goto("/fa/terms");
  expect(await page.locator(".article-content").innerText()).toContain(
    "استرداد",
  );
  const sitemap = await request.get("/sitemap.xml");
  const xml = await sitemap.text();
  expect(xml).toContain("/fa/articles/workplace-heat-stress-prevention");
  expect(xml).not.toContain("localhost");
  const receipt = await request.get(
    "/api/receipts/11111111-1111-4111-8111-111111111111/download?view=1",
  );
  expect(receipt.status()).toBe(401);
});
