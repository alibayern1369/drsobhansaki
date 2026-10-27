// Retry a lost connection once for reads or JSON writes with a server idempotency key.
// HTTP errors, OTP sends and unkeyed mutations are never replayed automatically.
export async function patientFetch(url: string, init?: RequestInit) {
  const method = (init?.method || "GET").toUpperCase();
  let retryable = method === "GET" || method === "HEAD";
  if (typeof init?.body === "string") {
    try {
      retryable ||= /^[a-f\d-]{36}$/i.test(
        JSON.parse(init.body).idempotencyKey || "",
      );
    } catch {}
  }
  try {
    return await fetch(url, init);
  } catch (error) {
    if (!retryable || !(error instanceof TypeError) || init?.signal?.aborted)
      throw error;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return fetch(url, init);
  }
}
