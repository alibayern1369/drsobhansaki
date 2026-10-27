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
        slots: [],
        booking: { doctorScheduling: true },
      },
    }),
  );
  await page.route("**/api/session", (r) =>
    r.fulfill({
      json: { user: loggedIn ? { id: "patient", role: "patient" } : null },
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
  await page.locator("#confirmed-scheduling").selectOption("doctor");
  await page.reload();
  await expect(page.locator("#booking-platform")).toHaveValue("telegram");
  await expect(page.locator("#confirmed-scheduling")).toHaveValue("doctor");
});
test("test patient completes phone and text bookings without OTP or real transfers", async ({
  page,
  request,
  baseURL,
}) => {
  test.skip(
    !process.env.TEST_PATIENT_USERNAME || !process.env.TEST_PATIENT_PASSWORD,
    "Configure the isolated test patient",
  );
  for (const type of ["phone", "text"]) {
    await page.goto(`/fa/booking?type=${type}`);
    await expect(page.locator('.choice[aria-pressed="true"]')).toContainText(
      type === "phone" ? "تلفنی" : "متنی",
    );
    await page
      .getByRole("button", {
        name: type === "phone" ? "ادامه و ورود به حساب" : "ادامه و تعیین زمان",
      })
      .click();
    if (type === "phone") {
      await page
        .getByRole("button", { name: "ورود آزمایشی با گذرواژه" })
        .click();
      await page
        .locator("#test-username")
        .fill(process.env.TEST_PATIENT_USERNAME!);
      await page
        .locator("#test-password")
        .fill(process.env.TEST_PATIENT_PASSWORD!);
      await page.getByRole("button", { name: "تأیید و ورود" }).click();
    }
    await expect(page.locator(".live-booking-form")).toBeVisible({
      timeout: 15000,
    });
    if (type === "text")
      await page.locator("#booking-platform").selectOption({ index: 1 });
    await page.locator("#confirmed-scheduling").selectOption("doctor");
    await page.locator('.live-booking-form input[type="checkbox"]').check();
    const creation = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/appointments" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "ثبت درخواست و ادامه پرداخت" })
      .click();
    const created = await creation;
    expect(created.ok(), await created.text()).toBeTruthy();
    await expect(page).toHaveURL(/dashboard\?appointment=/);
    const id = new URL(page.url()).searchParams.get("appointment")!;
    const rows = await (await page.request.get("/api/appointments")).json();
    const tracking = rows.find(
      (row: { id: string }) => row.id === id,
    ).trackingCode;
    const card = page
      .locator(".content-panel")
      .filter({ has: page.locator(`#test-receipt-${id}`) });
    expect(
      (await page.request.get(`/api/appointments/${id}/contact`)).status(),
    ).toBe(403);
    await card
      .locator('input[type="file"]')
      .setInputFiles("public/images/doctor.jpg");
    await card.getByRole("button", { name: "ثبت رسید آزمایشی" }).click();
    const pending = page
      .locator(".content-panel")
      .filter({ hasText: tracking });
    const paid = page.locator(".content-panel").filter({ hasText: tracking });
    await page.route(`**/api/appointments/${id}/contact`, (r) =>
      r.fulfill({
        json: {
          channels: [{ key: "telegram", url: "https://t.me/test_doctor" }],
        },
      }),
    );
    await pending
      .getByRole("button", { name: "شبیه‌سازی تأیید پرداخت و زمان" })
      .click();
    await expect(paid).toContainText("پرداخت تأییدشده");
    await expect(
      paid.getByRole("link", { name: "ورود به چت تلگرام" }),
    ).toHaveAttribute("href", "https://t.me/test_doctor");
  }
  const storage = await page.context().storageState();
  await request.storageState();
  const cookies = storage.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const denied = await request.get("/api/admin/overview", {
    headers: { Cookie: cookies },
  });
  expect(denied.status()).toBe(403);
  await request.post("/api/auth/logout", {
    headers: { Origin: baseURL!, Cookie: cookies },
    data: {},
  });
});
