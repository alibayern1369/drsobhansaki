# انتشار و انتقال

## Vercel

مخزن GitHub را به Vercel متصل کنید. تنظیمات محیط در پنل Vercel وارد شوند؛ فایل محیط commit نشود. `NEXT_PUBLIC_SITE_URL` را روی دامنهٔ HTTPS نهایی قرار دهید. برای preview، branch پایگاه دادهٔ جدا و سرویس پیامک آزمایشی استفاده کنید. migration در build اجرا نمی‌شود؛ SQL باید جداگانه بررسی، روی branch توسعه آزموده و سپس برای production تأیید شود.

`vercel.json` اجرای روزانهٔ outbox در ساعت ۰۶:۰۰ UTC و پاک‌سازی رسید در ساعت ۰۳:۰۰ UTC دارد. پاک‌سازی پیش‌فرض غیرفعال و dry-run است. برای اعلان سریع‌تر و انقضای دقیق نوبت، job runner با دورهٔ کوتاه‌تر و مطابق محدودیت پلن تنظیم کنید. هر دو endpoint به Bearer برابر `CRON_SECRET` نیاز دارند. سرویس SMS باید شناسهٔ یکتا/رفتار idempotent ارائه دهد؛ در وضعیت crash احتمال ارسال تکراری یا باقی‌ماندن sending هنوز باید مدیریت شود.

## VPS

`docker compose up -d --build` برنامه را روی loopback پورت ۳۰۰۰ اجرا می‌کند. reverse proxy با HTTPS مثل Caddy یا Nginx لازم است. کانتینر با کاربر غیر root اجرا می‌شود. `.env.local` فقط روی سرور و با دسترسی محدود نگهداری شود. Docker در این محیط اجرا و آزموده نشده است.

برای اجرای standalone بدون Docker، پوشه‌های public و .next/static را کنار خروجی .next/standalone کپی و `node .next/standalone/server.js` را اجرا کنید. `npm start` برای آزمایش محلی build است.

## انتقال PostgreSQL

از اتصال مستقیم برای `pg_dump --format=custom` استفاده کنید. فایل پشتیبان شامل داده حساس است؛ آن را رمزگذاری کنید. نسخهٔ سازگار PostgreSQL را آماده کنید؛ ابتدا restore روی محیط مجزا و کنترل تعداد رکوردها، constraints و آزمون خواندن/نوشتن انجام شود. سپس در بازهٔ نگهداری writes متوقف، dump نهایی تهیه و با `pg_restore` منتقل شود. پس از تغییر DATABASE_URL، ورود و مالکیت فایل/نوبت دوباره آزموده شوند. دسترسی عمومی DB را باز نکنید.

## انتقال فایل‌ها

رسیدهای جدید در Store خصوصی Vercel Blob با نام Drsaki هستند. دانلود فقط از API احرازشده، بدون redirect عمومی و با no-store انجام می‌شود. `BLOB_READ_WRITE_TOKEN` فقط سمت سرور است. رسیدهای قدیمی با provider برابر `legacy_s3` خودکار منتقل یا حذف نمی‌شوند. جزئیات متغیرها و انتشار در [گزارش Blob](VERCEL-BLOB.fa.md) آمده است.

## پشتیبان و rollback

پشتیبان رمزگذاری‌شدهٔ دوره‌ای DB و object storage، سیاست retention مصوب و آزمون restore لازم است. حداقل فنی نگهداری رسید جدید هفت روز کامل است؛ مدت الزامی باید جداگانه بررسی و تصویب شود. job حذف پیاده شده ولی `RECEIPT_CLEANUP_ALLOW_DELETE=false` و سیاست پیش‌فرض غیرفعال و dry-run است. پیش از migration production از snapshot/backup تأییدشده استفاده کنید. rollback برنامه با تصویر Docker یا deployment قبلی انجام می‌شود؛ rollback schema باید با migration بررسی‌شده و حفظ داده باشد، نه reset. پایش خطا بدون ثبت OTP یا اطلاعات پزشکی انجام شود.
