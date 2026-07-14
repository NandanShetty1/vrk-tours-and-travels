# VRK Admin Login Setup

The admin portal uses Firebase Authentication email/password login and Firestore admin permission records.

## Create Admin User

Firebase Console:

1. Open Authentication.
2. Open Users.
3. Click Add user.
4. Enter the admin email and password.
5. Copy the user's UID.

## Allow Admin In Firestore

Firebase Console:

1. Open Firestore Database.
2. Create database if it is not created yet.
3. Create collection: `adminUsers`.
4. Create document with the Firebase Authentication UID as the document ID.
5. Add these fields:

```text
email: admin@example.com
name: Owner
role: owner
active: true
```

Use lowercase email in Firestore.

Allowed roles:

- `owner`
- `admin`

If `active` is `false`, login is blocked.

## Enable Password Login

Firebase Console > Authentication > Sign-in method:

1. Open Email/Password.
2. Enable Email/Password.
3. Save.

## Forgot Password

The Admin Portal Forgot password button sends a Firebase password reset email to the admin email.

## Render Environment

Render must already have the Firebase web config and Firebase Admin service account variables:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_APP_ID
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MEASUREMENT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Do not put admin passwords in Render or GitHub.
