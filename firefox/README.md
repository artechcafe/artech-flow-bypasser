# Artech Flow Bypasser — Firefox

نسخهٔ فایرفاکس افزونه (فایرفاکس ۱۲۸ یا جدیدتر). روی Flow واقعی تست شده: Flow باز می‌شود و ابزارها کار می‌کنند.

## تفاوت با نسخهٔ کروم

| | کروم | فایرفاکس |
| --- | --- | --- |
| رفع خطای کشور | `inject/patch.js` داخل صفحهٔ Flow جواب‌ها را تغییر می‌دهد | `background.js` با `webRequest.filterResponseData` جواب را قبل از رسیدن به صفحه تغییر می‌دهد؛ منطق تغییر در `rewrite.js` |
| پس‌زمینه | service worker | background script (event page) |
| شمارندهٔ پنجرهٔ افزونه | از داخل صفحه خوانده می‌شود | `background.js` برای هر تب نگه می‌دارد |
| ترجمه | مترجم داخلی کروم یا Google Translate | فقط Google Translate |
| اجازه‌ها | `scripting` | `webRequest`، `webRequestBlocking` و `webRequestFilterResponse` (برای تغییر جواب‌ها) |

ابزارهای داخل Flow (`features/`) همان فایل‌های نسخهٔ کروم هستند.

## نصب

1. مخزن را دانلود و extract کنید.
2. در فایرفاکس به `about:debugging#/runtime/this-firefox` بروید.
3. «Load Temporary Add-on…» را بزنید و فایل `firefox/manifest.json` را انتخاب کنید.
4. Google Flow را باز کنید. اگر پنجرهٔ افزونه دکمهٔ «دادن اجازه» نشان داد، بزنید و تب را رفرش کنید.
