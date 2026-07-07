# VRK Tours and Travels

Full working car booking, tour package, owner/admin, driver, payment-confirmation, and printable bill project.

## What is included

- Customer website for car bookings, one way trips, tour packages, and one day packages.
- Owner/admin portal to add cars, tour packages, one day packages, drivers, payment details, and manage bookings.
- Driver portal to view assigned trips and update trip status.
- Owner/admin-controlled final price, fare breakup, inclusions, exclusions, and confirmation message.
- Customer payment-detail submission after owner confirmation.
- Printable bill/ticket page for each booking.
- JSON-file database at `data/store.json`.
- Live updates using Server-Sent Events, so changes refresh across open portals.
- No external npm packages required.

## Run the project

```powershell
node server.js
```

Open these URLs:

- Customer website: `http://localhost:5173/`
- Admin portal: `http://localhost:5173/admin.html`
- Driver portal: `http://localhost:5173/driver.html`

If port `5173` is already busy, the server automatically tries `5174`, `5175`, `5176`, and `5177`.

## Verify the project

```powershell
node scripts/verify.js
```

The verification script starts a temporary server, checks all three pages, creates a booking, assigns a driver, updates the trip from the driver portal API, checks customer tracking, and then stops the temporary server.

## Hosting

See `HOSTING.md` for Render deployment steps, persistent disk setup, environment variables, and custom domain notes.

## Owner login

- Admin PIN: `1234`

## Business flow

1. Owner/admin opens `admin.html` and enters business settings, payment instructions, cars, packages, and drivers.
2. Customer selects a car or package and submits a booking request.
3. Owner/admin sees the booking instantly, sets exact fare breakup, inclusions, exclusions, final amount, and confirmation status.
4. Customer tracks the booking ID, sees the confirmed amount, submits payment details, and can open the bill/ticket.
5. Owner/admin verifies payment and assigns car and driver.
6. Driver logs in, sees only assigned trips, and updates trip status.
7. Customer and owner/admin can print the booking bill/ticket.

## Fresh data

The project now starts without sample cars, packages, drivers, or bookings. The owner must enter all real business data from the admin portal.

## Files

- `server.js` - Node.js web server, API, live events, and persistence.
- `data/seed.json` - default data copied when the database is first created.
- `data/store.json` - generated database file after the first run.
- `public/index.html` - customer website.
- `public/admin.html` - admin portal.
- `public/driver.html` - driver portal.
- `public/bill.html` - printable booking bill/ticket.
- `public/js/*.js` - frontend logic.
- `public/css/styles.css` - shared responsive design.

## Reset demo data

Stop the server, delete `data/store.json`, then run:

```powershell
node server.js
```

The app will recreate a clean `data/store.json` from `data/seed.json`.
