(function () {
  const state = {
    data: null,
    tab: "cars",
    selected: null,
    infoItem: null,
    heroTimer: null,
    catalogTimers: [],
    trackingAccess: null,
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

  function contactPhoneDigits(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  function contactLinks() {
    const business = (state.data && state.data.business) || {};
    const digits = contactPhoneDigits(business.phone);
    const message = encodeURIComponent("Hi VRK Tours and Travels, I want to book a car or travel package.");
    return {
      phone: business.phone || "",
      email: business.email || "",
      address: business.address || "",
      call: digits ? `tel:+${digits}` : "#contactMap",
      whatsapp: digits ? `https://wa.me/${digits}?text=${message}` : "#contactMap",
      map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        business.address || business.name || "VRK Tours and Travels Karnataka"
      )}`
    };
  }

  function updateContactSections() {
    const business = (state.data && state.data.business) || {};
    const links = contactLinks();
    document.querySelectorAll("[data-contact-action='call']").forEach((link) => {
      link.href = links.call;
      link.toggleAttribute("target", false);
    });
    document.querySelectorAll("[data-contact-action='whatsapp']").forEach((link) => {
      link.href = links.whatsapp;
      if (links.whatsapp.startsWith("https://")) {
        link.target = "_blank";
      } else {
        link.removeAttribute("target");
      }
    });
    document.querySelectorAll("[data-contact-phone]").forEach((node) => {
      node.textContent = links.phone || "Owner phone will appear here";
    });
    document.querySelectorAll("[data-contact-email]").forEach((node) => {
      node.textContent = links.email || "Owner email will appear here";
    });
    document.querySelectorAll("[data-contact-address]").forEach((node) => {
      node.textContent = links.address || "Owner address will appear here";
    });
    document.querySelectorAll("[data-map-link]").forEach((link) => {
      link.href = links.map;
    });
    document.querySelectorAll("[data-map-title]").forEach((node) => {
      node.textContent = business.name || "VRK Tours and Travels";
    });
    document.querySelectorAll("[data-map-subtitle]").forEach((node) => {
      node.textContent = links.address || "Open Karnataka travel location in Google Maps";
    });
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
          id: "availableCars",
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
        id: "oneDayPackages",
        type: "day",
        eyebrow: "Popular one-day packages",
        title: "One-day packages for quick Karnataka trips",
        note: "Sightseeing, temple visits, family outings, and same-day return trips published by the owner.",
        empty: "Owner has not published active one-day packages yet."
      },
      {
        id: "tourPackages",
        type: "tour",
        eyebrow: "Multi-day tours",
        title: "Multi-day tour packages with planned routes",
        note: "Package cards show days, nights, start place, destinations, vehicles, allowances, toll notes, and owner-set starting price.",
        empty: "Owner has not published active tour packages yet."
      },
      {
        id: "availableCars",
        type: "car",
        eyebrow: "Available cars",
        title: "Featured cars for local rentals and outstation trips",
        note: "Owner-selected vehicles shown on the homepage. Open the full cars page to compare every active car.",
        empty: "Owner has not marked any featured cars yet.",
        featuredOnly: true,
        actionHref: "/cars.html",
        actionLabel: "View all cars"
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

  const tripTypeOptions = [
    ["local_rental", "Local rental"],
    ["one_way", "One way"],
    ["round_trip", "Round trip"],
    ["one_day_package", "One day package"],
    ["multi_day_package", "Multi day package"],
    ["airport_transfer", "Airport transfer"],
    ["custom_trip", "Custom trip"]
  ];

  function tripTypeLabel(value) {
    const match = tripTypeOptions.find(([key]) => key === value);
    return match ? match[1] : "Custom trip";
  }

  function defaultTripTypeForBookingType(type) {
    if (type === "tour") return "multi_day_package";
    if (type === "day") return "one_day_package";
    return "one_way";
  }

  function bookingFormUpgradeHtml() {
    return `
      <div class="booking-form-upgrade full" data-booking-upgrade>
        <div class="booking-extra-grid">
          <label class="full trip-type-field">
            Trip type
            <select name="tripType" required data-trip-type>
              ${tripTypeOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
            </select>
          </label>
          <label>
            WhatsApp number
            <input name="whatsappNumber" autocomplete="tel" placeholder="+91 mobile number" required>
          </label>
          <label>
            Pickup time
            <input name="pickupTime" type="time" required>
          </label>
          <label>
            Luggage count
            <input name="luggageCount" type="number" min="0" value="0">
          </label>
          <label>
            Vehicle preference
            <select name="vehiclePreference">
              <option value="">Owner can suggest</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Tempo Traveller">Tempo Traveller</option>
              <option value="Luxury car">Luxury car</option>
              <option value="Any available AC car">Any available AC car</option>
            </select>
          </label>
          <label class="full">
            Multiple destinations / stops
            <textarea name="multipleDestinations" rows="2" placeholder="Add extra stops, one place per line"></textarea>
          </label>

          <fieldset class="trip-dynamic-panel full" data-trip-fields="local_rental">
            <legend>Local rental package</legend>
            <label>
              Rental slab
              <select name="localRentalPackage" data-required="true">
                <option value="">Select package</option>
                <option value="4hrs / 40km">4hrs / 40km</option>
                <option value="8hrs / 80km">8hrs / 80km</option>
                <option value="12hrs / 120km">12hrs / 120km</option>
              </select>
            </label>
          </fieldset>

          <fieldset class="trip-dynamic-panel full" data-trip-fields="round_trip">
            <legend>Round trip planning</legend>
            <div class="booking-extra-grid">
              <label>
                Departure date
                <input name="departureDate" type="date">
              </label>
              <label>
                Return date
                <input name="tripReturnDate" type="date">
              </label>
              <label>
                Number of days
                <input name="numberOfDays" type="number" min="1" data-required="true">
              </label>
            </div>
            <small class="form-help">Use the destinations field above for all places to cover.</small>
          </fieldset>

          <fieldset class="trip-dynamic-panel full" data-trip-fields="airport_transfer">
            <legend>Airport transfer</legend>
            <div class="booking-extra-grid">
              <label>
                Pickup or drop
                <select name="airportTripMode" data-required="true">
                  <option value="">Select</option>
                  <option value="Airport pickup">Airport pickup</option>
                  <option value="Airport drop">Airport drop</option>
                </select>
              </label>
              <label>
                Airport
                <input name="airportName" placeholder="Kempegowda International Airport" data-required="true">
              </label>
              <label>
                Flight number
                <input name="flightNumber" placeholder="Example AI 503">
              </label>
              <label>
                Terminal
                <input name="terminal" placeholder="T1 / T2">
              </label>
              <label>
                Flight time
                <input name="flightTime" type="time" data-required="true">
              </label>
            </div>
          </fieldset>

          <fieldset class="trip-dynamic-panel full" data-trip-fields="custom_trip">
            <legend>Custom trip details</legend>
            <div class="booking-extra-grid">
              <label class="full">
                Add another destination
                <textarea name="customDestinations" rows="2" placeholder="Add places, route ideas, or stopovers" data-required="true"></textarea>
              </label>
              <label>
                Budget
                <input name="budget" type="number" min="0" placeholder="Approx budget">
              </label>
              <label>
                Number of days
                <input name="customNumberOfDays" type="number" min="1">
              </label>
              <label class="full">
                Special requirements
                <textarea name="specialRequirements" rows="2" placeholder="Senior citizen support, child seat, extra luggage, early morning pickup"></textarea>
              </label>
            </div>
          </fieldset>

          <label class="switch-row terms-check full">
            <input name="termsAccepted" type="checkbox" required>
            I accept that VRK owner will confirm vehicle, driver, route, final fare, and payment details before travel.
          </label>
        </div>
      </div>
    `;
  }

  function refreshTripFields(form) {
    if (!form || !form.elements || !form.elements.tripType) return;
    const tripType = form.elements.tripType.value;
    form.querySelectorAll("[data-trip-fields]").forEach((panel) => {
      const active = panel.dataset.tripFields.split(/\s+/).includes(tripType);
      panel.classList.toggle("hidden", !active);
      panel.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = !active;
        input.required = active && input.dataset.required === "true";
      });
    });
  }

  function upgradeBookingForm(form) {
    if (!form || form.querySelector("[data-booking-upgrade]")) return;
    form.insertAdjacentHTML("afterbegin", bookingFormUpgradeHtml());
    const tripType = form.elements.tripType;
    tripType.value = defaultTripTypeForBookingType(form.elements.bookingType ? form.elements.bookingType.value : "car");
    form.dataset.autoTripType = tripType.value;
    tripType.addEventListener("change", () => {
      form.dataset.tripTypeManual = "true";
      refreshTripFields(form);
    });
    refreshTripFields(form);
    prepareBookingFormValidation(form);
  }

  function tripSummaryDetails(booking) {
    const destinations = Array.isArray(booking.multipleDestinations)
      ? booking.multipleDestinations.join(" | ")
      : booking.multipleDestinations || "";
    const customDestinations = Array.isArray(booking.customDestinations)
      ? booking.customDestinations.join(" | ")
      : booking.customDestinations || "";
    return [
      `Trip type: ${tripTypeLabel(booking.tripType)}`,
      booking.whatsappNumber ? `WhatsApp: ${booking.whatsappNumber}` : "",
      booking.pickupTime ? `Pickup time: ${booking.pickupTime}` : "",
      booking.vehiclePreference ? `Vehicle preference: ${booking.vehiclePreference}` : "",
      Number(booking.luggageCount || 0) ? `Luggage: ${booking.luggageCount}` : "",
      destinations ? `Stops: ${destinations}` : "",
      booking.localRentalPackage ? `Local rental: ${booking.localRentalPackage}` : "",
      booking.numberOfDays ? `Trip days: ${booking.numberOfDays}` : "",
      booking.airportName ? `Airport: ${booking.airportName}` : "",
      booking.airportTripMode ? `Airport type: ${booking.airportTripMode}` : "",
      booking.flightNumber ? `Flight: ${booking.flightNumber}` : "",
      booking.terminal ? `Terminal: ${booking.terminal}` : "",
      booking.flightTime ? `Flight time: ${booking.flightTime}` : "",
      customDestinations ? `Custom destinations: ${customDestinations}` : "",
      booking.budget ? `Budget: ${VRK.money(booking.budget)}` : "",
      booking.specialRequirements ? `Special requirements: ${booking.specialRequirements}` : ""
    ].filter(Boolean);
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

  function localDateValue(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + Number(offsetDays || 0));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeMobileInput(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  }

  function isValidMobile(value) {
    return /^[6-9]\d{9}$/.test(normalizeMobileInput(value));
  }

  function normalizedIndiaMobile(value) {
    return `+91${normalizeMobileInput(value)}`;
  }

  function isValidEmail(value) {
    const email = String(value || "").trim();
    return !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function fieldName(input) {
    const label = input.closest("label");
    if (label) {
      return label.childNodes[0] ? label.childNodes[0].textContent.trim() : input.name;
    }
    return String(input.name || "field").replace(/([A-Z])/g, " $1").toLowerCase();
  }

  function firstInvalidField(form, message) {
    const invalid = form.querySelector(".is-invalid") || form.querySelector(":invalid");
    if (invalid && typeof invalid.focus === "function") invalid.focus();
    return { valid: false, message };
  }

  function setDateLimits(form) {
    if (!form || !form.elements) return;
    const today = localDateValue();
    ["travelDate", "departureDate"].forEach((name) => {
      if (form.elements[name]) form.elements[name].min = today;
    });
    const travelDate = form.elements.travelDate && form.elements.travelDate.value;
    const minimumReturn = travelDate && travelDate > today ? travelDate : today;
    ["returnDate", "tripReturnDate"].forEach((name) => {
      if (form.elements[name]) form.elements[name].min = minimumReturn;
    });
  }

  function clearFormValidation(form) {
    form.querySelectorAll(".is-invalid").forEach((input) => input.classList.remove("is-invalid"));
  }

  function markInvalid(input) {
    if (input) input.classList.add("is-invalid");
  }

  function validateBookingForm(form) {
    clearFormValidation(form);
    setDateLimits(form);
    const requiredControls = Array.from(form.querySelectorAll("[required]")).filter(
      (input) => !input.disabled && input.type !== "hidden"
    );
    const emptyRequired = requiredControls.filter((input) => {
      if (input.type === "checkbox") return !input.checked;
      return !String(input.value || "").trim();
    });
    if (emptyRequired.length) {
      emptyRequired.slice(0, 3).forEach(markInvalid);
      const names = emptyRequired.slice(0, 3).map(fieldName).join(", ");
      return firstInvalidField(form, `Please fill ${names}.`);
    }

    const travelDate = form.elements.travelDate && form.elements.travelDate.value;
    const returnDate = form.elements.returnDate && form.elements.returnDate.value;
    const departureDate = form.elements.departureDate && !form.elements.departureDate.disabled
      ? form.elements.departureDate.value
      : "";
    const tripReturnDate = form.elements.tripReturnDate && !form.elements.tripReturnDate.disabled
      ? form.elements.tripReturnDate.value
      : "";
    const today = localDateValue();
    if (travelDate && travelDate < today) {
      markInvalid(form.elements.travelDate);
      return firstInvalidField(form, "Travel date cannot be in the past.");
    }
    if (departureDate && departureDate < today) {
      markInvalid(form.elements.departureDate);
      return firstInvalidField(form, "Departure date cannot be in the past.");
    }
    if (returnDate && travelDate && returnDate < travelDate) {
      markInvalid(form.elements.returnDate);
      return firstInvalidField(form, "Return date cannot be before travel date.");
    }
    if (tripReturnDate && travelDate && tripReturnDate < travelDate) {
      markInvalid(form.elements.tripReturnDate);
      return firstInvalidField(form, "Round trip return date cannot be before travel date.");
    }

    if (!isValidMobile(form.elements.phone.value)) {
      markInvalid(form.elements.phone);
      return firstInvalidField(form, "Enter a valid 10-digit India mobile number.");
    }
    if (!isValidMobile(form.elements.whatsappNumber.value)) {
      markInvalid(form.elements.whatsappNumber);
      return firstInvalidField(form, "Enter a valid 10-digit India WhatsApp number.");
    }
    if (form.elements.email && !isValidEmail(form.elements.email.value)) {
      markInvalid(form.elements.email);
      return firstInvalidField(form, "Enter a valid email address, or leave email empty.");
    }

    const passengers = Number(form.elements.passengers.value || 0);
    if (!Number.isInteger(passengers) || passengers < 1) {
      markInvalid(form.elements.passengers);
      return firstInvalidField(form, "Passenger count must be at least 1.");
    }
    const selectedType = form.elements.bookingType.value;
    const capacity = selectedType === "car" ? passengerCapacity(state.selected) || Number(form.elements.passengers.max || 0) : 0;
    if (capacity && passengers > capacity) {
      markInvalid(form.elements.passengers);
      return firstInvalidField(form, `Selected car allows ${capacity} passenger(s). Choose a bigger car or reduce passengers.`);
    }

    return { valid: true };
  }

  function prepareBookingFormValidation(form) {
    if (!form || form.dataset.validationReady === "true") return;
    form.dataset.validationReady = "true";
    ["phone", "whatsappNumber"].forEach((name) => {
      if (form.elements[name]) {
        form.elements[name].inputMode = "tel";
        form.elements[name].placeholder = name === "phone" ? "10-digit mobile number" : "+91 WhatsApp number";
      }
    });
    ["passengers", "luggageCount", "numberOfDays", "customNumberOfDays", "budget"].forEach((name) => {
      if (form.elements[name]) form.elements[name].inputMode = "numeric";
    });
    form.addEventListener("input", () => {
      clearFormValidation(form);
      setDateLimits(form);
    });
    form.addEventListener("change", () => setDateLimits(form));
    setDateLimits(form);
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

  function tourDuration(item) {
    const days = Number(item.days || item.numberOfDays || 0);
    const nights = Number(item.nights || item.numberOfNights || 0);
    if (days || nights) {
      return [
        days ? `${days} day${days === 1 ? "" : "s"}` : "",
        nights ? `${nights} night${nights === 1 ? "" : "s"}` : ""
      ]
        .filter(Boolean)
        .join(" / ");
    }
    return item.duration || "Ask owner";
  }

  function tourDestinations(item) {
    return item.destinations || item.destination || "Owner customizes";
  }

  function moneyOrOwner(value, fallback = "Owner confirms") {
    const amount = Number(value || 0);
    return amount ? VRK.money(amount) : fallback;
  }

  function tourPlanningDetails(item) {
    return [
      item.startingPlace ? `Starting place: ${item.startingPlace}` : "",
      `Destinations: ${tourDestinations(item)}`,
      item.suitableVehicles ? `Suitable vehicles: ${item.suitableVehicles}` : "",
      `Driver allowance: ${moneyOrOwner(item.driverAllowance, "Owner confirms")}`,
      `Night allowance: ${moneyOrOwner(item.nightAllowance, "Owner confirms")}`,
      `Toll and parking: ${item.tollParkingInfo || "Owner confirms before trip"}`
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
      return [item.packageType || "Tour", item.startingPlace || "Start place", tourDestinations(item), tourDuration(item)]
        .filter(Boolean)
        .join(" | ");
    }
    return `${item.packageType || "One day"} | ${item.place || "Place"} | ${item.hours || "Hours"}`;
  }

  function tagsForItem(item) {
    const kind = kindForItem(item);
    if (kind === "car") {
      const generated = [
        item.featured ? "Featured" : "",
        availabilityLabel(item),
        item.brand || "",
        item.model || "",
        item.fuelType || item.fuel || ""
      ].filter(Boolean);
      return [...generated, ...(item.features || [])];
    }
    if (kind === "tour") {
      const generated = [item.packageType || "Tour", tourDuration(item), item.startingPlace || "", item.suitableVehicles || ""].filter(
        Boolean
      );
      return [...generated, ...(item.inclusions || [])];
    }
    if (kind === "day") {
      const generated = [item.packageType || "One day", item.place || "", item.hours || ""].filter(Boolean);
      return [...generated, ...(item.highlights || item.inclusions || [])];
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
        ["Number of days", item.days ? String(item.days) : tourDuration(item)],
        ["Number of nights", item.nights || item.nights === 0 ? String(item.nights) : "Ask owner"],
        ["Starting place", item.startingPlace || "Owner confirms"],
        ["Suitable vehicles", item.suitableVehicles || "Owner suggests"]
      ];
    }
    return [
      ["Places covered", item.place || "Custom"],
      ["Trip duration", item.hours || "Ask owner"],
      ["Package type", item.packageType || "One day"],
      ["Starting price", VRK.money(item.price || 0)]
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

  function dayPackageStrip(item) {
    return `
      <div class="package-price-strip">
        <span>
          <small>Starting package price</small>
          <b>${VRK.escapeHtml(VRK.money(item.price || 0))}</b>
        </span>
        <span>
          <small>Places covered</small>
          <b>${VRK.escapeHtml(item.place || "Owner confirms")}</b>
        </span>
      </div>
    `;
  }

  function tourPlanStrip(item) {
    return `
      <div class="tour-plan-strip">
        <span>
          <small>Starting package price</small>
          <b>${VRK.escapeHtml(VRK.money(item.price || 0))}</b>
        </span>
        <span>
          <small>Destinations covered</small>
          <b>${VRK.escapeHtml(tourDestinations(item))}</b>
        </span>
        <span>
          <small>Driver allowance</small>
          <b>${VRK.escapeHtml(moneyOrOwner(item.driverAllowance, "Owner confirms"))}</b>
        </span>
        <span>
          <small>Toll and parking</small>
          <b>${VRK.escapeHtml(item.tollParkingInfo || "As per actuals")}</b>
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
    const bannerSlides = banners
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
    if (state.pageMode === "home") {
      const counts = {
        cars: (state.data.cars || []).length,
        days: (state.data.dayPackages || []).length,
        tours: (state.data.tourPackages || []).length
      };
      heroCarousel.innerHTML = `
        <article class="hero-slide home-hero-slide" style="${styleForText("VRK Karnataka Travel")}">
          <div>
            <span class="eyebrow">VRK Tours and Travels</span>
            <h1>Comfortable cars, Trusted Drivers and Flexible Travel packages</h1>
            <p>Book local rentals, one day packages, outstation trips and custom tours from Karnataka.</p>
            <div class="hero-actions">
              <a class="primary" href="#quickBooking" data-open-booking>Book a car</a>
              <a class="secondary" href="#oneDayPackages">View packages</a>
              <a class="ghost hero-whatsapp" href="#contactMap" data-contact-action="whatsapp" target="_blank" rel="noopener">WhatsApp Us</a>
            </div>
            <div class="hero-stat-row" aria-label="Published services">
              <span><b>${counts.days}</b><small>One-day packages</small></span>
              <span><b>${counts.tours}</b><small>Multi-day tours</small></span>
              <span><b>${counts.cars}</b><small>Available cars</small></span>
            </div>
          </div>
        </article>
        ${bannerSlides}
      `;
      updateContactSections();
      startHeroAutoplay();
      return;
    }

    if (!bannerSlides) {
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

    heroCarousel.innerHTML = bannerSlides;
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
              ? `<img src="${VRK.escapeHtml(item.image)}" alt="${VRK.escapeHtml(
                  `${titleForItem(item)} ${kind === "car" ? "real vehicle image" : "package image"}`
                )}" loading="lazy">`
              : `<div class="image-placeholder" style="${styleForText(titleForItem(item))}">${VRK.escapeHtml(titleForItem(item))}<small>${
                  kind === "car" ? "Vehicle image pending" : "Package image pending"
                }</small></div>`
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
          ${kind === "tour" ? tourPlanStrip(item) : ""}
          ${kind === "day" ? dayPackageStrip(item) : ""}
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
      ${kindForItem(service) === "tour" ? tourPlanStrip(service) : ""}
      ${kindForItem(service) === "day" ? dayPackageStrip(service) : ""}
      ${kindForItem(service) === "car" ? itemList("Car details", carDetailsForItem(service)) : ""}
      ${kindForItem(service) === "car" ? itemList("Rate details", carRateDetails(service)) : ""}
      ${kindForItem(service) === "tour" ? itemList("Tour plan", tourPlanningDetails(service)) : ""}
      ${itemList("Included", includedForItem(service))}
      ${itemList("Extra charges / excluded", excludedForItem(service))}
      ${itemList(kindForItem(service) === "tour" ? "Day wise itinerary" : "Itinerary", service.itinerary)}
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
        <section class="catalog-shelf" id="${VRK.escapeHtml(section.id || `${section.type}Section`)}" data-catalog-section="${section.type}" aria-label="${VRK.escapeHtml(section.title)}">
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
    if (form.elements.tripType && form.dataset.tripTypeManual !== "true") {
      const preferredTripType = defaultTripTypeForBookingType(type);
      form.elements.tripType.value = preferredTripType;
      form.dataset.autoTripType = preferredTripType;
      refreshTripFields(form);
    }
    form.elements.packageId.value = state.selected ? state.selected.id : "";
    form.elements.packageTitle.value = state.selected ? titleForItem(state.selected) : "General travel enquiry";
    form.elements.amount.value = state.selected ? amountForItem(state.selected) : 0;
    if (form.elements.passengers) {
      const capacity = type === "car" ? passengerCapacity(state.selected) : 0;
      if (capacity) {
        form.elements.passengers.max = String(capacity);
        form.elements.passengers.placeholder = `Max ${capacity} passengers`;
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
    updateContactSections();
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
      if (form.dataset.submitting === "true") return;
      updateFormSelection(form);
      const submitButton = form.querySelector("button[type='submit']");
      const statusElement = messageElement || form.querySelector(".form-message");
      const validation = validateBookingForm(form);
      if (!validation.valid) {
        VRK.setMessage(statusElement, validation.message, "danger");
        return;
      }
      const originalButtonText = submitButton.textContent;
      form.dataset.submitting = "true";
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
      VRK.setMessage(statusElement, "Submitting booking request...", "active");

      try {
        const payload = VRK.formToObject(form);
        payload.passengers = Number(payload.passengers || 1);
        payload.amount = Number(payload.amount || 0);
        payload.luggageCount = Number(payload.luggageCount || 0);
        payload.numberOfDays = Number(payload.numberOfDays || payload.customNumberOfDays || 0);
        payload.budget = Number(payload.budget || 0);
        payload.termsAccepted = form.elements.termsAccepted && form.elements.termsAccepted.checked;
        payload.phone = normalizedIndiaMobile(payload.phone);
        payload.whatsappNumber = normalizedIndiaMobile(payload.whatsappNumber);
        if (payload.email) payload.email = String(payload.email).trim().toLowerCase();
        const result = await VRK.request("/api/bookings", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        VRK.setMessage(
          statusElement,
          `Booking successful. Booking ID: ${result.booking.id}. Tracking code: ${result.booking.trackingCode}. Keep both safely.`,
          "good"
        );
        state.trackingAccess = {
          bookingId: result.booking.id,
          phone: payload.phone,
          trackingCode: result.booking.trackingCode
        };
        trackForm.elements.bookingId.value = result.booking.id;
        trackForm.elements.phone.value = payload.phone;
        trackForm.elements.trackingCode.value = result.booking.trackingCode;
        renderTrackedBooking(result.booking);
        form.reset();
        form.dataset.tripTypeManual = "";
        updateFormSelection(form);
        setDateLimits(form);
      } catch (error) {
        VRK.setMessage(statusElement, error.message, "danger");
      } finally {
        form.dataset.submitting = "";
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
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
    const payload = VRK.formToObject(trackForm);
    payload.bookingId = String(payload.bookingId || "").trim();
    payload.phone = normalizedIndiaMobile(payload.phone || "");
    payload.trackingCode = String(payload.trackingCode || "").trim();
    if (!payload.bookingId || !payload.phone || !payload.trackingCode) {
      trackResult.innerHTML = `<p class="danger-text">Enter booking ID, registered mobile number, and tracking code.</p>`;
      return;
    }
    if (!isValidMobile(payload.phone)) {
      trackResult.innerHTML = `<p class="danger-text">Enter the same 10-digit mobile number used during booking.</p>`;
      return;
    }
    if (!/^\d{6}$/.test(payload.trackingCode)) {
      trackResult.innerHTML = `<p class="danger-text">Enter the 6-digit tracking code shown after booking.</p>`;
      return;
    }
    state.trackingAccess = {
      bookingId: payload.bookingId,
      phone: payload.phone,
      trackingCode: payload.trackingCode
    };
    trackResult.innerHTML = `<p>Securely checking booking...</p>`;
    try {
      const result = await VRK.request("/api/bookings/track", {
        method: "POST",
        body: JSON.stringify(payload)
      });
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
      ["advance_pending", "balance_pending"].includes(booking.paymentStatus) &&
      !["request_submitted", "under_review", "rejected", "cancelled_by_customer", "cancelled_by_admin", "closed"].includes(
        booking.status
      )
    );
  }

  function quotationLabel(value) {
    const labels = {
      waiting_for_owner: "Waiting for owner quotation",
      quotation_pending: "Quotation pending",
      quotation_ready: "Quotation ready",
      rejected: "Rejected",
      cancelled_by_customer: "Cancelled by customer",
      cancelled_by_admin: "Cancelled by admin"
    };
    return labels[value] || VRK.statusLabel(value || "quotation_pending");
  }

  function trackingCredentialInputs() {
    const access = state.trackingAccess || {};
    return `
      <input type="hidden" name="trackingPhone" value="${VRK.escapeHtml(access.phone || "")}">
      <input type="hidden" name="trackingCode" value="${VRK.escapeHtml(access.trackingCode || "")}">
    `;
  }

  function secureBillUrl(booking) {
    const access = state.trackingAccess || {};
    const params = new URLSearchParams({
      id: booking.id,
      phone: access.phone || "",
      code: access.trackingCode || ""
    });
    return `/bill.html?${params.toString()}`;
  }

  function trackingDetailGrid(booking) {
    const details = [
      ["Selected service", booking.selectedService || booking.packageTitle],
      ["Booking status", VRK.statusLabel(booking.status)],
      ["Quotation status", quotationLabel(booking.quotationStatus || (booking.amount ? "quotation_ready" : "waiting_for_owner"))],
      ["Payment status", VRK.statusLabel(booking.paymentStatus)],
      ["Trip status", VRK.statusLabel(booking.tripStatus || booking.status)],
      ["Travel date", VRK.dateLabel(booking.travelDate)],
      ["Pickup time", booking.pickupTime || "Not added"],
      ["Passengers", booking.passengers],
      ["Amount", booking.amount ? VRK.money(booking.amount) : "Owner quotation pending"],
      ["Assigned car", booking.car ? [booking.car.name, booking.car.seats].filter(Boolean).join(" | ") : "Visible after confirmation"],
      ["Assigned driver", booking.driver ? [booking.driver.name, booking.driver.phone].filter(Boolean).join(" | ") : "Visible after confirmation"]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
    return `<div class="tracking-summary-grid">${details
      .map(([label, value]) => `<span><b>${VRK.escapeHtml(label)}</b>${VRK.escapeHtml(value)}</span>`)
      .join("")}</div>`;
  }

  function liveLocationPanel(booking) {
    if (!["trip_started", "on_trip"].includes(booking.status)) return "";
    if (!booking.liveLocation) {
      return `<p class="note-line">Live location will appear here only while the active trip is running and the driver shares it.</p>`;
    }
    const link = booking.liveLocation.url || "";
    return `
      <div class="live-location-box">
        <b>Live location</b>
        ${link ? `<a class="secondary" href="${VRK.escapeHtml(link)}" target="_blank" rel="noopener">Open driver location</a>` : ""}
        ${booking.liveLocation.note ? `<small>${VRK.escapeHtml(booking.liveLocation.note)}</small>` : ""}
        ${booking.liveLocation.updatedAt ? `<small>Updated ${VRK.dateTimeLabel(booking.liveLocation.updatedAt)}</small>` : ""}
      </div>
    `;
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
    if (booking.paymentStatus === "advance_paid") {
      return `<p class="note-line">Advance payment verified by owner.</p>`;
    }
    if (booking.paymentStatus === "fully_paid") {
      return `<p class="note-line">Full payment verified by owner.</p>`;
    }
    if (booking.paymentStatus === "refunded") {
      return `<p class="note-line">Refund completed by owner.</p>`;
    }
    if (!canSubmitPayment(booking)) return "";
    return `
      ${paymentDetails()}
      <form class="payment-form form-grid compact" data-booking-id="${VRK.escapeHtml(booking.id)}">
        ${trackingCredentialInputs()}
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
          <span class="badge ${VRK.statusClass(booking.quotationStatus)}">${quotationLabel(
      booking.quotationStatus || (booking.amount ? "quotation_ready" : "waiting_for_owner")
    )}</span>
          <span class="badge ${VRK.statusClass(booking.paymentStatus)}">${VRK.statusLabel(booking.paymentStatus)}</span>
        </div>
        <strong>${VRK.escapeHtml(booking.selectedService || booking.packageTitle)}</strong>
        <small>Booking ID: ${VRK.escapeHtml(booking.id)}</small>
        ${booking.trackingCode ? `<p class="secure-code-box"><b>Tracking code</b><span>${VRK.escapeHtml(booking.trackingCode)}</span><small>Keep this code with your booking ID and mobile number.</small></p>` : ""}
        <small>${VRK.dateLabel(booking.travelDate)} | ${
      booking.amount ? VRK.money(booking.amount) : "Owner amount pending"
    }</small>
        ${trackingDetailGrid(booking)}
        ${booking.confirmationMessage ? `<p>${VRK.escapeHtml(booking.confirmationMessage)}</p>` : ""}
        ${liveLocationPanel(booking)}
        ${itemList("Trip details", tripSummaryDetails(booking))}
        ${fareBreakup(booking)}
        ${itemList("Included", booking.includedItems)}
        ${itemList("Extra / excluded", booking.excludedItems)}
        ${paymentForm(booking)}
        <a class="secondary ticket-link" href="${VRK.escapeHtml(secureBillUrl(booking))}">Open bill / ticket</a>
      </div>
    `;
  }

  [bookingForm, modalBookingForm].forEach(upgradeBookingForm);
  bindBookingForm(bookingForm, bookingMessage);
  bindBookingForm(modalBookingForm);
  VRK.watchLiveChanges(load);
  load().catch((error) => {
    catalog.innerHTML = `<div class="empty-state">${VRK.escapeHtml(error.message)}</div>`;
  });
})();
