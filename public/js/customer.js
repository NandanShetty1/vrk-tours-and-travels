(function () {
  const state = {
    data: null,
    tab: "cars",
    selected: null,
    infoItem: null,
    heroTimer: null,
    catalogTimers: [],
    pageMode: document.body.dataset.page || "home",
    customerProfile: null,
    auth: {
      ready: false,
      configured: false,
      mode: "login",
      method: "phone",
      confirmationResult: null,
      user: null,
      modules: null
    },
    popupShown: false
  };

  const heroCarousel = document.querySelector("#heroCarousel");
  const catalog = document.querySelector("#catalog");
  const galleryGrid = document.querySelector("#galleryGrid");
  const bookingForm = document.querySelector("#bookingForm");
  const modalBookingForm = document.querySelector("#modalBookingForm");
  const accountButton = document.querySelector("#accountButton");
  const accountButtonLabel = document.querySelector("#accountButtonLabel");
  const accountAvatar = document.querySelector("#accountAvatar");
  const accountModal = document.querySelector("#accountModal");
  const accountClose = document.querySelector("#accountClose");
  const customerLoginForm = document.querySelector("#customerLoginForm");
  const customerLoginMessage = document.querySelector("#customerLoginMessage");
  const customerAccountStatus = document.querySelector("#customerAccountStatus");
  const customerAccountSummary = document.querySelector("#customerAccountSummary");
  const providerLoginRow = document.querySelector(".provider-login-row");
  const authModeButtons = Array.from(document.querySelectorAll("[data-auth-mode]"));
  const authMethodButtons = Array.from(document.querySelectorAll("[data-auth-method]"));
  const authFieldGroups = Array.from(document.querySelectorAll("[data-auth-field]"));
  const authCreateFields = Array.from(document.querySelectorAll(".auth-create-field"));
  const authContinueButton = document.querySelector("#authContinueButton");
  const otpPanel = document.querySelector("#otpPanel");
  const verifyOtpButton = document.querySelector("#verifyOtpButton");
  const recaptchaContainer = document.querySelector("#recaptchaContainer");
  const bookingModal = document.querySelector("#bookingModal");
  const modalClose = document.querySelector("#modalClose");
  const infoModal = document.querySelector("#infoModal");
  const infoClose = document.querySelector("#infoClose");
  const infoCloseSecondary = document.querySelector("#infoCloseSecondary");
  const infoEyebrow = document.querySelector("#infoEyebrow");
  const infoTitle = document.querySelector("#infoTitle");
  const infoSubtitle = document.querySelector("#infoSubtitle");
  const infoBody = document.querySelector("#infoBody");
  const infoBook = document.querySelector("#infoBook");
  const siteFooter = document.querySelector("#siteFooter");
  const trackForm = document.querySelector("#trackForm");
  const trackResult = document.querySelector("#trackResult");
  const bookingMessage = document.querySelector("#bookingMessage");
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));

  function loadCustomerProfile() {
    try {
      const profile = JSON.parse(sessionStorage.getItem("vrkCustomerProfile") || "null");
      return profile && profile.verified ? profile : null;
    } catch {
      return null;
    }
  }

  function saveCustomerProfile(profile) {
    state.customerProfile = {
      ...profile,
      verified: true,
      customerName: profile.customerName || profile.name || "Customer"
    };
    sessionStorage.setItem("vrkCustomerProfile", JSON.stringify(state.customerProfile));
    renderCustomerAccount();
    applyCustomerProfile();
  }

  function clearCustomerProfile() {
    const previous = state.customerProfile;
    state.customerProfile = null;
    sessionStorage.removeItem("vrkCustomerProfile");
    renderCustomerAccount();
    if (previous && customerLoginForm && customerLoginForm.elements) {
      customerLoginForm.elements.customerName.value = previous.customerName || "";
      customerLoginForm.elements.phone.value = localIndiaPhone(previous.phone);
      customerLoginForm.elements.email.value = previous.email || "";
    }
  }

  function applyCustomerProfile() {
    if (!state.customerProfile) return;
    [bookingForm, modalBookingForm].forEach((form) => {
      if (!form || !form.elements) return;
      ["customerName", "phone", "email"].forEach((field) => {
        const value = field === "customerName" ? state.customerProfile.customerName || state.customerProfile.name : state.customerProfile[field];
        if (form.elements[field] && value) {
          form.elements[field].value = value;
        }
      });
    });
  }

  function setAuthMessage(message, tone) {
    if (!customerLoginMessage) return;
    VRK.setMessage(customerLoginMessage, message, tone || "");
  }

  function localIndiaPhone(phone) {
    return String(phone || "").replace(/^\+91/, "").replace(/\D/g, "").slice(-10);
  }

  function normalizePhone(phone, countryCode) {
    const code = String(countryCode || "+91").trim() || "+91";
    const trimmed = String(phone || "").replace(/\D/g, "");
    if (!trimmed) return "";
    const local = trimmed.length > 10 ? trimmed.slice(-10) : trimmed.replace(/^0+/, "");
    return `${code}${local}`;
  }

  function friendlyAuthError(error, method) {
    const code = error && error.code;
    const message = String((error && error.message) || "Login failed. Please try again.");
    if (code === "auth/operation-not-allowed") {
      if (method === "phone") return "Mobile OTP is not enabled in Firebase Authentication. Enable Phone sign-in method.";
      if (method === "email") return "Email link login is not enabled in Firebase Authentication. Enable Email/Password and Email link sign-in.";
      if (method === "google") return "Google login is not enabled in Firebase Authentication. Enable Google sign-in method.";
      return "This login provider is not enabled in Firebase Authentication.";
    }
    if (code === "auth/billing-not-enabled") {
      return "Mobile OTP needs Firebase billing enabled for real SMS. Use Google/email login now, or upgrade Firebase to Blaze and try again.";
    }
    if (code === "auth/unauthorized-domain") {
      return "Add this website domain in Firebase Authentication authorized domains.";
    }
    if (code === "auth/invalid-app-credential" || code === "auth/missing-app-credential") {
      return "Mobile OTP security check failed. Add this website domain in Firebase authorized domains and enable Phone sign-in.";
    }
    if (code === "auth/too-many-requests" || code === "auth/quota-exceeded") {
      return "Too many OTP attempts. Please wait and try again later.";
    }
    if (code === "auth/popup-blocked") {
      return "Popup was blocked. Allow popups for this website and try again.";
    }
    if (code === "auth/popup-closed-by-user") {
      return "Login popup was closed before completion.";
    }
    return message;
  }

  function customerNameValue() {
    if (!customerLoginForm) return "";
    return String(customerLoginForm.elements.customerName.value || "").trim();
  }

  function requireCreateName() {
    if (state.auth.mode !== "create") return true;
    if (customerNameValue()) return true;
    setAuthMessage("Enter customer name to create an account.", "danger");
    customerLoginForm.elements.customerName.focus();
    return false;
  }

  function authContinueLabel() {
    const verb = state.auth.mode === "create" ? "Create account" : "Login";
    if (state.auth.method === "email") return `${verb} with email link`;
    if (state.auth.method === "google") return `${verb} with Google`;
    return `${verb} with mobile OTP`;
  }

  function authStatusText() {
    const action = state.auth.mode === "create" ? "Create account" : "Login";
    if (state.auth.method === "email") return `${action} using a secure email link. Open the link in this same browser.`;
    if (state.auth.method === "google") return `${action} using your Google account.`;
    return `${action} using India mobile number OTP.`;
  }

  function refreshAuthControls() {
    if (!customerLoginForm || !customerAccountStatus || !authContinueButton || !otpPanel || !verifyOtpButton) return;
    const isSignup = state.auth.mode === "create";
    const title = document.querySelector("#customer-account-title");
    if (title) title.textContent = isSignup ? "Create customer account" : "Login to customer account";
    customerAccountStatus.textContent = authStatusText();
    customerLoginForm.elements.customerName.required = isSignup;
    authCreateFields.forEach((field) => field.classList.toggle("hidden", !isSignup));
    authFieldGroups.forEach((field) => {
      field.classList.toggle("hidden", field.dataset.authField !== state.auth.method);
    });
    providerLoginRow.classList.add("hidden");
    authContinueButton.textContent = authContinueLabel();
    authContinueButton.dataset.authAction = state.auth.method;
    const useOtp = state.auth.method === "phone";
    otpPanel.classList.toggle("hidden", !useOtp || !state.auth.confirmationResult);
    verifyOtpButton.classList.toggle("hidden", !useOtp || !state.auth.confirmationResult);
    if (!useOtp) state.auth.confirmationResult = null;
  }

  function applyAuthMode(mode) {
    state.auth.mode = mode === "create" ? "create" : "login";
    authModeButtons.forEach((item) => {
      const itemMode = item.dataset.authMode === "signup" ? "create" : "login";
      item.classList.toggle("active", itemMode === state.auth.mode);
    });
    refreshAuthControls();
  }

  function applyAuthMethod(method) {
    state.auth.method = ["phone", "email", "google"].includes(method) ? method : "phone";
    authMethodButtons.forEach((item) => item.classList.toggle("active", item.dataset.authMethod === state.auth.method));
    state.auth.confirmationResult = null;
    refreshAuthControls();
  }

  async function firebaseIdToken() {
    if (!state.auth.user) return "";
    return state.auth.user.getIdToken();
  }

  async function customerRequest(path, options) {
    const token = await firebaseIdToken();
    return VRK.request(path, {
      ...(options || {}),
      headers: {
        Authorization: `Bearer ${token}`,
        ...((options && options.headers) || {})
      }
    });
  }

  async function finishVerifiedCustomer(user, mode, extra) {
    const token = await user.getIdToken();
    const response = await fetch("/api/customers/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        mode,
        displayName: extra && extra.displayName,
        phone: extra && extra.phone,
        email: extra && extra.email,
        provider: extra && extra.provider
      })
    });
    const result = await response.json();
    if (!response.ok) {
      clearCustomerProfile();
      if (state.auth.modules && state.auth.instance) {
        await state.auth.modules.signOut(state.auth.instance);
      }
      throw new Error(result.error || "Customer login failed");
    }
    saveCustomerProfile(result.customer);
    setAuthMessage(result.created ? "Account created successfully." : "Logged in successfully.", "good");
    closeAccountModal();
  }

  async function setupFirebaseAuth() {
    const config = await VRK.request("/api/auth/config");
    state.auth.configured = Boolean(config.configured && config.firebaseConfig);
    if (!state.auth.configured) {
      state.auth.ready = true;
      renderCustomerAccount();
      setAuthMessage(
        "Secure login is not active yet. Add Firebase keys in Render environment variables.",
        "danger"
      );
      return;
    }

    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const app = appModule.initializeApp(config.firebaseConfig);
    const auth = authModule.getAuth(app);
    state.auth.modules = authModule;
    state.auth.instance = auth;
    state.auth.ready = true;

    authModule.onAuthStateChanged(auth, async (user) => {
      state.auth.user = user;
      if (!user) {
        sessionStorage.removeItem("vrkCustomerProfile");
        state.customerProfile = null;
        renderCustomerAccount();
        return;
      }
      try {
        const result = await customerRequest("/api/customers/me");
        saveCustomerProfile(result.customer);
      } catch {
        state.customerProfile = null;
        sessionStorage.removeItem("vrkCustomerProfile");
        renderCustomerAccount();
      }
    });

    if (authModule.isSignInWithEmailLink(auth, window.location.href)) {
      const pending = JSON.parse(localStorage.getItem("vrkEmailLogin") || "{}");
      const email = pending.email || window.prompt("Enter your email to complete sign in");
      if (email) {
        try {
          const credential = await authModule.signInWithEmailLink(auth, email, window.location.href);
          localStorage.removeItem("vrkEmailLogin");
          await finishVerifiedCustomer(credential.user, pending.mode || "login", pending);
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          localStorage.removeItem("vrkEmailLogin");
          window.history.replaceState({}, document.title, window.location.pathname);
          setAuthMessage(friendlyAuthError(error, "email"), "danger");
        }
      }
    }
  }

  function renderCustomerAccount() {
    if (!accountButton || !customerLoginForm || !customerAccountStatus || !providerLoginRow || !customerAccountSummary) return;
    const profile = state.customerProfile;
    if (!profile) {
      customerAccountStatus.textContent = state.auth.configured
        ? "Login or create account with verified mobile OTP, email link, or Google."
        : "Secure customer login needs Firebase keys before customers can sign in.";
      accountButtonLabel.textContent = "Sign in";
      accountAvatar.textContent = "?";
      accountButton.classList.remove("signed-in");
      customerLoginForm.classList.remove("hidden");
      providerLoginRow.classList.add("hidden");
      customerAccountSummary.classList.add("hidden");
      customerAccountSummary.innerHTML = "";
      refreshAuthControls();
      if (!state.auth.configured) {
        customerAccountStatus.textContent = "Secure customer login needs Firebase keys before customers can sign in.";
      }
      return;
    }
    const name = profile.customerName || profile.name || "Customer";
    customerAccountStatus.textContent = "Signed in with verified account.";
    accountButtonLabel.textContent = name.split(/\s+/)[0] || "Account";
    accountAvatar.textContent = name.slice(0, 1).toUpperCase();
    accountButton.classList.add("signed-in");
    customerLoginForm.classList.add("hidden");
    providerLoginRow.classList.add("hidden");
    customerAccountSummary.classList.remove("hidden");
    customerAccountSummary.innerHTML = `
      <div>
        <strong>${VRK.escapeHtml(name)}</strong>
        <small>${VRK.escapeHtml(profile.phone)}${profile.email ? ` | ${VRK.escapeHtml(profile.email)}` : ""}</small>
      </div>
      <div class="account-summary-actions">
        <button class="ghost" data-customer-logout type="button">Logout</button>
        <button class="ghost danger-button" data-customer-delete type="button">Delete account</button>
      </div>
    `;
  }

  function openAccountModal() {
    if (!accountModal) return;
    accountModal.classList.remove("hidden");
  }

  function closeAccountModal() {
    if (!accountModal) return;
    accountModal.classList.add("hidden");
  }

  function itemByTab() {
    if (!state.data) return [];
    if (state.tab === "cars") return state.data.cars;
    if (state.tab === "tours") return state.data.tourPackages;
    return state.data.dayPackages;
  }

  function itemByType(type) {
    if (!state.data) return [];
    if (type === "car") return state.data.cars.map((item) => ({ ...item, bookingType: "car" }));
    if (type === "tour") return state.data.tourPackages.map((item) => ({ ...item, bookingType: "tour" }));
    return state.data.dayPackages.map((item) => ({ ...item, bookingType: "day" }));
  }

  function catalogSections() {
    if (state.pageMode === "cars") {
      return [
        {
          type: "car",
          eyebrow: "Complete fleet",
          title: "All active cars",
          note: "Every active vehicle published by the owner, with image, category, seating, luggage, AC type, rates, and availability.",
          empty: "Owner has not published active cars yet."
        }
      ];
    }

    return [
      {
        type: "car",
        eyebrow: "Fleet",
        title: "Featured cars for local and outstation trips",
        note: "Owner-selected vehicles shown first on the homepage. Open the full cars page to compare every active car.",
        empty: "Owner has not marked any featured cars yet.",
        featuredOnly: true,
        actionHref: "/cars.html",
        actionLabel: "View all cars"
      },
      {
        type: "tour",
        eyebrow: "Tour packages",
        title: "Multi-day tour packages",
        note: "Package cards show destination, duration, inclusions, exclusions, and owner-set starting price.",
        empty: "Owner has not published active tour packages yet."
      },
      {
        type: "day",
        eyebrow: "One day",
        title: "One day travel packages",
        note: "Quick plans for temple visits, sightseeing, family outings, and same-day return trips.",
        empty: "Owner has not published active one day packages yet."
      }
    ];
  }

  function allItems() {
    if (!state.data) return [];
    return [
      ...state.data.cars.map((item) => ({ ...item, bookingType: "car" })),
      ...state.data.tourPackages.map((item) => ({ ...item, bookingType: "tour" })),
      ...state.data.dayPackages.map((item) => ({ ...item, bookingType: "day" }))
    ];
  }

  function bookingTypeForTab() {
    if (state.tab === "cars") return "car";
    if (state.tab === "tours") return "tour";
    return "day";
  }

  function kindForItem(item) {
    return (item && item.bookingType) || bookingTypeForTab();
  }

  function titleForItem(item) {
    return item.name || item.title || "Custom travel enquiry";
  }

  function amountForItem(item) {
    if (!item) return 0;
    if (kindForItem(item) === "car") {
      return Number(item.outstationRate || item.localRate || item.dayRate || item.ratePerKm || 0);
    }
    return item.price;
  }

  function priceForItem(item) {
    if (kindForItem(item) === "car") {
      const localRate = Number(item.localRate || item.ratePerKm || 0);
      const outstationRate = Number(item.outstationRate || item.dayRate || 0);
      const extraKmRate = Number(item.extraKmRate || 0);
      const parts = [
        localRate ? `${VRK.money(localRate)} local/km` : "",
        outstationRate ? `${VRK.money(outstationRate)} outstation/km` : "",
        extraKmRate ? `${VRK.money(extraKmRate)} extra/km` : ""
      ].filter(Boolean);
      return parts.length ? parts.join(" / ") : "Owner confirms fare";
    }
    return `${VRK.money(item.price)} starting price`;
  }

  function ratePerKm(value) {
    const amount = Number(value || 0);
    return amount ? `${VRK.money(amount)}/km` : "Owner confirms";
  }

  function availabilityLabel(item) {
    return item && item.available === false ? "Currently unavailable" : "Available now";
  }

  function availabilityClass(item) {
    return item && item.available === false ? "warn" : "good";
  }

  function passengerCapacity(item) {
    const match = String(item && item.seats ? item.seats : "").match(/^\d+/);
    return match ? Number(match[0]) : 0;
  }

  function carDetailsForItem(item) {
    const luggage = Number(item.luggageCapacity || 0);
    return [
      item.brand || item.model ? `Brand: ${[item.brand, item.model].filter(Boolean).join(" ")}` : "",
      item.vehicleNumber ? `Vehicle no: ${item.vehicleNumber}` : "",
      item.seats ? `Seats: ${item.seats}` : "",
      luggage ? `Luggage capacity: ${luggage}` : "",
      item.ac === false ? "Non AC" : "AC",
      item.fuelType || item.fuel ? `Fuel: ${item.fuelType || item.fuel}` : ""
    ].filter(Boolean);
  }

  function carRateDetails(item) {
    return [
      Number(item.localRate || item.ratePerKm || 0) ? `Local: ${VRK.money(item.localRate || item.ratePerKm)} per km` : "",
      Number(item.outstationRate || item.dayRate || 0) ? `Outstation: ${VRK.money(item.outstationRate || item.dayRate)} per km` : "",
      Number(item.extraKmRate || 0) ? `Extra km: ${VRK.money(item.extraKmRate)}` : "",
      Number(item.extraHourRate || 0) ? `Extra hour: ${VRK.money(item.extraHourRate)}` : ""
    ].filter(Boolean);
  }

  function detailForItem(item) {
    const kind = kindForItem(item);
    if (kind === "car") {
      const luggage = Number(item.luggageCapacity || 0);
      return [
        item.category || "Car",
        item.seats ? `${item.seats} seats` : "Seats not set",
        item.ac === false ? "Non AC" : "AC",
        item.fuelType || item.fuel || "Fuel",
        luggage ? `${luggage} luggage` : item.luggage || "Luggage"
      ]
        .filter(Boolean)
        .join(" | ");
    }
    if (kind === "tour") {
      return `${item.packageType || "Tour"} | ${item.destination || "Destination"} | ${item.duration || "Duration"}`;
    }
    return `${item.packageType || "One day"} | ${item.place || "Place"} | ${item.hours || "Hours"}`;
  }

  function tagsForItem(item) {
    if (kindForItem(item) === "car") {
      const generated = [
        item.featured ? "Featured" : "",
        availabilityLabel(item),
        item.brand || "",
        item.model || "",
        item.fuelType || item.fuel || ""
      ].filter(Boolean);
      return [...generated, ...(item.features || [])];
    }
    return item.features || item.inclusions || item.highlights || [];
  }

  function serviceLabel(item) {
    const kind = kindForItem(item);
    if (kind === "car") return item.category || "Car";
    if (kind === "tour") return item.packageType || "Tour package";
    return item.packageType || "One day package";
  }

  function cardSpecsForItem(item) {
    const kind = kindForItem(item);
    if (kind === "car") {
      const luggage = Number(item.luggageCapacity || 0);
      return [
        ["Category", item.category || "Car"],
        ["Seating capacity", item.seats || "Ask owner"],
        ["Luggage capacity", luggage ? `${luggage} bags` : item.luggage || "Ask owner"],
        ["AC type", item.ac === false ? "Non AC" : "AC"]
      ];
    }
    if (kind === "tour") {
      return [
        ["Destination", item.destination || "Custom"],
        ["Duration", item.duration || "Ask owner"],
        ["Type", item.packageType || "Tour"],
        ["Starts from", VRK.money(item.price || 0)]
      ];
    }
    return [
      ["Place", item.place || "Custom"],
      ["Hours", item.hours || "Ask owner"],
      ["Type", item.packageType || "One day"],
      ["Starts from", VRK.money(item.price || 0)]
    ];
  }

  function carRateStrip(item) {
    return `
      <div class="car-rate-strip">
        <span>
          <small>Starting local rate</small>
          <b>${VRK.escapeHtml(ratePerKm(item.localRate || item.ratePerKm))}</b>
        </span>
        <span>
          <small>Starting outstation rate</small>
          <b>${VRK.escapeHtml(ratePerKm(item.outstationRate || item.dayRate))}</b>
        </span>
      </div>
    `;
  }

  function includedForItem(item) {
    if (!item) return [];
    const kind = kindForItem(item);
    if (kind === "car") return [...(item.features || []), ...(item.includedItems || [])];
    if (kind === "tour") return item.inclusions || [];
    return item.highlights || item.inclusions || [];
  }

  function excludedForItem(item) {
    if (!item) return [];
    if (kindForItem(item) === "car") return item.extraCharges || [];
    return item.exclusions || [];
  }

  function styleForText(text) {
    const colors = [
      ["#0f766e", "#16221d"],
      ["#c2410c", "#172554"],
      ["#1d4ed8", "#365314"],
      ["#7c2d12", "#0f172a"],
      ["#047857", "#92400e"]
    ];
    const hash = String(text || "vrk").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const [start, end] = colors[hash % colors.length];
    return `background: linear-gradient(135deg, ${start}, ${end});`;
  }

  function renderHero() {
    const banners = state.data.banners || [];
    if (state.heroTimer) {
      window.clearInterval(state.heroTimer);
      state.heroTimer = null;
    }
    if (!banners.length) {
      heroCarousel.innerHTML = `
        <article class="hero-slide" style="${styleForText("VRK Tours")}">
          <div>
            <span class="eyebrow">VRK Tours and Travels</span>
            <h1>Cars, one way trips, tours, and day packages</h1>
            <p>Owner-confirmed pricing, driver assignment, and printable booking bill.</p>
            <span class="hero-hint">Choose a service below to book</span>
          </div>
        </article>
      `;
      return;
    }

    heroCarousel.innerHTML = banners
      .map(
        (banner) => `
          <article class="hero-slide banner-click" data-banner-info="${VRK.escapeHtml(banner.id)}" tabindex="0" role="button" aria-label="Open details for ${VRK.escapeHtml(
            banner.title
          )}" style="${
            banner.image
              ? `background-image: linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.18)), url('${VRK.escapeHtml(
                  banner.image
                )}')`
              : styleForText(banner.prompt || banner.title)
          }">
            <div>
              <span class="eyebrow">${VRK.escapeHtml(banner.offerLabel || banner.prompt || "Featured offer")}</span>
              <h1>${VRK.escapeHtml(banner.title)}</h1>
              <p>${VRK.escapeHtml(banner.subtitle || "Book now and owner will confirm the best travel plan.")}</p>
              <span class="hero-hint">${VRK.escapeHtml(banner.ctaLabel || "View details")}</span>
            </div>
          </article>
        `
      )
      .join("");
    startHeroAutoplay();
  }

  function startHeroAutoplay() {
    const slides = Array.from(heroCarousel.querySelectorAll(".hero-slide"));
    if (slides.length < 2) return;
    let index = 0;
    state.heroTimer = window.setInterval(() => {
      if (document.hidden) return;
      index = (index + 1) % slides.length;
      heroCarousel.scrollTo({ left: slides[index].offsetLeft - heroCarousel.offsetLeft, behavior: "smooth" });
    }, 5000);
  }

  function card(item) {
    const kind = kindForItem(item);
    const selected = state.selected && state.selected.id === item.id && kindForItem(state.selected) === kind;
    const unavailable = kind === "car" && item.available === false;
    const specs = cardSpecsForItem(item);
    const tags = tagsForItem(item).filter(Boolean).slice(0, 4);
    return `
      <article class="service-card catalog-card ${selected ? "selected" : ""} ${item.featured ? "featured-card" : ""} ${
      unavailable ? "unavailable-card" : ""
    }" data-card-type="${kind}">
        <div class="service-media">
          <div class="service-card-label">
            <span>${VRK.escapeHtml(serviceLabel(item))}</span>
            ${item.featured ? `<b>Featured</b>` : ""}
            ${unavailable ? `<b>Unavailable</b>` : ""}
          </div>
          ${
            item.image
              ? `<img src="${VRK.escapeHtml(item.image)}" alt="${VRK.escapeHtml(`${titleForItem(item)} real vehicle image`)}" loading="lazy">`
              : `<div class="image-placeholder" style="${styleForText(titleForItem(item))}">${VRK.escapeHtml(titleForItem(item))}<small>Vehicle image pending</small></div>`
          }
        </div>
        <div class="service-body">
          <div class="service-topline">
            <strong>${priceForItem(item)}</strong>
            <span>${VRK.escapeHtml(detailForItem(item))}</span>
          </div>
          <h3>${VRK.escapeHtml(titleForItem(item))}</h3>
          ${
            kind === "car"
              ? `<div class="service-status-row">
                  <span class="availability-pill ${availabilityClass(item)}">${VRK.escapeHtml(availabilityLabel(item))}</span>
                  <span>${VRK.escapeHtml([item.brand, item.model].filter(Boolean).join(" ") || item.category || "VRK vehicle")}</span>
                </div>`
              : ""
          }
          <p>${VRK.escapeHtml(
            item.description || item.overview || "Owner-confirmed service with clear details, verified driver assignment, and booking bill."
          )}</p>
          <div class="service-spec-grid">
            ${specs
              .map(
                ([label, value]) => `
                  <span>
                    <small>${VRK.escapeHtml(label)}</small>
                    <b>${VRK.escapeHtml(value)}</b>
                  </span>
                `
              )
              .join("")}
          </div>
          ${kind === "car" ? carRateStrip(item) : ""}
          <div class="tag-row">
            ${(tags.length ? tags : [serviceLabel(item)]).map((tag) => `<span>${VRK.escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="card-actions">
            <button class="ghost" data-details="${VRK.escapeHtml(item.id)}" data-type="${kind}" type="button">View details</button>
            <button class="secondary" data-book="${VRK.escapeHtml(item.id)}" data-type="${kind}" type="button" ${
      unavailable ? "disabled" : ""
    }>${unavailable ? "Unavailable" : "Book now"}</button>
          </div>
        </div>
      </article>
    `;
  }

  function openBannerInfo(banner) {
    state.infoItem = null;
    infoEyebrow.textContent = banner.offerLabel || banner.prompt || "Travel advertisement";
    infoTitle.textContent = banner.title || "Travel offer";
    infoSubtitle.textContent = banner.subtitle || "";
    const related = banner.targetId ? allItems().find((item) => item.id === banner.targetId) : null;
    infoBody.innerHTML = `
      ${banner.details ? `<div class="info-block"><p>${VRK.escapeHtml(banner.details)}</p></div>` : ""}
      ${banner.validUntil ? `<div class="info-price"><span>Valid until</span><strong>${VRK.dateLabel(banner.validUntil)}</strong></div>` : ""}
      ${related ? `<div class="info-price"><span>Related service</span><strong>${VRK.escapeHtml(titleForItem(related))}</strong></div>` : ""}
      ${itemList("Offer terms", banner.terms)}
    `;
    infoBook.classList.add("hidden");
    infoModal.classList.remove("hidden");
  }

  function openServiceInfo(item) {
    const service = { ...item, bookingType: item.bookingType || bookingTypeForTab() };
    const unavailable = kindForItem(service) === "car" && service.available === false;
    state.infoItem = service;
    infoEyebrow.textContent = detailForItem(service);
    infoTitle.textContent = titleForItem(service);
    infoSubtitle.textContent =
      service.description || service.overview || "Owner will confirm exact fare, vehicle, driver, and payment before trip.";
    infoBody.innerHTML = `
      <div class="info-price">
        <span>Starting price</span>
        <strong>${priceForItem(service)}</strong>
      </div>
      ${
        kindForItem(service) === "car"
          ? `<div class="info-price"><span>Availability</span><strong>${VRK.escapeHtml(availabilityLabel(service))}</strong></div>`
          : ""
      }
      ${kindForItem(service) === "car" ? carRateStrip(service) : ""}
      ${kindForItem(service) === "car" ? itemList("Car details", carDetailsForItem(service)) : ""}
      ${kindForItem(service) === "car" ? itemList("Rate details", carRateDetails(service)) : ""}
      ${itemList("Included", includedForItem(service))}
      ${itemList("Extra charges / excluded", excludedForItem(service))}
      ${itemList("Itinerary", service.itinerary)}
      ${itemList("Terms and conditions", service.terms)}
    `;
    infoBook.classList.remove("hidden");
    infoBook.disabled = unavailable;
    infoBook.textContent = unavailable ? "Currently unavailable" : kindForItem(service) === "car" ? "Book this car" : "Book this service";
    infoModal.classList.remove("hidden");
  }

  function closeInfoModal() {
    infoModal.classList.add("hidden");
    state.infoItem = null;
    infoBook.disabled = false;
    infoBook.textContent = "Book this service";
  }

  function renderFooter() {
    if (!siteFooter) return;
    const business = state.data.business || {};
    siteFooter.innerHTML = `
      <div class="footer-grid">
        <div>
          <span class="brand-mark">VRK</span>
          <h2>${VRK.escapeHtml(business.name || "VRK Tours and Travels")}</h2>
          <p>${VRK.escapeHtml(business.tagline || "Cars, tours, one way trips, and day packages.")}</p>
        </div>
        <div>
          <h3>Contact</h3>
          ${business.phone ? `<p><b>Phone</b> ${VRK.escapeHtml(business.phone)}</p>` : ""}
          ${business.email ? `<p><b>Email</b> ${VRK.escapeHtml(business.email)}</p>` : ""}
          ${business.address ? `<p><b>Address</b> ${VRK.escapeHtml(business.address)}</p>` : ""}
        </div>
        <div>
          <h3>Bookings</h3>
          <p>Owner confirms final fare before payment.</p>
          <p>Booking ID and printable bill are generated after request.</p>
        </div>
        <div>
          <h3>Payment</h3>
          ${business.upiId ? `<p><b>UPI</b> ${VRK.escapeHtml(business.upiId)}</p>` : ""}
          <p>${VRK.escapeHtml(business.gatewayNote || "Secure payment gateway can be connected with merchant keys.")}</p>
        </div>
      </div>
    `;
  }

  function stopCatalogAutoplay() {
    state.catalogTimers.forEach((timer) => window.clearInterval(timer));
    state.catalogTimers = [];
  }

  function slideCatalogTrack(track, direction) {
    if (!track) return;
    const distance = Math.max(280, Math.round(track.clientWidth * 0.86));
    const maxLeft = track.scrollWidth - track.clientWidth;
    if (maxLeft <= 4) return;
    const nextLeft = direction === "previous" ? track.scrollLeft - distance : track.scrollLeft + distance;
    track.scrollTo({
      left: nextLeft >= maxLeft - 12 ? 0 : Math.max(0, nextLeft),
      behavior: "smooth"
    });
  }

  function startCatalogAutoplay() {
    stopCatalogAutoplay();
    Array.from(catalog.querySelectorAll("[data-catalog-track]")).forEach((track, index) => {
      if (track.scrollWidth <= track.clientWidth + 12) return;
      const timer = window.setInterval(() => {
        if (document.hidden || track.matches(":hover") || track.closest(".catalog-shelf").matches(":hover")) return;
        slideCatalogTrack(track, "next");
      }, 4200 + index * 600);
      state.catalogTimers.push(timer);
    });
  }

  function itemsForSection(section) {
    return itemByType(section.type)
      .filter((item) => !section.featuredOnly || item.featured)
      .sort((a, b) => Number(b.featured || false) - Number(a.featured || false));
  }

  function firstVisibleCatalogItem() {
    for (const section of catalogSections()) {
      const first = itemsForSection(section)[0];
      if (first) return first;
    }
    return allItems()[0] || null;
  }

  function renderCatalog() {
    const sections = catalogSections().map((section) => {
      const items = itemsForSection(section);
      const countLabel = `${items.length} ${section.featuredOnly ? "featured" : items.length === 1 ? "option" : "options"}`;
      return `
        <section class="catalog-shelf" data-catalog-section="${section.type}" aria-label="${VRK.escapeHtml(section.title)}">
          <div class="shelf-head">
            <div>
              <span class="eyebrow">${VRK.escapeHtml(section.eyebrow)}</span>
              <h3>${VRK.escapeHtml(section.title)}</h3>
              <p>${VRK.escapeHtml(section.note)}</p>
            </div>
            <div class="shelf-meta">
              <span>${VRK.escapeHtml(countLabel)}</span>
              ${section.actionHref ? `<a class="shelf-link" href="${VRK.escapeHtml(section.actionHref)}">${VRK.escapeHtml(section.actionLabel || "View all")}</a>` : ""}
              <div class="shelf-controls">
                <button class="ghost" data-slide="previous" type="button" aria-label="Previous ${VRK.escapeHtml(section.title)}">&lt;</button>
                <button class="ghost" data-slide="next" type="button" aria-label="Next ${VRK.escapeHtml(section.title)}">&gt;</button>
              </div>
            </div>
          </div>
          ${
            items.length
              ? `<div class="catalog-slider">
                  <div class="catalog-track" data-catalog-track="${section.type}">
                    ${items.map(card).join("")}
                  </div>
                </div>`
              : `<div class="empty-state">${VRK.escapeHtml(section.empty)}</div>`
          }
        </section>
      `;
    });

    catalog.innerHTML = `<div class="catalog-shelves">${sections.join("")}</div>`;
    startCatalogAutoplay();
  }

  function renderGallery() {
    const items = state.data.gallery || [];
    if (!items.length) {
      galleryGrid.innerHTML = `<div class="empty-state">Gallery will appear after owner adds completed trip photos or videos.</div>`;
      return;
    }
    const galleryCard = (item, isClone) => `
      <article class="gallery-card" ${isClone ? `aria-hidden="true"` : ""}>
        <div class="gallery-media">
          ${
            item.mediaType === "video"
              ? `<video src="${VRK.escapeHtml(item.mediaUrl)}" ${
                  item.thumbnail ? `poster="${VRK.escapeHtml(item.thumbnail)}"` : ""
                } controls preload="metadata"></video>`
              : `<img src="${VRK.escapeHtml(item.mediaUrl)}" alt="${VRK.escapeHtml(item.title)}" loading="lazy">`
          }
        </div>
        <div>
          <h3>${VRK.escapeHtml(item.title)}</h3>
          <p>${VRK.escapeHtml(item.caption || "")}</p>
          <div class="tag-row">${(item.tags || [])
            .slice(0, 2)
            .map((tag) => `<span>${VRK.escapeHtml(tag)}</span>`)
            .join("")}</div>
        </div>
      </article>
    `;
    const visibleItems = items.slice(0, 10);
    const animated = visibleItems.length > 1;
    const cards = visibleItems.map((item) => galleryCard(item, false)).join("");
    const clones = animated ? visibleItems.map((item) => galleryCard(item, true)).join("") : "";
    galleryGrid.innerHTML = `
      <div class="gallery-rail" style="--gallery-speed: ${Math.max(24, visibleItems.length * 7)}s">
        <div class="gallery-track ${animated ? "is-animated" : "is-static"}">
          ${cards}
          ${clones}
        </div>
      </div>
    `;
  }

  function setSelected(item, openModal) {
    state.selected = item || null;
    document.querySelectorAll(".selected-strip").forEach((strip) => {
      strip.textContent = state.selected
        ? `${titleForItem(state.selected)} selected - ${detailForItem(state.selected)} - ${priceForItem(state.selected)}`
        : "General travel enquiry selected.";
    });
    document.querySelectorAll("form").forEach(updateFormSelection);
    renderCatalog();
    if (openModal) openBookingModal();
  }

  function updateFormSelection(form) {
    if (!form || !form.elements || !form.elements.bookingType) return;
    const type = state.selected ? state.selected.bookingType || bookingTypeForTab() : bookingTypeForTab();
    form.elements.bookingType.value = type;
    form.elements.packageId.value = state.selected ? state.selected.id : "";
    form.elements.packageTitle.value = state.selected ? titleForItem(state.selected) : "General travel enquiry";
    form.elements.amount.value = state.selected ? amountForItem(state.selected) : 0;
    if (form.elements.passengers) {
      const capacity = type === "car" ? passengerCapacity(state.selected) : 0;
      if (capacity) {
        form.elements.passengers.max = String(capacity);
        form.elements.passengers.placeholder = `Max ${capacity} passengers`;
        if (Number(form.elements.passengers.value || 1) > capacity) {
          form.elements.passengers.value = String(capacity);
        }
      } else {
        form.elements.passengers.removeAttribute("max");
        form.elements.passengers.placeholder = "";
      }
    }
  }

  function openBookingModal() {
    updateFormSelection(modalBookingForm);
    bookingModal.classList.remove("hidden");
  }

  function closeBookingModal() {
    bookingModal.classList.add("hidden");
  }

  function maybeShowPopup() {
    const popup = state.data.popupSettings || {};
    if (!popup.enabled || state.popupShown) return;
    if (!popup.showOnEveryVisit && sessionStorage.getItem("vrkPopupClosed")) return;
    state.popupShown = true;
    document.querySelector("#modalTitle").textContent = popup.title || "Send booking request";
    document.querySelector("#modalMessage").textContent = popup.message || "Owner will confirm the exact fare.";
    modalBookingForm.querySelector("button[type='submit']").textContent = popup.buttonLabel || "Send booking request";
    openBookingModal();
  }

  async function load() {
    state.data = await VRK.request("/api/public-data");
    renderHero();
    renderGallery();
    renderFooter();
    if (!state.selected) {
      const first = firstVisibleCatalogItem();
      setSelected(first, false);
    } else {
      renderCatalog();
      updateFormSelection(bookingForm);
      updateFormSelection(modalBookingForm);
    }
    applyCustomerProfile();
    maybeShowPopup();
  }

  function bindBookingForm(form, messageElement) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      updateFormSelection(form);
      const submitButton = form.querySelector("button[type='submit']");
      const statusElement = messageElement || form.querySelector(".form-message");
      submitButton.disabled = true;
      VRK.setMessage(statusElement, "Sending booking request...", "active");

      try {
        const payload = VRK.formToObject(form);
        payload.passengers = Number(payload.passengers || 1);
        payload.amount = Number(payload.amount || 0);
        const result = await VRK.request("/api/bookings", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        VRK.setMessage(
          statusElement,
          `Booking created: ${result.booking.id}. Owner will confirm final amount before payment.`,
          "good"
        );
        trackForm.elements.bookingId.value = result.booking.id;
        renderTrackedBooking(result.booking);
        form.reset();
        updateFormSelection(form);
        if (form === modalBookingForm) closeBookingModal();
      } catch (error) {
        VRK.setMessage(statusElement, error.message, "danger");
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  tabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.selected = null;
      tabs.forEach((item) => item.classList.toggle("active", item === button));
      setSelected(itemByTab()[0] || null, false);
    });
  });

  if (customerLoginForm) {
    customerLoginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      continueCustomerAuth().catch((error) => setAuthMessage(friendlyAuthError(error, state.auth.method), "danger"));
    });
  }

  function continueCustomerAuth() {
    if (state.auth.method === "email") return sendEmailLink();
    if (state.auth.method === "google") return signInWithProvider("Google");
    return sendPhoneOtp();
  }

  async function sendPhoneOtp() {
    if (!state.auth.configured) {
      setAuthMessage("Firebase keys are not configured yet. Add them in Render first.", "danger");
      return;
    }
    if (!requireCreateName()) return;
    const modules = state.auth.modules;
    const form = VRK.formToObject(customerLoginForm);
    const phone = normalizePhone(form.phone, form.countryCode);
    if (!/^\+91[6-9]\d{9}$/.test(phone)) {
      setAuthMessage("Enter a valid 10-digit India mobile number.", "danger");
      return;
    }
    setAuthMessage("Sending OTP...", "active");
    if (!window.vrkRecaptchaVerifier) {
      window.vrkRecaptchaVerifier = new modules.RecaptchaVerifier(state.auth.instance, recaptchaContainer, {
        size: "invisible"
      });
    }
    state.auth.confirmationResult = await modules.signInWithPhoneNumber(
      state.auth.instance,
      phone,
      window.vrkRecaptchaVerifier
    );
    otpPanel.classList.remove("hidden");
    verifyOtpButton.classList.remove("hidden");
    setAuthMessage("OTP sent. Enter the code to verify.", "good");
  }

  async function verifyPhoneOtp() {
    if (!state.auth.confirmationResult) {
      setAuthMessage("Send OTP first.", "danger");
      return;
    }
    const form = VRK.formToObject(customerLoginForm);
    const code = String(form.otpCode || "").trim();
    if (!code) {
      setAuthMessage("Enter the OTP code.", "danger");
      return;
    }
    setAuthMessage("Verifying OTP...", "active");
    const credential = await state.auth.confirmationResult.confirm(code);
    await finishVerifiedCustomer(credential.user, state.auth.mode, {
      displayName: form.customerName,
      phone: normalizePhone(form.phone, form.countryCode),
      email: form.email,
      provider: "phone"
    });
  }

  async function sendEmailLink() {
    if (!state.auth.configured) {
      setAuthMessage("Firebase keys are not configured yet. Add them in Render first.", "danger");
      return;
    }
    if (!requireCreateName()) return;
    const modules = state.auth.modules;
    const form = VRK.formToObject(customerLoginForm);
    const email = String(form.email || "").trim();
    if (!email) {
      setAuthMessage("Enter email address.", "danger");
      return;
    }
    await modules.sendSignInLinkToEmail(state.auth.instance, email, {
      url: `${window.location.origin}${window.location.pathname}`,
      handleCodeInApp: true
    });
    localStorage.setItem(
      "vrkEmailLogin",
      JSON.stringify({
        mode: state.auth.mode,
        email,
        displayName: form.customerName,
        phone: normalizePhone(form.phone, form.countryCode),
        provider: "emailLink"
      })
    );
    setAuthMessage("Secure email link sent. Check Inbox and Spam, then open that link in this same browser.", "good");
  }

  async function signInWithProvider(providerName) {
    if (!state.auth.configured) {
      setAuthMessage("Firebase keys are not configured yet. Add them in Render first.", "danger");
      return;
    }
    if (!requireCreateName()) return;
    const modules = state.auth.modules;
    const provider =
      providerName === "Google"
        ? new modules.GoogleAuthProvider()
        : new modules.OAuthProvider(providerName === "Apple" ? "apple.com" : "microsoft.com");
    setAuthMessage(`Opening ${providerName} sign in...`, "active");
    const credential = await modules.signInWithPopup(state.auth.instance, provider);
    const form = VRK.formToObject(customerLoginForm);
    await finishVerifiedCustomer(credential.user, state.auth.mode, {
      displayName: form.customerName || credential.user.displayName,
      phone: normalizePhone(form.phone, form.countryCode),
      email: form.email || credential.user.email,
      provider: providerName
    });
  }

  async function logoutCustomer() {
    if (state.auth.modules && state.auth.instance) {
      await state.auth.modules.signOut(state.auth.instance);
    }
    clearCustomerProfile();
    setAuthMessage("Logged out.", "good");
  }

  async function deleteCustomerAccount() {
    if (!state.auth.user) return;
    if (!confirm("Delete this customer account from VRK website?")) return;
    await customerRequest("/api/customers/me", { method: "DELETE" });
    try {
      await state.auth.modules.deleteUser(state.auth.user);
    } catch {
      await state.auth.modules.signOut(state.auth.instance);
    }
    clearCustomerProfile();
    setAuthMessage("Account deleted.", "good");
  }

  if (accountButton && accountClose && accountModal) {
    accountButton.addEventListener("click", openAccountModal);
    accountClose.addEventListener("click", closeAccountModal);
    accountModal.addEventListener("click", (event) => {
      if (event.target === accountModal) closeAccountModal();
    });
  }

  authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyAuthMode(button.dataset.authMode === "signup" ? "create" : "login");
    });
  });

  authMethodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyAuthMethod(button.dataset.authMethod);
      setAuthMessage("", "");
    });
  });

  function itemFromActionButton(button, field) {
    if (!button) return null;
    const id = button.dataset[field] || "";
    const type = button.dataset.type || bookingTypeForTab();
    return itemByType(type).find((entry) => entry.id === id) || null;
  }

  document.body.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-select]");
    const detailsButton = event.target.closest("[data-details]");
    const bookButton = event.target.closest("[data-book]");
    const slideButton = event.target.closest("[data-slide]");
    const bannerInfo = event.target.closest("[data-banner-info]");
    const openButton = event.target.closest("[data-open-booking]");
    const providerButton = event.target.closest("[data-auth-provider]");
    const authAction = event.target.closest("[data-auth-action]");
    const customerLogout = event.target.closest("[data-customer-logout]");
    const customerDelete = event.target.closest("[data-customer-delete]");

    if (slideButton) {
      const shelf = slideButton.closest(".catalog-shelf");
      slideCatalogTrack(shelf && shelf.querySelector("[data-catalog-track]"), slideButton.dataset.slide);
    }

    if (selectButton || bookButton) {
      const button = selectButton || bookButton;
      const item = itemFromActionButton(button, selectButton ? "select" : "book");
      if (item && !(bookButton && kindForItem(item) === "car" && item.available === false)) {
        setSelected(item, Boolean(bookButton));
      }
    }

    if (detailsButton) {
      const item = itemFromActionButton(detailsButton, "details");
      if (item) openServiceInfo(item);
    }

    if (bannerInfo) {
      const banner = (state.data.banners || []).find((item) => item.id === bannerInfo.dataset.bannerInfo);
      if (banner) openBannerInfo(banner);
    }

    if (openButton) openBookingModal();

    if (authAction) {
      continueCustomerAuth().catch((error) => setAuthMessage(friendlyAuthError(error, state.auth.method), "danger"));
    }

    if (providerButton) {
      signInWithProvider(providerButton.dataset.authProvider).catch((error) =>
        setAuthMessage(friendlyAuthError(error, "google"), "danger")
      );
    }

    if (customerLogout) logoutCustomer().catch((error) => setAuthMessage(error.message, "danger"));
    if (customerDelete) deleteCustomerAccount().catch((error) => setAuthMessage(error.message, "danger"));
  });

  if (verifyOtpButton) {
    verifyOtpButton.addEventListener("click", () => {
      verifyPhoneOtp().catch((error) => setAuthMessage(friendlyAuthError(error, "phone"), "danger"));
    });
  }

  heroCarousel.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const slide = event.target.closest("[data-banner-info]");
    if (!slide) return;
    event.preventDefault();
    const banner = (state.data.banners || []).find((item) => item.id === slide.dataset.bannerInfo);
    if (banner) openBannerInfo(banner);
  });

  modalClose.addEventListener("click", () => {
    sessionStorage.setItem("vrkPopupClosed", "yes");
    closeBookingModal();
  });

  bookingModal.addEventListener("click", (event) => {
    if (event.target === bookingModal) {
      sessionStorage.setItem("vrkPopupClosed", "yes");
      closeBookingModal();
    }
  });

  infoClose.addEventListener("click", closeInfoModal);
  infoCloseSecondary.addEventListener("click", closeInfoModal);
  infoModal.addEventListener("click", (event) => {
    if (event.target === infoModal) closeInfoModal();
  });
  infoBook.addEventListener("click", () => {
    if (!state.infoItem) return;
    const item = state.infoItem;
    if (kindForItem(item) === "car" && item.available === false) return;
    closeInfoModal();
    setSelected(item, true);
  });

  trackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const bookingId = trackForm.elements.bookingId.value.trim();
    if (!bookingId) return;
    trackResult.innerHTML = `<p>Checking booking...</p>`;
    try {
      const result = await VRK.request(`/api/bookings/${encodeURIComponent(bookingId)}`);
      renderTrackedBooking(result.booking);
    } catch (error) {
      trackResult.innerHTML = `<p class="danger-text">${VRK.escapeHtml(error.message)}</p>`;
    }
  });

  trackResult.addEventListener("submit", async (event) => {
    const form = event.target.closest(".payment-form");
    if (!form) return;
    event.preventDefault();
    const bookingId = form.dataset.bookingId;
    const payload = VRK.formToObject(form);
    payload.paidAmount = Number(payload.paidAmount || 0);
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const result = await VRK.request(`/api/bookings/${encodeURIComponent(bookingId)}/payment`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      renderTrackedBooking(result.booking);
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  });

  function fareBreakup(booking) {
    if (!booking.costItems || !booking.costItems.length) return "";
    return `
      <div class="fare-box">
        ${booking.costItems
          .map(
            (item) => `
              <span>${VRK.escapeHtml(item.label)}</span>
              <strong>${VRK.money(item.amount)}</strong>
            `
          )
          .join("")}
        <span>Total payable</span>
        <strong>${VRK.money(booking.amount)}</strong>
      </div>
    `;
  }

  function itemList(title, items) {
    if (!items || !items.length) return "";
    return `
      <div class="mini-list">
        <b>${title}</b>
        ${items.map((item) => `<small>${VRK.escapeHtml(item)}</small>`).join("")}
      </div>
    `;
  }

  function canSubmitPayment(booking) {
    return (
      Number(booking.amount || 0) > 0 &&
      ["payment_required", "advance_paid"].includes(booking.paymentStatus) &&
      !["pending_owner_confirmation", "cancelled"].includes(booking.status)
    );
  }

  function paymentDetails() {
    const business = state.data.business || {};
    return `
      <div class="payment-details">
        ${business.paymentInstructions ? `<p>${VRK.escapeHtml(business.paymentInstructions)}</p>` : ""}
        ${business.qrImage ? `<img src="${VRK.escapeHtml(business.qrImage)}" alt="Payment QR">` : ""}
        ${business.upiId ? `<small><b>UPI</b>${VRK.escapeHtml(business.upiId)}</small>` : ""}
        ${business.bankDetails ? `<small><b>Bank / Netbanking</b>${VRK.escapeHtml(business.bankDetails)}</small>` : ""}
        ${business.gatewayNote ? `<small>${VRK.escapeHtml(business.gatewayNote)}</small>` : ""}
      </div>
    `;
  }

  function paymentForm(booking) {
    if (booking.paymentStatus === "payment_submitted") {
      return `<p class="note-line">Payment details submitted. Owner will verify and update the bill.</p>`;
    }
    if (["paid", "advance_paid"].includes(booking.paymentStatus)) {
      return `<p class="note-line">Payment verified by owner.</p>`;
    }
    if (!canSubmitPayment(booking)) return "";
    return `
      ${paymentDetails()}
      <form class="payment-form form-grid compact" data-booking-id="${VRK.escapeHtml(booking.id)}">
        <label>
          Payer name
          <input name="payerName" value="${VRK.escapeHtml(booking.customerName)}" required>
        </label>
        <label>
          Paid amount
          <input name="paidAmount" type="number" min="1" value="${VRK.escapeHtml(booking.amount)}" required>
        </label>
        <label>
          Payment method
          <select name="paymentMethod" required>
            <option value="UPI">UPI</option>
            <option value="Bank transfer">Netbanking / bank transfer</option>
            <option value="QR payment">QR payment</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
          </select>
        </label>
        <label>
          Transaction / reference ID
          <input name="transactionId" placeholder="UPI ref, bank ref, receipt no.">
        </label>
        <label class="full">
          Payment date
          <input name="paymentDate" type="date">
        </label>
        <button class="primary full" type="submit">Submit payment details</button>
      </form>
    `;
  }

  function renderTrackedBooking(booking) {
    trackResult.innerHTML = `
      <div class="mini-status">
        <div class="status-row">
          <span class="badge ${VRK.statusClass(booking.status)}">${VRK.statusLabel(booking.status)}</span>
          <span class="badge ${VRK.statusClass(booking.paymentStatus)}">${VRK.statusLabel(booking.paymentStatus)}</span>
        </div>
        <strong>${VRK.escapeHtml(booking.packageTitle)}</strong>
        <small>Booking ID: ${VRK.escapeHtml(booking.id)}</small>
        <small>${VRK.dateLabel(booking.travelDate)} | ${
      booking.amount ? VRK.money(booking.amount) : "Owner amount pending"
    }</small>
        <small>Driver: ${VRK.escapeHtml(booking.driver ? booking.driver.name : "Not assigned yet")}</small>
        <small>Car: ${VRK.escapeHtml(booking.car ? booking.car.name : "Not assigned yet")}</small>
        ${booking.confirmationMessage ? `<p>${VRK.escapeHtml(booking.confirmationMessage)}</p>` : ""}
        ${fareBreakup(booking)}
        ${itemList("Included", booking.includedItems)}
        ${itemList("Extra / excluded", booking.excludedItems)}
        ${paymentForm(booking)}
        <a class="secondary ticket-link" href="/bill.html?id=${encodeURIComponent(booking.id)}">Open bill / ticket</a>
      </div>
    `;
  }

  bindBookingForm(bookingForm, bookingMessage);
  bindBookingForm(modalBookingForm);
  VRK.watchLiveChanges(load);
  load().catch((error) => {
    catalog.innerHTML = `<div class="empty-state">${VRK.escapeHtml(error.message)}</div>`;
  });
})();
