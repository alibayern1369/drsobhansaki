import { test, expect } from "@playwright/test";
test("320px phone has no overflow in either language", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const locale of ["fa", "en"]) {
    await page.goto(`/${locale}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
