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
    const error = new Error(data.error || `${route} failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function checkPage(base, route) {
  const response = await fetch(`${base}${route}`);
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  return response.status;
}

function futureDate(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
      cars: await checkPage(base, "/cars.html"),
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

    const businessResult = await request(base, "/api/admin/business", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        name: "VRK Tours and Travels",
        logo: "https://example.com/logo.png",
        phone: "+91 90000 00000",
        whatsapp: "+91 90000 00001",
        email: "owner@vrktravels.local",
        address: "Owner office address",
        googleMapsLink: "https://www.google.com/maps/search/?api=1&query=VRK",
        workingHours: "Mon-Sun, 6 AM - 11 PM",
        aboutText: "Owner managed tours and travels business.",
        socialLinks: "Instagram = https://example.com/vrk\nFacebook = https://example.com/vrk-fb",
        footerText: "Trusted car rentals and travel packages.",
        emergencySupportNumber: "+91 90000 00999",
        privacyPolicy: "Use booking details only for trip coordination.",
        cancellationPolicy: "Owner confirms cancellation and refund.",
        pricingPolicy: "Website fare is estimated until owner confirms.",
        safetyGuidelines: "Carry ID proof and follow safe travel rules.",
        faqText: "Owner confirms car, fare, and payment before travel.",
        upiId: "vrk@upi",
        paymentInstructions: "Pay only after owner shares the quotation.",
        invoicePrefix: "VRK",
        terms: "Quotation is owner confirmed.\nExtra kilometers are chargeable."
      })
    });

    const carResult = await request(base, "/api/admin/cars", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        name: "Owner Sedan",
        brand: "Toyota",
        model: "Etios",
        vehicleNumber: "KA09AB1234",
        category: "Sedan",
        seats: "4+1",
        luggageCapacity: 2,
        ac: true,
        fuelType: "Petrol",
        localRate: 16,
        outstationRate: 18,
        extraKmRate: 20,
        extraHourRate: 150,
        available: true,
        featured: true,
        description: "Clean AC sedan for local and outstation bookings.",
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
        email: "owner.driver@example.com",
        firebaseUid: "verify-driver-uid",
        license: "AP01 20260001",
        accessCode: "2468",
        rating: 4.9,
        active: true
      })
    });

    const otherDriverResult = await request(base, "/api/admin/drivers", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        name: "Other Driver",
        phone: "9000000002",
        email: "other.driver@example.com",
        license: "AP01 20260002",
        accessCode: "1357",
        rating: 4.7,
        active: true
      })
    });

    const tourPackageResult = await request(base, "/api/admin/tour-packages", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        title: "Coorg Family Tour",
        packageType: "Family tour",
        days: 3,
        nights: 2,
        startingPlace: "Mangaluru",
        destinations: "Madikeri, Abbey Falls, Raja Seat",
        suitableVehicles: "Sedan, SUV, Tempo Traveller",
        price: 12500,
        driverAllowance: 500,
        nightAllowance: 700,
        tollParkingInfo: "Toll and parking as per actuals",
        image: "https://example.com/coorg.jpg",
        overview: "Owner planned multi-day tour package with clear vehicle and cost notes.",
        inclusions: "Pickup and drop\nRoute planning\nDriver coordination",
        exclusions: "Hotel stay\nFood and entry tickets",
        itinerary: "Day 1: Pickup and Madikeri sightseeing\nDay 2: Abbey Falls and Raja Seat\nDay 3: Return trip",
        terms: "Final vehicle and route are owner confirmed.",
        active: true
      })
    });

    const dayPackageResult = await request(base, "/api/admin/day-packages", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        title: "Mysuru One Day Trip",
        packageType: "Sightseeing",
        place: "Mysuru Palace, Chamundi Hills, Brindavan Garden",
        hours: "12 hours",
        price: 4500,
        image: "https://example.com/mysuru.jpg",
        overview: "Owner planned one day trip with clear inclusions and terms.",
        highlights: "Pickup and drop\nSightseeing route planning",
        exclusions: "Entry tickets\nParking and toll",
        itinerary: "Morning pickup\nMysuru Palace visit\nEvening return",
        terms: "Final timings are owner confirmed.",
        active: true
      })
    });

    const bannerResult = await request(base, "/api/admin/banners", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        heading: "Festival Mysuru travel offer",
        subheading: "Owner curated one day package with comfortable cars.",
        desktopImage: "https://example.com/banner-desktop.jpg",
        mobileImage: "https://example.com/banner-mobile.jpg",
        badgeText: "Festival offer",
        priceText: "Starting INR 4,500",
        posterStyle: "sunset",
        buttonText: "Plan this trip",
        buttonLink: "#quickBooking",
        sortOrder: 1,
        active: true
      })
    });

    const galleryResult = await request(base, "/api/admin/gallery", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        image: "https://example.com/gallery-mysuru.jpg",
        caption: "Completed Mysuru family trip.",
        destination: "Mysuru",
        sortOrder: 1,
        active: true
      })
    });

    const popupResult = await request(base, "/api/admin/popup", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        enabled: true,
        popupType: "festival_discount",
        title: "Festival booking window open",
        message: "Ask owner for festival package availability.",
        buttonLabel: "Check packages",
        buttonLink: "#oneDayPackages",
        startDate: futureDate(-1),
        endDate: futureDate(10),
        allowClose: true,
        showOncePerDevice: true
      })
    });

    const tempCarResult = await request(base, "/api/admin/cars", {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        name: "Delete Test 1",
        brand: "Test",
        model: "Local",
        vehicleNumber: "KA09ZZ9999",
        category: "Sedan",
        seats: "4+1",
        luggageCapacity: 1,
        ac: true,
        fuelType: "Petrol",
        localRate: 10,
        outstationRate: 12,
        extraKmRate: 14,
        extraHourRate: 100,
        available: true,
        active: true
      })
    });

    const deletedTempCar = await request(base, `/api/admin/cars/${tempCarResult.item.id}/delete`, {
      method: "DELETE",
      headers: { "X-Admin-Pin": "1234" }
    });

    await request(base, `/api/admin/cars/${carResult.item.id}/archive`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" }
    });
    const shownCar = await request(base, `/api/admin/cars/${carResult.item.id}/show`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" }
    });

    const publicAfterSetup = await request(base, "/api/public-data");

    await request(base, `/api/admin/tourPackages/${tourPackageResult.item.id}/archive`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" }
    });
    const publicAfterTourArchive = await request(base, "/api/public-data");

    await request(base, `/api/admin/dayPackages/${dayPackageResult.item.id}/archive`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" }
    });
    const publicAfterDayArchive = await request(base, "/api/public-data");

    let pastDateRejected = false;
    try {
      await request(base, "/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Past Date Customer",
          phone: "9999900002",
          passengers: 1,
          bookingType: "car",
          tripType: "one_way",
          packageId: carResult.item.id,
          travelDate: "2020-01-01",
          whatsappNumber: "9999900002",
          pickupTime: "07:30",
          termsAccepted: true,
          pickupLocation: "Old pickup point",
          dropLocation: "Old drop point"
        })
      });
    } catch (error) {
      pastDateRejected = error.status === 422;
    }

    let passengerCapacityRejected = false;
    try {
      await request(base, "/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Large Group Customer",
          phone: "9999900003",
          passengers: 9,
          bookingType: "car",
          tripType: "one_way",
          packageId: carResult.item.id,
          travelDate: futureDate(3),
          whatsappNumber: "9999900003",
          pickupTime: "07:30",
          termsAccepted: true,
          pickupLocation: "Capacity pickup point",
          dropLocation: "Capacity drop point"
        })
      });
    } catch (error) {
      passengerCapacityRejected = error.status === 422;
    }

    const bookingPayload = {
      customerName: "Verification Customer",
      phone: "9999900000",
      email: "verify@example.com",
      passengers: 2,
      bookingType: "car",
      tripType: "round_trip",
      packageId: carResult.item.id,
      packageTitle: carResult.item.name,
      amount: carResult.item.dayRate,
      travelDate: futureDate(4),
      returnDate: futureDate(5),
      whatsappNumber: "9999900000",
      pickupTime: "07:30",
      luggageCount: 2,
      childSeatRequired: true,
      seniorCitizenTravelling: true,
      preferredCarId: carResult.item.id,
      vehiclePreference: "Sedan",
      multipleDestinations: "Temple stop\nLunch stop",
      numberOfDays: 2,
      estimatedDistanceKm: 88,
      estimatedTravelTime: "2 hrs 30 mins",
      estimatedFare: 1584,
      paymentPreference: "pay_later",
      advancePaymentInterest: true,
      termsAccepted: true,
      pickupLocation: "Test pickup point",
      dropLocation: "Test drop point",
      message: "Automated verification booking"
    };

    const created = await request(base, "/api/bookings", {
      method: "POST",
      body: JSON.stringify(bookingPayload)
    });

    let insecureTrackingRejected = false;
    try {
      await request(base, `/api/bookings/${created.booking.id}`);
    } catch (error) {
      insecureTrackingRejected = error.status === 403;
    }

    const trackedAfterCreate = await request(base, "/api/bookings/track", {
      method: "POST",
      body: JSON.stringify({
        bookingId: created.booking.id,
        phone: bookingPayload.phone,
        trackingCode: created.booking.trackingCode
      })
    });

    let duplicateBookingRejected = false;
    try {
      await request(base, "/api/bookings", {
        method: "POST",
        body: JSON.stringify(bookingPayload)
      });
    } catch (error) {
      duplicateBookingRejected = error.status === 409;
    }

    const confirmed = await request(base, `/api/admin/bookings/${created.booking.id}/assign`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        assignedDriverId: driverResult.item.id,
        assignedCarId: carResult.item.id,
        status: "advance_pending",
        paymentStatus: "advance_pending",
        quotationBaseFare: 2800,
        quotationIncludedKm: 180,
        quotationExtraKmRate: 18,
        quotationIncludedHours: 10,
        quotationExtraHourRate: 150,
        quotationDriverAllowance: 500,
        quotationNightAllowance: 0,
        quotationToll: 300,
        quotationParking: 100,
        quotationStatePermit: 0,
        quotationWaitingCharge: 0,
        quotationDiscount: 700,
        quotationAdvancePaid: 1000,
        quotationTotalAmount: 3000,
        quotationExpiryDate: futureDate(2),
        quotationAdminRemarks: "Verification quotation with included km and clear charges.",
        quotationChangeReason: "Initial verification quotation",
        includedItems: "AC sedan\nDriver allowance\nPickup and drop",
        excludedItems: "Extra kilometers\nNight charges",
        confirmationMessage: "Owner shared the quotation and payable amount.",
        customerContacted: true,
        routeVerified: true,
        scheduleConfirmed: true,
        vehicleChecked: true,
        fareShared: true,
        paymentChecked: false,
        driverInformed: false,
        tripCompleted: false
      })
    });

    let quotationReasonRequired = false;
    try {
      await request(base, `/api/admin/bookings/${created.booking.id}/assign`, {
        method: "POST",
        headers: { "X-Admin-Pin": "1234" },
        body: JSON.stringify({
          assignedDriverId: driverResult.item.id,
          assignedCarId: carResult.item.id,
          status: "advance_pending",
          paymentStatus: "advance_pending",
          quotationBaseFare: 3000,
          quotationIncludedKm: 180,
          quotationExtraKmRate: 18,
          quotationIncludedHours: 10,
          quotationExtraHourRate: 150,
          quotationDriverAllowance: 500,
          quotationToll: 300,
          quotationParking: 100,
          quotationDiscount: 700,
          quotationAdvancePaid: 1200,
          quotationTotalAmount: 3200,
          quotationExpiryDate: futureDate(2),
          quotationAdminRemarks: "Changed quotation without reason"
        })
      });
    } catch (error) {
      quotationReasonRequired = error.status === 422;
    }

    const requoted = await request(base, `/api/admin/bookings/${created.booking.id}/assign`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        assignedDriverId: driverResult.item.id,
        assignedCarId: carResult.item.id,
        status: "advance_pending",
        paymentStatus: "advance_pending",
        quotationBaseFare: 3000,
        quotationIncludedKm: 180,
        quotationExtraKmRate: 18,
        quotationIncludedHours: 10,
        quotationExtraHourRate: 150,
        quotationDriverAllowance: 500,
        quotationNightAllowance: 0,
        quotationToll: 300,
        quotationParking: 100,
        quotationStatePermit: 0,
        quotationWaitingCharge: 0,
        quotationDiscount: 700,
        quotationAdvancePaid: 1200,
        quotationTotalAmount: 3200,
        quotationExpiryDate: futureDate(2),
        quotationAdminRemarks: "Updated quotation after route review.",
        quotationChangeReason: "Customer added extra pickup coordination",
        includedItems: "AC sedan\nDriver allowance\nPickup and drop",
        excludedItems: "Extra kilometers\nNight charges",
        confirmationMessage: "Owner updated the quotation after route review.",
        customerContacted: true,
        routeVerified: true,
        scheduleConfirmed: true,
        vehicleChecked: true,
        fareShared: true,
        paymentChecked: false,
        driverInformed: false,
        tripCompleted: false
      })
    });

    const paid = await request(base, `/api/bookings/${created.booking.id}/payment`, {
      method: "POST",
      body: JSON.stringify({
        payerName: "Verification Customer",
        paymentMethod: "UPI",
        transactionId: "VERIFY123",
        paidAmount: requoted.booking.quotation.advancePaid,
        paymentDate: futureDate(1),
        trackingPhone: bookingPayload.phone,
        trackingCode: created.booking.trackingCode
      })
    });

    const verified = await request(base, `/api/admin/bookings/${created.booking.id}/status`, {
      method: "POST",
      headers: { "X-Admin-Pin": "1234" },
      body: JSON.stringify({
        status: "driver_assigned",
        paymentStatus: "advance_paid"
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

    let otherDriverBlocked = false;
    try {
      await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
        method: "POST",
        body: JSON.stringify({
          driverId: otherDriverResult.item.id,
          accessCode: otherDriverResult.item.accessCode,
          action: "accept_trip"
        })
      });
    } catch (error) {
      otherDriverBlocked = error.status === 404;
    }

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "accept_trip"
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "start_travelling"
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "reached_pickup"
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "starting_km",
        startingKm: 1200
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "start_trip",
        startingKm: 1200,
        liveLocationUrl: "https://maps.google.com/?q=12.9716,77.5946",
        liveLocationNote: "Verification location shared"
      })
    });

    const trackedDuringTrip = await request(base, "/api/bookings/track", {
      method: "POST",
      body: JSON.stringify({
        bookingId: created.booking.id,
        phone: bookingPayload.phone,
        trackingCode: created.booking.trackingCode
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "add_stop",
        stopName: "Verification stop",
        stopNote: "Route checkpoint"
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "report_issue",
        issue: "Verification issue note"
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "ending_km",
        endingKm: 1288
      })
    });

    await request(base, `/api/driver/bookings/${created.booking.id}/action`, {
      method: "POST",
      body: JSON.stringify({
        driverId: driverResult.item.id,
        accessCode: driverResult.item.accessCode,
        action: "complete_trip",
        endingKm: 1288
      })
    });

    const tracked = await request(base, "/api/bookings/track", {
      method: "POST",
      body: JSON.stringify({
        bookingId: created.booking.id,
        phone: bookingPayload.phone,
        trackingCode: created.booking.trackingCode
      })
    });
    const adminAfterLifecycle = await request(base, "/api/admin-data", {
      headers: { "X-Admin-Pin": "1234" }
    });
    let insecureBillRejected = false;
    try {
      await request(base, `/api/bill/${created.booking.id}`);
    } catch (error) {
      insecureBillRejected = error.status === 403;
    }

    const bill = await request(
      base,
      `/api/bill/${created.booking.id}?phone=${encodeURIComponent(bookingPayload.phone)}&trackingCode=${encodeURIComponent(
        created.booking.trackingCode
      )}`
    );
    let deleteBookedCarStatus = 0;
    try {
      await request(base, `/api/admin/cars/${carResult.item.id}/delete`, {
        method: "DELETE",
        headers: { "X-Admin-Pin": "1234" }
      });
    } catch (error) {
      deleteBookedCarStatus = error.status || 0;
    }

    console.log(
      JSON.stringify(
        {
          base,
          pageStatuses,
          initialPublicCars: publicEmpty.cars.length,
          publicCarsAfterOwnerSetup: publicAfterSetup.cars.length,
          businessLogoSaved: businessResult.business.logo === "https://example.com/logo.png",
          businessWhatsappSaved: businessResult.business.whatsapp === "+91 90000 00001",
          businessMapsSaved: businessResult.business.googleMapsLink.includes("google.com"),
          businessPoliciesSaved: businessResult.business.privacyPolicy.includes("trip coordination"),
          publicBannerDynamic: publicAfterSetup.banners.some(
            (item) =>
              item.id === bannerResult.item.id &&
              item.desktopImage &&
              item.mobileImage &&
              item.heading === "Festival Mysuru travel offer" &&
              item.buttonText === "Plan this trip" &&
              item.badgeText === "Festival offer" &&
              item.priceText === "Starting INR 4,500" &&
              item.posterStyle === "sunset"
          ),
          publicGalleryDynamic: publicAfterSetup.gallery.some(
            (item) => item.id === galleryResult.item.id && item.image && item.destination === "Mysuru" && item.sortOrder === 1
          ),
          popupDynamic: popupResult.popupSettings.popupType === "festival_discount" && popupResult.popupSettings.showOncePerDevice === true,
          publicTourPackagesAfterOwnerSetup: publicAfterSetup.tourPackages.length,
          tourPackageHiddenPublicly: publicAfterTourArchive.tourPackages.length === 0,
          publicDayPackagesAfterOwnerSetup: publicAfterSetup.dayPackages.length,
          dayPackageHiddenPublicly: publicAfterDayArchive.dayPackages.length === 0,
          adminLogin: adminLogin.ok,
          deletedUnusedCar: deletedTempCar.ok,
          shownHiddenCar: shownCar.item.active,
          deleteBookedCarStatus,
          pastDateRejected,
          passengerCapacityRejected,
          duplicateBookingRejected,
          insecureTrackingRejected,
          insecureBillRejected,
          secureTrackingWorks: trackedAfterCreate.booking.id === created.booking.id,
          quotationReasonRequired,
          bookingChecksSaved: confirmed.booking.checks && confirmed.booking.checks.fareShared === true,
          bookingStatusAfterCreate: created.booking.status,
          bookingId: created.booking.id,
          serialBookingId: /^VRK-\d{4}-\d{4,}$/.test(created.booking.id),
          trackingCodeIssued: /^\d{6}$/.test(created.booking.trackingCode || ""),
          bookingTripType: created.booking.tripType,
          bookingPickupTime: created.booking.pickupTime,
          bookingNewPassengerFields:
            trackedAfterCreate.booking.childSeatRequired === true &&
            trackedAfterCreate.booking.seniorCitizenTravelling === true &&
            trackedAfterCreate.booking.preferredCarId === carResult.item.id,
          bookingEstimateFields:
            trackedAfterCreate.booking.estimatedDistanceKm === 88 &&
            trackedAfterCreate.booking.estimatedTravelTime === "2 hrs 30 mins" &&
            trackedAfterCreate.booking.estimatedFare === 1584,
          ownerConfirmedAmount: requoted.booking.amount,
          quotationTotalAmount: requoted.booking.quotation.totalAmount,
          quotationAdvancePaid: requoted.booking.quotation.advancePaid,
          paymentStatusAfterCustomer: paid.booking.paymentStatus,
          adminVerifiedStatus: verified.booking.status,
          adminVerifiedPaymentStatus: verified.booking.paymentStatus,
          statusHistoryEvents: adminAfterLifecycle.bookingStatusHistory.filter(
            (item) => item.bookingId === created.booking.id
          ).length,
          quotationHistoryEvents: adminAfterLifecycle.quotationHistory.filter((item) => item.bookingId === created.booking.id).length,
          driverTrips: driverData.bookings.length,
          driverDataHidesPayment: driverData.bookings.every((booking) => booking.payment === undefined && booking.quotation === undefined),
          otherDriverBlocked,
          finalTrackedStatus: tracked.booking.status,
          liveLocationVisibleDuringTrip: Boolean(trackedDuringTrip.booking.liveLocation && trackedDuringTrip.booking.liveLocation.url),
          liveLocationHiddenAfterComplete: !tracked.booking.liveLocation,
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
