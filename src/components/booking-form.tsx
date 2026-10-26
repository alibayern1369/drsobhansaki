"use client";
import { JalaliDatePicker } from "./jalali-date-picker";
import { useState } from "react";
import Link from "next/link";
import { copy, services, type Locale } from "@/lib/content";
import { Icon } from "./icon";
import { LiveBooking } from "./live-booking";
export function BookingForm({
  locale,
  initialType = "phone",
}: {
  locale: Locale;
  initialType?: string;
}) {
  const fa = locale === "fa";
  const t = copy[locale];
  const [type, setType] = useState(initialType === "text" ? "text" : "phone");
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState("");
  const [schedule, setSchedule] = useState("assigned");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  function next(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (type === "text" && !platform) {
      setError(
        fa ? "یک پیام‌رسان انتخاب کنید." : "Choose a messaging platform.",
      );
      return;
    }
    if (!consent) {
      setError(
        fa
          ? "برای ادامه، شرایط و حریم خصوصی را بپذیرید."
          : "Please accept the terms and privacy notice.",
      );
      return;
    }
    setStep(2);
  }
  return (
    <>
      <div className="booking-progress">
        {(fa
          ? ["انتخاب مشاوره", "بررسی درخواست", "ورود و ثبت نهایی"]
          : ["Consultation", "Review request", "Sign in & confirm"]
        ).map((v, i) => (
          <span className={step === i + 1 ? "current" : ""} key={v}>
            <b>{i + 1}</b>
            {v}
            {i < 2 && <Icon name={fa ? "left" : "right"} size={14} />}
          </span>
        ))}
      </div>
      <div className="form-layout">
        <div className="form-panel">
          {step === 1 ? (
            <form onSubmit={next}>
              <h2>
                {fa ? "چطور می‌توانیم همراهتان باشیم؟" : "How can we help you?"}
              </h2>
              <div className="choice-grid">
                {(["phone", "text"] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    className={`choice ${type === v ? "selected" : ""}`}
                    onClick={() => setType(v)}
                    aria-pressed={type === v}
                  >
                    <Icon
                      name={v === "phone" ? "phone" : "message"}
                      size={26}
                    />
                    <div>
                      <strong>{v === "phone" ? t.phone : t.text}</strong>
                      <span>
                        {v === "phone"
                          ? fa
                            ? "گفت‌وگوی مستقیم با پزشک"
                            : "Talk directly to the doctor"
                          : fa
                            ? "ارسال پیام و مدارک"
                            : "Share messages and documents"}
                      </span>
                    </div>
                    {type === v && <Icon name="check" size={16} />}
                  </button>
                ))}
              </div>
              {type === "text" && (
                <>
                  <div className="field">
                    <label htmlFor="platform">
                      {fa ? "پیام‌رسان ترجیحی" : "Preferred messaging platform"}
                    </label>
                    <select
                      id="platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      required
                    >
                      <option value="">
                        {fa ? "انتخاب کنید" : "Select a platform"}
                      </option>
                      <option value="whatsapp">
                        {fa ? "واتساپ" : "WhatsApp"}
                      </option>
                      <option value="telegram">
                        {fa ? "تلگرام" : "Telegram"}
                      </option>
                      <option value="bale">{fa ? "بله" : "Bale"}</option>
                    </select>
                    <small>
                      {fa
                        ? "گزینه‌های نمایشی؛ فعال‌سازی نهایی توسط پزشک انجام می‌شود."
                        : "Preview options. Final availability is set by the doctor."}
                    </small>
                  </div>
                  <div className="notice">
                    {fa
                      ? "مشاوره متنی از پیام‌رسان خارجی استفاده می‌کند. سیاست‌های حریم خصوصی همان سرویس نیز اعمال می‌شود."
                      : "Text consultations use an external messaging service whose privacy policy also applies."}
                  </div>
                </>
              )}
              <div className="two-cols" style={{ marginTop: 20 }}>
                <div className="field">
                  <label htmlFor="full-name">
                    {fa ? "نام و نام خانوادگی" : "Full name"}
                  </label>
                  <input
                    id="full-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={3}
                    maxLength={100}
                    autoComplete="name"
                    placeholder={fa ? "نام کامل شما" : "Your full name"}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mobile">
                    {fa ? "شماره همراه" : "Mobile number"}
                  </label>
                  <input
                    id="mobile"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    type="tel"
                    required
                    pattern="09[0-9]{9}"
                    placeholder="09xxxxxxxxx"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="service">
                  {fa
                    ? "موضوع مشاوره (اختیاری)"
                    : "Consultation topic (optional)"}
                </label>
                <select id="service">
                  <option value="">
                    {fa ? "مشاوره عمومی" : "General consultation"}
                  </option>
                  {services.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s[locale]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="schedule">
                  {fa ? "روش تعیین زمان" : "Scheduling preference"}
                </label>
                <select
                  id="schedule"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                >
                  <option value="assigned">
                    {fa
                      ? "تعیین زمان توسط پزشک پس از تأیید پرداخت"
                      : "Doctor assigns a time after payment verification"}
                  </option>
                  <option value="preferred">
                    {fa ? "پیشنهاد تاریخ دلخواه" : "Request a preferred date"}
                  </option>
                </select>
              </div>
              {schedule === "preferred" && (
                <div className="field">
                  <label htmlFor="date">
                    {fa
                      ? "تاریخ پیشنهادی (قطعی نیست)"
                      : "Preferred date (not confirmed)"}
                  </label>
                  <JalaliDatePicker
                    id="date"
                    value={date}
                    onChange={setDate}
                    min={new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Asia/Tehran",
                    }).format(new Date())}
                    required
                  />
                  <small>{t.availabilityDesc}</small>
                </div>
              )}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  {fa
                    ? "شرایط مشاوره و سیاست حریم خصوصی را مطالعه کرده‌ام و با استفاده از اطلاعات ضروری برای بررسی درخواست و، در صورت انتخاب، پیام‌رسان خارجی موافقم."
                    : "I accept the consultation terms and privacy policy and consent to the necessary processing and, if selected, external messaging."}{" "}
                  <Link className="text-link" href={`/${locale}/privacy`}>
                    {t.privacy}
                  </Link>
                </span>
              </label>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button className="button" type="submit">
                {fa ? "ادامه و بررسی درخواست" : "Continue to review"}
                <Icon name="arrow" size={18} />
              </button>
            </form>
          ) : (
            <div>
              <h2>{fa ? "بررسی درخواست مشاوره" : "Review your request"}</h2>
              {[
                [fa ? "نام" : "Name", name],
                [fa ? "شماره همراه" : "Mobile", phone],
                [
                  fa ? "نوع مشاوره" : "Consultation",
                  type === "phone" ? t.phone : t.text,
                ],
                ...(type === "text"
                  ? [[fa ? "پیام‌رسان" : "Platform", platform]]
                  : []),
                [
                  fa ? "زمان پیشنهادی" : "Preferred date",
                  date ||
                    (fa ? "توسط پزشک تعیین می‌شود" : "Assigned by doctor"),
                ],
              ].map(([k, v]) => (
                <div className="summary-line" key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
              <LiveBooking locale={locale} type={type} platform={platform} />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={`/${locale}/login?next=booking`} className="button">
                  {fa ? "ورود برای ادامه" : "Sign in to continue"}
                  <Icon name="lock" size={16} />
                </Link>
                <button
                  className="button button-white"
                  style={{ borderColor: "#e9ecf0" }}
                  onClick={() => setStep(1)}
                >
                  {fa ? "ویرایش اطلاعات" : "Edit details"}
                </button>
              </div>
            </div>
          )}
        </div>
        <aside className="booking-sidebar">
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <span className="small-icon">
              <Icon name="doctor" />
            </span>
            <div>
              <strong>{t.name}</strong>
              <p style={{ fontSize: 11 }}>{t.profession}</p>
            </div>
          </div>
          <h3>{fa ? "خلاصهٔ مشاوره" : "Consultation summary"}</h3>
          <div className="summary-line">
            <span>{fa ? "روش مشاوره" : "Consultation"}</span>
            <strong>{type === "phone" ? t.phone : t.text}</strong>
          </div>
          <div className="summary-line">
            <span>{fa ? "منطقهٔ زمانی" : "Timezone"}</span>
            <strong>{fa ? "تهران" : "Asia/Tehran"}</strong>
          </div>
          <div className="summary-line">
            <span>{fa ? "تعرفه" : "Price"}</span>
            <strong>
              {fa ? "در انتظار هماهنگی زمان" : "Awaiting confirmation"}
            </strong>
          </div>
          <div className="notice">
            <Icon name="shield" size={18} />
            <p style={{ fontSize: 11, marginTop: 7 }}>
              {fa
                ? "تأیید نوبت تنها پس از بررسی پرداخت و تعیین زمان انجام می‌شود."
                : "Appointments are confirmed only after payment verification and scheduling."}
            </p>
          </div>
          <p style={{ fontSize: 10, marginTop: 17 }}>{t.urgent}</p>
        </aside>
      </div>
    </>
  );
}
