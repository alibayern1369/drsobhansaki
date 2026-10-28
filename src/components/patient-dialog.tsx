"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

export function PatientDialog({
  children,
  onClose,
  fa,
}: {
  children: ReactNode;
  onClose: () => void;
  fa: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="patient-dialog"
      aria-labelledby="appointment-dialog-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="patient-dialog-content">
        <header className="patient-dialog-header">
          <button className="text-link" onClick={onClose}>
            <Icon name={fa ? "right" : "left"} size={18} />
            {fa ? "بازگشت" : "Back"}
          </button>
          <h2 id="appointment-dialog-title">
            {fa ? "جزئیات نوبت" : "Appointment details"}
          </h2>
          <button
            className="dialog-close"
            onClick={onClose}
            aria-label={fa ? "بستن" : "Close"}
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
