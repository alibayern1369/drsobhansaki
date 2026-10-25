"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-state">
      <h1>دریافت اطلاعات انجام نشد</h1>
      <p>لطفاً کمی بعد دوباره تلاش کنید. · Please try again later.</p>
      <button className="button" onClick={reset}>
        تلاش دوباره · Retry
      </button>
    </main>
  );
}
