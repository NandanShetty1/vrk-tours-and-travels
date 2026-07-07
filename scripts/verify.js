const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const STORE_FILE = path.join(ROOT, "data", "store.json");
const SEED_FILE = path.join(ROOT, "data", "seed.json");
const PORT = 5188;

function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return {
    child,
    async wait() {
      const startedAt = Date.now();
      while (Date.now() - startedAt < 10000) {
        if (output.includes(`http://127.0.0.1:${PORT}`)) {
          return `http://127.0.0.1:${PORT}`;
        }
        if (child.exitCode !== null) {
          throw new Error(`Server exited early:\n${output}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      throw new Error(`Server did not start in time:\n${output}`);
    }
  };
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `${route} failed with ${response.status}`);
  }
  return data;
}

async function checkPage(base, route) {
  const response = await fetch(`${base}${route}`);
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  return response.status;
}

async function main() {
  const originalStore = await fs.readFile(STORE_FILE, "utf8").catch(() => null);
  const cleanSeed = await fs.readFile(SEED_FILE, "utf8");
  await fs.writeFile(STORE_FILE, cleanSeed, "utf8");

  const { child, wait } = startServer();
  try {
    const base = await wait();
    const pageStatuses = {
      customer: await checkPage(base, "/"),
      admin: await checkPage(base, "/admin.html"),
      driver: await checkPage(base, "/driver.html"),
      bill: await checkPage(base, "/bill.html"),
      css: await checkPage(base, "/css/styles.css")
    };

    const publicEmpty = await request(base, "/api/public-data");
    const adminLogin = await request(base, "/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ pin: "1234" })
    });

    await request(base, "/api/admin/business", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        name: "VRK Tours and Travels",
        phone: "+91 90000 00000",
        email: "owner@vrktravels.local",
        address: "Owner office address",
        upiId: "vrk@upi",
        paymentInstructions: "Pay only after owner confirms the final fare.",
        invoicePrefix: "VRK",
        terms: "Final amount is owner confirmed.\nExtra kilometers are chargeable."
      })
    });

    const carResult = await request(base, "/api/admin/cars", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        name: "Owner Sedan",
        category: "Sedan",
        seats: 4,
        fuel: "Petrol",
        luggage: "2 bags",
        ratePerKm: 16,
        dayRate: 2800,
        features: "AC\nExperienced driver",
        includedItems: "Driver allowance for local city\nBasic route planning",
        extraCharges: "Toll and parking extra\nNight charges extra",
        active: true
      })
    });

    const driverResult = await request(base, "/api/admin/drivers", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        name: "Owner Driver",
        phone: "9000000001",
        license: "AP01 20260001",
        accessCode: "2468",
        rating: 4.9,
        active: true
      })
    });

    const publicAfterSetup = await request(base, "/api/public-data");

    const created = await request(base, "/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        customerName: "Verification Customer",
        phone: "9999900000",
        email: "verify@example.com",
        passengers: 2,
        bookingType: "car",
        packageId: carResult.item.id,
        packageTitle: carResult.item.name,
        amount: carResult.item.dayRate,
        travelDate: "2026-07-20",
        returnDate: "2026-07-20",
        pickupLocation: "Test pickup point",
        dropLocation: "Test drop point",
        message: "Automated verification booking"
      })
    });

    const confirmed = await request(base, `/api/admin/bookings/${created.booking.id}/assign`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        assignedDriverId: driverResult.item.id,
        assignedCarId: carResult.item.id,
        status: "confirmed_waiting_payment",
        paymentStatus: "payment_required",
        costItems: "Base fare = 2800\nToll and parking = 300\nOwner discount = -100",
        includedItems: "AC sedan\nDriver allowance\nPickup and drop",
        excludedItems: "Extra kilometers\nNight charges",
        confirmationMessage: "Owner confirmed the final payable amount."
      })
    });

    const paid = await request(base, `/api/bookings/${created.booking.id}/payment`, {
      method: "POST",
      body: JSON.stringify({
        payerName: "Verification Customer",
        paymentMethod: "UPI",
        transactionId: "VERIFY123",
        paidAmount: confirmed.booking.amount,
        paymentDate: "2026-07-07"
      })
    });

    const verified = await request(base, `/api/admin/bookings/${created.booking.id}/status`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        status: "assigned",
        paymentStatus: "paid"
      })
    });

    const driverLogin = await request(base, "/api/driver/login", {
      method: "POST",
      body: JSON.stringify({
        phone: driverResult.item.phone,
        accessCode: driverResult.item.accessCode
      })
    });

    const driverData = await request(
      base,
      `/api/driver/${driverLogin.driver.id}?accessCode=${driverResult.item.accessCode}`
    );

    await request(base, `/api/driver/bookings/${created.booking.id}/status`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        status: "driver_accepted",
        notes: "Driver accepted verification trip"
      })
    });

    const tracked = await request(base, `/api/bookings/${created.booking.id}`);
    const bill = await request(base, `/api/bill/${created.booking.id}`);

    console.log(
      JSON.stringify(
        {
          base,
          pageStatuses,
          initialPublicCars: publicEmpty.cars.length,
          publicCarsAfterOwnerSetup: publicAfterSetup.cars.length,
          adminLogin: adminLogin.ok,
          bookingId: created.booking.id,
          ownerConfirmedAmount: confirmed.booking.amount,
          paymentStatusAfterCustomer: paid.booking.paymentStatus,
          adminVerifiedStatus: verified.booking.status,
          driverTrips: driverData.bookings.length,
          finalTrackedStatus: tracked.booking.status,
          billInvoiceBusiness: bill.business.name
        },
        null,
        2
      )
    );
  } finally {
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (originalStore === null) {
      await fs.rm(STORE_FILE, { force: true });
    } else {
      await fs.writeFile(STORE_FILE, originalStore, "utf8");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
