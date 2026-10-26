import { test, expect } from "@playwright/test";
test.setTimeout(60000);

test("administrator login has no public header or footer; public pages keep navigation", async ({
  page,
}) => {
  await page.goto("/fa/admin");
  await expect(page.locator("#admin-username")).toBeVisible();
  await expect(page.locator("header.header")).toHaveCount(0);
  await expect(page.locator("footer.footer")).toHaveCount(0);
  await page.goto("/fa");
  await expect(page.locator("header.header")).toBeVisible();
  await expect(page.locator("footer.footer")).toHaveCount(1);
});

test.describe("authenticated administration", () => {
  test.skip(
    !process.env.ADMIN_E2E_USERNAME || !process.env.ADMIN_E2E_PASSWORD,
    "Provide administrator test credentials locally",
  );
  test.beforeEach(async ({ request, context, baseURL }) => {
    const login = await request.post("/api/admin-access/login", {
      headers: { Origin: process.env.ADMIN_E2E_ORIGIN || baseURL! },
      data: {
        username: process.env.ADMIN_E2E_USERNAME,
        password: process.env.ADMIN_E2E_PASSWORD,
      },
    });
    expect(login.status()).toBe(200);
    await context.addCookies((await request.storageState()).cookies);
  });
  test.afterEach(async ({ request, baseURL }) => {
    await request.post("/api/auth/logout", {
      headers: { Origin: process.env.ADMIN_E2E_ORIGIN || baseURL! },
      data: {},
    });
  });

  test("all real admin menus load without raw JSON or browser errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const failed: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/admin") && response.status() >= 400)
        failed.push(`${response.status()} ${response.url()}`);
    });
    await page.goto("/fa/admin");
    await expect(page.locator(".dashboard-nav")).toBeVisible();
    await expect(
      page.getByText("در حال دریافت اطلاعات…", { exact: true }),
    ).toHaveCount(0);
    for (const tab of [
      "overview",
      "appointments",
      "patients",
      "appointment-requests",
      "consultations",
      "banks",
      "calendar",
      "platforms",
      "sms",
      "articles",
      "content",
      "branding",
      "contact",
      "policies",
      "seo",
      "roles",
      "audit",
      "settings",
      "receipt-storage",
      "security-login",
    ]) {
      await page.locator(`.dashboard-nav > a[href="#${tab}"]`).click();
      await expect(page.locator(".dashboard-title h1")).toBeVisible();
      await expect(
        page.getByText("در حال دریافت اطلاعات…", { exact: true }),
      ).toHaveCount(0);
      await expect(page.locator("#json-editor,pre.data-preview")).toHaveCount(
        0,
      );
    }
    await page.locator('.dashboard-nav > a[href="#branding"]').click();
    await expect(page.locator('input[type="file"]')).toHaveCount(7);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });

  test("settings, photo upload and Persian card entry send form values without mutating live content", async ({
    page,
  }) => {
    const submitted: Array<{ url: string; body: Record<string, unknown> }> = [];
    const removed: string[] = [];
    const uploadedUrl =
      "/api/site-images/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.png";
    await page.route("**/api/site-images/**", (route) =>
      route.fulfill({ path: "public/images/doctor.jpg" }),
    );
    await page.route("**/api/admin/**", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET") {
        if (url.pathname.endsWith("/site-images")) {
          if (route.request().method() === "DELETE") {
            removed.push(url.searchParams.get("id")!);
            await route.fulfill({ json: { ok: true } });
            return;
          }
          await route.fulfill({
            status: 201,
            json: { url: uploadedUrl },
          });
          return;
        }
        submitted.push({
          url: url.pathname,
          body: route.request().postDataJSON(),
        });
        await route.fulfill({ json: { ok: true } });
        return;
      }
      if (url.pathname.endsWith("/overview")) {
        await route.fulfill({
          json: {
            role: "super_admin",
            currentUserId: "owner",
            appointments: [],
            consultations: [],
            platforms: [],
            settings: [],
            content: [],
            articles: [],
            audit: [],
          },
        });
        return;
      }
      if (url.pathname.endsWith("/banks")) {
        await route.fulfill({ json: [] });
        return;
      }
      await route.continue();
    });
    await page.goto("/fa/admin");
    await page.locator('a[href="#branding"]').click();
    await page
      .locator("#upload-doctorImageUrl")
      .setInputFiles("public/images/doctor.jpg");
    await expect(page.locator("#image-doctorImageUrl")).toHaveValue(
      uploadedUrl,
    );
    await page
      .locator("fieldset")
      .filter({ has: page.locator("#upload-doctorImageUrl") })
      .getByRole("button", { name: "بازگشت به تصویر پیش‌فرض" })
      .click();
    await expect(page.locator("#image-doctorImageUrl")).toHaveValue("");
    expect(removed).toEqual(["aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.png"]);
    await page
      .locator("#upload-doctorImageUrl")
      .setInputFiles("public/images/doctor.jpg");
    await expect(page.locator("#image-doctorImageUrl")).toHaveValue(
      uploadedUrl,
    );
    await page
      .locator(
        '.admin-settings-form button[type="submit"],.admin-settings-form > button',
      )
      .last()
      .click();
    await expect.poll(() => submitted.length).toBe(1);
    expect(
      (submitted[0].body.value as Record<string, string>).doctorImageUrl,
    ).toBe(uploadedUrl);
    await page.locator('a[href="#content"]').click();
    await page.locator("#content-hero1").fill("متن آزمایشی");
    await page.getByLabel("انتشار این زبان روی سایت").check();
    await page.locator(".admin-settings-form > button").click();
    await expect.poll(() => submitted.length).toBe(2);
    expect((submitted[1].body.value as Record<string, string>).hero1).toBe(
      "متن آزمایشی",
    );
    expect(submitted[1].body.published).toBe(true);
    await page.locator('a[href="#banks"]').click();
    await page.locator('[name="bankName"]').fill("بانک آزمایشی");
    await page.locator('[name="holderName"]').fill("کاربر آزمایشی");
    await page.locator('[name="cardNumber"]').fill("۶۰۳۷-۹۹۱۲-۳۴۵۶-۷۸۹۰");
    await page.getByRole("button", { name: "ذخیره حساب", exact: true }).click();
    await expect.poll(() => submitted.length).toBe(3);
    expect(submitted[2].body.cardNumber).toBe("6037991234567890");
  });
});
