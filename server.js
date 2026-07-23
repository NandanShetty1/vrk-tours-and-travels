const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const DEFAULT_PORTS = [5173, 5174, 5175, 5176, 5177];
const HOST = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const USE_POSTGRES = Boolean(process.env.DATABASE_URL);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const sseClients = new Set();
let writeQueue = Promise.resolve();
let pgPool;
let firebaseAdminApp;
let firebaseAdminAuth;
let firebaseFirestore;

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function bookingId(store, travelDate) {
  const prefix = String((store.business && (store.business.invoicePrefix || store.business.name)) || "VRK")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 4) || "VRK";
  const yearMatch = String(travelDate || "").match(/^\d{4}/);
  const year = yearMatch ? yearMatch[0] : new Date().toISOString().slice(0, 4);
  const serialPattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let maxSerial = 0;
  let sameYearBookings = 0;
  for (const booking of store.bookings || []) {
    const bookingYear = String(booking.travelDate || booking.departureDate || booking.createdAt || "").slice(0, 4);
    if (bookingYear === year) sameYearBookings += 1;
    const match = String(booking.id || "").match(serialPattern);
    if (match) maxSerial = Math.max(maxSerial, Number(match[1]));
  }
  let serial = Math.max(maxSerial, sameYearBookings) + 1;
  let nextId = `${prefix}-${year}-${String(serial).padStart(4, "0")}`;
  while ((store.bookings || []).some((booking) => booking.id === nextId)) {
    serial += 1;
    nextId = `${prefix}-${year}-${String(serial).padStart(4, "0")}`;
  }
  return nextId;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, message, details) {
  sendJson(res, status, { error: message, details });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    const err = new Error("Invalid JSON body");
    err.status = 400;
    throw err;
  }
}

async function ensureStore() {
  if (USE_POSTGRES) {
    const pool = await getPostgresPool();
    const seed = await fs.readFile(path.join(ROOT, "data", "seed.json"), "utf8");
    await pool.query(`
      create table if not exists app_store (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )
    `);
    await pool.query(
      `
        insert into app_store (id, data)
        values ('main', $1::jsonb)
        on conflict (id) do nothing
      `,
      [seed]
    );
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const seed = await fs.readFile(path.join(ROOT, "data", "seed.json"), "utf8");
    await fs.writeFile(DATA_FILE, seed, "utf8");
  }
}

async function getPostgresPool() {
  if (pgPool) return pgPool;
  const { Pool } = require("pg");
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });
  return pgPool;
}

async function loadStore() {
  await ensureStore();
  if (USE_POSTGRES) {
    const pool = await getPostgresPool();
    const result = await pool.query("select data from app_store where id = 'main'");
    if (!result.rows.length) {
      const seed = await fs.readFile(path.join(ROOT, "data", "seed.json"), "utf8");
      return normalizeStore(JSON.parse(seed));
    }
    return normalizeStore(result.rows[0].data);
  }

  const raw = await fs.readFile(DATA_FILE, "utf8");
  return normalizeStore(JSON.parse(raw));
}

async function saveStore(store) {
  writeQueue = writeQueue.then(async () => {
    if (USE_POSTGRES) {
      const pool = await getPostgresPool();
      await pool.query(
        `
          update app_store
          set data = $1::jsonb, updated_at = now()
          where id = 'main'
        `,
        [JSON.stringify(store)]
      );
    } else {
      await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
    }
  });
  await writeQueue;
  broadcast("change", { at: now() });
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function publicBusiness(business) {
  const { adminPin, ...safeBusiness } = business;
  return safeBusiness;
}

function firebaseClientConfig() {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
  };
  const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
  return { configured, firebaseConfig: configured ? config : null };
}

function firebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

function getFirebaseAdminApp() {
  if (firebaseAdminApp) return firebaseAdminApp;
  if (!firebaseAdminConfigured()) {
    const err = new Error("Firebase Admin credentials are not configured");
    err.status = 503;
    throw err;
  }
  const { cert, getApps, initializeApp } = require("firebase-admin/app");
  firebaseAdminApp =
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
      })
    });
  return firebaseAdminApp;
}

function getFirebaseAuth() {
  if (firebaseAdminAuth) return firebaseAdminAuth;
  const { getAuth } = require("firebase-admin/auth");
  firebaseAdminAuth = getAuth(getFirebaseAdminApp());
  return firebaseAdminAuth;
}

function getFirestoreDb() {
  if (firebaseFirestore) return firebaseFirestore;
  const { getFirestore } = require("firebase-admin/firestore");
  firebaseFirestore = getFirestore(getFirebaseAdminApp());
  return firebaseFirestore;
}

async function verifyFirebaseToken(req, label) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const err = new Error(`${label || "Firebase"} token is required`);
    err.status = 401;
    throw err;
  }
  return getFirebaseAuth().verifyIdToken(match[1]);
}

async function verifyCustomerToken(req) {
  return verifyFirebaseToken(req, "Customer login");
}

async function firestoreAdminProfile(decoded) {
  const email = String(decoded.email || "").trim().toLowerCase();
  const db = getFirestoreDb();
  const collection = db.collection("adminUsers");
  let snapshot = await collection.doc(decoded.uid).get();
  if (!snapshot.exists && email) {
    const matches = await collection.where("email", "==", email).limit(1).get();
    if (!matches.empty) snapshot = matches.docs[0];
  }
  if (!snapshot.exists) {
    const err = new Error("This Firebase user is not allowed for admin. Add this user in Firestore adminUsers.");
    err.status = 403;
    throw err;
  }
  const profile = snapshot.data() || {};
  if (profile.active === false) {
    const err = new Error("This admin account is disabled.");
    err.status = 403;
    throw err;
  }
  const role = String(profile.role || "admin").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    const err = new Error("This user does not have admin role.");
    err.status = 403;
    throw err;
  }
  return {
    id: snapshot.id,
    uid: decoded.uid,
    email: email || String(profile.email || "").trim(),
    name: String(profile.name || decoded.name || email || "Admin").trim(),
    role
  };
}

async function verifyAdminRequest(req, store) {
  if (firebaseAdminConfigured()) {
    const decoded = await verifyFirebaseToken(req, "Admin login");
    req.admin = await firestoreAdminProfile(decoded);
    return req.admin;
  }

  const pin = req.headers["x-admin-pin"];
  if (pin && pin === store.business.adminPin) {
    req.admin = { role: "owner", name: "Legacy PIN admin" };
    return req.admin;
  }

  const err = new Error("Admin email login is not configured, and legacy PIN is invalid");
  err.status = 401;
  throw err;
}

async function requireAdmin(req, res, store) {
  try {
    await verifyAdminRequest(req, store);
    return true;
  } catch (error) {
    sendError(res, error.status || 401, error.message || "Admin login required");
    return false;
  }
}

function customerPublic(customer) {
  if (!customer || customer.deletedAt) return null;
  return {
    id: customer.id,
    uid: customer.uid,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    photoURL: customer.photoURL,
    provider: customer.provider,
    createdAt: customer.createdAt,
    lastLoginAt: customer.lastLoginAt
  };
}

function firebaseCustomerPayload(decoded, body = {}) {
  const firebase = decoded.firebase || {};
  const provider = String(firebase.sign_in_provider || body.provider || "firebase").trim();
  const email = String(decoded.email || "").trim();
  const emailVerified = Boolean(email && decoded.email_verified !== false);
  const phone = String(decoded.phone_number || "").trim();
  return {
    uid: decoded.uid,
    name: String(body.displayName || decoded.name || "").trim(),
    phone,
    email,
    photoURL: String(decoded.picture || "").trim(),
    provider,
    phoneVerified: Boolean(phone),
    emailVerified
  };
}

function customerAuthUids(customer) {
  return Array.isArray(customer.authUids) ? customer.authUids : [];
}

function hasVerifiedCustomerPhone(customer) {
  return Boolean(customer.phone && (customer.phoneVerified === true || customer.provider === "phone"));
}

function hasVerifiedCustomerEmail(customer) {
  return Boolean(
    customer.email &&
      (customer.emailVerified === true ||
        ["password", "emailLink", "google.com", "apple.com", "microsoft.com", "Google", "Apple", "Microsoft"].includes(customer.provider))
  );
}

function findCustomerForAuth(store, payload) {
  return store.customers.find((customer) => {
    if (customer.deletedAt) return false;
    if (customer.uid === payload.uid || customerAuthUids(customer).includes(payload.uid)) return true;
    if (payload.phoneVerified && hasVerifiedCustomerPhone(customer) && customer.phone === payload.phone) return true;
    if (payload.emailVerified && hasVerifiedCustomerEmail(customer) && customer.email === payload.email) return true;
    return false;
  });
}

const BOOKING_STATUSES = [
  "request_submitted",
  "under_review",
  "quotation_accepted",
  "advance_pending",
  "advance_paid",
  "booking_confirmed",
  "driver_assigned",
  "driver_accepted",
  "driver_arriving",
  "driver_reached",
  "trip_started",
  "on_trip",
  "trip_completed",
  "balance_pending",
  "fully_paid",
  "closed",
  "rejected",
  "cancelled_by_customer",
  "cancelled_by_admin",
  "refund_pending",
  "refunded"
];

const DRIVER_BOOKING_STATUSES = [
  "driver_assigned",
  "driver_accepted",
  "driver_arriving",
  "driver_reached",
  "trip_started",
  "on_trip",
  "trip_completed"
];

const PAYMENT_STATUSES = [
  "waiting_for_amount",
  "advance_pending",
  "payment_submitted",
  "advance_paid",
  "balance_pending",
  "fully_paid",
  "not_required",
  "refund_pending",
  "refunded"
];

const QUOTATION_FIELDS = [
  ["baseFare", "Base fare", "money"],
  ["includedKm", "Included km", "number"],
  ["extraKmRate", "Extra KM rate", "money"],
  ["includedHours", "Included hrs", "number"],
  ["extraHourRate", "Extra hr rate", "money"],
  ["driverAllowance", "Driver allowance", "money"],
  ["nightAllowance", "Night allowance", "money"],
  ["toll", "Toll", "money"],
  ["parking", "Parking", "money"],
  ["statePermit", "State permit", "money"],
  ["waitingCharge", "Waiting charge", "money"],
  ["discount", "Discount", "money"],
  ["advancePaid", "Advance paid", "money"],
  ["totalAmount", "Total amount", "money"],
  ["expiryDate", "Quotation expiry", "text"],
  ["adminRemarks", "Admin remarks", "text"]
];

