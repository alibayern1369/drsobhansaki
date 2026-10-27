"use client";
import { useState } from "react";
import {
  daysInJalaliMonth,
  gregorianFromJalali,
  jalaliParts,
  persianMonths,
  persianNumber,
  tehranDate,
} from "@/lib/jalali";
import type { BookingConfig } from "@/lib/booking-flow";
import type { Locale } from "@/lib/content";
export function BookingCalendar({
  slots,
  value,
  onChange,
  locale,
}: {
  slots: BookingConfig["slots"];
  value: string;
  onChange: (id: string) => void;
  locale: Locale;
}) {
  const dayKey = (date: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(date));
  const selectedSlot = slots.find((s) => s.id === value);
  const initial = jalaliParts(
    new Date(
      (selectedSlot
        ? dayKey(selectedSlot.startsAt)
        : slots[0]
          ? dayKey(slots[0].startsAt)
          : tehranDate()) + "T12:00:00Z",
    ),
  );
  const [monthIndex, setMonthIndex] = useState(
    initial.year * 12 + initial.month - 1,
  );
  const year = Math.floor(monthIndex / 12),
    month = (monthIndex % 12) + 1;
  const [day, setDay] = useState(
    selectedSlot ? dayKey(selectedSlot.startsAt) : "",
  );
  const first = gregorianFromJalali(year, month, 1)!;
  const offset = (new Date(first + "T12:00:00Z").getUTCDay() + 1) % 7;
  const available = new Set(slots.map((s) => dayKey(s.startsAt)));
  const fa = locale === "fa";
  return (
    <div className="booking-calendar" dir="rtl">
      <div className="calendar-title">
        <button
          type="button"
          aria-label={fa ? "ماه قبل" : "Previous month"}
          onClick={() => setMonthIndex((m) => m - 1)}
        >
          ‹
        </button>
        <strong>
          {persianMonths[month - 1]} {persianNumber(year)}
        </strong>
        <button
          type="button"
          aria-label={fa ? "ماه بعد" : "Next month"}
          onClick={() => setMonthIndex((m) => m + 1)}
        >
          ›
        </button>
      </div>
      <div className="calendar-days">
        {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((w, i) => (
          <span
            key={i}
            aria-label={
              [
                "شنبه",
                "یکشنبه",
                "دوشنبه",
                "سه‌شنبه",
                "چهارشنبه",
                "پنجشنبه",
                "جمعه",
              ][i]
            }
          >
            {w}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInJalaliMonth(year, month) }, (_, i) => {
          const date = gregorianFromJalali(year, month, i + 1)!;
          return (
            <button
              key={date}
              type="button"
              disabled={!available.has(date)}
              aria-pressed={day === date}
              aria-label={`${persianNumber(i + 1)} ${persianMonths[month - 1]} ${available.has(date) ? "دارای زمان آزاد" : "بدون ظرفیت"}`}
              className={
                day === date
                  ? "selected"
                  : available.has(date)
                    ? "available"
                    : ""
              }
              onClick={() => {
                setDay(date);
                onChange("");
              }}
            >
              {persianNumber(i + 1)}
            </button>
          );
        })}
      </div>
      <p className="calendar-hint">
        {fa
          ? "روزهای رنگی ظرفیت آزاد دارند. ساعت‌ها به وقت تهران هستند."
          : "Highlighted days have availability. Times are in Tehran."}
      </p>
      <div className="slot-cards">
        {slots
          .filter((s) => dayKey(s.startsAt) === day)
          .map((s) => (
            <button
              type="button"
              key={s.id}
              className={value === s.id ? "selected" : ""}
              aria-pressed={value === s.id}
              onClick={() => onChange(s.id)}
            >
              {new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", {
                timeZone: "Asia/Tehran",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(s.startsAt))}
            </button>
          ))}
      </div>
      {!slots.length && (
        <p className="notice">
          {fa
            ? "در حال حاضر زمان آزاد وجود ندارد. لطفاً بعداً مراجعه کنید."
            : "No times are currently available. Please check again later."}
        </p>
      )}
    </div>
  );
}
