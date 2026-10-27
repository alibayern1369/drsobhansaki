import { formatJalali } from "./jalali";
export function appointmentConfirmationMessage(
  input: {
    startsAt: Date | string;
    type: string;
    trackingCode: string;
    siteUrl: string;
  },
  template?: string,
) {
  const origin = new URL(input.siteUrl).origin;
  const values = {
    doctor: "دکتر سبحان ساکی",
    type: input.type === "phone" ? "مشاوره تلفنی" : "مشاوره متنی",
    date: `${formatJalali(input.startsAt, true)} (تهران)`,
    tracking: input.trackingCode,
    panel: `${origin}/fa/dashboard`,
  };
  const source =
    template?.trim() ||
    "نوبت شما نزد {doctor} تأیید شد.\n{type}\n{date}\nکد پیگیری: {tracking}\nجزئیات و ارتباط با پزشک:\n{panel}";
  const rendered = source.replace(
    /\{(doctor|type|date|tracking|panel)\}/g,
    (_, key: keyof typeof values) => values[key],
  );
  const missing = (Object.keys(values) as (keyof typeof values)[])
    .filter((key) => !source.includes(`{${key}}`))
    .map((key) =>
      key === "tracking" ? `کد پیگیری: ${values[key]}` : values[key],
    );
  return [rendered, ...missing].join("\n");
}
