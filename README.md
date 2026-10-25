# RG GAMER BOY FF Rewards — release starter

## Included
- `public/user.html`: user site with the supplied banner, daily +10 Cards, task rewards, 1–7 day selector, card pricing and order history.
- `public/admin.html`: Firebase email/password admin login and shared order dashboard.
- `server.js`: Express API using Firebase Admin SDK. Server-side balance checks and card deductions; orders saved to Realtime Database.
- `database.rules.json`: default-deny rules. The backend uses the Firebase Admin SDK and is not limited by client rules.

## Important setup (must do before launch)
1. In Firebase Console → Authentication → Sign-in method, enable **Anonymous** for the user site and **Email/Password** for the admin.
2. Create the admin account in Firebase Authentication. Copy its UID.
3. In Firebase Console → Project settings → Service accounts, generate a private key for Firebase Admin SDK. Keep it private; never put it in HTML or GitHub. In Railway Variables, set:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = the entire service-account JSON on one line
   - `FIREBASE_DATABASE_URL` = `https://rg-key-website-default-rtdb.asia-southeast1.firebasedatabase.app`
   - `ADMIN_UIDS` = the admin UID (multiple UIDs separated by commas)
4. Deploy this folder as a Railway Node project; start command is `npm start`. Railway should install dependencies from `package.json`.
5. In Firebase Realtime Database → Rules, publish the contents of `database.rules.json` (default deny).
6. Serve `public/admin.html` on the same Railway domain at `/admin.html`. The user page is `/`.
7. Test with a non-admin user and admin account before sharing publicly.

## Current pricing and rewards
Plans: 1 day FREE; 2 days FREE; 3 days 100 Cards; 4 days 150; 5 days 300; 6 days 650; 7 days 1000.
Daily bonus: 10 Cards per UTC calendar day.
Tasks: YouTube 20; WhatsApp channel 15; Discord 20; Video 1 = 5; WhatsApp groups = 10 each; other two videos = 1 each; Daily task = 15; Small task = 5.

## Security and limitations
- Never make Realtime Database rules public. Keep them deny-by-default because the backend uses Admin SDK.
- Admin authorization is checked by UID against `ADMIN_UIDS` on every admin API request. Hiding the admin page is not security.
- User identity uses Firebase anonymous auth. If a user clears browser data or changes device, anonymous identity may change and their balance/order history may not follow them. Add account linking if persistent cross-device identity is required.
- Task claims are rate-limited to one per task per shared UTC day, but the server cannot independently prove a user subscribed/joined/watched. Do not advertise task completion as verified. For anti-fraud, require admin review or implement trusted platform verification.
- Orders deduct Cards at submission and are marked Pending. Status changes do not automatically grant Discord roles. A Discord bot/backend integration is needed to grant/revoke roles and enforce expiry durations.
- If an order fails to save after the balance transaction, the API attempts to restore the Cards. Review logs and test before production.
- Use HTTPS (Railway provides this). Never publish the Firebase service-account private key.
