# Hosting VRK Tours and Travels

Recommended first hosting option: Render Web Service with a persistent disk.

## Why Render

This project is a Node.js web app and stores owner-entered bookings in a JSON file. On cloud hosting, normal files can be temporary. Use a persistent disk so `store.json` is not lost after restart or redeploy.

## Before Uploading

Keep these files:

- `server.js`
- `package.json`
- `data/seed.json`
- `public/`
- `scripts/`
- `README.md`

Do not upload private runtime data unless you really want it online:

- `data/store.json`
- `server.log`
- `server.err.log`
- `node_modules/`

The `.gitignore` already excludes these.

## Render Setup

1. Create a GitHub account if you do not already have one.
2. Create a new GitHub repository, for example `vrk-tours-and-travels`.
3. Upload this project folder to that repository.
4. Open Render Dashboard.
5. Click `New` -> `Web Service`.
6. Connect the GitHub repository.
7. Use these settings:

```text
Language: Node
Build Command: npm install
Start Command: node server.js
```

8. Add a persistent disk:

```text
Mount path: /var/data
Size: smallest available size is enough to start
```

9. Add environment variables:

```text
DATA_DIR=/var/data
NODE_ENV=production
```

10. Deploy.

After deploy, Render gives a public URL like:

```text
https://your-service-name.onrender.com
```

Your pages will be:

```text
Customer: https://your-service-name.onrender.com/
Admin:    https://your-service-name.onrender.com/admin.html
Driver:   https://your-service-name.onrender.com/driver.html
```

## After Deploy

1. Open `/admin.html`.
2. Login with PIN `1234`.
3. Go to `Settings`.
4. Change the admin PIN immediately.
5. Add business phone, email, address, UPI ID, bank details, and bill terms.
6. Add cars, packages, and drivers.
7. Test one customer booking.

## Custom Domain

In Render, open the service and go to `Settings` -> `Custom Domains`.

Add your domain, then update DNS in your domain provider as Render shows. After DNS verification, Render issues HTTPS/TLS for the domain.

## Production Note

This app currently uses manual owner-verified payment details. For automatic real online payment collection, connect Razorpay or Stripe before launch.
