# گزارش ادغام Vercel Blob خصوصی — ۲۵ اکتبر ۲۰۲۶

Store موجود **Drsaki** خصوصی است و به پروژهٔ `drsobhansaki` اتصال دارد. Store جدید ساخته نشد. ادغام در اپ موجود انجام شد و آزمون واقعی روی [Preview محافظت‌شده](https://drsobhansaki-mrk0p0s83-alibayern1369s-projects.vercel.app) موفق بود. Production منتشر یا migration نشده است.

## رفتار نهایی

بیمار احرازشده برای نوبت متعلق به خود یک upload intent می‌گیرد. سرور مبلغ، وضعیت پرداخت، حساب بانکی فعال، مالکیت، محدودیت درخواست و تکرار را بررسی می‌کند. مرورگر فقط توکن کوتاه‌عمر محدود به مسیر تصادفی مشخص، MIME مجاز و اندازهٔ اعلام‌شده دریافت می‌کند. نوشتن روی مسیر دلخواه و overwrite مجاز نیست.

آپلود مستقیم با SDK رسمی انجام می‌شود تا فایل پنج مگابایتی از محدودیت بدنهٔ Function عبور نکند. سقف دقیق برنامه ۵٬۲۴۲٬۸۸۰ بایت است. JPEG، PNG، WebP و PDF مجازند. پس از آپلود، سرور خود فایل خصوصی را با سقف حافظه می‌خواند و اندازه، MIME، امضای واقعی و SHA-256 را بررسی می‌کند. فایل نامعتبر برای دانلود پذیرفته نمی‌شود. این بررسی جایگزین اسکن بدافزار نیست؛ وضعیت آن صریحاً همین محدودیت را ثبت می‌کند.

فایل معتبر فقط وضعیت پرداخت را به `under_review` می‌برد. تأیید مستقل واریز توسط مدیر همچنان لازم است. metadata در Neon و باینری فقط در Blob نگهداری می‌شود.

دانلود از `/api/receipts/{receiptId}/download` است. سرور شناسه را به مسیر ثبت‌شده تبدیل می‌کند؛ URL یا pathname ورودی کاربر مبنای دسترسی نیست. مالک یا doctor/super_admin با MFA کمتر از پانزده دقیقه مجاز است. پاسخ stream خصوصی با no-store، attachment، nosniff و sandbox است؛ لینک عمومی یا redirect Blob صادر نمی‌شود.

## وابستگی و پایگاه داده

- نصب `@vercel/blob` نسخهٔ 2.8.2.
- حذف دو وابستگی S3 مربوط به receipt: `@aws-sdk/client-s3` و `@aws-sdk/s3-request-presigner`.
- override برای zod در `@vercel/cli-config` به نسخهٔ وابستگی اصلی؛ audit اجرایی صفر آسیب‌پذیری گزارش کرد.
- migration نسخه‌دار `drizzle/0002_colossal_maginty.sql` و snapshot/journal ساخته و فقط روی Neon development اجرا شدند. reset یا DROP داده انجام نشد.
- metadata رسید با مالک، provider، pathname، نام اصلی، MIME، اندازه، زمان، وضعیت بررسی، وضعیت حذف، تعداد تلاش، خطای امن، موعد retry، انقضای intent و holdها تکمیل شد. جدول `receipt_cleanup_runs` افزوده شد؛ مجموع جدول‌ها ۳۵ است.
- نام TypeScript فیلدها `paymentId` و `fileSize` است؛ ستون فیزیکی قدیمی `submission_id` و `size_bytes` برای سازگاری حفظ شد.
- رکوردهای قبلی `legacy_s3` باقی می‌مانند و خودکار منتقل یا حذف نمی‌شوند. دانلود قدیمی S3 از این مسیر جدید پشتیبانی نمی‌شود؛ انتقال آن‌ها در صورت وجود، کار جداگانه است.

## فایل‌های ساخته‌شده

- migration بالا و `drizzle/meta/0002_snapshot.json`.
- منطق مستقل: `src/lib/receipt-policy.ts`، `receipt-content.ts`، `receipt-upload.ts` و `cron-auth.ts`.
- منطق سرور: `src/server/blob-store.ts`، `receipt-cleanup.ts` و `receipt-http.ts`.
- routeهای `src/app/api/appointments/[appointmentId]/receipt/route.ts` و `receipts/route.ts`.
- routeهای `src/app/api/receipts/uploads/route.ts`، `[receiptId]/route.ts`، `[receiptId]/complete/route.ts` و `[receiptId]/download/route.ts`.
- routeهای `src/app/api/cron/cleanup-receipts/route.ts`، `src/app/api/admin/receipt-storage/route.ts` و `src/app/api/admin/receipts/[receiptId]/retention/route.ts`.
- اجزای `src/components/patient-receipts.tsx` و `receipt-storage-settings.tsx`.
- آزمون‌های `tests/receipts.test.ts`، `receipt-database.test.ts` و `tests/e2e/receipt-security.spec.ts`.
- همین گزارش.

## فایل‌های اصلاح‌شده

`package.json`، `package-lock.json`، `.env.example`، `vercel.json`، `drizzle/meta/_journal.json`، `scripts/test-database.mjs`، `src/db/schema.ts`، `src/lib/domain.ts`، `src/proxy.ts`، `src/server/storage.ts`، `appointments.ts`، `admin-operations.ts`، route قدیمی `src/app/api/[...path]/route.ts`، اجزای `patient-dashboard.tsx`، `admin-panel.tsx` و `admin-appointment-actions.tsx`، README و راهنماهای مدیریت، انتشار، وضعیت و آزمون اصلاح شدند.

فایل‌های محلی `.env*` و `.vercel/` ignored هستند و شامل تنظیمات/هویت موقت‌اند؛ نباید منتشر یا commit شوند. اتصال CLI فایل `.vercel/project.json` را ساخت و هویت OIDC محلی افزود. CLI برای آزمون Preview یک protection bypass ساخت؛ محافظت عمومی Preview خاموش نشد. تنظیمات Secret موجود پروژه تغییر نکردند. Preview متغیرهای مختص همان deployment برای DB توسعه، secrets مستقل و قفل حذف false دارد.

## تنظیمات ورسل

| نام | مقدار یا کاربرد |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Secret موجود اتصال Drsaki؛ فقط سرور |
| `BLOB_STORE_ID` | شناسهٔ واقعی Store موجود، از integration |
| `BLOB_WEBHOOK_PUBLIC_KEY` | مقدار موجود integration؛ روش فعلی callback با SDK و توکن سرور اعتبارسنجی می‌شود |
| `DATABASE_URL` | اتصال pooled شاخهٔ مناسب Neon؛ برای Preview توسعه |
| `AUTH_SECRET` | Secret تصادفی حداقل ۳۲ کاراکتر |
| `CRON_SECRET` | Secret تصادفی حداقل ۳۲ کاراکتر |
| `RECEIPT_CLEANUP_ALLOW_DELETE` | فعلاً و تا اجازهٔ صریح `false` |
| `NEXT_PUBLIC_SITE_URL` | دامنهٔ HTTPS نهایی؛ در تنظیمات فعلی Production موجود نبود |

سه متغیر Blob در Preview و Production وجود داشتند؛ مقدار توکن read/write از نوع Secret و غیرقابل بازخوانی است. `vercel env pull` برای Secret مقدار `[SENSITIVE]` می‌نویسد؛ این مقدار توکن معتبر نیست. ورود CLI به‌تنهایی Secret را روی رایانه آشکار نمی‌کند. برای استفادهٔ محلی از همان اتصال، مقدار توکن را هنگام ایجاد امن نگه دارید یا از بخش توکن‌های Store طبق دسترسی حساب، توکن مخصوص توسعه تهیه کنید و فقط در `.env.local` بگذارید. توکن موجود Production را برای این کار تعویض نکنید. هیچ credential با `NEXT_PUBLIC_` تعریف نشود.

آزمون مستقیم SDK با OIDC محلی به دلیل مجاز نبودن محیط development رد شد؛ این مجوز تغییر نکرد. آزمون واقعی موفق از طریق Functionهای Preview با Secret موجود read/write انجام شد.

## Cron و حذف

Cron جدید `/api/cron/cleanup-receipts` روزانه ساعت ۰۳:۰۰ UTC است؛ Cron قبلی `/api/jobs` در ۰۶:۰۰ UTC حفظ شد. دو زمان‌بندی روزانه با محدودیت جاری Hobby سازگارند؛ زمان اجرای دقیق در Hobby تضمین دقیقه‌ای ندارد. پیکربندی در deployment موجود است؛ Cron زمان‌بندی‌شده با انتشار Production فعال می‌شود، بنابراین اجرای زمان‌بندی‌شدهٔ Production هنوز ادعا نمی‌شود.

پیش‌فرض سیاست: غیرفعال، dry-run، حداقل هفت روز، الزامات اجباری بررسی‌نشده. تصویب مدت الزامی توسط super_admin و بررسی حقوقی/حسابداری لازم است. حتی پس از تصویب، قفل محیطی false مانع حذف می‌شود. این قفل در این کار true نشده است.

حذف فقط پس از گذشت مدت بیشتر از حداقل هفت روز، مدت سیاست و الزام اجباری و نهایی‌شدن هر سه وضعیت رسید/پرداخت/نوبت مجاز است. اختلاف، hold دستی/حقوقی، تاریخ الزام آینده و وضعیت در حال بررسی مانع‌اند. قفل advisory تراکنشی و row lock از هم‌پوشانی و تغییر هم‌زمان سیاست/hold جلوگیری می‌کنند. batch محدود، timeout، خطای بدون اطلاعات حساس و retry با فاصله پیاده شده‌اند. حذف فقط object است؛ تاریخ مالی و نوبت باقی می‌مانند. شیء ازقبل‌مفقود به‌صورت idempotent مدیریت می‌شود.

## نتایج واقعی

- `npm run test:db`: ۴۸ موفق، صفر خطا، صفر skip؛ شامل DB واقعی development با rollback و رقابت قفل cleanup.
- Playwright: ۱۷ موفق؛ شامل چهار آزمون امنیت API جدید.
- build، lint و typecheck موفق شدند؛ نتیجهٔ نهایی در TEST-RESULTS ثبت است.
- روی Preview واقعی: آپلود PNG ساختگی خصوصی، بررسی signature/hash و metadata Neon، دانلود byte-for-byte مالک و پزشک با MFA تازه موفق بود.
- روی همان Preview: دانلود ناشناس 401، بیمار دیگر منع دسترسی، لینک مستقیم Blob غیرقابل خواندن و پاسخ خصوصی no-store بود.
- پرداخت و metadata پس از آپلود `under_review` ماندند؛ هیچ واریز ساختگی تأیید نشد.
- Cron واقعی: بدون Bearer برابر 401؛ با Secret صحیح برابر 200، `dryRun:true` و `deleted:0` بود.
- سناریوهای حذف موفق، شیء مفقود، شکست/retry، مرز هفت روز، pending، dispute، hold و قفل مجوز با storage mock آزموده شدند. حذف واقعی رسید بیمار یا فعال‌سازی destructive cleanup انجام نشد.

## موارد باقی‌مانده

Production باید با شاخهٔ صحیح Neon، migration بررسی‌شده و دامنهٔ نهایی منتشر شود؛ مقدار write-only DATABASE_URL فعلی بدون تغییر حفظ شده و مقصد آن از این بررسی معلوم نشده است. اسکن بدافزار، پیامک واقعی، تأیید واریز بانکی واقعی و الزامات حقوقی این ادغام را آزموده یا تأیید نمی‌کند.

یک تصویر بسیار کوچک ساختگی و metadata آن برای ثبت نتیجهٔ آزمون، خصوصی در Store/DB توسعه باقی ماندند؛ نشست‌ها باطل و تمام حساب‌های کاربری و بانکی ساختگی غیرفعال شدند. روی نمونه hold ثبت شد. intent بدون فایلِ تلاش اولیه نیز در توسعه با hold باقی است. این نمونه‌ها فایل بیمار نیستند و تحت حذف خودکار فعال قرار نگرفتند. جزئیات شناسایی نمونهٔ موفق فقط در فایل ignored محلی `.vercel/blob-verification-record.json` است. داده‌های واقعی Production تغییر نکردند.

## مستندات مبنا

[ذخیره‌سازی خصوصی](https://vercel.com/docs/vercel-blob/private-storage)، [آپلود مستقیم](https://vercel.com/docs/vercel-blob/client-upload)، [SDK رسمی](https://vercel.com/docs/vercel-blob/using-blob-sdk)، [محدودیت Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)، [Secret غیرقابل بازخوانی](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types).