const LEGACY_STATUS_MAP = {
  pending_owner_confirmation: "request_submitted",
  confirmed_waiting_payment: "advance_pending",
  payment_submitted: "advance_pending",
  payment_verified: "booking_confirmed",
  assigned: "driver_assigned",
  driver_accepted: "driver_accepted",
  on_trip: "on_trip",
  completed: "trip_completed",
  cancelled: "cancelled_by_admin",
  paid: "fully_paid"
};

const LEGACY_PAYMENT_STATUS_MAP = {
  payment_required: "advance_pending",
  paid: "fully_paid",
  cancelled: "not_required"
};

function normalizeBookingStatus(value, fallback = "request_submitted") {
  const status = String(value || fallback).trim();
  const mapped = LEGACY_STATUS_MAP[status] || status;
  return BOOKING_STATUSES.includes(mapped) ? mapped : fallback;
}

function normalizePaymentStatus(value, fallback = "waiting_for_amount") {
  const status = String(value || fallback).trim();
  const mapped = LEGACY_PAYMENT_STATUS_MAP[status] || status;
  return PAYMENT_STATUSES.includes(mapped) ? mapped : fallback;
}

function statusHistoryForBooking(store, bookingId) {
  return (store.bookingStatusHistory || [])
    .filter((item) => item.bookingId === bookingId)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function emptyQuotation() {
  return {
    baseFare: 0,
    includedKm: 0,
    extraKmRate: 0,
    includedHours: 0,
    extraHourRate: 0,
    driverAllowance: 0,
    nightAllowance: 0,
    toll: 0,
    parking: 0,
    statePermit: 0,
    waitingCharge: 0,
    discount: 0,
    advancePaid: 0,
    totalAmount: 0,
    expiryDate: "",
    adminRemarks: "",
    updatedAt: "",
    updatedBy: ""
  };
}

function calculatedQuotationTotal(quotation) {
  return Math.max(
    0,
    parseMoney(quotation.baseFare) +
      parseMoney(quotation.driverAllowance) +
      parseMoney(quotation.nightAllowance) +
      parseMoney(quotation.toll) +
      parseMoney(quotation.parking) +
      parseMoney(quotation.statePermit) +
      parseMoney(quotation.waitingCharge) -
      parseMoney(quotation.discount)
  );
}

function normalizeQuotation(value, booking) {
  const source = value && typeof value === "object" ? value : {};
  const quotation = emptyQuotation();
  QUOTATION_FIELDS.forEach(([field, , type]) => {
    if (type === "money") quotation[field] = parseMoney(source[field]);
    else if (type === "number") quotation[field] = parseInteger(source[field]);
    else quotation[field] = String(source[field] || "").trim();
  });
  if (!quotation.totalAmount && booking && parseMoney(booking.amount) > 0) {
    quotation.baseFare = quotation.baseFare || parseMoney(booking.amount);
    quotation.totalAmount = parseMoney(booking.amount);
  }
  if (!quotation.totalAmount) quotation.totalAmount = calculatedQuotationTotal(quotation);
  quotation.updatedAt = String(source.updatedAt || "").trim();
  quotation.updatedBy = String(source.updatedBy || "").trim();
  return quotation;
}

function quotationFromBody(body, existing, adminName) {
  const quotation = normalizeQuotation(existing || {}, null);
  QUOTATION_FIELDS.forEach(([field, , type]) => {
    const prefixed = `quotation${field[0].toUpperCase()}${field.slice(1)}`;
    const value = Object.prototype.hasOwnProperty.call(body, prefixed) ? body[prefixed] : body[field];
    if (value === undefined) return;
    if (type === "money") quotation[field] = parseMoney(value);
    else if (type === "number") quotation[field] = parseInteger(value);
    else quotation[field] = String(value || "").trim();
  });
  if (!quotation.totalAmount) quotation.totalAmount = calculatedQuotationTotal(quotation);
  quotation.updatedAt = now();
  quotation.updatedBy = adminName || "admin";
  return quotation;
}

function quotationCostItems(quotation, fallbackItems) {
  const current = normalizeQuotation(quotation || {}, null);
  const rows = [
    ["Base fare", current.baseFare],
    ["Driver allowance", current.driverAllowance],
    ["Night allowance", current.nightAllowance],
    ["Toll", current.toll],
    ["Parking", current.parking],
    ["State permit", current.statePermit],
    ["Waiting charge", current.waitingCharge],
    ["Discount", current.discount ? -Math.abs(current.discount) : 0]
  ]
    .map(([label, amount]) => ({ label, amount: parseMoney(amount) }))
    .filter((item) => item.amount !== 0);
  if (rows.length) return rows;
  return Array.isArray(fallbackItems) ? fallbackItems : [];
}

function quotationChanged(previous, next) {
  const before = normalizeQuotation(previous || {}, null);
  const after = normalizeQuotation(next || {}, null);
  return QUOTATION_FIELDS.some(([field]) => String(before[field] || "") !== String(after[field] || ""));
}

function quotationHistoryForBooking(store, bookingId) {
  return (store.quotationHistory || [])
    .filter((item) => item.bookingId === bookingId)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function recordQuotationHistory(store, booking, previous, next, meta = {}) {
  store.quotationHistory = Array.isArray(store.quotationHistory) ? store.quotationHistory : [];
  const before = normalizeQuotation(previous || {}, null);
  const after = normalizeQuotation(next || {}, null);
  const changes = QUOTATION_FIELDS.map(([field, label]) => ({
    field,
    label,
    from: before[field],
    to: after[field]
  })).filter((change) => String(change.from || "") !== String(change.to || ""));
  if (!changes.length) return null;
  const entry = {
    id: id("QTH"),
    bookingId: booking.id,
    at: now(),
    by: meta.by || "admin",
    source: meta.source || "admin_quotation_update",
    reason: String(meta.reason || "").trim(),
    oldValues: before,
    newValues: after,
    changes
  };
  store.quotationHistory.push(entry);
  return entry;
}

function recordBookingStatusHistory(store, booking, before, meta = {}) {
  store.bookingStatusHistory = Array.isArray(store.bookingStatusHistory) ? store.bookingStatusHistory : [];
  const previous = before || {};
  const changes = [];
  [
    ["status", "Booking status"],
    ["paymentStatus", "Payment status"],
    ["assignedDriverId", "Driver assignment"],
    ["assignedCarId", "Car assignment"],
    ["amount", "Quotation total"]
  ].forEach(([field, label]) => {
    const fromValue = previous[field] === undefined || previous[field] === null ? "" : String(previous[field]);
    const toValue = booking[field] === undefined || booking[field] === null ? "" : String(booking[field]);
    if (fromValue !== toValue) {
      changes.push({ field, label, from: fromValue, to: toValue });
    }
  });
  if (!changes.length) return null;
  const entry = {
    id: id("BKH"),
    bookingId: booking.id,
    at: now(),
    by: meta.by || "system",
    source: meta.source || "system",
    note: String(meta.note || "").trim(),
    changes
  };
  store.bookingStatusHistory.push(entry);
  booking.history = Array.isArray(booking.history) ? booking.history : [];
  booking.history.push({
    at: entry.at,
    by: entry.by,
    message: entry.note || changes.map((change) => `${change.label}: ${change.from || "empty"} to ${change.to || "empty"}`).join("; ")
  });
  return entry;
}

function normalizeBusinessSettings(business) {
  const current = business || {};
  return {
    logo: "",
    phone: "+91 9113673823",
    whatsapp: "+91 9113673823",
    email: "nandanshetty111@gmail.com",
    googleMapsLink: "",
    workingHours: "",
    aboutText: "",
    socialLinks: [],
    footerText: "",
    emergencySupportNumber: "",
    privacyPolicy:
      "Customer contact and trip details are used only for quotation, booking coordination, billing, and trip support.",
    cancellationPolicy:
      "Cancellation and refund depend on vehicle assignment, driver movement, permits, hotel/package commitments, and owner confirmation.",
    pricingPolicy:
      "Website fare is an estimate. Final fare is confirmed by VRK Tours and Travels after route, distance, timing, toll, parking, permit, and vehicle review.",
    safetyGuidelines:
      "Passengers should share accurate pickup details, carry required ID proof, follow driver safety instructions, and avoid unsafe route changes.",
    faqText:
      "Final car, driver, route, fare, advance, balance, and payment method are confirmed by the owner before travel.",
    qrImage: "",
    gatewayNote: "Online gateway can be connected later with Razorpay or Stripe merchant keys.",
    authNote: "Customer login uses Firebase Phone OTP, email link, and Google sign-in after production keys are configured.",
    ...current,
    phone: String(current.phone || "+91 9113673823").trim(),
    whatsapp: String(current.whatsapp || current.phone || "+91 9113673823").trim(),
    email: String(current.email || "nandanshetty111@gmail.com").trim(),
    socialLinks: normalizeArrayText(current.socialLinks),
    terms: normalizeArrayText(current.terms)
  };
}

function normalizeBannerItem(item) {
  const source = item || {};
  const heading = String(source.heading || source.title || "").trim();
  const subheading = String(source.subheading || source.subtitle || "").trim();
  const desktopImage = String(source.desktopImage || source.image || "").trim();
  const mobileImage = String(source.mobileImage || "").trim();
  const buttonText = String(source.buttonText || source.ctaLabel || "View details").trim();
  return {
    ...source,
    heading,
    title: heading,
    subheading,
    subtitle: subheading,
    desktopImage,
    mobileImage,
    image: desktopImage,
    buttonText,
    ctaLabel: buttonText,
    buttonLink: String(source.buttonLink || "").trim(),
    badgeText: String(source.badgeText || source.offerLabel || "").trim(),
    priceText: String(source.priceText || "").trim(),
    posterStyle: String(source.posterStyle || "teal").trim(),
    sortOrder: Number(source.sortOrder || 0),
    active: flagValue(source.active, true)
  };
}

function normalizeGalleryItem(item) {
  const source = item || {};
  const image = String(source.image || source.mediaUrl || "").trim();
  const destination = String(source.destination || "").trim();
  const caption = String(source.caption || source.title || "").trim();
  return {
    ...source,
    image,
    mediaUrl: image,
    mediaType: "image",
    destination,
    title: destination || caption || String(source.title || "").trim(),
    caption,
    tags: normalizeArrayText(source.tags || destination),
    sortOrder: Number(source.sortOrder || 0),
    active: flagValue(source.active, true)
  };
}

function normalizePopupSettings(popup) {
  const source = popup || {};
  const allowedTypes = ["seasonal_offer", "important_travel_notice", "festival_discount", "temporary_announcement"];
  const popupType = allowedTypes.includes(source.popupType) ? source.popupType : "seasonal_offer";
  const showOnce =
    source.showOncePerDevice !== undefined
      ? flagValue(source.showOncePerDevice, true)
      : source.showOnEveryVisit !== undefined
        ? !flagValue(source.showOnEveryVisit, false)
        : true;
  return {
    enabled: flagValue(source.enabled, false),
    popupType,
    title: String(source.title || "Plan your next trip with VRK").trim(),
    message: String(source.message || "Send a booking request and owner will share a quotation.").trim(),
    buttonLabel: String(source.buttonLabel || "Book now").trim(),
    buttonLink: String(source.buttonLink || "#quickBooking").trim(),
    image: String(source.image || "").trim(),
    startDate: String(source.startDate || "").trim(),
    endDate: String(source.endDate || "").trim(),
    allowClose: flagValue(source.allowClose, true),
    showOncePerDevice: showOnce,
    showOnEveryVisit: !showOnce
  };
}

function normalizeStore(store) {
  store.business = normalizeBusinessSettings(store.business);
  store.banners = Array.isArray(store.banners) ? store.banners : [];
  store.banners = store.banners.map(normalizeBannerItem);
  store.gallery = Array.isArray(store.gallery) ? store.gallery : [];
  store.gallery = store.gallery.map(normalizeGalleryItem);
  store.customers = Array.isArray(store.customers) ? store.customers : [];
  store.cars = Array.isArray(store.cars) ? store.cars : [];
  store.tourPackages = Array.isArray(store.tourPackages) ? store.tourPackages : [];
  store.dayPackages = Array.isArray(store.dayPackages) ? store.dayPackages : [];
  store.drivers = Array.isArray(store.drivers) ? store.drivers : [];
  store.bookings = Array.isArray(store.bookings) ? store.bookings : [];
  store.bookingStatusHistory = Array.isArray(store.bookingStatusHistory) ? store.bookingStatusHistory : [];
  store.quotationHistory = Array.isArray(store.quotationHistory) ? store.quotationHistory : [];
  store.drivers.forEach((driver) => {
    driver.email = String(driver.email || driver.authEmail || "").trim().toLowerCase();
    driver.authEmail = driver.email;
    driver.firebaseUid = String(driver.firebaseUid || driver.authUid || "").trim();
    driver.phone = String(driver.phone || "").trim();
    driver.active = flagValue(driver.active, true);
  });
  store.bookings.forEach((booking) => {
    booking.status = normalizeBookingStatus(booking.status);
    booking.paymentStatus = normalizePaymentStatus(booking.paymentStatus);
    booking.history = Array.isArray(booking.history) ? booking.history : [];
    booking.quotation = normalizeQuotation(booking.quotation, booking);
    booking.amount = parseMoney(booking.quotation.totalAmount || booking.amount);
    booking.costItems = quotationCostItems(booking.quotation, booking.costItems);
    booking.driverTrip = normalizeDriverTrip(booking.driverTrip);
  });
  store.popupSettings = normalizePopupSettings(store.popupSettings);
  return store;
}

function publicData(store) {
  normalizeStore(store);
  return {
    business: publicBusiness(store.business),
    cars: store.cars.filter((item) => item.active),
    tourPackages: store.tourPackages.filter((item) => item.active),
    dayPackages: store.dayPackages.filter((item) => item.active),
    banners: store.banners.filter((item) => item.active).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    gallery: store.gallery.filter((item) => item.active).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    popupSettings: store.popupSettings
  };
}

function adminData(store) {
  normalizeStore(store);
  return {
    business: store.business,
    cars: store.cars,
    tourPackages: store.tourPackages,
    dayPackages: store.dayPackages,
    drivers: store.drivers,
    bookings: store.bookings.map((booking) => bookingSummary(store, booking)),
    bookingStatusHistory: store.bookingStatusHistory,
    quotationHistory: store.quotationHistory,
    banners: store.banners,
    gallery: store.gallery,
    popupSettings: store.popupSettings
  };
}

function findDriver(store, driverId, accessCode) {
  return store.drivers.find(
    (driver) => driver.id === driverId && driver.accessCode === accessCode && driver.active
  );
}

function parseKmReading(value, label) {
  const km = Number(value);
  if (!Number.isFinite(km) || km < 0) {
    throw validationError(`${label} must be a valid kilometre reading.`);
  }
  return Number(km.toFixed(1));
}

function pushDriverTripTimeline(booking, driver, action, label, detail) {
  booking.driverTrip = normalizeDriverTrip(booking.driverTrip);
  booking.driverTrip.timeline.push({
    at: now(),
    action,
    label,
    detail: String(detail || "").trim(),
    driverId: driver.id,
    by: driver.name
  });
}

function setDriverLiveLocation(booking, body) {
  const liveUrl = String(body.liveLocationUrl || "").trim();
  const liveNote = String(body.liveLocationNote || "").trim();
  if (liveUrl || liveNote) {
    booking.liveLocation = {
      url: liveUrl,
      note: liveNote,
      updatedAt: now()
    };
  }
}

function applyDriverAction(store, booking, driver, body = {}) {
  booking.driverTrip = normalizeDriverTrip(booking.driverTrip);
  const action = String(body.action || "").trim();
  if (
    ["trip_completed", "closed", "cancelled_by_customer", "cancelled_by_admin", "rejected"].includes(booking.status) &&
    action !== "report_issue"
  ) {
    throw validationError("This trip is already closed for driver actions.");
  }
  const before = { ...booking };
  let label = "";
  let detail = String(body.note || body.notes || "").trim();

  if (action === "accept_trip") {
    if (!["booking_confirmed", "driver_assigned"].includes(booking.status)) {
      throw validationError("This trip cannot be accepted from the current status.");
    }
    booking.status = "driver_accepted";
    label = "Driver accepted trip";
  } else if (action === "start_travelling") {
    if (!["booking_confirmed", "driver_assigned", "driver_accepted"].includes(booking.status)) {
      throw validationError("Start travelling is not available for the current status.");
    }
    booking.status = "driver_arriving";
    label = "Driver started travelling to pickup";
    setDriverLiveLocation(booking, body);
  } else if (action === "reached_pickup") {
    if (!["driver_assigned", "driver_accepted", "driver_arriving"].includes(booking.status)) {
      throw validationError("Reached pickup is not available for the current status.");
    }
    booking.status = "driver_reached";
    label = "Driver reached pickup";
  } else if (action === "starting_km") {
    if (["trip_started", "on_trip"].includes(booking.status) && booking.driverTrip.startingKm !== "") {
      throw validationError("Starting KM is already saved for this active trip.");
    }
    booking.driverTrip.startingKm = parseKmReading(body.startingKm, "Starting KM");
    label = "Starting KM entered";
    detail = `${booking.driverTrip.startingKm} km`;
  } else if (action === "start_trip") {
    if (["trip_started", "on_trip"].includes(booking.status)) {
      throw validationError("This trip is already started.");
    }
    if (!["driver_reached", "driver_arriving", "driver_accepted", "driver_assigned"].includes(booking.status)) {
      throw validationError("Start trip is not available for the current status.");
    }
    const startingKm = body.startingKm || booking.driverTrip.startingKm;
    if (startingKm === "" || startingKm === undefined || startingKm === null) {
      throw validationError("Enter starting KM reading before starting the trip.");
    }
    booking.driverTrip.startingKm = parseKmReading(startingKm, "Starting KM");
    booking.status = "trip_started";
    label = "Trip started";
    detail = detail || `Starting KM ${booking.driverTrip.startingKm}`;
    setDriverLiveLocation(booking, body);
  } else if (action === "add_stop") {
    if (!["trip_started", "on_trip"].includes(booking.status)) {
      throw validationError("Stops can be added only after the trip has started.");
    }
    const stopName = String(body.stopName || body.stop || "").trim();
    if (!stopName) throw validationError("Enter stop name.");
    const stop = {
      id: id("STOP"),
      name: stopName,
      note: String(body.stopNote || "").trim(),
      at: now(),
      driverId: driver.id
    };
    booking.driverTrip.stops.push(stop);
    label = "Stop added";
    detail = [stop.name, stop.note].filter(Boolean).join(" - ");
  } else if (action === "resume_trip") {
    if (!["trip_started", "on_trip"].includes(booking.status)) {
      throw validationError("Trip can be resumed only after it has started.");
    }
    booking.status = "on_trip";
    label = "Trip resumed";
    setDriverLiveLocation(booking, body);
  } else if (action === "report_issue") {
    const issue = String(body.issue || body.issueNote || "").trim();
    if (!issue) throw validationError("Enter issue details.");
    booking.driverTrip.issues.push({
      id: id("ISSUE"),
      note: issue,
      at: now(),
      driverId: driver.id
    });
    label = "Issue reported";
    detail = issue;
  } else if (action === "ending_km") {
    if (!["trip_started", "on_trip"].includes(booking.status)) {
      throw validationError("Ending KM can be entered only during an active trip.");
    }
    const endingKm = parseKmReading(body.endingKm, "Ending KM");
    if (booking.driverTrip.startingKm !== "" && endingKm < Number(booking.driverTrip.startingKm)) {
      throw validationError("Ending KM cannot be less than starting KM.");
    }
    booking.driverTrip.endingKm = endingKm;
    label = "Ending KM entered";
    detail = `${booking.driverTrip.endingKm} km`;
  } else if (action === "complete_trip") {
    if (!["trip_started", "on_trip"].includes(booking.status)) {
      throw validationError("Complete trip is available only during an active trip.");
    }
    const endingKm = body.endingKm || booking.driverTrip.endingKm;
    if (endingKm === "" || endingKm === undefined || endingKm === null) {
      throw validationError("Enter ending KM reading before completing the trip.");
    }
    booking.driverTrip.endingKm = parseKmReading(endingKm, "Ending KM");
    if (booking.driverTrip.startingKm !== "" && booking.driverTrip.endingKm < Number(booking.driverTrip.startingKm)) {
      throw validationError("Ending KM cannot be less than starting KM.");
    }
    booking.status = "trip_completed";
    label = "Trip completed";
    detail = detail || `Ending KM ${booking.driverTrip.endingKm}`;
    delete booking.liveLocation;
  } else {
    throw validationError("Select a valid driver trip action.");
  }

  if (["trip_completed", "driver_accepted", "driver_arriving", "driver_reached"].includes(booking.status)) {
    delete booking.liveLocation;
  }
  booking.updatedAt = now();
  pushDriverTripTimeline(booking, driver, action, label, detail);
  recordBookingStatusHistory(store, booking, before, {
    by: driver.name,
    source: "driver_trip_action",
    note: detail ? `${label}: ${detail}` : label
  });
  return booking;
}

function normalizeArrayText(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function parseInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function flagValue(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (value === true || value === "true" || value === "on" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "off" || value === "0" || value === 0) return false;
  return Boolean(value);
}

function validationError(message) {
  const err = new Error(message);
  err.status = 422;
  return err;
}

function businessTodayDate() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(new Date())
    .reduce((dateParts, part) => {
      dateParts[part.type] = part.value;
      return dateParts;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isValidDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function assertValidTravelDates(travelDate, returnDate) {
  if (!isValidDateOnly(travelDate)) {
    throw validationError("Select a valid travel date.");
  }
  if (travelDate < businessTodayDate()) {
    throw validationError("Travel date cannot be in the past.");
  }
  if (returnDate) {
    if (!isValidDateOnly(returnDate)) {
      throw validationError("Select a valid return date.");
    }
    if (returnDate < travelDate) {
      throw validationError("Return date cannot be before travel date.");
    }
  }
}

function normalizeBookingMobile(value, label) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  const mobile = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw validationError(`${label || "Mobile number"} must be a valid 10-digit India mobile number.`);
  }
  return `+91${mobile}`;
}

function normalizeBookingEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw validationError("Enter a valid email address, or leave email empty.");
  }
  return email;
}

function carPassengerCapacity(item) {
  const match = String(item && item.seats ? item.seats : "").match(/^\d+/);
  return match ? Number(match[0]) : 0;
}

function findRecentDuplicateBooking(store, booking) {
  const createdAt = Date.now();
  return (store.bookings || []).find((item) => {
    if (["cancelled_by_customer", "cancelled_by_admin", "rejected", "closed"].includes(normalizeBookingStatus(item.status))) return false;
    const ageMs = createdAt - new Date(item.createdAt || 0).getTime();
    return (
      ageMs >= 0 &&
      ageMs < 2 * 60 * 1000 &&
      item.phone === booking.phone &&
      item.bookingType === booking.bookingType &&
      item.packageId === booking.packageId &&
      item.travelDate === booking.travelDate &&
      item.pickupLocation === booking.pickupLocation
    );
  });
}

function generateTrackingCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashTrackingCode(code) {
  return crypto.createHash("sha256").update(String(code || "").trim()).digest("hex");
}

function bookingHasTrackingCode(booking) {
  return Boolean(booking && booking.trackingCodeHash);
}

function verifyBookingTrackingAccess(booking, payload) {
  if (!booking) {
    throw validationError("Booking not found.");
  }
  requireFields(payload, ["bookingId", "phone", "trackingCode"]);
  if (!bookingHasTrackingCode(booking)) {
    const err = new Error("Secure tracking code is not available for this older booking. Please contact VRK owner.");
    err.status = 403;
    throw err;
  }
  const phone = normalizeBookingMobile(payload.phone, "Registered mobile number");
  if (phone !== booking.phone) {
    const err = new Error("Booking ID and registered mobile number do not match.");
    err.status = 403;
    throw err;
  }
  if (hashTrackingCode(payload.trackingCode) !== booking.trackingCodeHash) {
    const err = new Error("Tracking code is incorrect.");
    err.status = 403;
    throw err;
  }
  return phone;
}

function comparablePhone(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

function quotationStatus(booking) {
  const status = normalizeBookingStatus(booking.status);
  if (["cancelled_by_customer", "cancelled_by_admin", "rejected"].includes(status)) return status;
  const quotation = normalizeQuotation(booking.quotation, booking);
  if (quotation.totalAmount > 0 && quotation.expiryDate && quotation.expiryDate < businessTodayDate()) return "quotation_expired";
  if (
    [
      "quotation_accepted",
      "advance_pending",
      "advance_paid",
      "booking_confirmed",
      "driver_assigned",
      "driver_accepted",
      "driver_arriving",
      "driver_reached",
      "trip_started",
      "on_trip",
      "trip_completed",
      "balance_pending",
      "fully_paid",
      "closed"
    ].includes(status)
  ) {
    return "quotation_accepted";
  }
  if (quotation.totalAmount > 0) return "quotation_ready";
  if (["request_submitted", "under_review"].includes(status)) return "waiting_for_owner";
  return "quotation_pending";
}

function customerTrackingSummary(store, booking) {
  const summary = bookingSummary(store, booking);
  const canShowAssignment = [
    "booking_confirmed",
    "driver_assigned",
    "driver_accepted",
    "driver_arriving",
    "driver_reached",
    "trip_started",
    "on_trip",
    "trip_completed",
    "balance_pending",
    "fully_paid",
    "closed"
  ].includes(summary.status);
  const onTrip = ["trip_started", "on_trip"].includes(summary.status);
  return {
    id: summary.id,
    customerName: summary.customerName,
    bookingType: summary.bookingType,
    tripType: summary.tripType,
    packageTitle: summary.packageTitle,
    selectedService: summary.packageTitle,
    travelDate: summary.travelDate,
    returnDate: summary.returnDate,
    pickupTime: summary.pickupTime,
    pickupLocation: summary.pickupLocation,
    dropLocation: summary.dropLocation,
    passengers: summary.passengers,
    whatsappNumber: summary.whatsappNumber,
    luggageCount: summary.luggageCount,
    childSeatRequired: summary.childSeatRequired,
    seniorCitizenTravelling: summary.seniorCitizenTravelling,
    preferredCarId: summary.preferredCarId,
    vehiclePreference: summary.vehiclePreference,
    multipleDestinations: summary.multipleDestinations,
    localRentalPackage: summary.localRentalPackage,
    numberOfDays: summary.numberOfDays,
    airportTripMode: summary.airportTripMode,
    airportName: summary.airportName,
    flightNumber: summary.flightNumber,
    terminal: summary.terminal,
    flightTime: summary.flightTime,
    railwayStation: summary.railwayStation,
    trainNumber: summary.trainNumber,
    trainTime: summary.trainTime,
    eventVenue: summary.eventVenue,
    eventStartTime: summary.eventStartTime,
    eventEndTime: summary.eventEndTime,
    companyName: summary.companyName,
    reportingTime: summary.reportingTime,
    billingRequired: summary.billingRequired,
    customDestinations: summary.customDestinations,
    budget: summary.budget,
    specialRequirements: summary.specialRequirements,
    estimatedDistanceKm: summary.estimatedDistanceKm,
    estimatedTravelTime: summary.estimatedTravelTime,
    estimatedFare: summary.estimatedFare,
    paymentPreference: summary.paymentPreference,
    advancePaymentInterest: summary.advancePaymentInterest,
    status: summary.status,
    quotationStatus: quotationStatus(summary),
    paymentStatus: summary.paymentStatus,
    tripStatus: summary.status,
    amount: summary.amount,
    quotation: summary.quotation,
    paidAmount: summary.paidAmount,
    balanceAmount: summary.balanceAmount,
    confirmationMessage: summary.confirmationMessage,
    includedItems: summary.includedItems,
    excludedItems: summary.excludedItems,
    costItems: summary.costItems,
    car: canShowAssignment && summary.car
      ? {
          name: summary.car.name,
          brand: summary.car.brand,
          model: summary.car.model,
          category: summary.car.category,
          seats: summary.car.seats,
          ac: summary.car.ac
        }
      : null,
    driver: canShowAssignment && summary.driver
      ? {
          name: summary.driver.name,
          phone: summary.driver.phone,
          rating: summary.driver.rating
        }
      : null,
    liveLocation: onTrip && summary.liveLocation
      ? {
          url: summary.liveLocation.url || "",
          note: summary.liveLocation.note || "",
          updatedAt: summary.liveLocation.updatedAt || ""
        }
      : null
  };
}

function driverPublic(driver) {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email || driver.authEmail || "",
    license: driver.license || "",
    rating: driver.rating || ""
  };
}

function normalizeDriverTrip(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    startingKm: source.startingKm || source.startKm || "",
    endingKm: source.endingKm || source.endKm || "",
    stops: Array.isArray(source.stops) ? source.stops : [],
    issues: Array.isArray(source.issues) ? source.issues : [],
    timeline: Array.isArray(source.timeline) ? source.timeline : []
  };
}

