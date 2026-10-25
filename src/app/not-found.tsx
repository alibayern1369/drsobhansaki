import Link from "next/link";
export default function NotFound() {
  return (
    <main
      className="empty-state"
      style={{ maxWidth: 650, margin: "100px auto" }}
    >
      <span className="eyebrow">404</span>
      <h1>صفحه پیدا نشد · Page not found</h1>
      <p>ممکن است نشانی تغییر کرده باشد.</p>
      <Link href="/fa" className="button">
        بازگشت به خانه
      </Link>
    </main>
  );
}
