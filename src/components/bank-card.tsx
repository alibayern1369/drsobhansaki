"use client";
import { useState } from "react";
import { findIranianBank } from "@/lib/iranian-banks";
import type { Locale } from "@/lib/content";
import { Icon } from "./icon";
export function BankLogo({ name }: { name: string }) {
  const bank = findIranianBank(name);
  return bank ? (
    <span
      role="img"
      aria-label={name}
      className="bank-logo"
      style={{
        backgroundPosition: `${-(bank.logo % 5) * 64}px ${-Math.floor(bank.logo / 5) * 64}px`,
      }}
    />
  ) : (
    <Icon name="copy" size={28} />
  );
}
export function BankCard({
  bank,
  locale,
}: {
  bank: { bankName: string; holderName: string; cardNumber: string };
  locale: Locale;
}) {
  const [status, setStatus] = useState("");
  const fa = locale === "fa";
  return (
    <div
      className="payment-bank-card"
      style={{
        background: `linear-gradient(125deg, ${findIranianBank(bank.bankName)?.color || "#244d60"}, #122531)`,
      }}
    >
      <div className="payment-bank-heading">
        <BankLogo name={bank.bankName} />
        <span>{bank.bankName || (fa ? "کارت بانکی" : "Bank card")}</span>
        <span className="card-chip" aria-hidden="true" />
      </div>
      <strong dir="ltr" className="payment-bank-number">
        {bank.cardNumber.replace(/(.{4})(?=.)/g, "$1 ") ||
          "•••• •••• •••• ••••"}
      </strong>
      <div className="payment-bank-footer">
        <span>
          {bank.holderName || (fa ? "نام دارنده کارت" : "Cardholder")}
        </span>
        <button
          type="button"
          disabled={!bank.cardNumber}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(bank.cardNumber);
              setStatus(fa ? "کپی شد" : "Copied");
            } catch {
              setStatus(
                fa
                  ? "شماره را انتخاب و کپی کنید"
                  : "Select and copy the number",
              );
            }
          }}
        >
          <Icon name="copy" size={16} />
          {fa ? "کپی" : "Copy"}
        </button>
      </div>
      <span className="bank-copy-status" role="status">
        {status}
      </span>
    </div>
  );
}