function driverBookingSummary(store, booking) {
  const summary = bookingSummary(store, booking);
  const car = summary.car
    ? {
        id: summary.car.id,
        name: summary.car.name,
        brand: summary.car.brand,
        model: summary.car.model,
        vehicleNumber: summary.car.vehicleNumber,
        category: summary.car.category,
        seats: summary.car.seats,
        luggageCapacity: summary.car.luggageCapacity,
        ac: summary.car.ac
      }
    : null;
  return {
    id: summary.id,
    bookingType: summary.bookingType,
    tripType: summary.tripType,
    packageTitle: summary.packageTitle,
    customerName: summary.customerName,
    phone: summary.phone,
    whatsappNumber: summary.whatsappNumber,
    passengers: summary.passengers,
    travelDate: summary.travelDate,
    returnDate: summary.returnDate,
    departureDate: summary.departureDate,
    tripReturnDate: summary.tripReturnDate,
    pickupTime: summary.pickupTime,
    luggageCount: summary.luggageCount,
    vehiclePreference: summary.vehiclePreference,
    multipleDestinations: summary.multipleDestinations,
    localRentalPackage: summary.localRentalPackage,
    numberOfDays: summary.numberOfDays,
    airportTripMode: summary.airportTripMode,
    airportName: summary.airportName,
    flightNumber: summary.flightNumber,
    terminal: summary.terminal,
    flightTime: summary.flightTime,
    customDestinations: summary.customDestinations,
    specialRequirements: summary.specialRequirements,
    pickupLocation: summary.pickupLocation,
    dropLocation: summary.dropLocation,
    message: summary.message,
    status: summary.status,
    car,
    driverTrip: normalizeDriverTrip(summary.driverTrip),
    liveLocation: ["trip_started", "on_trip"].includes(summary.status) ? summary.liveLocation || null : null,
    updatedAt: summary.updatedAt
  };
}

