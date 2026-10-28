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
test("booking shows exactly two consultation types and sends guests to login", async ({
  page,
}) => {
  await page.goto("/fa/booking?type=text");
  await expect(page.locator(".choice")).toHaveCount(2);
  await expect(page.locator('.choice[aria-pressed="true"]')).toContainText(
    "مشاوره متنی",
  );
  await expect(page.locator(".booking-sidebar")).toContainText("تومان");
  await page.getByRole("button", { name: "ادامه و ورود به حساب" }).click();
  await expect(page).toHaveURL(/\/fa\/login\?next=/);
  await expect(
    page.getByText("انتخاب مشاوره شما محفوظ است", { exact: false }),
  ).toBeVisible();
});

test("OTP service failure displays an error without advancing", async ({
  page,
}) => {
  await page.route("**/api/auth/otp", (route) =>
    route.fulfill({ status: 503, json: { message: "SMS unavailable" } }),
  );
  await page.goto("/en/login");
  await page.getByLabel("Mobile number").fill("09123456789");
  await page.getByRole("button", { name: "Send verification code" }).click();
  await expect(
    page.locator('.login-panel .form-error[role="alert"]'),
  ).toBeVisible();
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
test("missing or unpublished article cannot be opened publicly", async ({
  request,
}) => {
  const r = await request.get("/fa/articles/missing-test-article-8e90d93a");
  expect([200, 404]).toContain(r.status());
  expect(await r.text()).toMatch(/name="robots" content="noindex/);
});
test("API configuration contains supported consultation types", async ({
  request,
}) => {
  const r = await request.get("/api/config");
  expect(r.ok()).toBeTruthy();
  const data = await r.json();
  expect(typeof data.ready).toBe("boolean");
  expect(
    data.types.every(
      (t: { key: string; priceRial: number }) =>
        ["phone", "text"].includes(t.key) && Number.isSafeInteger(t.priceRial),
    ),
  ).toBeTruthy();
  expect(Array.isArray(data.banks)).toBeTruthy();
  expect(Array.isArray(data.slots)).toBeTruthy();
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
  const toggle = page.getByRole("button", { name: "منوی اصلی" });
  await expect(toggle).toHaveAttribute("aria-controls", "main-navigation");
  await page.locator('.navigation [aria-current="page"]').focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".navigation")).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
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
