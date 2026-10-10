# راه‌اندازی بدون حساب پرداخت

ورود Kick روی **Cloudflare Workers Free** اجرا می‌شود. Firebase روی Spark باقی می‌ماند؛ Functions و Blaze لازم نیستند. فایل‌های سایت همچنان روی GitHub Pages هستند. پلن رایگان Workers سقف مصرف دارد و نامحدود نیست.

## ۱. ساخت Worker

در داشبورد Cloudflare، بخش Workers & Pages، یک Worker با نام `chatbattle-auth` بساز. در ویرایشگر کد، محتوای `worker/worker.mjs` را جایگزین نمونه کن و Deploy بزن. نیازی به نصب package، KV، D1 یا دامنهٔ اختصاصی نیست. پیش از تنظیم Secrets، Worker درخواست ورود را با وضعیت 503 رد می‌کند.

## ۲. Variables and Secrets

در تنظیمات Worker این چهار مقدار عمومی را به‌صورت Text اضافه کن:

| نام | مقدار |
|---|---|
| `KICK_CLIENT_ID` | `01M4KM71HWC2MQQTYRWFQE5KYF` |
| `KICK_REDIRECT_URI` | `https://ahmadramzy1.github.io/chatBattle/kick-callback.html` |
| `SITE_ORIGIN` | `https://ahmadramzy1.github.io` |
| `FIREBASE_PROJECT_ID` | `chat-battle-b976d` |

دو مقدار زیر باید از نوع **Secret** باشند:

- `KICK_CLIENT_SECRET`: مقدار Secret اپ ساخته‌شده در Kick.
- `FIREBASE_SERVICE_ACCOUNT`: محتوای کامل فایل JSON حساب سرویس Firebase، شامل private_key و client_email.

برای دریافت JSON در Firebase به **Project settings → Service accounts → Firebase Admin SDK → Generate new private key** برو. فایل را روی دستگاه خودت نگه دار و محتوای آن را مستقیم در فیلد Secret کلادفلر وارد کن. فایل یا محتوای آن را در GitHub یا چت نفرست. این کلید امکان امضای توکن ورود Firebase دارد؛ فقط در Worker نگهداری می‌شود.

تنظیمات را ذخیره و Deploy کن. آدرس عمومی Worker معمولاً شبیه `https://chatbattle-auth.YOUR-SUBDOMAIN.workers.dev` خواهد بود؛ همان آدرس را برای تکمیل تنظیم سایت ارائه کن. در `kick-config.js` باید `KICK_AUTH_API` برابر این آدرس باشد. Redirect URL اپ Kick همچنان همان آدرس GitHub Pages است.

## ۳. قوانین و انتشار سایت

در Firestore → Rules محتوای `firestore.rules` همین شاخه را جایگزین و Publish کن. سپس کد کامل سایت را روی main منتشر کن. ترتیب مهم است: ابتدا Worker و Secrets، سپس Rules و در پایان سایت. تا پیش از تنظیم Worker، نسخهٔ جدید سایت برای ارسال ویدیو آماده نیست.

ورود Anonymous میزبان را فعال نگه دار. حساب Kick بیننده در یک نشست Firebase جدا قرار می‌گیرد تا مالکیت اتاق میزبان تغییر نکند. برای آزمایش نهایی یک مسابقهٔ جدید بساز؛ نام‌های ثبت‌شده در مسابقه‌های قدیمی به‌طور خودکار تأیید نمی‌شوند.

## نحوهٔ احراز هویت

State با HMAC امضا و به PKCE متصل می‌شود و ده دقیقه اعتبار دارد. Kick کد ورود را یک بار مصرف می‌کند؛ Worker بدون دریافت موفق توکن و اطلاعات حساب از Kick، توکن Firebase صادر نمی‌کند. شناسهٔ Firebase از ID ثابت Kick ساخته می‌شود. Firestore نام ثبت‌شده را با claim امضاشده کنترل می‌کند. ایمیل و توکن‌های دسترسی Kick ذخیره نمی‌شوند. درخواست به سرویس بیرونی فقط به endpointهای ثابت Kick ارسال می‌شود.

## بررسی

```sh
node --test tournament.test.cjs worker/worker.test.mjs
```

تست Worker امضای واقعی RSA توکن خروجی را با کلید آزمایشی بررسی می‌کند؛ پاسخ Kick شبیه‌سازی‌شده است. تست زندهٔ ورود، سهمیه/CPU محیط واقعی Workers و Rules پس از تنظیم حساب‌ها باید انجام شود.

منابع: [Workers Free بدون کارت](https://www.cloudflare.com/products/workers/)، [محدودیت‌ها](https://developers.cloudflare.com/workers/platform/limits/)، [توکن سفارشی Firebase](https://firebase.google.com/docs/auth/admin/create-custom-tokens).