function findFirebaseDriver(store, decoded) {
  const uid = String(decoded.uid || "").trim();
  const email = String(decoded.email || "").trim().toLowerCase();
  const phone = comparablePhone(decoded.phone_number);
  return store.drivers.find((driver) => {
    if (!driver.active) return false;
    if (uid && (driver.firebaseUid === uid || driver.authUid === uid)) return true;
    if (email && [driver.email, driver.authEmail].map((value) => String(value || "").trim().toLowerCase()).includes(email)) {
      return true;
    }
    if (phone && comparablePhone(driver.phone) === phone) return true;
    return false;
  });
}

async function verifyDriverRequest(req, store, body = {}) {
  if (firebaseAdminConfigured()) {
    const decoded = await verifyFirebaseToken(req, "Driver login");
    const driver = findFirebaseDriver(store, decoded);
    if (!driver) {
      const err = new Error("This Firebase account is not linked to an active driver. Add the driver's Firebase email, phone, or UID in admin.");
      err.status = 403;
      throw err;
    }
    req.driver = driver;
    return driver;
  }

  const url = new URL(req.url, "http://localhost");
  const driverId = body.driverId || url.searchParams.get("driverId") || url.pathname.replace(/^\/api\/driver\//, "");
  const accessCode = body.accessCode || url.searchParams.get("accessCode") || "";
  const driver = findDriver(store, driverId, accessCode);
  if (!driver) {
    const err = new Error("Invalid driver access");
    err.status = 401;
    throw err;
  }
  req.driver = driver;
  return driver;
}

async function requireDriver(req, res, store, body = {}) {
  try {
    return await verifyDriverRequest(req, store, body);
  } catch (error) {
    sendError(res, error.status || 401, error.message || "Driver login required");
    return null;
  }
}

function normalizeCarName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (!name) throw validationError("Car name is required");
  if (!/^[A-Za-z0-9 ]+$/.test(name)) {
    throw validationError("Car name can contain only letters, numbers, and spaces");
  }
  return name;
}

