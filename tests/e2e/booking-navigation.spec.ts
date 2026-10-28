import { test, expect, type Page } from "@playwright/test";
const id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const config = {
  ready: true,
  types: [
    {
      id: "phone-type",
      key: "phone",
      priceRial: 7500000,
      durationMinutes: 20,
      enabled: true,
    },
  ],
  platforms: [],
  slots: [],
  banks: [],
  booking: { patientScheduling: true, doctorScheduling: true },
};
async function mockBooking(page: Page, paymentStatus = "awaiting_payment") {
  const appointment = {
    id,
    trackingCode: "LONG-TRACKING-CODE-1234567890",
    status:
      paymentStatus === "under_review"
        ? "awaiting_verification"
        : "awaiting_payment",
    paymentStatus,
    priceRial: 7500000,
    durationMinutes: 20,
    typeSnapshot: { key: "phone" },
    slotId: null,
    startsAt: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  };
  await page.route("**/api/config", (route) => route.fulfill({ json: config }));
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: { user: { id: "patient", role: "patient", name: "بیمار آزمایشی" } },
    }),
  );
  await page.route(`**/api/patient/appointments/${id}`, (route) =>
    route.fulfill({ json: { appointment } }),
  );
  await page.route(`**/api/appointments/${id}/receipts`, (route) =>
    route.fulfill({ json: [] }),
  );
}
test("time selection can return to consultation type and start over", async ({
  page,
}) => {
  await mockBooking(page);
  await page.goto("/fa/booking");
  await page.getByRole("button", { name: "ادامه و تعیین زمان" }).click();
  await expect(page.locator(".wizard-progress li.current")).toContainText(
    "انتخاب زمان نوبت",
  );
  await page.getByRole("button", { name: "بازگشت به نوع مشاوره" }).click();
  await expect(page.locator(".wizard-progress li.current")).toContainText(
    "انتخاب نوع مشاوره",
  );
  await page.getByRole("button", { name: "ادامه و تعیین زمان" }).click();
  await page.getByRole("button", { name: "شروع رزرو جدید از ابتدا" }).click();
  await expect(page.locator(".wizard-progress li.current")).toContainText(
    "انتخاب نوع مشاوره",
  );
  expect(
    await page.evaluate(() => sessionStorage.getItem("booking-draft-v2:fa")),
  ).toBeNull();
});
test("returning from payment releases the hold before changing time", async ({
  page,
}) => {
  await mockBooking(page);
  let released = 0;
  await page.route(`**/api/patient/appointments/${id}/release`, (route) => {
    released++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/fa/booking?appointment=${id}`);
  await page.getByRole("button", { name: "بازگشت و تغییر زمان نوبت" }).click();
  await expect(page.locator(".wizard-progress li.current")).toContainText(
    "انتخاب زمان نوبت",
  );
  expect(released).toBe(1);
  await expect(page).toHaveURL(/\/fa\/booking$/);
});
test("failed release keeps the current reservation and reports the error", async ({
  page,
}) => {
  await mockBooking(page);
  await page.route(`**/api/patient/appointments/${id}/release`, (route) =>
    route.fulfill({
      status: 409,
      json: { message: "این نوبت قابل آزادسازی نیست" },
    }),
  );
  await page.goto(`/fa/booking?appointment=${id}`);
  await page.getByRole("button", { name: "شروع رزرو جدید از ابتدا" }).click();
  await expect(page.locator(".booking-layout [role=alert]")).toContainText(
    "این نوبت قابل آزادسازی نیست",
  );
  await expect(page.locator(".wizard-progress li.current")).toContainText(
    "پرداخت و ارسال رسید",
  );
  await expect(page).toHaveURL(new RegExp(id));
});
test("reviewed receipt actions fit mobile and restart preserves submitted appointments", async ({
  page,
}) => {
  await mockBooking(page, "under_review");
  let released = 0;
  await page.route(`**/api/patient/appointments/${id}/release`, (route) => {
    released++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/fa/booking?appointment=${id}`);
  await expect(
    page.getByRole("heading", { name: "رسید شما برای بررسی ثبت شد" }),
  ).toBeVisible();
  for (const width of [360, 768, 1200]) {
    await page.setViewportSize({ width, height: 1000 });
    const metrics = await page.locator(".booking-layout").evaluate((layout) => {
      const buttons = Array.from(
        layout.querySelectorAll(
          ".booking-actions .button,.booking-dashboard-button",
        ),
      ).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          left: b.left,
          right: b.right,
          width: b.width,
          height: b.height,
        };
      });
      const sidebar = layout.querySelector(".booking-sidebar")!;
      return {
        buttons,
        viewport: innerWidth,
        bodyWidth: document.documentElement.scrollWidth,
        notice: getComputedStyle(sidebar.querySelector(".notice")!).fontSize,
        summary: getComputedStyle(sidebar.querySelector(".summary-line")!)
          .fontSize,
        paragraph: getComputedStyle(sidebar.querySelector("p")!).fontSize,
      };
    });
    expect(metrics.bodyWidth).toBeLessThanOrEqual(width);
    for (const b of metrics.buttons) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width + 1);
      expect(b.height).toBeGreaterThanOrEqual(48);
    }
    expect(metrics.notice).toBe("14px");
    expect(metrics.summary).toBe("14px");
    expect(metrics.paragraph).toBe("14px");
  }
  await page.getByRole("button", { name: "شروع رزرو جدید از ابتدا" }).click();
  await expect(page.locator(".wizard-progress li.current")).toContainText(
    "انتخاب نوع مشاوره",
  );
  expect(released).toBe(0);
});
