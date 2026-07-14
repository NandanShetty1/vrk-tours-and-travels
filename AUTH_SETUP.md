# VRK Customer Login Setup

The customer website is prepared for real verified login. Customers cannot be treated as signed in just by typing an email or mobile number. Real login uses Firebase Authentication.

## What Works After Setup

- New customer clicks the account icon, chooses Create account, verifies mobile OTP/email/social login, then account is created.
- Existing customer clicks Login and verifies again.
- Create account requires customer name plus one verified login method.
- If an existing customer clicks Create account, the website shows: "You already have an account. Please login."
- If a new customer clicks Login before creating an account, the website shows: "No customer account found. Please create an account first."
- Customer can logout.
- Customer can delete their VRK website account.
- After Firebase is configured, booking requires a verified customer account.
- Phone OTP is shown as India-only for now: customer selects `India +91` and enters a 10-digit Indian mobile number.
- The backend only trusts phone/email values verified by Firebase. A typed email is not treated as verified until the customer uses the email login link.

## Firebase Project

1. Open https://console.firebase.google.com/
2. Create project: `VRK Tours and Travels`.
3. Add a Web app.
4. Copy the Firebase web config values.

Add these in Render > your service > Environment:

```text
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_APP_ID=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MEASUREMENT_ID=...
```

The web `FIREBASE_API_KEY` is not a password, but restrict it to your website domain in Google Cloud.

## Firebase Admin Backend Keys

Firebase Console:

1. Project settings.
2. Service accounts.
3. Generate new private key.
4. Copy these values into Render environment:

```text
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Keep `FIREBASE_PRIVATE_KEY` secret. Never put it in HTML, browser JavaScript, GitHub, or admin portal fields.

## Authorized Domains

Firebase Console > Authentication > Settings > Authorized domains:

```text
vrk-tours-and-travels.onrender.com
your custom domain later
```

## Enable Sign-In Methods

Firebase Console > Authentication > Sign-in method:

- Phone: enable for mobile OTP.
- Email/Password: enable Email link/passwordless sign-in if available in your Firebase console.
- Google: enable and configure consent screen in Google Cloud.
- Apple: needs Apple Developer account, Services ID, Team ID, Key ID, and private key.
- Microsoft: needs Microsoft Azure App Registration Client ID and Client Secret.

For Phone, set the SMS region policy to allow India. The website currently shows only `India +91`.

## Google OAuth

In the Google provider screen, Firebase may ask for project-level settings before Save is enabled:

1. Set Public-facing name for project to `VRK Tours and Travels`.
2. Select Support email for project from the dropdown. This must be your owner Gmail/Google account email.
3. Click Save.

For this website, ignore the Android SHA-1 message unless you later build an Android app. Firebase can create the Google OAuth client automatically. Keep the authorized domain as your Render/custom domain.

## Apple OAuth

Apple Developer account is required:

1. Create an Identifier / Services ID.
2. Add Firebase callback URL shown in Firebase Apple provider settings.
3. Create Apple private key.
4. Add Team ID, Key ID, Services ID, and private key into Firebase Apple provider settings.

## Microsoft OAuth

Microsoft Azure Portal:

1. App registrations.
2. New registration.
3. Add Firebase callback URL shown in Firebase Microsoft provider settings.
4. Create Client Secret.
5. Add Client ID and Client Secret into Firebase Microsoft provider settings.

## After Adding Keys

1. Render service > Manual Deploy > Deploy latest commit.
2. Open customer website.
3. Click top-right account icon.
4. Test Create account with your phone/email.
5. Test Login with the same account.
