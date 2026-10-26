"use client";
import { useId, useRef, useState } from "react";
import {
  daysInJalaliMonth,
  gregorianFromJalali,
  jalaliParts,
  persianMonths,
  persianNumber,
  tehranDate,
  parsePersianTime,
} from "@/lib/jalali";
type Props = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  min?: string;
  dateTime?: boolean;
  disabled?: boolean;
};
export function JalaliDatePicker({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  required,
  min,
  dateTime = false,
  disabled,
}: Props) {
  const generated = useId();
  const controlId = id || generated;
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const today = tehranDate();
  const seed = jalaliParts(
    new Date((selected.slice(0, 10) || today) + "T12:00:00Z"),
  );
  const [year, setYear] = useState(seed.year);
  const [month, setMonth] = useState(seed.month);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const selectedParts = selected
    ? jalaliParts(new Date(selected.slice(0, 10) + "T12:00:00Z"))
    : null;
  const [time, setTime] = useState(selected.slice(11, 16) || "09:00");
  const update = (next: string) => {
    wrap.current
      ?.querySelector<HTMLInputElement>(".jalali-display")
      ?.setCustomValidity("");
    setInternal(next);
    onChange?.(next);
  };
  const first = gregorianFromJalali(year, month, 1)!;
  const offset = (new Date(first + "T12:00:00Z").getUTCDay() + 1) % 7;
  const label = selectedParts
    ? `${persianNumber(selectedParts.day)} ${persianMonths[selectedParts.month - 1]} ${persianNumber(selectedParts.year)}${dateTime ? `، ${persianNumber(selected.slice(11, 16))}` : ""}`
    : "انتخاب تاریخ شمسی";
  const move = (delta: number) => {
    const m = month + delta;
    if (m < 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else if (m > 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth(m);
  };
  return (
    <div
      className="jalali-picker"
      dir="rtl"
      ref={wrap}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <input type="hidden" name={name} value={selected} />
      <input
        id={controlId}
        className="jalali-display"
        type="text"
        role="combobox"
        aria-controls={`${controlId}-calendar`}
        autoComplete="off"
        value={selected ? label : ""}
        onChange={() => {}}
        placeholder={label}
        required={required}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onInvalid={() => setOpen(true)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open && (
        <div
          className="jalali-popover"
          id={`${controlId}-calendar`}
          role="dialog"
          aria-label="تقویم هجری شمسی"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              wrap.current
                ?.querySelector<HTMLInputElement>(".jalali-display")
                ?.focus();
            }
          }}
        >
          <div className="jalali-navigation">
            <button type="button" aria-label="ماه قبل" onClick={() => move(-1)}>
              ‹
            </button>
            <select
              aria-label="ماه شمسی"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {persianMonths.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="سال شمسی"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: 151 }, (_, i) => seed.year - 120 + i).map(
                (y) => (
                  <option key={y} value={y}>
                    {persianNumber(y)}
                  </option>
                ),
              )}
            </select>
            <button type="button" aria-label="ماه بعد" onClick={() => move(1)}>
              ›
            </button>
          </div>
          <div className="jalali-grid">
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((day, i) => (
              <span key={i} className="jalali-weekday">
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInJalaliMonth(year, month) }, (_, i) => {
              const day = i + 1;
              const iso = gregorianFromJalali(year, month, day)!;
              const active = selected.slice(0, 10) === iso;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={
                    (dateTime && !parsePersianTime(time)) ||
                    (!!min && iso < min.slice(0, 10))
                  }
                  aria-label={`${persianNumber(day)} ${persianMonths[month - 1]} ${persianNumber(year)}`}
                  aria-pressed={active}
                  className={active ? "selected" : iso === today ? "today" : ""}
                  onClick={() => {
                    update(
                      iso +
                        (dateTime
                          ? `T${parsePersianTime(time) || "09:00"}`
                          : ""),
                    );
                    setOpen(false);
                  }}
                >
                  {persianNumber(day)}
                </button>
              );
            })}
          </div>
          {dateTime && (
            <div className="jalali-time">
              <label htmlFor={`${controlId}-time`}>ساعت تهران</label>
              <input
                id={`${controlId}-time`}
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={persianNumber(time)}
                onChange={(e) => {
                  setTime(e.target.value);
                  const normalized = parsePersianTime(e.target.value);
                  wrap.current
                    ?.querySelector<HTMLInputElement>(".jalali-display")
                    ?.setCustomValidity(
                      normalized
                        ? ""
                        : "ساعت معتبر بین ۰۰:۰۰ تا ۲۳:۵۹ وارد کنید.",
                    );
                  if (normalized && selected)
                    update(selected.slice(0, 10) + "T" + normalized);
                }}
                placeholder="۰۹:۰۰"
              />
              <small>ساعت را به شکل ۱۴:۳۰ وارد کنید.</small>
            </div>
          )}
          <div className="jalali-toolbar">
            <button
              type="button"
              disabled={dateTime && !parsePersianTime(time)}
              onClick={() => {
                const now = jalaliParts(new Date(today + "T12:00:00Z"));
                setYear(now.year);
                setMonth(now.month);
                update(
                  today +
                    (dateTime ? `T${parsePersianTime(time) || "09:00"}` : ""),
                );
                setOpen(false);
              }}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => {
                update("");
                setOpen(false);
              }}
            >
              پاک کردن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function PersianTimeInput({
  id,
  name,
  required,
}: {
  id: string;
  name: string;
  required?: boolean;
}) {
  const [time, setTime] = useState("");
  return (
    <>
      <input type="hidden" name={name} value={parsePersianTime(time) || ""} />
      <input
        id={id}
        value={time}
        onChange={(e) => {
          setTime(persianNumber(e.target.value));
          e.currentTarget.setCustomValidity(
            e.target.value && !parsePersianTime(e.target.value)
              ? "ساعت معتبر وارد کنید."
              : "",
          );
        }}
        type="text"
        dir="ltr"
        inputMode="numeric"
        placeholder="۰۹:۰۰"
        required={required}
        pattern="[0-9۰-۹٠-٩]{2}:[0-9۰-۹٠-٩]{2}"
        onBlur={(e) =>
          e.currentTarget.setCustomValidity(
            time && !parsePersianTime(time)
              ? "ساعت معتبر بین ۰۰:۰۰ تا ۲۳:۵۹ وارد کنید."
              : "",
          )
        }
      />
    </>
  );
}