function normalizeVehicleNumber(value) {
  const vehicleNumber = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!vehicleNumber) throw validationError("Vehicle number is required");
  if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(vehicleNumber)) {
    throw validationError("Vehicle number format should look like KA09AB1234");
  }
  return vehicleNumber;
}

function normalizeSeatLabel(value) {
  const seats = String(value || "").trim().replace(/\s+/g, "");
  if (!seats) throw validationError("Seats field is required");
  if (!/^\d+(\+\d+)?$/.test(seats)) {
    throw validationError("Seats should look like 4+1, 5+1, or 7");
  }
  return seats;
}

function parseCostItems(value, fallbackAmount) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        label: String(item.label || "").trim(),
        amount: parseMoney(item.amount)
      }))
      .filter((item) => item.label && item.amount !== 0);
  }

  const lines = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items = lines
    .map((line) => {
      const match = line.match(/^(.+?)(?:=|:|-)\s*(-?\d+(?:\.\d+)?)$/);
      if (!match) return null;
      return {
        label: match[1].trim(),
        amount: parseMoney(match[2])
      };
    })
    .filter(Boolean);

  if (!items.length && parseMoney(fallbackAmount) > 0) {
    return [{ label: "Quotation total", amount: parseMoney(fallbackAmount) }];
  }
  return items;
}

function totalCost(items) {
  return items.reduce((sum, item) => sum + parseMoney(item.amount), 0);
}

function selectedItem(store, bookingType, packageId) {
  if (bookingType === "car") return store.cars.find((item) => item.id === packageId);
  if (bookingType === "tour") return store.tourPackages.find((item) => item.id === packageId);
  if (bookingType === "day") return store.dayPackages.find((item) => item.id === packageId);
  return null;
}

function defaultInclusions(item, bookingType) {
  if (!item) return [];
  if (bookingType === "car") return [...(item.features || []), ...(item.includedItems || [])];
  if (bookingType === "tour") return item.inclusions || [];
  if (bookingType === "day") return item.highlights || item.inclusions || [];
  return [];
}

const FIELD_LABELS = {
  customerName: "customer name",
  phone: "mobile number",
  whatsappNumber: "WhatsApp number",
  email: "email address",
  bookingType: "booking type",
  tripType: "trip type",
  trackingCode: "tracking code",
  travelDate: "travel date",
  returnDate: "return date",
  pickupTime: "pickup time",
  pickupLocation: "pickup location",
  dropLocation: "drop location",
  passengers: "passenger count",
  localRentalPackage: "local rental package",
  numberOfDays: "number of days",
  airportTripMode: "airport pickup or drop",
  airportName: "airport",
  flightTime: "flight time",
  customDestinations: "custom destinations"
};

function fieldLabel(field) {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, " $1").toLowerCase();
}

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !String(payload[field] || "").trim());
  if (missing.length) {
    const err = new Error(`Please fill ${missing.map(fieldLabel).join(", ")}.`);
    err.status = 422;
    throw err;
  }
}

function upsertById(collection, item) {
  const index = collection.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    collection.unshift(item);
    return item;
  }
  collection[index] = { ...collection[index], ...item, updatedAt: now() };
  return collection[index];
}

function itemBookingUsage(store, collectionName, itemId) {
  if (collectionName === "cars") {
    return store.bookings.filter(
      (booking) => booking.assignedCarId === itemId || (booking.bookingType === "car" && booking.packageId === itemId)
    );
  }
  if (collectionName === "tourPackages") {
    return store.bookings.filter((booking) => booking.bookingType === "tour" && booking.packageId === itemId);
  }
  if (collectionName === "dayPackages") {
    return store.bookings.filter((booking) => booking.bookingType === "day" && booking.packageId === itemId);
  }
  if (collectionName === "drivers") {
    return store.bookings.filter((booking) => booking.assignedDriverId === itemId);
  }
  return [];
}

function defaultBookingChecks() {
  return {
    customerContacted: false,
    routeVerified: false,
    scheduleConfirmed: false,
    vehicleChecked: false,
    fareShared: false,
    paymentChecked: false,
    driverInformed: false,
    tripCompleted: false
  };
}

function bookingChecksFromBody(body, existing) {
  const current = { ...defaultBookingChecks(), ...(existing || {}) };
  Object.keys(current).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      current[key] = flagValue(body[key], false);
    }
  });
  return current;
}

const TRIP_TYPES = new Set([
  "local_rental",
  "one_way",
  "round_trip",
  "one_day_package",
  "multi_day_package",
  "airport_transfer",
  "railway_transfer",
  "wedding_event",
  "corporate_booking",
  "custom_trip"
]);

function defaultTripType(bookingType) {
  if (bookingType === "tour") return "multi_day_package";
  if (bookingType === "day") return "one_day_package";
  return "one_way";
}

function normalizeTripType(value, bookingType) {
  const tripType = String(value || defaultTripType(bookingType)).trim();
  if (!TRIP_TYPES.has(tripType)) {
    throw validationError("Select a valid trip type");
  }
  return tripType;
}

function createBooking(store, payload) {
  const effectiveTravelDate = String(payload.travelDate || payload.departureDate || "").trim();
  const effectiveReturnDate = String(payload.returnDate || payload.tripReturnDate || "").trim();
  requireFields(
    { ...payload, travelDate: effectiveTravelDate },
    ["customerName", "phone", "bookingType", "travelDate", "pickupLocation", "dropLocation", "pickupTime", "passengers"]
  );
  assertValidTravelDates(effectiveTravelDate, effectiveReturnDate);
  const bookingType = String(payload.bookingType);
  if (!["car", "tour", "day"].includes(bookingType)) {
    const err = new Error("Booking type must be car, tour, or day");
    err.status = 422;
    throw err;
  }
  const tripType = normalizeTripType(payload.tripType, bookingType);
  const customerName = String(payload.customerName || "").trim();
  if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(customerName)) {
    throw validationError("Enter a valid full name using letters and spaces.");
  }
  const phone = normalizeBookingMobile(payload.phone, "Mobile number");
  const whatsappNumber = payload.whatsappNumber ? normalizeBookingMobile(payload.whatsappNumber, "WhatsApp number") : phone;
  const email = normalizeBookingEmail(payload.email);
  if (!flagValue(payload.termsAccepted, false)) {
    throw validationError("Please accept the terms, privacy, cancellation, refund, pricing, and safety policies before booking.");
  }
  if (tripType === "local_rental") {
    requireFields(payload, ["localRentalPackage"]);
  }
  if (tripType === "round_trip") {
    requireFields(
      { ...payload, returnDate: effectiveReturnDate, numberOfDays: payload.numberOfDays || payload.customNumberOfDays || payload.noOfDays },
      ["returnDate", "numberOfDays"]
    );
  }
  if (tripType === "airport_transfer") {
    requireFields(payload, ["airportTripMode", "airportName", "flightTime"]);
  }
  if (tripType === "railway_transfer") {
    requireFields(payload, ["railwayStation", "trainTime"]);
  }
  if (tripType === "wedding_event") {
    requireFields(payload, ["eventVenue", "eventStartTime"]);
  }
  if (tripType === "corporate_booking") {
    requireFields(payload, ["companyName", "reportingTime"]);
  }
  if (tripType === "custom_trip") {
    requireFields({ ...payload, customDestinations: normalizeArrayText(payload.customDestinations).join("\n") }, ["customDestinations"]);
  }
  const item = selectedItem(store, bookingType, payload.packageId || "");
  const preferredCar = store.cars.find((car) => car.id === payload.preferredCarId);
  const numberOfDays = parseInteger(payload.numberOfDays || payload.customNumberOfDays || payload.noOfDays);
  if (tripType === "round_trip" && numberOfDays < 1) {
    throw validationError("Number of days must be at least 1 for a round trip.");
  }
  const passengers = parseInteger(payload.passengers);
  if (passengers < 1) {
    throw validationError("Passenger count must be at least 1.");
  }
  const capacity = carPassengerCapacity(preferredCar || (bookingType === "car" ? item : null));
  if (capacity && passengers > capacity) {
    throw validationError(`Selected car allows ${capacity} passenger(s). Reduce passengers or choose a bigger car.`);
  }
  const trackingCode = generateTrackingCode();

  const booking = {
    id: bookingId(store, effectiveTravelDate),
    trackingCodeHash: hashTrackingCode(trackingCode),
    trackingCodeHint: `ends with ${trackingCode.slice(-2)}`,
    bookingType,
    tripType,
    packageId: payload.packageId || "",
    packageTitle: payload.packageTitle || (item && (item.name || item.title)) || "Custom booking",
    customerName,
    customerUid: String(payload.customerUid || "").trim(),
    customerAccountId: String(payload.customerAccountId || "").trim(),
    phone,
    whatsappNumber,
    email,
    passengers,
    travelDate: effectiveTravelDate,
    returnDate: effectiveReturnDate,
    departureDate: String(payload.departureDate || effectiveTravelDate || ""),
    tripReturnDate: String(payload.tripReturnDate || effectiveReturnDate || ""),
    pickupTime: String(payload.pickupTime || "").trim(),
    luggageCount: parseInteger(payload.luggageCount),
    childSeatRequired: flagValue(payload.childSeatRequired, false),
    seniorCitizenTravelling: flagValue(payload.seniorCitizenTravelling, false),
    preferredCarId: String(payload.preferredCarId || "").trim(),
    vehiclePreference: String(payload.vehiclePreference || "").trim(),
    multipleDestinations: normalizeArrayText(payload.multipleDestinations),
    localRentalPackage: String(payload.localRentalPackage || "").trim(),
    numberOfDays,
    airportTripMode: String(payload.airportTripMode || "").trim(),
    airportName: String(payload.airportName || "").trim(),
    flightNumber: String(payload.flightNumber || "").trim(),
    terminal: String(payload.terminal || "").trim(),
    flightTime: String(payload.flightTime || "").trim(),
    railwayStation: String(payload.railwayStation || "").trim(),
    trainNumber: String(payload.trainNumber || "").trim(),
    trainTime: String(payload.trainTime || "").trim(),
    eventVenue: String(payload.eventVenue || "").trim(),
    eventStartTime: String(payload.eventStartTime || "").trim(),
    eventEndTime: String(payload.eventEndTime || "").trim(),
    companyName: String(payload.companyName || "").trim(),
    reportingTime: String(payload.reportingTime || "").trim(),
    billingRequired: flagValue(payload.billingRequired, false),
    customDestinations: normalizeArrayText(payload.customDestinations),
    budget: parseMoney(payload.budget),
    specialRequirements: String(payload.specialRequirements || "").trim(),
    estimatedDistanceKm: parseMoney(payload.estimatedDistanceKm),
    estimatedTravelTime: String(payload.estimatedTravelTime || "").trim(),
    estimatedFare: parseMoney(payload.estimatedFare || payload.amount),
    paymentPreference: String(payload.paymentPreference || "pay_later").trim(),
    advancePaymentInterest: flagValue(payload.advancePaymentInterest, false),
    termsAccepted: true,
    pickupLocation: String(payload.pickupLocation).trim(),
    dropLocation: String(payload.dropLocation || "").trim(),
    message: String(payload.message || "").trim(),
    estimatedAmount: parseMoney(payload.amount),
    amount: 0,
    quotation: emptyQuotation(),
    costItems: [],
    includedItems: defaultInclusions(item, bookingType),
    excludedItems: [],
    confirmationMessage: "",
    status: "request_submitted",
    assignedDriverId: "",
    assignedCarId: bookingType === "car" ? payload.packageId || "" : "",
    paymentStatus: "waiting_for_amount",
    payment: null,
    checks: defaultBookingChecks(),
    notes: "",
    createdAt: now(),
    updatedAt: now(),
    history: []
  };
  Object.defineProperty(booking, "_trackingCode", {
    value: trackingCode,
    enumerable: false
  });

  const duplicate = findRecentDuplicateBooking(store, booking);
  if (duplicate) {
    const err = new Error(`This booking was already submitted. Your booking ID is ${duplicate.id}.`);
    err.status = 409;
    throw err;
  }

  store.bookings.unshift(booking);
  recordBookingStatusHistory(
    store,
    booking,
    { status: "", paymentStatus: "", assignedDriverId: "", assignedCarId: "", amount: "" },
    { by: "customer", source: "customer_booking", note: "Booking request submitted" }
  );
  return booking;
}

