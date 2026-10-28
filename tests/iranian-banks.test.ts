import { test } from "node:test";
import assert from "node:assert/strict";
import { iranianBanks, findIranianBank } from "../src/lib/iranian-banks";
test("bank identities resolve existing names with or without bank prefix", () => {
  for (const bank of iranianBanks) {
    assert.equal(findIranianBank(bank.name)?.id, bank.id);
    assert.equal(findIranianBank(bank.name.replace("بانک ", ""))?.id, bank.id);
  }
  assert.equal(findIranianBank("بانک سفارشی"), undefined);
});
test("each bank has a unique bundled logo position and valid brand color", () => {
  assert.equal(
    new Set(iranianBanks.map((b) => b.id)).size,
    iranianBanks.length,
  );
  assert.equal(
    new Set(iranianBanks.map((b) => b.logo)).size,
    iranianBanks.length,
  );
  for (const bank of iranianBanks) {
    assert.match(bank.color, /^#[0-9a-f]{6}$/);
    assert.ok(bank.logo >= 0 && bank.logo < 35);
    assert.ok(!bank.name.includes("?"));
  }
});

test("Blu aliases select its own brand rather than the parent bank", () => {
  for (const name of [
    "بلوبانک",
    "بلو بانک",
    "بلو",
    "بانک بلو",
    "blu",
    "BLUBANK",
  ]) {
    assert.equal(findIranianBank(name)?.id, "blu");
  }
  assert.equal(findIranianBank("بانک سامان")?.id, "sb");
});
