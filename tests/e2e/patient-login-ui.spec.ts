import { test, expect } from "@playwright/test";

test("mobile login has no public chrome and collects a new patient's name after OTP", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/auth/otp", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/auth/verify", (route) =>
    route.fulfill({ json: { ok: true, profileRequired: true } }),
  );
  await page.route("**/api/patient/profile", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.goto("/fa/login?next=/fa/booking");
  await expect(page.locator(".header")).toHaveCount(0);
  await expect(page.locator(".footer")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "بازگشت به سایت" }),
  ).toHaveAttribute("href", "/fa");
  await page.getByLabel("شماره همراه", { exact: true }).fill("۰۹۱۲۳۴۵۶۷۸۹");
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await expect(page.locator("bdi")).toHaveText("0912 345 6789");
  await expect(page.locator("bdi")).toHaveAttribute("dir", "ltr");
  await page.getByLabel("کد تأیید شش‌رقمی").fill("123456");
  await page.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(page.getByLabel("نام و نام خانوادگی")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ذخیره و ادامه" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("نام و نام خانوادگی").fill("علی محمدی");
  const saved = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/patient/profile") &&
      request.method() === "PUT",
  );
  await page.getByRole("button", { name: "ذخیره و ادامه" }).click();
  expect((await saved).postDataJSON()).toEqual({
    name: "علی محمدی",
    locale: "fa",
  });
});
