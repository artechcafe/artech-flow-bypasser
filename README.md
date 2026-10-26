# Artech Flow Bypasser

**English** · [فارسی](#فارسی)

A Chrome extension that fixes the **"Flow is not available in your country"** error in [Google Flow](https://flow.google.com) (Google's AI video and image studio with Veo, Omni and Nano Banana), and adds prompt tools Flow doesn't have.

By [artech.cafe](https://artech.cafe) · [Instagram](https://instagram.com/artech.cafe) · [Telegram](https://t.me/artechcafe) · [YouTube](https://www.youtube.com/c/artechcafe)

### Features

- **Region fix:** removes the "unsupported country" and "you don't have access to Flow" screens in the browser.
- **Swap a tagged reference with one click** in the prompt box, and preview it on hover.
- **Persian (RTL) prompts** shown right-to-left, plus Persian-to-English prompt translation.
- **Negative prompt** added as its own line at the end of the prompt.
- **Finish notification** when a generation is done while you're in another tab.
- **Auto-retry** of failed generations (off by default).
- **Update notice** in the extension popup when a new version is published here.

### Install

1. Download the latest ZIP: [artech-flow-bypasser.zip](https://github.com/artechcafe/artech-flow-bypasser/releases/latest/download/artech-flow-bypasser.zip)
2. Extract it to a folder you will keep (for example Documents).
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Click **Load unpacked** and select that folder.
5. Open or refresh Google Flow.

### Firefox

A Firefox version (Firefox 128+) is in the [`firefox/`](firefox) folder. Until it is signed by Mozilla it installs only as a temporary add-on: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `firefox/manifest.json`. It is removed when Firefox closes.

### Notes

- The extension does not change your IP. You still need a VPN; if Flow opens and makes images but video generation says *"You've reached your usage limit"*, switch the VPN server to another country (preferably the US).
- Changing Flow's region check is against Google's terms and could get an account limited. Use a separate Google account if yours matters.

---

<div dir="rtl">

## فارسی

افزونهٔ کروم برای رفع خطای «کشور شما پشتیبانی نمی‌شود» در Google Flow، به‌همراه ابزارهای اضافه برای پرامپت‌نویسی و کار با Flow.

سازنده: [artech.cafe](https://artech.cafe) · [اینستاگرام](https://instagram.com/artech.cafe) · [تلگرام](https://t.me/artechcafe) · [یوتیوب](https://www.youtube.com/c/artechcafe)

## نصب

1. فایل ZIP آخرین نسخه را دانلود کنید: [Download ZIP](https://github.com/artechcafe/artech-flow-bypasser/releases/latest/download/artech-flow-bypasser.zip)
2. فایل را extract کنید و پوشهٔ داخلش را جایی نگه دارید که پاکش نمی‌کنید (مثلاً Documents).
3. در کروم به `chrome://extensions` بروید و «Developer mode» را روشن کنید.
4. «Load unpacked» را بزنید و همان پوشه را انتخاب کنید.
5. تب Google Flow را باز کنید یا یک بار رفرش کنید.

## فایرفاکس

نسخهٔ فایرفاکس (۱۲۸ یا جدیدتر) در پوشهٔ [`firefox/`](firefox) است. تا وقتی موزیلا امضایش نکرده، فقط به‌صورت موقت نصب می‌شود: به `about:debugging#/runtime/this-firefox` بروید، «Load Temporary Add-on…» را بزنید و فایل `firefox/manifest.json` را انتخاب کنید. با بستن فایرفاکس حذف می‌شود.

## ابزارهای اضافه

همه از بخش «ابزارهای اضافه» در پنجرهٔ افزونه روشن/خاموش می‌شوند و بدون رفرش صفحه اعمال می‌شوند.

| ابزار | فایل | توضیح |
| --- | --- | --- |
| تعویض رفرنس با کلیک | `ref-swap.js` | کلیک روی رفرنس تگ‌شده، انتخابگر Flow را باز می‌کند؛ رفرنس جدید جای قبلی می‌نشیند و تصویر قبلی از نوار بالای پرامپت حذف می‌شود. Esc لغو می‌کند. |
| پیش‌نمایش رفرنس | `ref-preview.js` | با بردن موس روی رفرنس تگ‌شده، تصویرش نمایش داده می‌شود. |
| پرامپت فارسی راست‌چین | `rtl.js` | متن فارسی در پرامپت و تاریخچه راست‌چین و با ترتیب درست کلمات. |
| ترجمهٔ فارسی به انگلیسی | `translate.js` | بخش‌های فارسی پرامپت ترجمه می‌شوند و رفرنس‌ها دست نمی‌خورند. مترجم داخلی Chrome (فعلاً) فارسی ندارد، پس متن به Google Translate فرستاده می‌شود. |
| پرامپت منفی | `negative.js` | با دکمهٔ «افزودن به پرامپت»، «Avoid: …» در یک خط جداگانه در انتهای پرامپت اضافه می‌شود؛ هیچ‌وقت دوبار. |
| اعلان پایان ساخت | `notify.js` | وقتی در تب یا برنامهٔ دیگری هستید: اعلان ویندوز، صدای کوتاه و شمارنده روی عنوان تب. |
| تلاش دوبارهٔ خودکار | `auto-retry.js` | ساخت ناموفق (نه لغوشده) را با دکمهٔ Retry خود Flow حداکثر ۲ بار دوباره امتحان می‌کند؛ سقف کلی ۵ بار در ۱۰ دقیقه. پیش‌فرض خاموش. |

## نکته

این افزونه IP شما را تغییر نمی‌دهد و فقط بررسی منطقه در سمت مرورگر را برمی‌دارد. اگر گوگل در سمت سرور هم منطقه را بررسی کند، بعضی امکانات ممکن است باز هم کار نکنند.
دور زدن محدودیت منطقه خلاف قوانین گوگل است و ممکن است حساب شما محدود شود.

</div>
