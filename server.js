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

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function bookingId(store) {
  const prefix = String((store.business && store.business.invoicePrefix) || "VRK")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6) || "VRK";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${stamp}-${code}`;
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

function normalizeStore(store) {
  store.business = {
    qrImage: "",
    gatewayNote: "Online gateway can be connected later with Razorpay or Stripe merchant keys.",
    authNote: "OTP login, Google login, Apple login, and Microsoft login require provider accounts and production keys before enabling.",
    ...store.business
  };
  store.banners = Array.isArray(store.banners) ? store.banners : [];
  store.gallery = Array.isArray(store.gallery) ? store.gallery : [];
  store.popupSettings = {
    enabled: false,
    title: "Plan your next trip with VRK",
    message: "Send a booking request and owner will confirm the final fare.",
    buttonLabel: "Book now",
    showOnEveryVisit: false,
    image: "",
    ...(store.popupSettings || {})
  };
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
    bookings: store.bookings,
    banners: store.banners,
    gallery: store.gallery,
    popupSettings: store.popupSettings
  };
}

function isAdmin(req, store) {
  const pin = req.headers["x-admin-pin"];
  return Boolean(pin && pin === store.business.adminPin);
}

function findDriver(store, driverId, accessCode) {
  return store.drivers.find(
    (driver) => driver.id === driverId && driver.accessCode === accessCode && driver.active
  );
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
    return [{ label: "Confirmed fare", amount: parseMoney(fallbackAmount) }];
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

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !String(payload[field] || "").trim());
  if (missing.length) {
    const err = new Error(`Missing required field: ${missing.join(", ")}`);
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

function createBooking(store, payload) {
  requireFields(payload, ["customerName", "phone", "bookingType", "travelDate", "pickupLocation"]);
  const bookingType = String(payload.bookingType);
  if (!["car", "tour", "day"].includes(bookingType)) {
    const err = new Error("Booking type must be car, tour, or day");
    err.status = 422;
    throw err;
  }
  const item = selectedItem(store, bookingType, payload.packageId || "");

  const booking = {
    id: bookingId(store),
    bookingType,
    packageId: payload.packageId || "",
    packageTitle: payload.packageTitle || (item && (item.name || item.title)) || "Custom booking",
    customerName: String(payload.customerName).trim(),
    phone: String(payload.phone).trim(),
    email: String(payload.email || "").trim(),
    passengers: Number(payload.passengers || 1),
    travelDate: String(payload.travelDate),
    returnDate: String(payload.returnDate || ""),
    pickupLocation: String(payload.pickupLocation).trim(),
    dropLocation: String(payload.dropLocation || "").trim(),
    message: String(payload.message || "").trim(),
    estimatedAmount: parseMoney(payload.amount),
    amount: 0,
    costItems: [],
    includedItems: defaultInclusions(item, bookingType),
    excludedItems: [],
    confirmationMessage: "",
    status: "pending_owner_confirmation",
    assignedDriverId: "",
    assignedCarId: bookingType === "car" ? payload.packageId || "" : "",
    paymentStatus: "waiting_for_amount",
    payment: null,
    notes: "",
    createdAt: now(),
    updatedAt: now(),
    history: [
      {
        at: now(),
        by: "customer",
        message: "Booking request created"
      }
    ]
  };

  store.bookings.unshift(booking);
  return booking;
}

function bookingSummary(store, booking) {
  const car = store.cars.find((item) => item.id === booking.assignedCarId);
  const driver = store.drivers.find((item) => item.id === booking.assignedDriverId);
  const paidAmount = parseMoney(booking.payment && booking.payment.paidAmount);
  const amount = parseMoney(booking.amount);
  return {
    ...booking,
    car,
    driver,
    paidAmount,
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

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readBody(req);
    sendJson(res, 200, { ok: body.pin === store.business.adminPin });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin-data") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    sendJson(res, 200, adminData(store));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/business") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    const body = await readBody(req);
    store.business = {
      ...store.business,
      name: String(body.name || store.business.name || "").trim(),
      tagline: String(body.tagline || "").trim(),
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim(),
      address: String(body.address || "").trim(),
      gstNumber: String(body.gstNumber || "").trim(),
      upiId: String(body.upiId || "").trim(),
      qrImage: String(body.qrImage || "").trim(),
      bankDetails: String(body.bankDetails || "").trim(),
      paymentInstructions: String(body.paymentInstructions || "").trim(),
      gatewayNote: String(body.gatewayNote || store.business.gatewayNote || "").trim(),
      invoicePrefix: String(body.invoicePrefix || store.business.invoicePrefix || "VRK").trim(),
      terms: normalizeArrayText(body.terms)
    };
    if (String(body.adminPin || "").trim()) {
      store.business.adminPin = String(body.adminPin).trim();
    }
    await saveStore(store);
    sendJson(res, 200, { business: store.business });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bookings") {
    const body = await readBody(req);
    const booking = createBooking(store, body);
    await saveStore(store);
    sendJson(res, 201, { booking: bookingSummary(store, booking) });
    return;
  }

  const bookingMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)$/);
  if (req.method === "GET" && bookingMatch) {
    const booking = store.bookings.find((item) => item.id === bookingMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
    sendJson(res, 200, { booking: bookingSummary(store, booking) });
    return;
  }

  const billMatch = url.pathname.match(/^\/api\/bill\/([^/]+)$/);
  if (req.method === "GET" && billMatch) {
    const booking = store.bookings.find((item) => item.id === billMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
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
    if (parseMoney(booking.amount) <= 0 || booking.paymentStatus === "waiting_for_amount") {
      return sendError(res, 422, "Owner has not confirmed the payable amount yet");
    }
    requireFields(body, ["payerName", "paymentMethod"]);
    booking.payment = {
      payerName: String(body.payerName).trim(),
      paymentMethod: String(body.paymentMethod).trim(),
      transactionId: String(body.transactionId || "").trim(),
      paidAmount: parseMoney(body.paidAmount || booking.amount),
      paymentDate: String(body.paymentDate || "").trim(),
      submittedAt: now()
    };
    booking.paymentStatus = "payment_submitted";
    if (booking.status === "confirmed_waiting_payment") {
      booking.status = "payment_submitted";
    }
    booking.updatedAt = now();
    booking.history.push({
      at: now(),
      by: "customer",
      message: "Payment details submitted for owner verification"
    });
    await saveStore(store);
    sendJson(res, 200, { booking: bookingSummary(store, booking) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/cars") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    const body = await readBody(req);
    requireFields(body, ["name", "category", "seats"]);
    const item = upsertById(store.cars, {
      id: body.id || id("CAR"),
      name: String(body.name).trim(),
      category: String(body.category).trim(),
      seats: Number(body.seats || 4),
      fuel: String(body.fuel || "").trim(),
      luggage: String(body.luggage || "").trim(),
      ratePerKm: Number(body.ratePerKm || 0),
      dayRate: Number(body.dayRate || 0),
      image: String(body.image || "").trim(),
      features: normalizeArrayText(body.features),
      includedItems: normalizeArrayText(body.includedItems),
      extraCharges: normalizeArrayText(body.extraCharges),
      terms: normalizeArrayText(body.terms),
      active: body.active !== false,
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/tour-packages") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    const body = await readBody(req);
    requireFields(body, ["title", "destination", "duration", "price"]);
    const item = upsertById(store.tourPackages, {
      id: body.id || id("TOUR"),
      title: String(body.title).trim(),
      packageType: String(body.packageType || "").trim(),
      destination: String(body.destination).trim(),
      duration: String(body.duration).trim(),
      price: Number(body.price || 0),
      image: String(body.image || "").trim(),
      overview: String(body.overview || "").trim(),
      inclusions: normalizeArrayText(body.inclusions),
      exclusions: normalizeArrayText(body.exclusions),
      itinerary: normalizeArrayText(body.itinerary),
      terms: normalizeArrayText(body.terms),
      active: body.active !== false,
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/day-packages") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
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
      exclusions: normalizeArrayText(body.exclusions),
      terms: normalizeArrayText(body.terms),
      active: body.active !== false,
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/drivers") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    const body = await readBody(req);
    requireFields(body, ["name", "phone", "accessCode"]);
    const item = upsertById(store.drivers, {
      id: body.id || id("DRV"),
      name: String(body.name).trim(),
      phone: String(body.phone).trim(),
      license: String(body.license || "").trim(),
      accessCode: String(body.accessCode).trim(),
      rating: Number(body.rating || 4.8),
      active: body.active !== false,
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/banners") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    normalizeStore(store);
    const body = await readBody(req);
    const prompt = String(body.prompt || "").trim();
    const title = String(body.title || (prompt ? `Explore ${prompt}` : "")).trim();
    requireFields({ title }, ["title"]);
    const item = upsertById(store.banners, {
      id: body.id || id("BAN"),
      title,
      subtitle: String(body.subtitle || (prompt ? "Owner curated travel offer from VRK Tours and Travels" : "")).trim(),
      details: String(body.details || "").trim(),
      terms: normalizeArrayText(body.terms),
      validUntil: String(body.validUntil || "").trim(),
      offerLabel: String(body.offerLabel || "").trim(),
      prompt,
      image: String(body.image || "").trim(),
      ctaLabel: String(body.ctaLabel || "View details").trim(),
      targetType: String(body.targetType || "").trim(),
      targetId: String(body.targetId || "").trim(),
      sortOrder: Number(body.sortOrder || 0),
      active: body.active !== false,
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/gallery") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    normalizeStore(store);
    const body = await readBody(req);
    requireFields(body, ["title", "mediaUrl"]);
    const item = upsertById(store.gallery, {
      id: body.id || id("GAL"),
      title: String(body.title).trim(),
      caption: String(body.caption || "").trim(),
      mediaType: String(body.mediaType || "image").trim(),
      mediaUrl: String(body.mediaUrl || "").trim(),
      thumbnail: String(body.thumbnail || "").trim(),
      tripDate: String(body.tripDate || "").trim(),
      tags: normalizeArrayText(body.tags),
      featured: body.featured === true || body.featured === "on",
      sortOrder: Number(body.sortOrder || 0),
      active: body.active !== false,
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/popup") {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    normalizeStore(store);
    const body = await readBody(req);
    store.popupSettings = {
      enabled: body.enabled === true || body.enabled === "on",
      title: String(body.title || "").trim(),
      message: String(body.message || "").trim(),
      buttonLabel: String(body.buttonLabel || "Book now").trim(),
      showOnEveryVisit: body.showOnEveryVisit === true || body.showOnEveryVisit === "on",
      image: String(body.image || "").trim()
    };
    await saveStore(store);
    sendJson(res, 200, { popupSettings: store.popupSettings });
    return;
  }

  const archiveMatch = url.pathname.match(
    /^\/api\/admin\/(cars|tourPackages|dayPackages|drivers|banners|gallery)\/([^/]+)\/archive$/
  );
  if (req.method === "POST" && archiveMatch) {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    const [, collectionName, itemId] = archiveMatch;
    const item = store[collectionName].find((entry) => entry.id === itemId);
    if (!item) return sendError(res, 404, "Item not found");
    item.active = false;
    item.updatedAt = now();
    await saveStore(store);
    sendJson(res, 200, { item });
    return;
  }

  const assignMatch = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/assign$/);
  if (req.method === "POST" && assignMatch) {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    const body = await readBody(req);
    const booking = store.bookings.find((item) => item.id === assignMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
    const costItems = parseCostItems(body.costItems, body.amount || booking.amount);
    const calculatedAmount = costItems.length ? totalCost(costItems) : parseMoney(body.amount || booking.amount);
    booking.assignedDriverId = body.assignedDriverId || "";
    booking.assignedCarId = body.assignedCarId || booking.assignedCarId || "";
    booking.amount = calculatedAmount;
    booking.costItems = costItems;
    if (Object.prototype.hasOwnProperty.call(body, "includedItems")) {
      booking.includedItems = normalizeArrayText(body.includedItems);
    }
    if (Object.prototype.hasOwnProperty.call(body, "excludedItems")) {
      booking.excludedItems = normalizeArrayText(body.excludedItems);
    }
    booking.confirmationMessage = String(body.confirmationMessage || "").trim();
    booking.status = body.status || (booking.assignedDriverId ? "assigned" : "confirmed_waiting_payment");
    booking.paymentStatus =
      body.paymentStatus ||
      (calculatedAmount > 0 && booking.paymentStatus === "waiting_for_amount"
        ? "payment_required"
        : booking.paymentStatus);
    booking.notes = String(body.notes || booking.notes || "");
    booking.updatedAt = now();
    booking.history.push({
      at: now(),
      by: "admin",
      message: `Owner updated booking to ${booking.status} with amount ${calculatedAmount}`
    });
    await saveStore(store);
    sendJson(res, 200, { booking: bookingSummary(store, booking) });
    return;
  }

  const adminStatusMatch = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/status$/);
  if (req.method === "POST" && adminStatusMatch) {
    if (!isAdmin(req, store)) return sendError(res, 401, "Invalid admin PIN");
    const body = await readBody(req);
    const booking = store.bookings.find((item) => item.id === adminStatusMatch[1]);
    if (!booking) return sendError(res, 404, "Booking not found");
    booking.status = String(body.status || booking.status);
    booking.paymentStatus = String(body.paymentStatus || booking.paymentStatus);
    if (["paid", "advance_paid"].includes(booking.paymentStatus) && booking.status === "payment_submitted") {
      booking.status = "payment_verified";
    }
    booking.updatedAt = now();
    booking.history.push({
      at: now(),
      by: "admin",
      message: `Status changed to ${booking.status}; payment ${booking.paymentStatus}`
    });
    await saveStore(store);
    sendJson(res, 200, { booking: bookingSummary(store, booking) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/driver/login") {
    const body = await readBody(req);
    const driver = store.drivers.find(
      (item) => item.phone === body.phone && item.accessCode === body.accessCode && item.active
    );
    if (!driver) return sendError(res, 401, "Driver phone or access code is wrong");
    sendJson(res, 200, { driver: { id: driver.id, name: driver.name, phone: driver.phone } });
    return;
  }

  const driverDataMatch = url.pathname.match(/^\/api\/driver\/([^/]+)$/);
  if (req.method === "GET" && driverDataMatch) {
    const accessCode = url.searchParams.get("accessCode") || "";
    const driver = findDriver(store, driverDataMatch[1], accessCode);
    if (!driver) return sendError(res, 401, "Invalid driver access");
    const bookings = store.bookings
      .filter((booking) => booking.assignedDriverId === driver.id)
      .map((booking) => bookingSummary(store, booking));
    sendJson(res, 200, {
      driver: { id: driver.id, name: driver.name, phone: driver.phone, rating: driver.rating },
      bookings
    });
    return;
  }

  const driverStatusMatch = url.pathname.match(/^\/api\/driver\/bookings\/([^/]+)\/status$/);
  if (req.method === "POST" && driverStatusMatch) {
    const body = await readBody(req);
    const driver = findDriver(store, body.driverId, body.accessCode);
    if (!driver) return sendError(res, 401, "Invalid driver access");
    const booking = store.bookings.find(
      (item) => item.id === driverStatusMatch[1] && item.assignedDriverId === driver.id
    );
    if (!booking) return sendError(res, 404, "Assigned booking not found");
    booking.status = String(body.status || booking.status);
    booking.notes = String(body.notes || booking.notes || "");
    booking.updatedAt = now();
    booking.history.push({
      at: now(),
      by: driver.name,
      message: body.notes ? `${booking.status}: ${body.notes}` : `Status changed to ${booking.status}`
    });
    await saveStore(store);
    sendJson(res, 200, { booking: bookingSummary(store, booking) });
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
  console.log("Admin PIN: 1234");
  console.log("Owner can add cars, packages, drivers, prices, and payment details from admin portal.");
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
