import test from "node:test";
import assert from "node:assert/strict";
import { sendMelipayamak } from "../src/lib/melipayamak";

const config = {
  username: "test-user",
  password: "test-only-password",
  otpBodyId: "123",
};
test("OTP uses the approved pattern and sends only its variable", async () => {
  const transport: typeof fetch = async (url, options) => {
    assert.equal(
      url,
      "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber",
    );
    const body = options?.body as URLSearchParams;
    assert.equal(body.get("text"), "123456");
    assert.equal(body.get("bodyId"), "123");
    assert.equal(body.get("password"), config.password);
    assert.equal(options?.redirect, "error");
    return Response.json({ RetStatus: 1, Value: "987654321" });
  };
  assert.deepEqual(
    await sendMelipayamak("09123456789", "unused", config, "123456", transport),
    { id: "987654321" },
  );
});
test("HTTP 200 with a provider error is still a failed send", async () => {
  for (const result of [
    { RetStatus: 1, Value: "-1" },
    { RetStatus: 0, Value: "123" },
  ]) {
    await assert.rejects(
      sendMelipayamak("09123456789", "", config, "123456", async () =>
        Response.json(result),
      ),
      /SMS_DELIVERY_FAILED/,
    );
  }
});
test("provider errors cannot leak credentials and missing configuration cannot send", async () => {
  await assert.rejects(
    sendMelipayamak("09123456789", "", config, "123456", async () => {
      throw new Error(config.password);
    }),
    /^Error: SMS_DELIVERY_FAILED$/,
  );
  await assert.rejects(
    sendMelipayamak("09123456789", "", {}, "123456", async () => {
      throw new Error("must not send");
    }),
    /SMS_NOT_CONFIGURED/,
  );
});
