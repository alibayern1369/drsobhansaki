# وب‌سایت دکتر سبحان ساکی

پلتفرم دوزبانهٔ فارسی/انگلیسی با Next.js، TypeScript، Tailwind و Drizzle/PostgreSQL. طراحی از تصویر مرجع کاربر الهام گرفته است.

```sh
npm ci
npm run dev
```

نشانی‌ها: `/fa`، `/en`، `/fa/booking`، `/fa/login`، `/fa/dashboard` و `/fa/admin`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

آزمون مرورگر به Chrome نصب‌شده نیاز دارد. آزمون پایگاه داده بدون `TEST_DATABASE_URL` عمداً skip می‌شود. اطلاعات واقعی بیمار، بانک، مجوز پزشکی و نظر بیماران ساخته نشده است. عکس‌ها نمایشی‌اند. مقاله‌ها تا تأیید پزشک عمومی نمی‌شوند. نبود credential به خطای روشن سرویس منتهی می‌شود، نه موفقیت نمایشی.

فایل `.env.example` الگوی تنظیمات است. فایل‌های واقعی محیط را commit نکنید. migration در `drizzle/` است؛ هیچ migration خودکار هنگام build یا start اجرا نمی‌شود.

- [وضعیت و کارهای باقی‌مانده](docs/IMPLEMENTATION-STATUS.fa.md)
- [راهنمای مدیر](docs/ADMIN-GUIDE.fa.md)
- [انتشار، انتقال، پشتیبان و rollback](docs/DEPLOYMENT.fa.md)
- [نتایج آزمون‌های اجراشده](docs/TEST-RESULTS.fa.md)

موانع فعلی: دسترسی حساب Neon به پروژهٔ درخواستی، سرویس پیامک و storage، اطلاعات واقعی مطب و آزمون یکپارچهٔ گردش‌کار. این نسخه را سامانهٔ کامل آمادهٔ دریافت اطلاعات واقعی بیمار تلقی نکنید؛ جزئیات در سند وضعیت آمده است.

تصاویر عمومی از Unsplash و قلم Vazirmatn از Google Fonts دریافت شده‌اند. منبع پیش‌نویس‌های پزشکی در `src/lib/medical-drafts.ts` ذخیره شده است؛ منبع قدیمی به‌عنوان پژوهش جدید معرفی نشده است.
