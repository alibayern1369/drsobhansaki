import test from "node:test";
import assert from "node:assert/strict";
import { validateSiteSettings } from "../src/lib/site-settings";
import { normalizeDigits } from "../src/lib/admin-labels";
import { siteAsset } from "../src/lib/site-assets";

test("website settings reject script URLs, invalid colors and enabled booking with no scheduling method", () => {
  assert.throws(() =>
    validateSiteSettings("branding", { logoUrl: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    validateSiteSettings("branding", {
      doctorImageUrl: "//external.example/image",
    }),
  );
  assert.throws(() =>
    validateSiteSettings("branding", {
      primaryColor: "red; background:url(x)",
    }),
  );
  assert.throws(() =>
    validateSiteSettings("booking", {
      enabled: true,
      patientScheduling: false,
      doctorScheduling: false,
    }),
  );
  assert.doesNotThrow(() =>
    validateSiteSettings("branding", {
      doctorImageUrl: "/api/site-images/example.png",
      primaryColor: "#123abc",
    }),
  );
  assert.equal(siteAsset("javascript:alert(1)", "/fallback"), "/fallback");
  assert.equal(siteAsset("//external.example/image", "/fallback"), "/fallback");
});
test("Persian and Arabic card digits normalize without losing leading zeroes", () => {
  assert.equal(normalizeDigits("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩"), "01234567890123456789");
});
test("footer social settings are a separate validated group", () => {
  assert.throws(() =>
    validateSiteSettings("social", { telegram: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    validateSiteSettings("social", { instagram: "http://example.com" }),
  );
  const result = validateSiteSettings("social", {
    telegram: "https://t.me/public_profile",
    phone: "09123456789",
  });
  assert.deepEqual(result, {
    telegram: "https://t.me/public_profile",
    phone: "09123456789",
  });
});
