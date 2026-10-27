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

فایل [artech-flow-bypasser-firefox.xpi](https://github.com/artechcafe/artech-flow-bypasser/releases/download/firefox-v1.6.1/artech-flow-bypasser-firefox.xpi) را در فایرفاکس باز کنید و «Add» را بزنید. اگر پنجرهٔ افزونه دکمهٔ «دادن اجازه» نشان داد، بزنید و تب Flow را رفرش کنید.

نسخه‌های بعدی از طریق [`updates.json`](updates.json) خودکار آپدیت می‌شوند.
