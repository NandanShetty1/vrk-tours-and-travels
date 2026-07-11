# VRK Customer Login Setup

Use Firebase Authentication for customer login because it supports phone OTP, email, Google, Apple, and Microsoft in one system.

## 1. Create Firebase project

1. Open https://console.firebase.google.com/
2. Create a project for `VRK Tours and Travels`.
3. Add a Web app.
4. Copy the Firebase web config:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "..."
};
```

The Firebase web `apiKey` is not a password. It identifies the Firebase project, but it should still be restricted to your website domain in Google Cloud.

## 2. Authorize website domain

In Firebase Console:

1. Go to Authentication.
2. Open Settings.
3. In Authorized domains, add:
   - `vrk-tours-and-travels.onrender.com`
   - your custom domain later, for example `vrktours.com`

Phone OTP will not work correctly until the production domain is authorized.

## 3. Enable sign-in methods

In Firebase Console > Authentication > Sign-in method:

1. Enable Phone.
2. Enable Email if you want email/password or email-link login.
3. Enable Google.
4. Enable Apple only after Apple Developer setup.
5. Enable Microsoft and paste Microsoft Client ID and Client Secret from Microsoft Azure.

For phone OTP, also set SMS region policy to allow India and any other country you serve.

## 4. Apple and Microsoft extra keys

Apple login requires Apple Developer Program setup. Apple will give a Services ID, Team ID, Key ID, and private key. Add those in Firebase Apple provider settings, not in public code.

Microsoft login requires an app registration in Microsoft Azure. Copy Client ID and Client Secret into Firebase Microsoft provider settings, not in public code.

## 5. Backend verification

After Firebase login works in the browser, the browser sends a Firebase ID token to this Node server. The server must verify it using Firebase Admin SDK before creating a trusted customer account.

Render environment variables needed later:

```text
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Never put the Firebase private key, Apple private key, Microsoft secret, or payment gateway secret inside HTML, browser JavaScript, GitHub, or the admin portal.

## 6. Current project status

The website now has the correct account icon and login/create-account popup UI. Real OTP/social sign-in becomes active after the Firebase project and provider keys are created.
