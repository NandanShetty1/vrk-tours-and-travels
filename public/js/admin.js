(function () {
  const state = {
    pin: sessionStorage.getItem("vrkAdminPin") || "",
    data: null,
    section: "bookings"
  };

  const loginPanel = document.querySelector("#loginPanel");
  const adminApp = document.querySelector("#adminApp");
  const loginForm = document.querySelector("#adminLoginForm");
  const loginMessage = document.querySelector("#adminLoginMessage");
  const metrics = document.querySelector("#metrics");
  const sectionButtons = Array.from(document.querySelectorAll("[data-section]"));
  const sections = {
    bookings: document.querySelector("#bookingsSection"),
    cars: document.querySelector("#carsSection"),
    tours: document.querySelector("#toursSection"),
    days: document.querySelector("#daysSection"),
    drivers: document.querySelector("#driversSection"),
    banners: document.querySelector("#bannersSection"),
    gallery: document.querySelector("#gallerySection"),
    popup: document.querySelector("#popupSection"),
    settings: document.querySelector("#settingsSection")
  };

  function adminHeaders() {
    return { "X-Admin-Pin": state.pin };
  }

  function collectionMeta(section) {
    return {
      cars: {
        endpoint: "/api/admin/cars",
        archive: "cars",
        title: "Cars",
        empty: "No cars added.",
        fields: [
          ["name", "Car name", "text"],
          ["category", "Category", "text"],
          ["seats", "Seats", "number"],
          ["fuel", "Fuel", "text"],
          ["luggage", "Luggage", "text"],
          ["ratePerKm", "Rate per km", "number"],
          ["dayRate", "Day rate", "number"],
          ["image", "Image URL", "url"],
          ["features", "Features, one per line", "textarea"],
          ["includedItems", "Default inclusions, one per line", "textarea"],
          ["extraCharges", "Extra charge notes, one per line", "textarea"],
          ["terms", "Car terms and conditions, one per line", "textarea"]
        ]
      },
      tours: {
        endpoint: "/api/admin/tour-packages",
        archive: "tourPackages",
        title: "Tour packages",
        empty: "No tour packages added.",
        fields: [
          ["title", "Package title", "text"],
          ["packageType", "Package type", "text"],
          ["destination", "Destination", "text"],
          ["duration", "Duration", "text"],
          ["price", "Price", "number"],
          ["image", "Image URL", "url"],
          ["overview", "Overview", "textarea"],
          ["inclusions", "Inclusions, one per line", "textarea"],
          ["exclusions", "Exclusions, one per line", "textarea"],
          ["itinerary", "Itinerary, one per line", "textarea"],
          ["terms", "Tour terms and conditions, one per line", "textarea"]
        ]
      },
      days: {
        endpoint: "/api/admin/day-packages",
        archive: "dayPackages",
        title: "One day packages",
        empty: "No one day packages added.",
        fields: [
          ["title", "Package title", "text"],
          ["packageType", "Package type", "text"],
          ["place", "Place", "text"],
          ["hours", "Hours", "text"],
          ["price", "Price", "number"],
          ["image", "Image URL", "url"],
          ["overview", "Overview", "textarea"],
          ["highlights", "Highlights, one per line", "textarea"],
          ["exclusions", "Exclusions, one per line", "textarea"],
          ["terms", "One day trip terms and conditions, one per line", "textarea"]
        ]
      },
      drivers: {
        endpoint: "/api/admin/drivers",
        archive: "drivers",
        title: "Drivers",
        empty: "No drivers added.",
        fields: [
          ["name", "Driver name", "text"],
          ["phone", "Phone", "text"],
          ["license", "License", "text"],
          ["accessCode", "Access code", "text"],
          ["rating", "Rating", "number"]
        ]
      },
      banners: {
        endpoint: "/api/admin/banners",
        archive: "banners",
        title: "Homepage banners",
        empty: "No banners added.",
        fields: [
          ["prompt", "Prompt for banner/ad idea", "textarea"],
          ["title", "Banner title", "text"],
          ["subtitle", "Banner subtitle", "textarea"],
          ["details", "Banner details shown after customer clicks", "textarea"],
          ["terms", "Banner offer terms, one per line", "textarea"],
          ["validUntil", "Offer valid until", "date"],
          ["offerLabel", "Offer label, example Weekend offer", "text"],
          ["image", "Banner image URL", "url"],
          ["targetType", "Target type: car, tour, day, or blank", "text"],
          ["targetId", "Target service/package ID", "text"],
          ["sortOrder", "Sort order", "number"]
        ]
      },
      gallery: {
        endpoint: "/api/admin/gallery",
        archive: "gallery",
        title: "Gallery",
        empty: "No gallery media added.",
        fields: [
          ["title", "Gallery title", "text"],
          ["caption", "Caption", "textarea"],
          ["mediaType", "Media type: image or video", "text"],
          ["mediaUrl", "Image or video URL", "url"],
          ["thumbnail", "Thumbnail URL", "url"],
          ["tripDate", "Trip date", "date"],
          ["tags", "Tags, one per line", "textarea"],
          ["sortOrder", "Sort order", "number"]
        ]
      }
    }[section];
  }

  function collectionFor(section) {
    if (section === "cars") return state.data.cars;
    if (section === "tours") return state.data.tourPackages;
    if (section === "days") return state.data.dayPackages;
    if (section === "drivers") return state.data.drivers;
    if (section === "banners") return state.data.banners;
    if (section === "gallery") return state.data.gallery;
    return [];
  }

  async function load() {
    if (!state.pin) return;
    state.data = await VRK.request("/api/admin-data", { headers: adminHeaders() });
    loginPanel.classList.add("hidden");
    adminApp.classList.remove("hidden");
    render();
  }

  function render() {
    renderMetrics();
    renderBookings();
    renderCollection("cars");
    renderCollection("tours");
    renderCollection("days");
    renderCollection("drivers");
    renderCollection("banners");
    renderCollection("gallery");
    renderPopup();
    renderSettings();
  }

  function renderMetrics() {
    const bookings = state.data.bookings;
    const activeTrips = bookings.filter((booking) =>
      ["assigned", "driver_accepted", "on_trip", "payment_verified"].includes(booking.status)
    ).length;
    const pending = bookings.filter((booking) => booking.status === "pending_owner_confirmation").length;
    const paymentReview = bookings.filter((booking) => booking.paymentStatus === "payment_submitted").length;
    const revenue = bookings
      .filter((booking) => booking.status !== "cancelled")
      .reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

    metrics.innerHTML = [
      ["Total bookings", bookings.length],
      ["Owner review", pending],
      ["Payment review", paymentReview],
      ["Active trips", activeTrips],
      ["Confirmed value", VRK.money(revenue)]
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
  }

  function bookingTypeLabel(booking) {
    if (booking.bookingType === "car") return "Car booking";
    if (booking.bookingType === "tour") return "Tour package";
    return "One day package";
  }

  function options(items, selectedId, labelField) {
    return [
      `<option value="">Not assigned</option>`,
      ...items
        .filter((item) => item.active)
        .map(
          (item) =>
            `<option value="${VRK.escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${VRK.escapeHtml(
              item[labelField]
            )}</option>`
        )
    ].join("");
  }

  function costItemsText(booking) {
    return (booking.costItems || []).map((item) => `${item.label} = ${item.amount}`).join("\n");
  }

  function renderBookings() {
    const bookings = state.data.bookings;
    sections.bookings.innerHTML = `
      <div class="section-title">
        <div>
          <span class="eyebrow">Bookings</span>
          <h2>Customer requests and trip control</h2>
        </div>
      </div>
      <div class="booking-list">
        ${
          bookings.length
            ? bookings.map(renderBookingCard).join("")
            : `<div class="empty-state">No bookings yet.</div>`
        }
      </div>
    `;

    sections.bookings.querySelectorAll(".manage-booking-form").forEach((form) => {
      form.addEventListener("submit", saveBooking);
    });
  }

  function renderBookingCard(booking) {
    const driver = state.data.drivers.find((item) => item.id === booking.assignedDriverId);
    const car = state.data.cars.find((item) => item.id === booking.assignedCarId);
    const payment = booking.payment;
    return `
      <article class="booking-card">
        <div class="booking-main">
          <div>
            <span class="badge ${VRK.statusClass(booking.status)}">${VRK.statusLabel(booking.status)}</span>
            <span class="badge ${VRK.statusClass(booking.paymentStatus)}">${VRK.statusLabel(booking.paymentStatus)}</span>
            <h3>${VRK.escapeHtml(booking.packageTitle)}</h3>
            <p>${bookingTypeLabel(booking)} | ${VRK.dateLabel(booking.travelDate)} | ${VRK.escapeHtml(
      booking.passengers
    )} passengers</p>
          </div>
          <strong>${booking.amount ? VRK.money(booking.amount) : "Amount not set"}</strong>
        </div>
        <div class="booking-detail-grid">
          <span><b>Customer</b>${VRK.escapeHtml(booking.customerName)} / ${VRK.escapeHtml(booking.phone)}</span>
          <span><b>Pickup</b>${VRK.escapeHtml(booking.pickupLocation)}</span>
          <span><b>Drop</b>${VRK.escapeHtml(booking.dropLocation || "Not added")}</span>
          <span><b>Driver</b>${VRK.escapeHtml(driver ? driver.name : "Not assigned")}</span>
          <span><b>Car</b>${VRK.escapeHtml(car ? car.name : "Not assigned")}</span>
          <span><b>Created</b>${VRK.dateTimeLabel(booking.createdAt)}</span>
        </div>
        ${booking.message ? `<p class="note-line">${VRK.escapeHtml(booking.message)}</p>` : ""}
        ${
          payment
            ? `<p class="note-line">Payment submitted by ${VRK.escapeHtml(payment.payerName)} using ${VRK.escapeHtml(
                payment.paymentMethod
              )}. Ref: ${VRK.escapeHtml(payment.transactionId || "Not provided")}. Paid: ${VRK.money(
                payment.paidAmount
              )}</p>`
            : ""
        }
        <form class="manage-booking-form form-grid compact" data-booking-id="${VRK.escapeHtml(booking.id)}">
          <label>
            Driver
            <select name="assignedDriverId">${options(state.data.drivers, booking.assignedDriverId, "name")}</select>
          </label>
          <label>
            Car
            <select name="assignedCarId">${options(state.data.cars, booking.assignedCarId, "name")}</select>
          </label>
          <label>
            Final amount fallback
            <input name="amount" type="number" min="0" value="${VRK.escapeHtml(booking.amount)}">
          </label>
          <label>
            Status
            <select name="status">
              ${[
                "pending_owner_confirmation",
                "confirmed_waiting_payment",
                "payment_submitted",
                "payment_verified",
                "assigned",
                "driver_accepted",
                "on_trip",
                "completed",
                "cancelled"
              ]
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
            Payment status
            <select name="paymentStatus">
              ${[
                "waiting_for_amount",
                "payment_required",
                "payment_submitted",
                "advance_paid",
                "paid",
                "not_required",
                "refunded"
              ]
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      booking.paymentStatus === status ? "selected" : ""
                    }>${VRK.statusLabel(status)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="full">
            Fare breakup, one line as Label = Amount
            <textarea name="costItems" rows="4">${VRK.escapeHtml(costItemsText(booking))}</textarea>
          </label>
          <label class="full">
            Package includes, one per line
            <textarea name="includedItems" rows="3">${VRK.escapeHtml(VRK.linesToText(booking.includedItems))}</textarea>
          </label>
          <label class="full">
            Package excludes / extra charges, one per line
            <textarea name="excludedItems" rows="3">${VRK.escapeHtml(VRK.linesToText(booking.excludedItems))}</textarea>
          </label>
          <label class="full">
            Customer confirmation message
            <textarea name="confirmationMessage" rows="2">${VRK.escapeHtml(booking.confirmationMessage)}</textarea>
          </label>
          <label class="full">
            Admin notes
            <textarea name="notes" rows="2">${VRK.escapeHtml(booking.notes)}</textarea>
          </label>
          <button class="primary full" type="submit">Update booking</button>
        </form>
      </article>
    `;
  }

  async function saveBooking(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const bookingId = form.dataset.bookingId;
    const payload = VRK.formToObject(form);
    payload.amount = Number(payload.amount || 0);
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await VRK.request(`/api/admin/bookings/${bookingId}/assign`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload)
      });
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function renderField(field, item) {
    const [name, label, type] = field;
    const value = Array.isArray(item && item[name]) ? VRK.linesToText(item[name]) : (item && item[name]) || "";
    if (type === "textarea") {
      return `
        <label class="full">
          ${label}
          <textarea name="${name}" rows="3">${VRK.escapeHtml(value)}</textarea>
        </label>
      `;
    }
    return `
      <label>
        ${label}
        <input name="${name}" type="${type}" value="${VRK.escapeHtml(value)}">
      </label>
    `;
  }

  function renderCollection(section) {
    const meta = collectionMeta(section);
    const items = collectionFor(section);
    const formId = `${section}Form`;
    sections[section].innerHTML = `
      <div class="section-title">
        <div>
          <span class="eyebrow">${meta.title}</span>
          <h2>Add or update ${meta.title.toLowerCase()}</h2>
        </div>
      </div>
      <form id="${formId}" class="admin-form form-grid">
        <input type="hidden" name="id">
        ${meta.fields.map((field) => renderField(field)).join("")}
        <label class="switch-row full">
          <input name="active" type="checkbox" checked>
          Show this item to customers
        </label>
        <button class="primary full" type="submit">Save ${meta.title}</button>
      </form>
      <div class="admin-list">
        ${
          items.length
            ? items.map((item) => renderCollectionItem(section, item)).join("")
            : `<div class="empty-state">${meta.empty}</div>`
        }
      </div>
    `;

    const form = document.querySelector(`#${formId}`);
    form.addEventListener("submit", (event) => saveCollection(event, section));
    sections[section].querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => fillCollectionForm(section, button.dataset.edit));
    });
    sections[section].querySelectorAll("[data-archive]").forEach((button) => {
      button.addEventListener("click", () => archiveItem(section, button.dataset.archive));
    });
  }

  function renderCollectionItem(section, item) {
    const title = item.name || item.title;
    const subtitle = item.category || item.destination || item.place || item.phone;
    const price = item.dayRate || item.price || item.rating;
    return `
      <article class="admin-row ${item.active ? "" : "muted"}">
        <div>
          <span class="badge ${item.active ? "good" : "danger"}">${item.active ? "active" : "hidden"}</span>
          <h3>${VRK.escapeHtml(title)}</h3>
          <p>${VRK.escapeHtml(subtitle || "")}${price ? ` | ${VRK.escapeHtml(price)}` : ""}</p>
        </div>
        <div class="row-actions">
          <button class="secondary" data-edit="${VRK.escapeHtml(item.id)}" type="button">Edit</button>
          <button class="ghost" data-archive="${VRK.escapeHtml(item.id)}" type="button">Hide</button>
        </div>
      </article>
    `;
  }

  async function saveCollection(event, section) {
    event.preventDefault();
    const meta = collectionMeta(section);
    const form = event.currentTarget;
    const payload = VRK.formToObject(form);
    payload.active = form.elements.active.checked;
    ["seats", "ratePerKm", "dayRate", "price", "rating", "sortOrder"].forEach((field) => {
      if (payload[field] !== undefined && payload[field] !== "") payload[field] = Number(payload[field]);
    });
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await VRK.request(meta.endpoint, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload)
      });
      form.reset();
      form.elements.active.checked = true;
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function fillCollectionForm(section, itemId) {
    const meta = collectionMeta(section);
    const item = collectionFor(section).find((entry) => entry.id === itemId);
    const form = document.querySelector(`#${section}Form`);
    if (!item || !form) return;
    form.elements.id.value = item.id;
    meta.fields.forEach(([name]) => {
      if (!form.elements[name]) return;
      form.elements[name].value = Array.isArray(item[name]) ? VRK.linesToText(item[name]) : item[name] || "";
    });
    form.elements.active.checked = Boolean(item.active);
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function archiveItem(section, itemId) {
    const meta = collectionMeta(section);
    if (!confirm("Hide this item from customers?")) return;
    await VRK.request(`/api/admin/${meta.archive}/${itemId}/archive`, {
      method: "POST",
      headers: adminHeaders()
    });
    await load();
  }

  function renderPopup() {
    const popup = state.data.popupSettings || {};
    sections.popup.innerHTML = `
      <div class="section-title">
        <div>
          <span class="eyebrow">Website popup</span>
          <h2>First-visit booking popup</h2>
        </div>
      </div>
      <form id="popupForm" class="admin-form form-grid">
        <label class="switch-row full">
          <input name="enabled" type="checkbox" ${popup.enabled ? "checked" : ""}>
          Show popup when customer opens website
        </label>
        <label>
          Popup title
          <input name="title" value="${VRK.escapeHtml(popup.title || "")}">
        </label>
        <label>
          Button label
          <input name="buttonLabel" value="${VRK.escapeHtml(popup.buttonLabel || "Book now")}">
        </label>
        <label class="full">
          Popup message
          <textarea name="message" rows="3">${VRK.escapeHtml(popup.message || "")}</textarea>
        </label>
        <label class="full">
          Popup image URL
          <input name="image" type="url" value="${VRK.escapeHtml(popup.image || "")}">
        </label>
        <label class="switch-row full">
          <input name="showOnEveryVisit" type="checkbox" ${popup.showOnEveryVisit ? "checked" : ""}>
          Show every visit instead of once per browser session
        </label>
        <button class="primary full" type="submit">Save popup settings</button>
      </form>
    `;

    sections.popup.querySelector("#popupForm").addEventListener("submit", savePopup);
  }

  async function savePopup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = VRK.formToObject(form);
    payload.enabled = form.elements.enabled.checked;
    payload.showOnEveryVisit = form.elements.showOnEveryVisit.checked;
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await VRK.request("/api/admin/popup", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload)
      });
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function renderSettings() {
    const business = state.data.business;
    sections.settings.innerHTML = `
      <div class="section-title">
        <div>
          <span class="eyebrow">Owner settings</span>
          <h2>Business, payment, and bill details</h2>
        </div>
      </div>
      <form id="settingsForm" class="admin-form form-grid">
        <label>
          Business name
          <input name="name" value="${VRK.escapeHtml(business.name)}" required>
        </label>
        <label>
          Invoice prefix
          <input name="invoicePrefix" value="${VRK.escapeHtml(business.invoicePrefix || "VRK")}">
        </label>
        <label class="full">
          Tagline
          <input name="tagline" value="${VRK.escapeHtml(business.tagline)}">
        </label>
        <label>
          Phone
          <input name="phone" value="${VRK.escapeHtml(business.phone)}">
        </label>
        <label>
          Email
          <input name="email" type="email" value="${VRK.escapeHtml(business.email)}">
        </label>
        <label class="full">
          Address
          <textarea name="address" rows="2">${VRK.escapeHtml(business.address)}</textarea>
        </label>
        <label>
          GST number
          <input name="gstNumber" value="${VRK.escapeHtml(business.gstNumber)}">
        </label>
        <label>
          UPI ID
          <input name="upiId" value="${VRK.escapeHtml(business.upiId)}">
        </label>
        <label class="full">
          UPI QR image URL
          <input name="qrImage" type="url" value="${VRK.escapeHtml(business.qrImage || "")}">
        </label>
        <label class="full">
          Bank details
          <textarea name="bankDetails" rows="3">${VRK.escapeHtml(business.bankDetails)}</textarea>
        </label>
        <label class="full">
          Payment instructions shown to customer
          <textarea name="paymentInstructions" rows="3">${VRK.escapeHtml(business.paymentInstructions)}</textarea>
        </label>
        <label class="full">
          Payment gateway note
          <textarea name="gatewayNote" rows="2">${VRK.escapeHtml(business.gatewayNote || "")}</textarea>
        </label>
        <label class="full">
          Bill terms, one per line
          <textarea name="terms" rows="4">${VRK.escapeHtml(VRK.linesToText(business.terms))}</textarea>
        </label>
        <label class="full">
          New admin PIN
          <input name="adminPin" type="password" placeholder="Leave blank to keep current PIN">
        </label>
        <button class="primary full" type="submit">Save owner settings</button>
      </form>
    `;

    sections.settings.querySelector("#settingsForm").addEventListener("submit", saveSettings);
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = VRK.formToObject(form);
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await VRK.request("/api/admin/business", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload)
      });
      if (payload.adminPin) {
        state.pin = payload.adminPin;
        sessionStorage.setItem("vrkAdminPin", payload.adminPin);
      }
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function showSection(section) {
    state.section = section;
    sectionButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === section));
    Object.entries(sections).forEach(([name, element]) => element.classList.toggle("hidden", name !== section));
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = loginForm.elements.pin.value.trim();
    VRK.setMessage(loginMessage, "Checking PIN...", "active");
    try {
      const result = await VRK.request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ pin })
      });
      if (!result.ok) {
        VRK.setMessage(loginMessage, "Wrong PIN.", "danger");
        return;
      }
      state.pin = pin;
      sessionStorage.setItem("vrkAdminPin", pin);
      await load();
    } catch (error) {
      VRK.setMessage(loginMessage, error.message, "danger");
    }
  });

  document.querySelector("#logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("vrkAdminPin");
    state.pin = "";
    adminApp.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  });

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section));
  });

  VRK.watchLiveChanges(() => {
    if (state.pin) load().catch(console.error);
  });

  if (state.pin) {
    load().catch(() => {
      sessionStorage.removeItem("vrkAdminPin");
      state.pin = "";
    });
  }
})();
