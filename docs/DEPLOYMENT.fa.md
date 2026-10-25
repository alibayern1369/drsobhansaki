# انتشار و انتقال

## Vercel

مخزن GitHub را به Vercel متصل کنید. تنظیمات محیط در پنل Vercel وارد شوند؛ فایل محیط commit نشود. `NEXT_PUBLIC_SITE_URL` را روی دامنهٔ HTTPS نهایی قرار دهید. برای preview، branch پایگاه دادهٔ جدا و سرویس پیامک آزمایشی استفاده کنید. migration در build اجرا نمی‌شود؛ SQL باید جداگانه بررسی، روی branch توسعه آزموده و سپس برای production تأیید شود.

`vercel.json` یک اجرای روزانه برای outbox دارد. برای اعلان سریع‌تر و انقضای دقیق نوبت، job runner با دورهٔ کوتاه‌تر و مطابق محدودیت پلن تنظیم کنید. endpoint `/api/jobs` به Bearer برابر `CRON_SECRET` نیاز دارد. سرویس SMS باید شناسهٔ یکتا/رفتار idempotent ارائه دهد؛ در وضعیت crash احتمال ارسال تکراری یا باقی‌ماندن sending هنوز باید مدیریت شود.

## VPS

`docker compose up -d --build` برنامه را روی loopback پورت ۳۰۰۰ اجرا می‌کند. reverse proxy با HTTPS مثل Caddy یا Nginx لازم است. کانتینر با کاربر غیر root اجرا می‌شود. `.env.local` فقط روی سرور و با دسترسی محدود نگهداری شود. Docker در این محیط اجرا و آزموده نشده است.

برای اجرای standalone بدون Docker، پوشه‌های public و .next/static را کنار خروجی .next/standalone کپی و `node .next/standalone/server.js` را اجرا کنید. `npm start` برای آزمایش محلی build است.

## انتقال PostgreSQL

از اتصال مستقیم برای `pg_dump --format=custom` استفاده کنید. فایل پشتیبان شامل داده حساس است؛ آن را رمزگذاری کنید. نسخهٔ سازگار PostgreSQL را آماده کنید؛ ابتدا restore روی محیط مجزا و کنترل تعداد رکوردها، constraints و آزمون خواندن/نوشتن انجام شود. سپس در بازهٔ نگهداری writes متوقف، dump نهایی تهیه و با `pg_restore` منتقل شود. پس از تغییر DATABASE_URL، ورود و مالکیت فایل/نوبت دوباره آزموده شوند. دسترسی عمومی DB را باز نکنید.

## انتقال فایل‌ها

رسیدها در bucket خصوصی S3-compatible هستند. object keyها باید ثابت بمانند. با ابزار سازگار S3، فایل‌ها و checksumها را منتقل، سپس S3_ENDPOINT و کلیدها را تغییر دهید. دسترسی عمومی bucket نباید فعال شود. URLهای امضاشده ۶۰ ثانیه اعتبار دارند و نام فایل کاربر object key نیست.

## پشتیبان و rollback

پشتیبان رمزگذاری‌شدهٔ دوره‌ای DB و object storage، سیاست retention مصوب و آزمون restore لازم است. زمان نگهداری ۱۸۰روزه در مدل رسید فعلاً مقدار پایه است و job حذف هنوز پیاده نشده؛ آن را سیاست نهایی حقوقی تلقی نکنید. پیش از migration production از snapshot/backup تأییدشده استفاده کنید. rollback برنامه با تصویر Docker یا deployment قبلی انجام می‌شود؛ rollback schema باید با migration بررسی‌شده و حفظ داده باشد، نه reset. پایش خطا بدون ثبت OTP یا اطلاعات پزشکی انجام شود.
