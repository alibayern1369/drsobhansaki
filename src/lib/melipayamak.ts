type Configuration = {
  username?: string;
  password?: string;
  from?: string;
  otpBodyId?: string;
};

export async function sendMelipayamak(
  phone: string,
  message: string,
  config: Configuration,
  otpCode?: string,
  transport: typeof fetch = fetch,
  reportUnknownOutcome = false,
) {
  if (!config.username || !config.password)
    throw new Error("SMS_NOT_CONFIGURED");
  const pattern = otpCode !== undefined;
  if (pattern ? !/^\d+$/.test(config.otpBodyId || "") : !config.from)
    throw new Error("SMS_NOT_CONFIGURED");
  const body = new URLSearchParams({
    username: config.username,
    password: config.password,
    to: phone,
    text: pattern ? otpCode! : message,
    ...(pattern
      ? { bodyId: config.otpBodyId! }
      : { from: config.from!, isFlash: "false" }),
  });
  try {
    const response = await transport(
      `https://rest.payamak-panel.com/api/SendSMS/${pattern ? "BaseServiceNumber" : "SendSMS"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error(
        reportUnknownOutcome && response.status >= 500
          ? "SMS_DELIVERY_OUTCOME_UNKNOWN"
          : "SMS_DELIVERY_FAILED",
      );
    const result = await response.json();
    const id = String(result.Value ?? "");
    if (Number(result.RetStatus) !== 1 || !/^[1-9]\d*$/.test(id))
      throw new Error("SMS_DELIVERY_FAILED");
    return { id };
  } catch (error) {
    const knownFailure =
      error instanceof Error && error.message === "SMS_DELIVERY_FAILED";
    throw new Error(
      reportUnknownOutcome && !knownFailure
        ? "SMS_DELIVERY_OUTCOME_UNKNOWN"
        : "SMS_DELIVERY_FAILED",
    );
  }
}
