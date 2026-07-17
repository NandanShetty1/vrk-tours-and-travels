(function () {
  const state = {
    auth: {
      configured: false,
      app: null,
      instance: null,
      modules: null,
      user: null,
      confirmationResult: null
    },
    method: "email",
    driver: JSON.parse(sessionStorage.getItem("vrkDriver") || "null"),
    accessCode: sessionStorage.getItem("vrkDriverCode") || "",
    data: null
  };

  const loginPanel = document.querySelector("#driverLoginPanel");
  const driverApp = document.querySelector("#driverApp");
  const emailForm = document.querySelector("#driverEmailLoginForm");
  const phoneForm = document.querySelector("#driverPhoneLoginForm");
  const otpForm = document.querySelector("#driverOtpForm");
  const legacyForm = document.querySelector("#driverLegacyLoginForm");
  const loginMessage = document.querySelector("#driverLoginMessage");
  const driverName = document.querySelector("#driverName");
  const metrics = document.querySelector("#driverMetrics");
  const trips = document.querySelector("#driverTrips");
  const methodButtons = Array.from(document.querySelectorAll("[data-driver-auth-method]"));
  const methodPanels = Array.from(document.querySelectorAll("[data-driver-auth-panel]"));

  const tripTypeLabels = {
    local_rental: "Local rental",
    one_way: "One way",
    round_trip: "Round trip",
    one_day_package: "One day package",
    multi_day_package: "Multi day package",
    airport_transfer: "Airport transfer",
    custom_trip: "Custom trip"
  };

  function setMessage(message, tone) {
    VRK.setMessage(loginMessage, message, tone);
  }

  function indiaPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      throw new Error("Enter a valid 10-digit India mobile number.");
    }
    return `+91${digits}`;
  }

  function friendlyAuthError(error) {
    const code = error && error.code ? error.code : "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return "Driver email or password is wrong.";
    }
    if (code === "auth/operation-not-allowed") {
      return "This Firebase login provider is not enabled.";
    }
    if (code === "auth/billing-not-enabled") {
      return "Phone OTP needs Firebase billing enabled. Use driver email/password login.";
    }
    if (code === "auth/unauthorized-domain") {
      return "Add this website domain in Firebase Authentication authorized domains.";
    }
    if (code === "auth/too-many-requests" || code === "auth/quota-exceeded") {
      return "Too many login attempts. Please wait and try again.";
    }
    return (error && error.message) || "Driver login failed.";
  }

  function renderAuthMode() {
    methodButtons.forEach((button) => {
      const active = button.dataset.driverAuthMethod === state.method;
      button.classList.toggle("active", active);
      button.classList.toggle("hidden", !state.auth.configured);
    });
    methodPanels.forEach((panel) => {
      panel.classList.toggle("hidden", !state.auth.configured || panel.dataset.driverAuthPanel !== state.method);
    });
    otpForm.classList.toggle("hidden", !state.auth.configured || state.method !== "phone" || !state.auth.confirmationResult);
    legacyForm.classList.toggle("hidden", state.auth.configured);
    if (!state.auth.configured) {
      emailForm.classList.add("hidden");
      phoneForm.classList.add("hidden");
    }
  }

  async function driverHeaders() {
    if (!state.auth.configured || !state.auth.user) return {};
    return { Authorization: `Bearer ${await state.auth.user.getIdToken()}` };
  }

  function showLogin() {
    loginPanel.classList.remove("hidden");
    driverApp.classList.add("hidden");
    renderAuthMode();
  }

  function showApp() {
    loginPanel.classList.add("hidden");
    driverApp.classList.remove("hidden");
  }

  async function load() {
    if (state.auth.configured) {
      if (!state.auth.user) return;
      state.data = await VRK.request("/api/driver/me", { headers: await driverHeaders() });
      state.driver = state.data.driver;
    } else {
      if (!state.driver || !state.accessCode) return;
      state.data = await VRK.request(
        `/api/driver/${encodeURIComponent(state.driver.id)}?accessCode=${encodeURIComponent(state.accessCode)}`
      );
    }
    showApp();
    render();
  }

  function render() {
    driverName.textContent = `${state.data.driver.name}'s trips`;
    const activeStatuses = [
      "booking_confirmed",
      "driver_assigned",
      "driver_accepted",
      "driver_arriving",
      "driver_reached",
      "trip_started",
      "on_trip"
    ];
    const active = state.data.bookings.filter((booking) => activeStatuses.includes(booking.status)).length;
    const completed = state.data.bookings.filter((booking) => booking.status === "trip_completed").length;
    metrics.innerHTML = [
      ["Assigned trips", state.data.bookings.length],
      ["Active", active],
      ["Completed", completed],
      ["Rating", state.data.driver.rating || "New"]
    ]
      .map(
        ([label, value]) => `
          <article class="metric-card">
            <span>${label}</span>
            <strong>${value}</strong>
          </article>
        `
      )
      .join("");

    trips.innerHTML = state.data.bookings.length
      ? state.data.bookings.map(renderTrip).join("")
      : `<div class="empty-state">No trips assigned yet.</div>`;
  }

  function listText(value) {
    if (Array.isArray(value)) return value.join(" | ");
    return value || "";
  }

  function tripTypeLabel(booking) {
    return tripTypeLabels[booking.tripType] || "Custom trip";
  }

  function driverTripDetails(booking) {
    const trip = booking.driverTrip || {};
    return [
      ["Booking ID", booking.id],
      ["Trip type", tripTypeLabel(booking)],
      ["Travel date", VRK.dateLabel(booking.travelDate)],
      ["Return date", booking.returnDate ? VRK.dateLabel(booking.returnDate) : ""],
      ["Pickup time", booking.pickupTime],
      ["WhatsApp", booking.whatsappNumber],
      ["Passengers", booking.passengers],
      ["Luggage", booking.luggageCount || booking.luggageCount === 0 ? `${booking.luggageCount}` : ""],
      ["Vehicle preference", booking.vehiclePreference],
      ["Route stops", listText(booking.multipleDestinations)],
      ["Local rental", booking.localRentalPackage],
      ["Days", booking.numberOfDays ? `${booking.numberOfDays}` : ""],
      ["Airport", booking.airportName],
      ["Airport type", booking.airportTripMode],
      ["Flight", booking.flightNumber],
      ["Terminal", booking.terminal],
      ["Flight time", booking.flightTime],
      ["Custom route", listText(booking.customDestinations)],
      ["Special requirements", booking.specialRequirements],
      ["Starting KM", trip.startingKm || trip.startingKm === 0 ? `${trip.startingKm}` : ""],
      ["Ending KM", trip.endingKm || trip.endingKm === 0 ? `${trip.endingKm}` : ""]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
  }

  function detailSpans(details) {
    return details.map(([label, value]) => `<span><b>${VRK.escapeHtml(label)}</b>${VRK.escapeHtml(value)}</span>`).join("");
  }

  function renderTripList(items, emptyLabel) {
    if (!items || !items.length) return "";
    return `
      <div class="driver-mini-list">
        ${items
          .map(
            (item) => `
              <span>
                <b>${VRK.escapeHtml(item.name || item.note || item.label || emptyLabel)}</b>
                ${VRK.escapeHtml(item.note && item.name ? item.note : item.at ? VRK.dateTimeLabel(item.at) : "")}
              </span>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderTimeline(booking) {
    const timeline = (booking.driverTrip && booking.driverTrip.timeline) || [];
    if (!timeline.length) return "";
    return `
      <div class="driver-timeline">
        ${timeline
          .slice(-5)
          .reverse()
          .map(
            (item) => `
              <span>
                <b>${VRK.escapeHtml(item.label || item.action)}</b>
                ${VRK.escapeHtml([item.detail, VRK.dateTimeLabel(item.at)].filter(Boolean).join(" | "))}
              </span>
            `
          )
          .join("")}
      </div>
    `;
  }

  function actionButton(booking, action, label, tone) {
    return `<button class="${tone || "secondary"}" data-booking-id="${VRK.escapeHtml(
      booking.id
    )}" data-driver-action="${action}" type="button">${label}</button>`;
  }

  function actionForm(booking, action, body, buttonLabel, tone) {
    return `
      <form class="driver-action-panel" data-booking-id="${VRK.escapeHtml(booking.id)}" data-driver-action="${action}">
        ${body}
        <button class="${tone || "secondary"}" type="submit">${buttonLabel}</button>
      </form>
    `;
  }

  function renderActions(booking) {
    const trip = booking.driverTrip || {};
    const closed = ["trip_completed", "closed", "cancelled_by_customer", "cancelled_by_admin", "rejected"].includes(booking.status);
    const onTrip = ["trip_started", "on_trip"].includes(booking.status);
    if (closed) {
      return `
        <div class="driver-action-shell">
          <span class="badge good">${VRK.statusLabel(booking.status)}</span>
          ${renderTimeline(booking)}
        </div>
      `;
    }

    const startKmValue = trip.startingKm || trip.startingKm === 0 ? trip.startingKm : "";
    const endKmValue = trip.endingKm || trip.endingKm === 0 ? trip.endingKm : "";
    return `
      <div class="driver-action-shell">
        <div class="driver-action-grid">
          ${["booking_confirmed", "driver_assigned"].includes(booking.status) ? actionButton(booking, "accept_trip", "Accept Trip") : ""}
          ${
            ["booking_confirmed", "driver_assigned", "driver_accepted"].includes(booking.status)
              ? actionButton(booking, "start_travelling", "Start travelling")
              : ""
          }
          ${
            ["driver_assigned", "driver_accepted", "driver_arriving"].includes(booking.status)
              ? actionButton(booking, "reached_pickup", "Reached Pickup")
              : ""
          }
        </div>
        ${
          !onTrip
            ? `
              ${actionForm(
                booking,
                "starting_km",
                `<label>Starting KM<input name="startingKm" type="number" min="0" step="0.1" value="${VRK.escapeHtml(startKmValue)}" required></label>`,
                "Save starting KM"
              )}
              ${actionForm(
                booking,
                "start_trip",
                `
                  <label>Starting KM<input name="startingKm" type="number" min="0" step="0.1" value="${VRK.escapeHtml(startKmValue)}" required></label>
                  <label>Live location link<input name="liveLocationUrl" placeholder="Google Maps live location link"></label>
                  <label>Location note<input name="liveLocationNote" placeholder="Current location note"></label>
                `,
                "Start Trip",
                "primary"
              )}
            `
            : ""
        }
        ${
          onTrip
            ? `
              ${actionForm(
                booking,
                "add_stop",
                `
                  <label>Stop name<input name="stopName" required></label>
                  <label>Stop note<input name="stopNote"></label>
                `,
                "Add stop"
              )}
              ${actionForm(
                booking,
                "resume_trip",
                `
                  <label>Live location link<input name="liveLocationUrl" value="${VRK.escapeHtml(
                    booking.liveLocation ? booking.liveLocation.url || "" : ""
                  )}"></label>
                  <label>Location note<input name="liveLocationNote" value="${VRK.escapeHtml(
                    booking.liveLocation ? booking.liveLocation.note || "" : ""
                  )}"></label>
                `,
                "Resume trip"
              )}
              ${actionForm(
                booking,
                "report_issue",
                `<label class="full">Issue details<input name="issue" required></label>`,
                "Report issue",
                "ghost"
              )}
              ${actionForm(
                booking,
                "ending_km",
                `<label>Ending KM<input name="endingKm" type="number" min="0" step="0.1" value="${VRK.escapeHtml(endKmValue)}" required></label>`,
                "Save ending KM"
              )}
              ${actionForm(
                booking,
                "complete_trip",
                `<label>Ending KM<input name="endingKm" type="number" min="0" step="0.1" value="${VRK.escapeHtml(endKmValue)}" required></label>`,
                "Complete trip",
                "primary"
              )}
            `
            : ""
        }
        ${renderTripList(trip.stops, "Stop")}
        ${renderTripList(trip.issues, "Issue")}
        ${renderTimeline(booking)}
      </div>
    `;
  }

  function renderTrip(booking) {
    return `
      <article class="booking-card driver-trip-card">
        <div class="booking-main">
          <div>
            <span class="badge ${VRK.statusClass(booking.status)}">${VRK.statusLabel(booking.status)}</span>
            <h3>${VRK.escapeHtml(booking.packageTitle)}</h3>
            <p>${VRK.dateLabel(booking.travelDate)} | ${VRK.escapeHtml(booking.passengers)} passengers | ${VRK.escapeHtml(
      tripTypeLabel(booking)
    )}</p>
          </div>
        </div>
        <div class="booking-detail-grid">
          <span><b>Customer</b>${VRK.escapeHtml(booking.customerName)} / ${VRK.escapeHtml(booking.phone)}</span>
          <span><b>Pickup</b>${VRK.escapeHtml(booking.pickupLocation)}</span>
          <span><b>Drop</b>${VRK.escapeHtml(booking.dropLocation || "Not added")}</span>
          <span><b>Car</b>${VRK.escapeHtml(booking.car ? `${booking.car.name} ${booking.car.vehicleNumber || ""}` : "Not assigned")}</span>
          ${detailSpans(driverTripDetails(booking))}
        </div>
        ${booking.message ? `<p class="note-line">${VRK.escapeHtml(booking.message)}</p>` : ""}
        ${renderActions(booking)}
      </article>
    `;
  }

  async function postDriverAction(bookingId, action, payload, trigger) {
    const button = trigger && trigger.tagName === "BUTTON" ? trigger : trigger ? trigger.querySelector("button") : null;
    if (button) button.disabled = true;
    try {
      const body = { ...payload, action };
      if (!state.auth.configured) {
        body.driverId = state.driver.id;
        body.accessCode = state.accessCode;
      }
      await VRK.request(`/api/driver/bookings/${bookingId}/action`, {
        method: "POST",
        headers: await driverHeaders(),
        body: JSON.stringify(body)
      });
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function setupFirebase() {
    const config = await VRK.request("/api/auth/config");
    state.auth.configured = Boolean(config.configured && config.firebaseConfig);
    if (!state.auth.configured) {
      setMessage("Firebase driver login is not configured. Using local access-code fallback.", "warn");
      renderAuthMode();
      if (state.driver) load().catch(() => {
        sessionStorage.removeItem("vrkDriver");
        sessionStorage.removeItem("vrkDriverCode");
        state.driver = null;
        state.accessCode = "";
      });
      return;
    }

    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    state.auth.modules = authModule;
    state.auth.app = appModule.initializeApp(config.firebaseConfig);
    state.auth.instance = authModule.getAuth(state.auth.app);
    await authModule.setPersistence(state.auth.instance, authModule.browserSessionPersistence);
    renderAuthMode();

    authModule.onAuthStateChanged(state.auth.instance, async (user) => {
      state.auth.user = user;
      if (!user) {
        showLogin();
        return;
      }
      try {
        await load();
        setMessage("", "");
      } catch (error) {
        setMessage(error.message, "danger");
        await authModule.signOut(state.auth.instance);
        showLogin();
      }
    });
  }

  async function ensureRecaptcha() {
    if (window.vrkDriverRecaptchaVerifier) return window.vrkDriverRecaptchaVerifier;
    const modules = state.auth.modules;
    window.vrkDriverRecaptchaVerifier = new modules.RecaptchaVerifier(state.auth.instance, "driverRecaptcha", {
      size: "normal"
    });
    await window.vrkDriverRecaptchaVerifier.render();
    return window.vrkDriverRecaptchaVerifier;
  }

  emailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.auth.configured) return;
    const payload = VRK.formToObject(emailForm);
    const button = emailForm.querySelector("button");
    button.disabled = true;
    setMessage("Checking driver login...", "active");
    try {
      await state.auth.modules.signInWithEmailAndPassword(
        state.auth.instance,
        String(payload.email || "").trim(),
        String(payload.password || "")
      );
    } catch (error) {
      setMessage(friendlyAuthError(error), "danger");
    } finally {
      button.disabled = false;
    }
  });

  phoneForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.auth.configured) return;
    const payload = VRK.formToObject(phoneForm);
    const button = phoneForm.querySelector("button");
    button.disabled = true;
    setMessage("Sending OTP...", "active");
    try {
      const verifier = await ensureRecaptcha();
      state.auth.confirmationResult = await state.auth.modules.signInWithPhoneNumber(
        state.auth.instance,
        indiaPhone(payload.phone),
        verifier
      );
      setMessage("OTP sent. Enter it below.", "good");
      renderAuthMode();
    } catch (error) {
      setMessage(friendlyAuthError(error), "danger");
    } finally {
      button.disabled = false;
    }
  });

  otpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = VRK.formToObject(otpForm);
    if (!state.auth.confirmationResult) {
      setMessage("Send OTP first.", "danger");
      return;
    }
    const button = otpForm.querySelector("button");
    button.disabled = true;
    setMessage("Verifying OTP...", "active");
    try {
      await state.auth.confirmationResult.confirm(String(payload.otp || "").trim());
      state.auth.confirmationResult = null;
      otpForm.reset();
      renderAuthMode();
    } catch (error) {
      setMessage(friendlyAuthError(error), "danger");
    } finally {
      button.disabled = false;
    }
  });

  legacyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.auth.configured) return;
    const payload = VRK.formToObject(legacyForm);
    setMessage("Checking driver details...", "active");
    try {
      const result = await VRK.request("/api/driver/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      state.driver = result.driver;
      state.accessCode = payload.accessCode;
      sessionStorage.setItem("vrkDriver", JSON.stringify(result.driver));
      sessionStorage.setItem("vrkDriverCode", payload.accessCode);
      await load();
    } catch (error) {
      setMessage(error.message, "danger");
    }
  });

  methodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.method = button.dataset.driverAuthMethod === "phone" ? "phone" : "email";
      state.auth.confirmationResult = null;
      renderAuthMode();
    });
  });

  trips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-driver-action]");
    if (!button || button.closest("form")) return;
    postDriverAction(button.dataset.bookingId, button.dataset.driverAction, {}, button).catch(console.error);
  });

  trips.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-driver-action]");
    if (!form) return;
    event.preventDefault();
    postDriverAction(form.dataset.bookingId, form.dataset.driverAction, VRK.formToObject(form), form).catch(console.error);
  });

  document.querySelector("#driverLogoutButton").addEventListener("click", async () => {
    sessionStorage.removeItem("vrkDriver");
    sessionStorage.removeItem("vrkDriverCode");
    state.driver = null;
    state.accessCode = "";
    state.data = null;
    if (state.auth.modules && state.auth.instance) {
      await state.auth.modules.signOut(state.auth.instance);
    }
    showLogin();
  });

  VRK.watchLiveChanges(() => {
    if ((state.auth.configured && state.auth.user) || (!state.auth.configured && state.driver)) {
      load().catch(console.error);
    }
  });

  setupFirebase().catch((error) => {
    setMessage(friendlyAuthError(error), "danger");
    showLogin();
  });
})();
