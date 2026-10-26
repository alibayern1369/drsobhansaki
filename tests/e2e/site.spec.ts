import { test, expect } from "@playwright/test";
test("Persian homepage uses RTL and renders the real design", async ({
  page,
}) => {
  await page.goto("/fa");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "حال خوب شما",
  );
  await expect(page.locator(".services-section .service-card")).toHaveCount(6);
  await expect(page.locator(".doctor-photo img")).toBeVisible();
});
test("English homepage uses LTR and language switch preserves page", async ({
  page,
}) => {
  await page.goto("/en/about");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".language").click();
  await expect(page).toHaveURL(/\/fa\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "درباره پزشک",
  );
});
test("FAQ opens and closes accessibly", async ({ page }) => {
  await page.goto("/fa");
  const details = page.locator("details").nth(1);
  await expect(details).not.toHaveAttribute("open");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
});
test("booking allows text, platform selection and request review", async ({
  page,
}) => {
  await page.goto("/fa/booking?type=text");
  await expect(
    page.getByRole("button", { name: "مشاوره متنی" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("پیام‌رسان ترجیحی").selectOption("telegram");
  await page.getByLabel("نام و نام خانوادگی").fill("کاربر آزمایشی");
  await page.getByLabel("شماره همراه", { exact: true }).fill("09123456789");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ادامه و بررسی درخواست" }).click();
  await expect(
    page.getByRole("heading", { name: "بررسی درخواست مشاوره" }),
  ).toBeVisible();
  await expect(
    page.getByText("رزرو هنوز ثبت نشده است.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ویرایش اطلاعات" }).click();
  await expect(page.getByLabel("نام و نام خانوادگی")).toHaveValue(
    "کاربر آزمایشی",
  );
});
test("unconfigured OTP displays a real service error", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel("Mobile number").fill("09123456789");
  await page.getByRole("button", { name: "Send verification code" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("#otp-code")).toHaveCount(0);
});
test("private dashboard and admin require sign in", async ({ page }) => {
  for (const path of ["/fa/admin", "/fa/dashboard"]) {
    await page.goto(path);
    await expect(
      page.getByLabel(path.endsWith("/admin") ? "نام کاربری" : "شماره همراه"),
    ).toBeVisible();
    await expect(page.getByText("وضعیت پرداخت", { exact: true })).toHaveCount(
      0,
    );
  }
});
test("unreviewed article cannot be opened publicly", async ({ request }) => {
  const r = await request.get("/fa/articles/blood-sugar");
  expect(r.status()).toBe(404);
});
test("API configuration has no fake banks or appointment slots", async ({
  request,
}) => {
  const r = await request.get("/api/config");
  expect(r.ok()).toBeTruthy();
  expect(await r.json()).toMatchObject({ ready: false, banks: [], slots: [] });
});
test("public service pages exist in both languages", async ({ page }) => {
  for (const locale of ["fa", "en"])
    for (const slug of [
      "blood-sugar",
      "blood-pressure",
      "cholesterol",
      "thyroid",
      "fatty-liver",
      "occupational",
    ]) {
      const r = await page.goto(`/${locale}/services/${slug}`);
      expect(r?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
});
test("mobile menu opens and layout does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fa");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "منوی اصلی" }).click();
  await expect(page.locator(".navigation")).toBeVisible();
  await page.locator(".navigation").getByText("خدمات پزشکی").click();
  await expect(page).toHaveURL(/\/fa\/services$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("SEO metadata and sitemap are localized", async ({ page, request }) => {
  await page.goto("/en/services/thyroid");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/en\/services\/thyroid$/,
  );
  await expect(page.locator('link[hreflang="fa"]')).toHaveAttribute(
    "href",
    /\/fa\/services\/thyroid$/,
  );
  const r = await request.get("/sitemap.xml");
  expect(await r.text()).toContain("/fa/services/thyroid");
});
test("security headers and scheduled jobs access are protected", async ({
  request,
}) => {
  const r = await request.get("/fa");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  expect(r.headers()["content-security-policy"]).toContain("object-src 'none'");
  const job = await request.get("/api/jobs");
  expect(job.status()).toBe(401);
});
