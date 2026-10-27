"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { copy, type Locale } from "@/lib/content";
import { formatMoney } from "@/lib/domain";
import { formatJalali } from "@/lib/jalali";
import {
  appointmentTone,
  consultationContactAllowed,
  statusLabel,
  type PatientAppointment,
} from "@/lib/patient-portal";
import { ReceiptForm } from "./receipt-form";
import { PatientReceipts } from "./patient-receipts";
import { ConsultationContact } from "./consultation-contact";
import { Icon } from "./icon";
import { patientFetch } from "@/lib/patient-fetch";
type Summary = {
  user: { name: string | null; phone: string };
  stats: {
    total: number;
    confirmed: number;
    pending: number;
    completed: number;
  };
  next: PatientAppointment | null;
};
type Notification = {
  id: string;
  appointmentId: string | null;
  event: string;
  readAt: string | null;
  createdAt: string;
};
type Details = {
  appointment: PatientAppointment;
  history: {
    id: string;
    toState: string;
    note: string | null;
    createdAt: string;
  }[];
  reviews: { action: string; note: string | null; createdAt: string }[];
  payments: {
    id: string;
    status: string;
    transactionReference: string | null;
    createdAt: string;
  }[];
};
const views = [
  "overview",
  "appointments",
  "payments",
  "history",
  "notifications",
  "profile",
  "support",
];
export function PatientDashboard({
  locale,
  initialView = "overview",
  appointmentId,
  initialFilter = "",
}: {
  locale: Locale;
  initialView?: string;
  appointmentId?: string;
  initialFilter?: string;
}) {
  const fa = locale === "fa",
    t = copy[locale],
    router = useRouter();
  const view = views.includes(initialView) ? initialView : "overview";
  const [summary, setSummary] = useState<Summary | null>(null),
    [items, setItems] = useState<PatientAppointment[]>([]);
  const [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState(initialFilter),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("newest");
  const [notifications, setNotifications] = useState<Notification[]>([]),
    [unread, setUnread] = useState(0);
  const [name, setName] = useState(""),
    [support, setSupport] = useState<{ phone?: string; email?: string }>({});
  const [selected, setSelected] = useState(appointmentId || ""),
    [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true),
    [detailLoading, setDetailLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const href = (v: string, id?: string) =>
    `/${locale}/dashboard?view=${v}${id ? `&appointment=${id}` : ""}`;
  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      const r = await patientFetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
          ...init?.headers,
        },
        cache: "no-store",
      });
      const data = await r.json();
      if (r.status === 401) {
        window.dispatchEvent(new Event("medical-session-changed"));
        router.push(
          `/${locale}/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
      }
      if (!r.ok)
        throw new Error(
          data.message ||
            (fa ? "دریافت اطلاعات انجام نشد." : "Unable to load information."),
        );
      return data;
    },
    [locale, router, fa],
  );
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      filter,
      q: query,
      sort,
    });
    Promise.resolve()
      .then(() => {
        if (active) {
          setLoading(true);
          setError("");
        }
        return Promise.all([
          api("/api/patient/summary"),
          api(`/api/patient/appointments?${params}`),
          api("/api/patient/notifications"),
          view === "support"
            ? api("/api/patient/support")
            : Promise.resolve(null),
        ]);
      })
      .then(([s, a, n, help]) => {
        if (!active) return;
        setSummary(s);
        setItems(a.items);
        setTotal(a.total);
        setNotifications(n.items);
        setUnread(n.unread);
        setName(s.user.name || "");
        if (help) setSupport(help);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, page, filter, query, sort, view, revision]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) {
          setDetailLoading(true);
          setDetails(null);
        }
        return api(`/api/patient/appointments/${selected}`);
      })
      .then((d) => {
        if (active) setDetails(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, api, revision]);
  const labels = fa
    ? [
        "پیشخوان",
        "نوبت‌های من",
        "پرداخت‌ها و رسیدها",
        "تاریخچه نوبت‌ها",
        "پیام‌ها و اعلان‌ها",
        "حساب کاربری",
        "راهنما و پشتیبانی",
      ]
    : [
        "Overview",
        "My appointments",
        "Payments & receipts",
        "Appointment history",
        "Notifications",
        "Profile",
        "Help & support",
      ];
  const title = labels[views.indexOf(view)];
  const appointmentCard = (a: PatientAppointment) => (
    <article key={a.id} className="patient-appointment">
      <div className="appointment-card-heading">
        <span className="small-icon">
          <Icon
            name={a.typeSnapshot.key === "phone" ? "phone" : "message"}
            size={20}
          />
        </span>
        <div>
          <h3>{a.typeSnapshot.key === "phone" ? t.phone : t.text}</h3>
          <small>
            {a.startsAt
              ? formatJalali(a.startsAt, true)
              : fa
                ? "زمان هنوز تعیین نشده"
                : "Time not assigned"}
          </small>
        </div>
        <span className={`appointment-status ${appointmentTone(a)}`}>
          {statusLabel(
            appointmentTone(a) === "red" ? a.paymentStatus : a.status,
            locale,
          )}
        </span>
      </div>
      <div className="appointment-card-meta">
        <span>{formatMoney(a.priceRial, locale)}</span>
        <span dir="ltr">{a.trackingCode}</span>
      </div>
      <button
        className="button button-small button-white"
        onClick={() => {
          setSelected(a.id);
          setMessage("");
        }}
      >
        {fa
          ? view === "payments"
            ? "رسید و جزئیات پرداخت"
            : "مشاهده جزئیات نوبت"
          : "View details"}
        <Icon name="arrow" size={16} />
      </button>
    </article>
  );
  return (
    <div className="patient-portal">
      <aside className="patient-sidebar">
        <div className="patient-sidebar-profile">
          <span className="account-avatar">
            {summary?.user.name?.slice(0, 1) || <Icon name="user" />}
          </span>
          <strong>
            {summary?.user.name || (fa ? "حساب بیمار" : "Patient account")}
          </strong>
          <small>
            {fa ? "سلامتی شما، اولویت ماست" : "Your health comes first"}
          </small>
        </div>
        <nav aria-label={fa ? "منوی پنل بیمار" : "Patient navigation"}>
          {views.map((v, i) => (
            <Link
              className={view === v ? "active" : ""}
              key={v}
              href={href(v)}
              aria-current={view === v ? "page" : undefined}
            >
              {labels[i]}
              {v === "notifications" && unread > 0 && (
                <b>{new Intl.NumberFormat(locale).format(unread)}</b>
              )}
            </Link>
          ))}
        </nav>
        <Link className="button button-small" href={`/${locale}/booking`}>
          {t.book}
          <Icon name="plus" size={16} />
        </Link>
      </aside>
      <section className="patient-main">
        <div className="dashboard-title">
          <div>
            <p className="eyebrow">{fa ? "پنل بیمار" : "Patient portal"}</p>
            <h1>{title}</h1>
          </div>
          <Link href={`/${locale}/booking`} className="button button-small">
            {fa ? "نوبت جدید" : "New appointment"}
            <Icon name="plus" size={16} />
          </Link>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
            <button
              className="text-link"
              onClick={() => setRevision((r) => r + 1)}
            >
              {fa ? "تلاش مجدد" : "Retry"}
            </button>
          </div>
        )}
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <div className="portal-skeleton" role="status" aria-busy="true">
            <span /> <span /> <span />
            {fa ? "دریافت اطلاعات حساب شما…" : "Loading your account…"}
          </div>
        ) : (
          <>
            {view === "overview" && (
              <>
                <div className="patient-welcome">
                  <h2>
                    {fa
                      ? `سلام ${summary?.user.name || "همراه گرامی"}، خوش آمدید`
                      : `Welcome, ${summary?.user.name || "patient"}`}
                  </h2>
                  <p>
                    {fa
                      ? "نوبت‌ها، نتیجه بررسی رسید و پیام‌های مرتبط با مشاوره را اینجا دنبال کنید."
                      : "Track appointments, receipt reviews and consultation updates here."}
                  </p>
                </div>
                <div className="stats-grid">
                  {(
                    ["total", "confirmed", "pending", "completed"] as const
                  ).map((key, i) => (
                    <button
                      className="stat-card"
                      key={key}
                      onClick={() => {
                        router.push(
                          href("appointments") +
                            "&filter=" +
                            ["", "confirmed", "pending", "past"][i],
                        );
                      }}
                    >
                      <span>
                        {
                          (fa
                            ? [
                                "همه نوبت‌ها",
                                "تأییدشده",
                                "در انتظار بررسی",
                                "انجام‌شده",
                              ]
                            : [
                                "All appointments",
                                "Confirmed",
                                "Pending",
                                "Completed",
                              ])[i]
                        }
                      </span>
                      <strong>
                        {new Intl.NumberFormat(locale).format(
                          summary?.stats[key] || 0,
                        )}
                      </strong>
                    </button>
                  ))}
                </div>
                <h2>{fa ? "نوبت آینده شما" : "Your next appointment"}</h2>
                {summary?.next ? (
                  appointmentCard(summary.next)
                ) : (
                  <p className="notice">
                    {fa
                      ? "نوبت قطعی آینده ندارید."
                      : "You have no upcoming confirmed appointments."}
                  </p>
                )}
                <h2>{fa ? "آخرین درخواست" : "Latest request"}</h2>
                {items[0] ? (
                  appointmentCard(items[0])
                ) : (
                  <p className="notice">
                    {fa ? "هنوز درخواستی ثبت نکرده‌اید." : "No requests yet."}
                  </p>
                )}
                {unread > 0 && (
                  <Link className="notice" href={href("notifications")}>
                    {fa
                      ? `${new Intl.NumberFormat(locale).format(unread)} اعلان خوانده‌نشده دارید؛ مشاهده پیام‌ها`
                      : `${unread} unread notifications — view messages`}
                  </Link>
                )}
              </>
            )}
            {["appointments", "payments", "history"].includes(view) && (
              <>
                <form
                  className="portal-filters"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setQuery(search);
                    setPage(1);
                  }}
                >
                  <div className="field">
                    <label htmlFor="patient-search">
                      {fa ? "جست‌وجوی کد پیگیری" : "Search tracking code"}
                    </label>
                    <input
                      id="patient-search"
                      value={search}
                      maxLength={100}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="patient-filter">
                      {fa ? "وضعیت" : "Status"}
                    </label>
                    <select
                      id="patient-filter"
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      {["", "future", "pending", "past", "cancelled"].map(
                        (f, i) => (
                          <option key={f} value={f}>
                            {
                              (fa
                                ? [
                                    "همه",
                                    "آینده",
                                    "در انتظار",
                                    "گذشته",
                                    "لغو یا منقضی‌شده",
                                  ]
                                : [
                                    "All",
                                    "Upcoming",
                                    "Pending",
                                    "Past",
                                    "Cancelled / expired",
                                  ])[i]
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="patient-sort">
                      {fa ? "مرتب‌سازی" : "Sort"}
                    </label>
                    <select
                      id="patient-sort"
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="newest">
                        {fa ? "جدیدترین" : "Newest"}
                      </option>
                      <option value="oldest">
                        {fa ? "قدیمی‌ترین" : "Oldest"}
                      </option>
                    </select>
                  </div>
                  <button className="button button-small">
                    {fa ? "جست‌وجو" : "Search"}
                  </button>
                </form>
                {view === "payments" && (
                  <p className="notice">
                    {fa
                      ? "هر پرداخت به یک نوبت متصل است. برای مشاهده رسید، شماره تراکنش، دلیل اصلاح یا ارسال مجدد، جزئیات همان نوبت را باز کنید."
                      : "Payments belong to appointments. Open an appointment to view receipts, bank references, correction reasons or resubmit."}
                  </p>
                )}
                {items.length ? (
                  items.map(appointmentCard)
                ) : (
                  <div className="empty-state">
                    <Icon name="calendar" size={30} />
                    <h2>{fa ? "نوبتی پیدا نشد" : "No appointments found"}</h2>
                    <p>
                      {fa
                        ? "فیلترها را تغییر دهید یا اولین نوبت خود را ثبت کنید."
                        : "Change the filters or book your first appointment."}
                    </p>
                    <Link
                      className="button button-small"
                      href={`/${locale}/booking`}
                    >
                      {t.book}
                    </Link>
                  </div>
                )}
                <nav
                  className="portal-pagination"
                  aria-label={fa ? "صفحه‌بندی نوبت‌ها" : "Appointment pages"}
                >
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {fa ? "قبلی" : "Previous"}
                  </button>
                  <span>
                    {new Intl.NumberFormat(locale).format(page)} /{" "}
                    {new Intl.NumberFormat(locale).format(
                      Math.max(1, Math.ceil(total / 8)),
                    )}
                  </span>
                  <button
                    disabled={page * 8 >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {fa ? "بعدی" : "Next"}
                  </button>
                </nav>
              </>
            )}
            {view === "notifications" && (
              <div className="content-panel">
                {notifications.length ? (
                  notifications.map((n) => (
                    <article
                      className={`patient-notification ${n.readAt ? "" : "unread"}`}
                      key={n.id}
                    >
                      <strong>{notificationLabel(n.event, fa)}</strong>
                      <small>{formatJalali(n.createdAt, true)}</small>
                      <div>
                        {n.appointmentId && (
                          <button
                            className="text-link"
                            onClick={() => setSelected(n.appointmentId!)}
                          >
                            {fa ? "مشاهده نوبت مرتبط" : "View appointment"}
                          </button>
                        )}
                        {!n.readAt && (
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await api("/api/patient/notifications", {
                                  method: "POST",
                                  body: JSON.stringify({ id: n.id }),
                                });
                                setNotifications((old) =>
                                  old.map((item) =>
                                    item.id === n.id
                                      ? {
                                          ...item,
                                          readAt: new Date().toISOString(),
                                        }
                                      : item,
                                  ),
                                );
                                setUnread((c) => Math.max(0, c - 1));
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {fa ? "خوانده شد" : "Mark read"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    {fa
                      ? "هنوز پیامی ندارید. رویدادهای نوبت‌ها اینجا نمایش داده می‌شوند."
                      : "No notifications yet. Appointment updates will appear here."}
                  </div>
                )}
              </div>
            )}
            {view === "profile" && (
              <form
                className="content-panel portal-profile"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    const u = await api("/api/patient/profile", {
                      method: "PUT",
                      body: JSON.stringify({ name, locale }),
                    });
                    setSummary((old) => (old ? { ...old, user: u } : old));
                    window.dispatchEvent(new Event("medical-session-changed"));
                    setMessage(
                      fa ? "اطلاعات حساب ذخیره شد." : "Profile saved.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="field">
                  <label htmlFor="patient-name">
                    {fa ? "نام و نام خانوادگی" : "Full name"}
                  </label>
                  <input
                    id="patient-name"
                    autoComplete="name"
                    required
                    minLength={3}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="patient-mobile">
                    {fa ? "شماره همراه تأییدشده" : "Verified mobile"}
                  </label>
                  <input
                    id="patient-mobile"
                    value={summary?.user.phone || ""}
                    dir="ltr"
                    readOnly
                  />
                  <small>
                    {fa
                      ? "شماره همراه شناسه ورود شماست و از این فرم تغییر نمی‌کند."
                      : "Your verified mobile is your sign-in identity and cannot be changed here."}
                  </small>
                </div>
                <button className="button" disabled={busy}>
                  {busy
                    ? fa
                      ? "در حال ذخیره…"
                      : "Saving…"
                    : fa
                      ? "ذخیره اطلاعات"
                      : "Save profile"}
                </button>
              </form>
            )}
            {view === "support" && (
              <div className="content-panel portal-help">
                <h2>{fa ? "راهنمای دریافت مشاوره" : "Consultation guide"}</h2>
                {(fa
                  ? [
                      [
                        "چطور نوبت بگیرم؟",
                        "نوع مشاوره و تعرفه را انتخاب کنید، با شماره همراه وارد شوید، زمان آزاد را تعیین و رسید بانکی را ارسال کنید.",
                      ],
                      [
                        "رسید ارسال شده؛ نوبت قطعی است؟",
                        "خیر؛ وضعیت زرد در انتظار بررسی است. پس از بررسی واریز توسط پزشک، نوبت سبز و قطعی می‌شود.",
                      ],
                      [
                        "رسید نیاز به اصلاح دارد؛ چه کنم؟",
                        "در بخش پرداخت‌ها جزئیات نوبت را باز کنید، دلیل اصلاح را بخوانید و رسید درست را برای همان نوبت بفرستید.",
                      ],
                      [
                        "چطور آزمایش یا عکس ارسال کنم؟",
                        "پس از تأیید نوبت، راه ارتباط با پزشک در جزئیات نوبت فعال می‌شود. مدارک مربوط به مشاوره را در همان پیام‌رسان ارسال کنید.",
                      ],
                      [
                        "برای تغییر زمان یا لغو چه کنم؟",
                        "از جزئیات نوبت درخواست تغییر زمان یا لغو ثبت کنید. لغو نوبت به‌تنهایی به معنی بازپرداخت بانکی نیست.",
                      ],
                    ]
                  : [
                      [
                        "How do I book?",
                        "Choose consultation and price, sign in, choose an available time, then upload your bank receipt.",
                      ],
                      [
                        "Does uploading confirm my appointment?",
                        "No. Yellow means awaiting review. The appointment turns green after physician approval.",
                      ],
                      [
                        "My receipt needs correction",
                        "Open the appointment in Payments, read the reason and resubmit a corrected receipt for the same appointment.",
                      ],
                      [
                        "How do I send reports or images?",
                        "After confirmation, open your appointment details for the doctor's configured contact channels.",
                      ],
                      [
                        "Rescheduling or cancellation",
                        "Submit a request from appointment details. Cancellation does not itself refund a bank transfer.",
                      ],
                    ]
                ).map(([q, a]) => (
                  <details key={q}>
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
                {support.phone && (
                  <a
                    className="button button-small"
                    href={`tel:${support.phone.replace(/[^+\d]/g, "")}`}
                  >
                    {fa ? "تماس با پشتیبانی" : "Contact support"} ·{" "}
                    {support.phone}
                  </a>
                )}
                {support.email && (
                  <a className="text-link" href={`mailto:${support.email}`}>
                    {support.email}
                  </a>
                )}
                <p className="notice">{t.urgent}</p>
                <Link className="text-link" href={`/${locale}/contact`}>
                  {fa ? "صفحه تماس" : "Contact page"}
                </Link>
              </div>
            )}
          </>
        )}
        {selected && (
          <section
            className="patient-detail content-panel"
            aria-label={fa ? "جزئیات نوبت" : "Appointment details"}
          >
            <div className="dashboard-title">
              <h2>{fa ? "جزئیات نوبت" : "Appointment details"}</h2>
              <button className="text-link" onClick={() => setSelected("")}>
                {fa ? "بستن جزئیات" : "Close details"}
              </button>
            </div>
            {detailLoading ? (
              <p role="status">
                {fa ? "در حال دریافت جزئیات…" : "Loading details…"}
              </p>
            ) : (
              details && (
                <AppointmentDetails
                  details={details}
                  locale={locale}
                  onChange={() => setRevision((r) => r + 1)}
                  onRequest={async (kind) => {
                    setBusy(true);
                    try {
                      await api(`/api/appointments/${selected}/request`, {
                        method: "POST",
                        body: JSON.stringify({ kind }),
                      });
                      setMessage(
                        fa
                          ? "درخواست برای بررسی ثبت شد."
                          : "Request submitted for review.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  busy={busy}
                />
              )
            )}
          </section>
        )}
      </section>
    </div>
  );
}
function AppointmentDetails({
  details,
  locale,
  onChange,
  onRequest,
  busy,
}: {
  details: Details;
  locale: Locale;
  onChange: () => void;
  onRequest: (kind: string) => Promise<void>;
  busy: boolean;
}) {
  const a = details.appointment,
    fa = locale === "fa";
  return (
    <>
      <span className={`appointment-status ${appointmentTone(a)}`}>
        {statusLabel(
          appointmentTone(a) === "red" ? a.paymentStatus : a.status,
          locale,
        )}
      </span>
      {[
        [
          fa ? "نوع مشاوره" : "Consultation",
          a.typeSnapshot.key === "phone"
            ? copy[locale].phone
            : copy[locale].text,
        ],
        [fa ? "کد پیگیری" : "Tracking code", a.trackingCode],
        [
          fa ? "زمان (تهران)" : "Time (Tehran)",
          a.startsAt ? formatJalali(a.startsAt, true) : "—",
        ],
        [fa ? "تعرفه" : "Price", formatMoney(a.priceRial, locale)],
        [
          fa ? "وضعیت پرداخت" : "Payment status",
          statusLabel(a.paymentStatus, locale),
        ],
      ].map(([label, value]) => (
        <div className="summary-line" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      {details.reviews[0]?.note && (
        <div className={`notice ${appointmentTone(a) === "red" ? "warn" : ""}`}>
          <strong>{fa ? "نتیجه بررسی پزشک" : "Physician review"}</strong>
          <p>{details.reviews[0].note}</p>
        </div>
      )}
      {[
        "awaiting_payment",
        "rejected",
        "additional_information_required",
      ].includes(a.paymentStatus) &&
        ["awaiting_payment", "awaiting_verification"].includes(a.status) && (
          <ReceiptForm
            appointmentId={a.id}
            locale={locale}
            onSubmitted={onChange}
          />
        )}
      <PatientReceipts
        appointmentId={a.id}
        locale={locale}
        refreshKey={a.paymentStatus}
        onFinalized={onChange}
      />
      {details.payments.length > 0 && (
        <>
          <h3>{fa ? "سابقه پرداخت‌ها" : "Payment history"}</h3>
          {details.payments.map((p) => (
            <div className="summary-line" key={p.id}>
              <span>
                {formatJalali(p.createdAt, true)}
                <small>
                  {p.transactionReference
                    ? `${fa ? "شماره تراکنش:" : "Reference:"} ${p.transactionReference}`
                    : ""}
                </small>
              </span>
              <strong>{statusLabel(p.status, locale)}</strong>
            </div>
          ))}
        </>
      )}
      {consultationContactAllowed(a) ? (
        <ConsultationContact id={a.id} locale={locale} />
      ) : (
        <p className="notice">
          {fa
            ? "راه ارتباط با پزشک پس از تأیید نهایی نوبت نمایش داده می‌شود."
            : "Doctor contact details appear after appointment confirmation."}
        </p>
      )}
      <details className="appointment-timeline">
        <summary>{fa ? "تاریخچه وضعیت نوبت" : "Appointment timeline"}</summary>
        <ol>
          {details.history.map((h) => (
            <li key={h.id}>
              <strong>{statusLabel(h.toState, locale)}</strong>
              <small>{formatJalali(h.createdAt, true)}</small>
              {h.note &&
                !h.note.startsWith("System:") &&
                !h.note.startsWith("Patient returned") && <p>{h.note}</p>}
            </li>
          ))}
        </ol>
      </details>
      {[
        "awaiting_payment",
        "awaiting_verification",
        "awaiting_scheduling",
        "confirmed",
      ].includes(a.status) && (
        <div className="portal-actions">
          <button
            disabled={busy}
            className="text-link"
            onClick={() => void onRequest("reschedule")}
          >
            {fa ? "درخواست تغییر زمان" : "Request rescheduling"}
          </button>
          <button
            disabled={busy}
            className="text-link"
            onClick={() => void onRequest("cancel")}
          >
            {fa ? "درخواست لغو نوبت" : "Request cancellation"}
          </button>
        </div>
      )}
    </>
  );
}
function notificationLabel(event: string, fa: boolean) {
  const labels: Record<string, [string, string]> = {
    booking_submitted: ["درخواست نوبت ثبت شد", "Booking request received"],
    receipt_submitted: [
      "رسید برای بررسی ارسال شد",
      "Receipt submitted for review",
    ],
    appointment_confirmed: [
      "نوبت شما تأیید شد؛ جزئیات و راه ارتباط پزشک را مشاهده کنید",
      "Appointment confirmed — view details and doctor contacts",
    ],
    payment_approved: ["پرداخت تأیید شد", "Payment approved"],
    payment_rejected: [
      "رسید نیاز به اصلاح دارد؛ دلیل بررسی را مشاهده کنید",
      "Receipt needs correction — view review reason",
    ],
    payment_additional_information_required: [
      "برای بررسی پرداخت اطلاعات بیشتری لازم است",
      "More payment information required",
    ],
  };
  return (
    labels[event]?.[fa ? 0 : 1] ||
    (fa ? "وضعیت نوبت شما به‌روز شد" : "Your appointment was updated")
  );
}
