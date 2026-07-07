(function () {
  const state = {
    driver: JSON.parse(sessionStorage.getItem("vrkDriver") || "null"),
    accessCode: sessionStorage.getItem("vrkDriverCode") || "",
    data: null
  };

  const loginPanel = document.querySelector("#driverLoginPanel");
  const driverApp = document.querySelector("#driverApp");
  const loginForm = document.querySelector("#driverLoginForm");
  const loginMessage = document.querySelector("#driverLoginMessage");
  const driverName = document.querySelector("#driverName");
  const metrics = document.querySelector("#driverMetrics");
  const trips = document.querySelector("#driverTrips");

  async function load() {
    if (!state.driver || !state.accessCode) return;
    state.data = await VRK.request(
      `/api/driver/${encodeURIComponent(state.driver.id)}?accessCode=${encodeURIComponent(state.accessCode)}`
    );
    loginPanel.classList.add("hidden");
    driverApp.classList.remove("hidden");
    render();
  }

  function render() {
    driverName.textContent = `${state.data.driver.name}'s trips`;
    const active = state.data.bookings.filter((booking) =>
      ["payment_verified", "assigned", "driver_accepted", "on_trip"].includes(booking.status)
    ).length;
    const completed = state.data.bookings.filter((booking) => booking.status === "completed").length;
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

    trips.querySelectorAll("form").forEach((form) => {
      form.addEventListener("submit", saveStatus);
    });
  }

  function renderTrip(booking) {
    return `
      <article class="booking-card">
        <div class="booking-main">
          <div>
            <span class="badge ${VRK.statusClass(booking.status)}">${VRK.statusLabel(booking.status)}</span>
            <h3>${VRK.escapeHtml(booking.packageTitle)}</h3>
            <p>${VRK.dateLabel(booking.travelDate)} | ${VRK.escapeHtml(booking.passengers)} passengers</p>
          </div>
          <strong>${VRK.money(booking.amount)}</strong>
        </div>
        <div class="booking-detail-grid">
          <span><b>Customer</b>${VRK.escapeHtml(booking.customerName)} / ${VRK.escapeHtml(booking.phone)}</span>
          <span><b>Pickup</b>${VRK.escapeHtml(booking.pickupLocation)}</span>
          <span><b>Drop</b>${VRK.escapeHtml(booking.dropLocation || "Not added")}</span>
          <span><b>Car</b>${VRK.escapeHtml(booking.car ? booking.car.name : "Not assigned")}</span>
        </div>
        ${booking.message ? `<p class="note-line">${VRK.escapeHtml(booking.message)}</p>` : ""}
        <form class="form-grid compact" data-booking-id="${VRK.escapeHtml(booking.id)}">
          <label>
            Trip status
            <select name="status">
              ${["payment_verified", "assigned", "driver_accepted", "on_trip", "completed"]
                .map(
                  (status) =>
                    `<option value="${status}" ${booking.status === status ? "selected" : ""}>${VRK.statusLabel(
                      status
                    )}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>
            Driver note
            <input name="notes" value="${VRK.escapeHtml(booking.notes || "")}">
          </label>
          <button class="primary" type="submit">Update trip</button>
        </form>
      </article>
    `;
  }

  async function saveStatus(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = VRK.formToObject(form);
    payload.driverId = state.driver.id;
    payload.accessCode = state.accessCode;
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await VRK.request(`/api/driver/bookings/${form.dataset.bookingId}/status`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = VRK.formToObject(loginForm);
    VRK.setMessage(loginMessage, "Checking driver details...", "active");
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
      VRK.setMessage(loginMessage, error.message, "danger");
    }
  });

  document.querySelector("#driverLogoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("vrkDriver");
    sessionStorage.removeItem("vrkDriverCode");
    state.driver = null;
    state.accessCode = "";
    driverApp.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  });

  VRK.watchLiveChanges(() => {
    if (state.driver) load().catch(console.error);
  });

  if (state.driver) {
    load().catch(() => {
      sessionStorage.removeItem("vrkDriver");
      sessionStorage.removeItem("vrkDriverCode");
      state.driver = null;
    });
  }
})();