function bookingSummary(store, booking) {
  const { trackingCodeHash, ...safeBooking } = booking;
  const car = store.cars.find((item) => item.id === booking.assignedCarId);
  const driver = store.drivers.find((item) => item.id === booking.assignedDriverId);
  const quotation = normalizeQuotation(booking.quotation, booking);
  const amount = parseMoney(quotation.totalAmount || booking.amount);
  const quotedAdvance = parseMoney(quotation.advancePaid);
  const submittedPayment = parseMoney(booking.payment && booking.payment.paidAmount);
  const paidAmount = Math.max(quotedAdvance, submittedPayment);
  const costItems = quotationCostItems(quotation, booking.costItems);
  return {
    ...safeBooking,
    quotation,
    quotationHistory: quotationHistoryForBooking(store, booking.id),
    car,
    driver,
    statusHistory: statusHistoryForBooking(store, booking.id),
    paidAmount,
    amount,
    costItems,
    balanceAmount: Math.max(amount - paidAmount, 0)
  };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === "/") filePath = "/index.html";
  const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));

  if (!resolved.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  } catch {
    sendError(res, 404, "Page not found");
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  const store = await loadStore();

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ at: now() })}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/public-data") {
    sendJson(res, 200, publicData(store));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/config") {
    const client = firebaseClientConfig();
    sendJson(res, 200, {
      configured: client.configured && firebaseAdminConfigured(),
      clientConfigured: client.configured,
      serverConfigured: firebaseAdminConfigured(),
      firebaseConfig: client.firebaseConfig,
      providers: ["password", "phone", "emailLink", "google.com"]
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/customers/session") {
    const body = await readBody(req);
    const decoded = await verifyCustomerToken(req);
    normalizeStore(store);
    const mode = String(body.mode || "login");
    const payload = firebaseCustomerPayload(decoded, body);
    const existing = findCustomerForAuth(store, payload);

    if (mode === "create" && !payload.name) {
      return sendJson(res, 400, {
        error: "Enter customer name to create an account.",
        code: "CUSTOMER_NAME_REQUIRED"
      });
    }

    if (mode === "create" && !payload.phoneVerified && !payload.emailVerified) {
      return sendJson(res, 400, {
        error: "Create account using verified mobile OTP, email link, or Google.",
        code: "VERIFIED_CONTACT_REQUIRED"
      });
    }

    if (mode === "create" && existing) {
      return sendJson(res, 409, {
        error: "You already have an account. Please login.",
        code: "ACCOUNT_EXISTS",
        customer: customerPublic(existing)
      });
    }

    if (mode === "login" && !existing) {
      return sendJson(res, 404, {
        error: "No customer account found. Please create an account first.",
        code: "ACCOUNT_NOT_FOUND"
      });
    }

    const customer = existing || {
      id: id("CUS"),
      uid: payload.uid,
      authUids: [payload.uid],
      createdAt: now()
    };
    customer.authUids = Array.from(new Set([...customerAuthUids(customer), customer.uid, payload.uid].filter(Boolean)));
    customer.name = payload.name || customer.name || payload.phone || payload.email || "Customer";
    if (payload.phone) {
      customer.phone = payload.phone;
      customer.phoneVerified = payload.phoneVerified;
    } else {
      customer.phone = customer.phone || "";
    }
    if (payload.email) {
      customer.email = payload.email;
      customer.emailVerified = payload.emailVerified;
    } else {
      customer.email = customer.email || "";
    }
    customer.photoURL = payload.photoURL || customer.photoURL || "";
    customer.provider = payload.provider || customer.provider || "firebase";
    customer.lastLoginAt = now();
    customer.updatedAt = now();
    if (!existing) store.customers.unshift(customer);
    await saveStore(store);
    sendJson(res, existing ? 200 : 201, {
      customer: customerPublic(customer),
      created: !existing,
      alreadyExists: false
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/customers/me") {
    const decoded = await verifyCustomerToken(req);
    normalizeStore(store);
    const customer = findCustomerForAuth(store, firebaseCustomerPayload(decoded));
    if (!customer) return sendError(res, 404, "No customer account found. Please create an account first");
    sendJson(res, 200, { customer: customerPublic(customer) });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/customers/me") {
    const decoded = await verifyCustomerToken(req);
    normalizeStore(store);
    const customer = findCustomerForAuth(store, firebaseCustomerPayload(decoded));
    if (!customer) return sendError(res, 404, "Customer account not found");
    customer.deletedAt = now();
    customer.updatedAt = now();
    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readBody(req);
    if (firebaseAdminConfigured()) {
      return sendError(res, 410, "PIN login is disabled. Use admin email and password.");
    }
    sendJson(res, 200, { ok: body.pin === store.business.adminPin });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/session") {
    if (!(await requireAdmin(req, res, store))) return;
    sendJson(res, 200, { ok: true, admin: req.admin });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin-data") {
    if (!(await requireAdmin(req, res, store))) return;
    sendJson(res, 200, adminData(store));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/business") {
    if (!(await requireAdmin(req, res, store))) return;
    const body = await readBody(req);
    store.business = {
      ...store.business,
      name: String(body.name || store.business.name || "").trim(),
      tagline: String(body.tagline || "").trim(),
      logo: String(body.logo || "").trim(),
      phone: String(body.phone || "").trim(),
      whatsapp: String(body.whatsapp || body.whatsappNumber || "").trim(),
      email: String(body.email || "").trim(),
      address: String(body.address || "").trim(),
      googleMapsLink: String(body.googleMapsLink || body.mapLink || "").trim(),
      workingHours: String(body.workingHours || "").trim(),
      aboutText: String(body.aboutText || "").trim(),
      socialLinks: normalizeArrayText(body.socialLinks),
      footerText: String(body.footerText || "").trim(),
      emergencySupportNumber: String(body.emergencySupportNumber || "").trim(),
      privacyPolicy: String(body.privacyPolicy || "").trim(),
      cancellationPolicy: String(body.cancellationPolicy || "").trim(),
      pricingPolicy: String(body.pricingPolicy || "").trim(),
      safetyGuidelines: String(body.safetyGuidelines || "").trim(),
      faqText: String(body.faqText || "").trim(),
      gstNumber: String(body.gstNumber || "").trim(),
      upiId: String(body.upiId || "").trim(),
      qrImage: String(body.qrImage || "").trim(),
      bankDetails: String(body.bankDetails || "").trim(),
      paymentInstructions: String(body.paymentInstructions || "").trim(),
      gatewayNote: String(body.gatewayNote || store.business.gatewayNote || "").trim(),
      invoicePrefix: String(body.invoicePrefix || store.business.invoicePrefix || "VRK").trim(),
      terms: normalizeArrayText(body.terms)
    };
    await saveStore(store);
    sendJson(res, 200, { business: store.business });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bookings") {
    const body = await readBody(req);
    const booking = createBooking(store, body);
    await saveStore(store);
    sendJson(res, 201, { booking: { ...customerTrackingSummary(store, booking), trackingCode: booking._trackingCode } });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bookings/track") {
    const body = await readBody(req);
    requireFields(body, ["bookingId", "phone", "trackingCode"]);
    const booking = store.bookings.find((item) => item.id === String(body.bookingId || "").trim());
    if (!booking) return sendError(res, 404, "Booking not found. Check your booking ID.");
    try {
      verifyBookingTrackingAccess(booking, body);
    } catch (error) {
      return sendError(res, error.status || 403, error.message || "Secure tracking verification failed.");
    }
    sendJson(res, 200, { booking: customerTrackingSummary(store, booking) });
    return;
  }

  const bookingMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)$/);
  if (req.method === "GET" && bookingMatch) {
    sendError(res, 403, "Use secure tracking with booking ID, registered mobile number, and tracking code.");
    return;
  }

  const billMatch = url.pathname.match(/^\/api\/bill\/([^/]+)$/);
  if (req.method === "GET" && billMatch) {
    const booking = store.bookings.find((item) => item.id === billMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
    const billPhone = url.searchParams.get("phone") || "";
    const billTrackingCode = url.searchParams.get("trackingCode") || url.searchParams.get("code") || "";
    if (!billPhone || !billTrackingCode) {
      return sendError(res, 403, "Use secure bill link from booking tracking.");
    }
    try {
      verifyBookingTrackingAccess(booking, {
        bookingId: booking.id,
        phone: billPhone,
        trackingCode: billTrackingCode
      });
    } catch (error) {
      return sendError(res, error.status || 403, error.message || "Secure bill verification failed.");
    }
    sendJson(res, 200, {
      business: publicBusiness(store.business),
      booking: bookingSummary(store, booking)
    });
    return;
  }

  const paymentMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/payment$/);
  if (req.method === "POST" && paymentMatch) {
    const body = await readBody(req);
    const booking = store.bookings.find((item) => item.id === paymentMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
    try {
      verifyBookingTrackingAccess(booking, {
        ...body,
        bookingId: booking.id,
        phone: body.trackingPhone || body.phone
      });
    } catch (error) {
      return sendError(res, error.status || 403, error.message || "Secure tracking verification failed.");
    }
    if (parseMoney(booking.amount) <= 0 || booking.paymentStatus === "waiting_for_amount") {
      return sendError(res, 422, "Owner has not shared the quotation yet");
    }
    requireFields(body, ["payerName", "paymentMethod"]);
    const before = { ...booking };
    booking.payment = {
      payerName: String(body.payerName).trim(),
      paymentMethod: String(body.paymentMethod).trim(),
      transactionId: String(body.transactionId || "").trim(),
      paidAmount: parseMoney(body.paidAmount || booking.amount),
      paymentDate: String(body.paymentDate || "").trim(),
      submittedAt: now()
    };
    booking.paymentStatus = "payment_submitted";
    if (["quotation_accepted", "advance_pending"].includes(booking.status)) {
      booking.status = "advance_pending";
    }
    booking.updatedAt = now();
    recordBookingStatusHistory(store, booking, before, {
      by: "customer",
      source: "customer_payment",
      note: "Payment details submitted for owner verification"
    });
    await saveStore(store);
    sendJson(res, 200, { booking: customerTrackingSummary(store, booking) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/cars") {
    if (!(await requireAdmin(req, res, store))) return;
    const body = await readBody(req);
    requireFields(body, ["name", "brand", "vehicleNumber", "category", "seats"]);
    const localRate = parseMoney(body.localRate !== undefined ? body.localRate : body.ratePerKm);
    const outstationRate = parseMoney(body.outstationRate !== undefined ? body.outstationRate : body.dayRate);
    const fuelType = String(body.fuelType || body.fuel || "").trim();
    const luggageCapacity = parseInteger(body.luggageCapacity);
    const item = upsertById(store.cars, {
      id: body.id || id("CAR"),
      name: normalizeCarName(body.name),
      brand: String(body.brand || "").trim(),
      model: String(body.model || "").trim(),
      vehicleNumber: normalizeVehicleNumber(body.vehicleNumber),
      category: String(body.category).trim(),
      seats: normalizeSeatLabel(body.seats),
      luggageCapacity,
      ac: flagValue(body.ac, true),
      fuelType,
      fuel: fuelType,
      luggage: luggageCapacity ? `${luggageCapacity} bags` : String(body.luggage || "").trim(),
      localRate,
      outstationRate,
      extraKmRate: parseMoney(body.extraKmRate),
      extraHourRate: parseMoney(body.extraHourRate),
      ratePerKm: localRate,
      dayRate: outstationRate,
      image: String(body.image || "").trim(),
      description: String(body.description || "").trim(),
      features: normalizeArrayText(body.features),
      includedItems: normalizeArrayText(body.includedItems),
      extraCharges: normalizeArrayText(body.extraCharges),
      terms: normalizeArrayText(body.terms),
      available: flagValue(body.available, true),
      featured: flagValue(body.featured, false),
      active: flagValue(body.active, true),
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/tour-packages") {
    if (!(await requireAdmin(req, res, store))) return;
    const body = await readBody(req);
    const days = parseInteger(body.days || body.numberOfDays);
    const nights = parseInteger(body.nights || body.numberOfNights);
    const destinations = String(body.destinations || body.destination || "").trim();
    const duration = String(
      body.duration || (days ? `${days} days${nights ? ` / ${nights} nights` : ""}` : "")
    ).trim();
    requireFields({ ...body, destination: destinations, duration }, ["title", "destination", "duration", "price"]);
    const item = upsertById(store.tourPackages, {
      id: body.id || id("TOUR"),
      title: String(body.title).trim(),
      packageType: String(body.packageType || "").trim(),
      days,
      nights,
      startingPlace: String(body.startingPlace || "").trim(),
      destinations,
      destination: destinations,
      duration,
      suitableVehicles: String(body.suitableVehicles || "").trim(),
      price: parseMoney(body.price),
      driverAllowance: parseMoney(body.driverAllowance),
      nightAllowance: parseMoney(body.nightAllowance),
      tollParkingInfo: String(body.tollParkingInfo || body.tollParking || "").trim(),
      image: String(body.image || "").trim(),
      overview: String(body.overview || "").trim(),
      inclusions: normalizeArrayText(body.inclusions),
      exclusions: normalizeArrayText(body.exclusions),
      itinerary: normalizeArrayText(body.itinerary),
      terms: normalizeArrayText(body.terms),
      active: flagValue(body.active, true),
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/day-packages") {
    if (!(await requireAdmin(req, res, store))) return;
    const body = await readBody(req);
    requireFields(body, ["title", "place", "hours", "price"]);
    const item = upsertById(store.dayPackages, {
      id: body.id || id("DAY"),
      title: String(body.title).trim(),
      packageType: String(body.packageType || "").trim(),
      place: String(body.place).trim(),
      hours: String(body.hours).trim(),
      price: Number(body.price || 0),
      image: String(body.image || "").trim(),
      overview: String(body.overview || "").trim(),
      highlights: normalizeArrayText(body.highlights),
      inclusions: normalizeArrayText(body.inclusions || body.highlights),
      exclusions: normalizeArrayText(body.exclusions),
      itinerary: normalizeArrayText(body.itinerary),
      terms: normalizeArrayText(body.terms),
      active: flagValue(body.active, true),
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/drivers") {
    if (!(await requireAdmin(req, res, store))) return;
    const body = await readBody(req);
    requireFields(body, ["name", "phone"]);
    const existingDriver = store.drivers.find((driver) => driver.id === body.id) || {};
    const email = String(body.email || body.authEmail || existingDriver.email || "").trim().toLowerCase();
    const firebaseUid = String(body.firebaseUid || body.authUid || existingDriver.firebaseUid || "").trim();
    const accessCode = String(body.accessCode || existingDriver.accessCode || "").trim();
    const item = upsertById(store.drivers, {
      id: body.id || id("DRV"),
      name: String(body.name).trim(),
      phone: String(body.phone).trim(),
      email,
      authEmail: email,
      firebaseUid,
      license: String(body.license || "").trim(),
      accessCode,
      rating: Number(body.rating || 4.8),
      active: flagValue(body.active, true),
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/banners") {
    if (!(await requireAdmin(req, res, store))) return;
    normalizeStore(store);
    const body = await readBody(req);
    const prompt = String(body.prompt || "").trim();
    const heading = String(body.heading || body.title || (prompt ? `Explore ${prompt}` : "")).trim();
    requireFields({ heading }, ["heading"]);
    const desktopImage = String(body.desktopImage || body.image || "").trim();
    const mobileImage = String(body.mobileImage || "").trim();
    const buttonText = String(body.buttonText || body.ctaLabel || "View details").trim();
    const item = upsertById(store.banners, normalizeBannerItem({
      id: body.id || id("BAN"),
      heading,
      title: heading,
      subheading: String(body.subheading || body.subtitle || (prompt ? "Owner curated travel offer from VRK Tours and Travels" : "")).trim(),
      details: String(body.details || "").trim(),
      terms: normalizeArrayText(body.terms),
      validUntil: String(body.validUntil || "").trim(),
      offerLabel: String(body.offerLabel || "").trim(),
      badgeText: String(body.badgeText || body.offerLabel || "").trim(),
      priceText: String(body.priceText || "").trim(),
      posterStyle: String(body.posterStyle || "teal").trim(),
      prompt,
      desktopImage,
      mobileImage,
      image: desktopImage,
      buttonText,
      ctaLabel: buttonText,
      buttonLink: String(body.buttonLink || "").trim(),
      targetType: String(body.targetType || "").trim(),
      targetId: String(body.targetId || "").trim(),
      sortOrder: Number(body.sortOrder || 0),
      active: flagValue(body.active, true),
      createdAt: body.createdAt || now(),
      updatedAt: now()
    }));
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/gallery") {
    if (!(await requireAdmin(req, res, store))) return;
    normalizeStore(store);
    const body = await readBody(req);
    const image = String(body.image || body.mediaUrl || "").trim();
    requireFields({ image }, ["image"]);
    const item = upsertById(store.gallery, normalizeGalleryItem({
      id: body.id || id("GAL"),
      title: String(body.title || body.destination || body.caption || "Travel gallery").trim(),
      caption: String(body.caption || "").trim(),
      destination: String(body.destination || "").trim(),
      image,
      mediaType: "image",
      mediaUrl: image,
      thumbnail: String(body.thumbnail || "").trim(),
      tripDate: String(body.tripDate || "").trim(),
      tags: normalizeArrayText(body.tags || body.destination),
      featured: body.featured === true || body.featured === "on",
      sortOrder: Number(body.sortOrder || 0),
      active: flagValue(body.active, true),
      createdAt: body.createdAt || now(),
      updatedAt: now()
    }));
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/popup") {
    if (!(await requireAdmin(req, res, store))) return;
    normalizeStore(store);
    const body = await readBody(req);
    store.popupSettings = normalizePopupSettings({
      enabled: flagValue(body.enabled, false),
      popupType: String(body.popupType || "").trim(),
      title: String(body.title || "").trim(),
      message: String(body.message || "").trim(),
      buttonLabel: String(body.buttonLabel || "Book now").trim(),
      buttonLink: String(body.buttonLink || "#quickBooking").trim(),
      image: String(body.image || "").trim(),
      startDate: String(body.startDate || "").trim(),
      endDate: String(body.endDate || "").trim(),
      allowClose: flagValue(body.allowClose, true),
      showOncePerDevice: flagValue(body.showOncePerDevice, true)
    });
    await saveStore(store);
    sendJson(res, 200, { popupSettings: store.popupSettings });
    return;
  }

  const archiveMatch = url.pathname.match(
    /^\/api\/admin\/(cars|tourPackages|dayPackages|drivers|banners|gallery)\/([^/]+)\/archive$/
  );
  if (req.method === "POST" && archiveMatch) {
    if (!(await requireAdmin(req, res, store))) return;
    const [, collectionName, itemId] = archiveMatch;
    const item = store[collectionName].find((entry) => entry.id === itemId);
    if (!item) return sendError(res, 404, "Item not found");
    item.active = false;
    item.updatedAt = now();
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  const showMatch = url.pathname.match(
    /^\/api\/admin\/(cars|tourPackages|dayPackages|drivers|banners|gallery)\/([^/]+)\/show$/
  );
  if (req.method === "POST" && showMatch) {
    if (!(await requireAdmin(req, res, store))) return;
    const [, collectionName, itemId] = showMatch;
    const item = store[collectionName].find((entry) => entry.id === itemId);
    if (!item) return sendError(res, 404, "Item not found");
    item.active = true;
    item.updatedAt = now();
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  const deleteMatch = url.pathname.match(
    /^\/api\/admin\/(cars|tourPackages|dayPackages|drivers|banners|gallery)\/([^/]+)\/delete$/
  );
  if (req.method === "DELETE" && deleteMatch) {
    if (!(await requireAdmin(req, res, store))) return;
    const [, collectionName, itemId] = deleteMatch;
    const collection = store[collectionName];
    const index = collection.findIndex((entry) => entry.id === itemId);
    if (index === -1) return sendError(res, 404, "Item not found");
    const usedBookings = itemBookingUsage(store, collectionName, itemId);
    if (usedBookings.length) {
      return sendError(
        res,
        409,
        `This item is used in ${usedBookings.length} booking(s). Use Hide instead to keep booking history and bills safe.`
      );
    }
    const [deleted] = collection.splice(index, 1);
    await saveStore(store);
    sendJson(res, 200, { ok: true, deleted });
    return;
  }

  const assignMatch = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/assign$/);
  if (req.method === "POST" && assignMatch) {
    if (!(await requireAdmin(req, res, store))) return;
    const body = await readBody(req);
    const booking = store.bookings.find((item) => item.id === assignMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
    const adminName = req.admin && req.admin.name ? req.admin.name : "admin";
    const before = { ...booking };
    const previousQuotation = normalizeQuotation(booking.quotation, booking);
    const nextQuotation = quotationFromBody(body, previousQuotation, adminName);
    const quoteChanged = quotationChanged(previousQuotation, nextQuotation);
    const quotationReason = String(body.quotationChangeReason || "").trim();
    if (quoteChanged && (previousQuotation.totalAmount || previousQuotation.updatedAt) && !quotationReason) {
      return sendError(res, 422, "Enter a reason for changing the saved quotation.");
    }
    if (quoteChanged) {
      booking.quotation = nextQuotation;
      recordQuotationHistory(store, booking, previousQuotation, nextQuotation, {
        by: adminName,
        source: "admin_quotation_update",
        reason: quotationReason || "Initial quotation created"
      });
    }
    const calculatedAmount = parseMoney(booking.quotation.totalAmount);
    booking.assignedDriverId = body.assignedDriverId || "";
    booking.assignedCarId = body.assignedCarId || booking.assignedCarId || "";
    booking.amount = calculatedAmount;
    booking.costItems = quotationCostItems(booking.quotation, booking.costItems);
    if (Object.prototype.hasOwnProperty.call(body, "includedItems")) {
      booking.includedItems = normalizeArrayText(body.includedItems);
    }
    if (Object.prototype.hasOwnProperty.call(body, "excludedItems")) {
      booking.excludedItems = normalizeArrayText(body.excludedItems);
    }
    booking.confirmationMessage = String(body.confirmationMessage || "").trim();
    booking.status = normalizeBookingStatus(
      body.status || (booking.assignedDriverId ? "driver_assigned" : calculatedAmount > 0 ? "quotation_accepted" : booking.status)
    );
    booking.paymentStatus = normalizePaymentStatus(
      body.paymentStatus ||
        (calculatedAmount > 0 && booking.paymentStatus === "waiting_for_amount"
          ? "advance_pending"
          : booking.paymentStatus)
    );
    booking.checks = bookingChecksFromBody(body, booking.checks);
    booking.notes = String(body.notes || booking.notes || "");
    booking.updatedAt = now();
    recordBookingStatusHistory(store, booking, before, {
      by: adminName,
      source: "admin_booking_update",
      note: quoteChanged
        ? `Owner updated quotation and booking lifecycle. Reason: ${quotationReason || "Initial quotation created"}`
        : `Owner updated booking lifecycle and amount ${calculatedAmount}`
    });
    await saveStore(store);
    sendJson(res, 200, { booking: bookingSummary(store, booking) });
    return;
  }

  const adminStatusMatch = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/status$/);
  if (req.method === "POST" && adminStatusMatch) {
    if (!(await requireAdmin(req, res, store))) return;
    const body = await readBody(req);
    const booking = store.bookings.find((item) => item.id === adminStatusMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
    const before = { ...booking };
    booking.status = normalizeBookingStatus(body.status || booking.status);
    booking.paymentStatus = normalizePaymentStatus(body.paymentStatus || booking.paymentStatus);
    if (booking.paymentStatus === "advance_paid" && booking.status === "advance_pending") {
      booking.status = "advance_paid";
    }
    if (booking.paymentStatus === "fully_paid" && ["balance_pending", "trip_completed"].includes(booking.status)) {
      booking.status = "fully_paid";
    }
    booking.updatedAt = now();
    recordBookingStatusHistory(store, booking, before, {
      by: req.admin && req.admin.name ? req.admin.name : "admin",
      source: "admin_status_update",
      note: `Status changed to ${booking.status}; payment ${booking.paymentStatus}`
    });
    await saveStore(store);
    sendJson(res, 200, { booking: bookingSummary(store, booking) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/driver/login") {
    if (firebaseAdminConfigured()) {
      return sendError(res, 410, "Use Firebase driver login. Access code login is disabled on production.");
    }
    const body = await readBody(req);
    const driver = store.drivers.find(
      (item) => item.phone === body.phone && item.accessCode === body.accessCode && item.active
    );
    if (!driver) return sendError(res, 401, "Driver phone or access code is wrong");
    sendJson(res, 200, { driver: driverPublic(driver) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/driver/me") {
    const driver = await requireDriver(req, res, store);
    if (!driver) return;
    const bookings = store.bookings
      .filter((booking) => booking.assignedDriverId === driver.id)
      .map((booking) => driverBookingSummary(store, booking));
    sendJson(res, 200, {
      driver: driverPublic(driver),
      bookings
    });
    return;
  }

  const driverActionMatch = url.pathname.match(/^\/api\/driver\/bookings\/([^/]+)\/action$/);
  if (req.method === "POST" && driverActionMatch) {
    const body = await readBody(req);
    const driver = await requireDriver(req, res, store, body);
    if (!driver) return;
    const booking = store.bookings.find(
      (item) => item.id === driverActionMatch[1] && item.assignedDriverId === driver.id
    );
    if (!booking) return sendError(res, 404, "Assigned booking not found");
    try {
      applyDriverAction(store, booking, driver, body);
    } catch (error) {
      return sendError(res, error.status || 422, error.message || "Driver action failed");
    }
    await saveStore(store);
    sendJson(res, 200, { booking: driverBookingSummary(store, booking) });
    return;
  }

  const driverDataMatch = url.pathname.match(/^\/api\/driver\/([^/]+)$/);
  if (req.method === "GET" && driverDataMatch) {
    if (firebaseAdminConfigured()) {
      return sendError(res, 410, "Use /api/driver/me with Firebase driver login.");
    }
    const accessCode = url.searchParams.get("accessCode") || "";
    const driver = findDriver(store, driverDataMatch[1], accessCode);
    if (!driver) return sendError(res, 401, "Invalid driver access");
    const bookings = store.bookings
      .filter((booking) => booking.assignedDriverId === driver.id)
      .map((booking) => driverBookingSummary(store, booking));
    sendJson(res, 200, {
      driver: driverPublic(driver),
      bookings
    });
    return;
  }

  const driverStatusMatch = url.pathname.match(/^\/api\/driver\/bookings\/([^/]+)\/status$/);
  if (req.method === "POST" && driverStatusMatch) {
    if (firebaseAdminConfigured()) {
      return sendError(res, 410, "Use the driver action workflow instead of direct status updates.");
    }
    const body = await readBody(req);
    const driver = findDriver(store, body.driverId, body.accessCode);
    if (!driver) return sendError(res, 401, "Invalid driver access");
    const booking = store.bookings.find(
      (item) => item.id === driverStatusMatch[1] && item.assignedDriverId === driver.id
    );
    if (!booking) return sendError(res, 404, "Assigned booking not found");
    const before = { ...booking };
    const driverStatus = normalizeBookingStatus(body.status || booking.status);
    if (!DRIVER_BOOKING_STATUSES.includes(driverStatus)) {
      return sendError(res, 422, "Driver can update only driver and trip statuses.");
    }
    booking.status = driverStatus;
    booking.notes = String(body.notes || booking.notes || "");
    if (["trip_started", "on_trip"].includes(booking.status)) {
      const liveUrl = String(body.liveLocationUrl || "").trim();
      const liveNote = String(body.liveLocationNote || "").trim();
      if (liveUrl || liveNote) {
        booking.liveLocation = {
          url: liveUrl,
          note: liveNote,
          updatedAt: now()
        };
      }
    } else {
      delete booking.liveLocation;
    }
    booking.updatedAt = now();
    recordBookingStatusHistory(store, booking, before, {
      by: driver.name,
      source: "driver_status_update",
      note: body.notes ? `${booking.status}: ${body.notes}` : `Status changed to ${booking.status}`
    });
    await saveStore(store);
    sendJson(res, 200, { booking: driverBookingSummary(store, booking) });
    return;
  }

  sendError(res, 404, "API route not found");
}

async function router(req, res) {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    sendError(res, error.status || 500, error.message || "Server error");
  }
}

async function listenOnAvailablePort(server, ports) {
  for (const port of ports) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, HOST);
      });
      return port;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`No available port found in ${ports.join(", ")}`);
}

async function start() {
  await ensureStore();
  const server = http.createServer(router);
  const requestedPort = Number(process.env.PORT || 0);
  const ports = requestedPort ? [requestedPort] : DEFAULT_PORTS;
  const port = await listenOnAvailablePort(server, ports);
  const displayHost = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
  console.log(`VRK Tours and Travels is running at http://${displayHost}:${port}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(
    firebaseAdminConfigured()
      ? "Admin portal uses Firebase email/password login with Firestore adminUsers permission."
      : "Admin portal can use legacy PIN only when Firebase Admin credentials are not configured."
  );
  console.log("Owner can add cars, packages, drivers, prices, and payment details from admin portal.");
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
