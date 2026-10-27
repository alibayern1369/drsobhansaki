import { test, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 15000 });
test.setTimeout(90000);
test("OTP login resumes the selected consultation and preserves the reviewed price", async ({
  page,
}) => {
  let loggedIn = false;
  const types = [
    {
      id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      key: "phone",
      priceRial: 7500000,
      durationMinutes: 20,
      enabled: true,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
      key: "text",
      priceRial: 5000000,
      durationMinutes: 20,
      enabled: true,
    },
  ];
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ready: true,
        types,
        platforms: [
          { id: "cccccccc-cccc-4ccc-cccc-cccccccccccc", key: "telegram" },
        ],
        slots: [
          {
            id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
            consultationTypeId: types[1].id,
            startsAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
        booking: { patientScheduling: true, doctorScheduling: true },
      },
    }),
  );
  await page.route("**/api/session", (r) =>
    r.fulfill({
      json: {
        user: loggedIn
          ? {
              id: "patient",
              role: "patient",
              phone: "09123456789",
              name: "بیمار آزمون رابط",
            }
          : null,
      },
    }),
  );
  await page.route("**/api/auth/otp", (r) => r.fulfill({ json: { ok: true } }));
  await page.route("**/api/auth/verify", (r) => {
    loggedIn = true;
    return r.fulfill({ json: { ok: true } });
  });
  await page.goto("/fa/booking");
  await expect(page.locator(".choice")).toHaveCount(2);
  await page.locator(".choice").filter({ hasText: "مشاوره متنی" }).click();
  await expect(page.locator(".booking-sidebar")).toContainText("۵۰۰٬۰۰۰");
  await page.getByRole("button", { name: "ادامه و ورود به حساب" }).click();
  await expect(page).toHaveURL(/\/fa\/login\?next=/);
  await page.locator("#login-phone").fill("09123456789");
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await page.locator("#otp-code").fill("123456");
  await page.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(page).toHaveURL(/booking\?resume=1/);
  await expect(page.locator(".live-booking-form")).toBeVisible();
  await expect(page.locator(".booking-sidebar")).toContainText("مشاوره متنی");
  await page.locator("#booking-platform").selectOption("telegram");
  await expect(page.locator(".wizard-progress .current")).toContainText(
    "انتخاب زمان نوبت",
  );
  await page.reload();
  await expect(page.locator("#booking-platform")).toHaveValue("telegram");
  await expect(page.locator(".booking-calendar")).toBeVisible();
});
