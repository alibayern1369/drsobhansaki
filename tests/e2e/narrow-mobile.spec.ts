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
    const floating = await page.locator(".consult-floating").boundingBox();
    const caption = await page.locator(".doctor-caption").boundingBox();
    expect(
      floating!.y + floating!.height + 12 <= caption!.y ||
        caption!.y + caption!.height + 12 <= floating!.y,
    ).toBeTruthy();
  }
});
