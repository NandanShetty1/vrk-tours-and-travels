# VRK Customer Account Status

Customer account login is currently disabled on the public website because the owner said it is not required.

Customers can book directly by entering:

- Customer name
- Mobile number
- Email, optional
- Passenger count
- Travel date
- Pickup and drop locations
- Notes

The admin still manages cars, packages, banners, bookings, fare confirmation, drivers, payments, and bills from the admin portal.

Firebase environment variables may remain in Render, but the public customer booking flow does not require Firebase login, OTP, Google sign-in, or account creation.

If customer accounts are needed again later, re-enable the account UI and the booking authentication check in `public/js/customer.js` and `server.js`.
