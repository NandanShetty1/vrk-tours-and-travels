(function () {
  const state = {
    auth: {
      configured: false,
      ready: false,
      app: null,
      instance: null,
      modules: null,
      user: null,
      admin: null
    },
    data: null,
    section: "bookings"
  };

  const loginPanel = document.querySelector("#loginPanel");
  const adminApp = document.querySelector("#adminApp");
  const loginForm = document.querySelector("#adminLoginForm");
  const loginMessage = document.querySelector("#adminLoginMessage");
  const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
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

  async function adminHeaders() {
    if (state.auth.user) {
      return { Authorization: `Bearer ${await state.auth.user.getIdToken()}` };
    }
    return {};
  }

  function collectionMeta(section) {
    return {
      cars: {
        endpoint: "/api/admin/cars",
        archive: "cars",
        title: "Cars",
        empty: "No cars added.",
        fields: [
          ["name", "Car name, letters and numbers only", "text", { required: true, pattern: "[A-Za-z0-9 ]+", placeholder: "Innova Crysta 7" }],
          ["brand", "Brand", "text", { required: true, placeholder: "Toyota" }],
          ["model", "Model", "text", { placeholder: "2024" }],
          [
            "vehicleNumber",
            "Vehicle number, example KA09AB1234",
            "text",
            {
              required: true,
              pattern: "[A-Za-z]{2}[0-9]{1,2}[A-Za-z]{1,3}[0-9]{1,4}",
              placeholder: "KA09AB1234",
              uppercase: true
            }
          ],
          ["category", "Category", "text", { required: true, placeholder: "Sedan, SUV, Tempo Traveller" }],
          ["seats", "Seats, example 4+1 or 5+1", "text", { required: true, pattern: "[0-9]+\\+[0-9]+|[0-9]+", placeholder: "4+1" }],
          ["luggageCapacity", "Luggage capacity", "number", { min: 0, step: 1, placeholder: "3" }],
          ["ac", "AC vehicle", "checkbox", { defaultChecked: true }],
          ["fuelType", "Fuel type", "select", { options: ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] }],
          ["image", "Image URL", "url"],
          ["localRate", "Local rate per km", "number", { min: 0, step: "0.01" }],
          ["outstationRate", "Outstation rate per km", "number", { min: 0, step: "0.01" }],
          ["extraKmRate", "Extra km rate", "number", { min: 0, step: "0.01" }],
          ["extraHourRate", "Extra hour rate", "number", { min: 0, step: "0.01" }],
          ["available", "Available for booking", "checkbox", { defaultChecked: true }],
          ["featured", "Featured car", "checkbox"],
          ["description", "Description shown to customer", "textarea"],
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
          ["title", "Package title", "text", { required: true, placeholder: "Coorg family tour package" }],
          ["packageType", "Package type", "text", { placeholder: "Family tour, temple tour, honeymoon trip" }],
          ["days", "Number of days", "number", { required: true, min: 1, step: 1 }],
          ["nights", "Number of nights", "number", { min: 0, step: 1 }],
          ["startingPlace", "Starting place", "text", { required: true, placeholder: "Mangaluru / Bengaluru" }],
          ["destinations", "Destinations covered", "text", { required: true, placeholder: "Coorg, Madikeri, Abbey Falls" }],
          ["suitableVehicles", "Suitable vehicles", "text", { placeholder: "Sedan, SUV, Tempo Traveller" }],
          ["price", "Starting price", "number", { required: true, min: 0, step: "0.01" }],
          ["driverAllowance", "Driver allowance", "number", { min: 0, step: "0.01" }],
          ["nightAllowance", "Night allowance", "number", { min: 0, step: "0.01" }],
          ["tollParkingInfo", "Toll and parking information", "textarea"],
          ["image", "Tour image URL or uploaded image", "url", { upload: true, placeholder: "Paste tour image URL or upload below" }],
          ["overview", "Customer overview", "textarea"],
          ["inclusions", "Inclusions, one per line", "textarea"],
          ["exclusions", "Exclusions, one per line", "textarea"],
          ["itinerary", "Day wise itinerary, one per line", "textarea"],
          ["terms", "Tour terms and conditions, one per line", "textarea"]
        ]
      },
      days: {
        endpoint: "/api/admin/day-packages",
        archive: "dayPackages",
        title: "One day packages",
        empty: "No one day packages added.",
        fields: [
          ["title", "Package title", "text", { required: true, placeholder: "Mysuru palace one day trip" }],
          ["packageType", "Package type", "text", { placeholder: "Temple, sightseeing, family trip" }],
          ["place", "Places covered", "text", { required: true, placeholder: "Mysuru Palace, Chamundi Hills, Brindavan Garden" }],
          ["hours", "Trip duration / hours", "text", { required: true, placeholder: "12 hours" }],
          ["price", "Starting price", "number", { required: true, min: 0, step: "0.01" }],
          ["image", "Image URL or uploaded image", "url", { upload: true, placeholder: "Paste image URL or upload below" }],
          ["overview", "Customer overview", "textarea"],
          ["highlights", "Package includes / highlights, one per line", "textarea"],
          ["exclusions", "Extra charges / not included, one per line", "textarea"],
          ["itinerary", "Day plan / itinerary, one per line", "textarea"],
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
    if (state.auth.configured && !state.auth.user) return;
    state.data = await VRK.request("/api/admin-data", { headers: await adminHeaders() });
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
      ["driver_assigned", "driver_accepted", "driver_arriving", "driver_reached", "trip_started", "on_trip"].includes(
        booking.status
      )
    ).length;
    const pending = bookings.filter((booking) => ["request_submitted", "under_review"].includes(booking.status)).length;
    const paymentReview = bookings.filter((booking) => booking.paymentStatus === "payment_submitted").length;
    const revenue = bookings
      .filter((booking) => !["cancelled_by_customer", "cancelled_by_admin", "rejected"].includes(booking.status))
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

  const tripTypeLabels = {
    local_rental: "Local rental",
    one_way: "One way",
    round_trip: "Round trip",
    one_day_package: "One day package",
    multi_day_package: "Multi day package",
    airport_transfer: "Airport transfer",
    custom_trip: "Custom trip"
  };

  function tripTypeLabel(booking) {
    return tripTypeLabels[booking.tripType] || "Custom trip";
  }

  const bookingStatusOptions = [
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

  const paymentStatusOptions = [
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

  function listText(value) {
    if (Array.isArray(value)) return value.join(" | ");
    return value || "";
  }

  function bookingTripDetails(booking) {
    return [
      ["Trip type", tripTypeLabel(booking)],
      ["WhatsApp", booking.whatsappNumber || booking.phone],
      ["Pickup time", booking.pickupTime],
      ["Luggage", booking.luggageCount || booking.luggageCount === 0 ? `${booking.luggageCount}` : ""],
      ["Vehicle preference", booking.vehiclePreference],
      ["Stops / destinations", listText(booking.multipleDestinations)],
      ["Local rental slab", booking.localRentalPackage],
      ["Days", booking.numberOfDays ? `${booking.numberOfDays}` : ""],
      ["Airport type", booking.airportTripMode],
      ["Airport", booking.airportName],
      ["Flight", booking.flightNumber],
      ["Terminal", booking.terminal],
      ["Flight time", booking.flightTime],
      ["Custom route", listText(booking.customDestinations)],
      ["Budget", booking.budget ? VRK.money(booking.budget) : ""],
      ["Special requirements", booking.specialRequirements]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
  }

  function bookingDetailSpans(details) {
    return details
      .map(([label, value]) => `<span><b>${VRK.escapeHtml(label)}</b>${VRK.escapeHtml(value)}</span>`)
      .join("");
  }

  function statusHistoryTimeline(booking) {
    const history = Array.isArray(booking.statusHistory) ? booking.statusHistory.slice(-6).reverse() : [];
    if (!history.length) {
      return `<div class="status-history"><b>Status history</b><small>No lifecycle history recorded yet.</small></div>`;
    }
    return `
      <div class="status-history">
        <b>Status history</b>
        ${history
          .map((entry) => {
            const changes = (entry.changes || [])
              .map((change) => `${change.label}: ${change.from || "empty"} to ${change.to || "empty"}`)
              .join("; ");
            return `<small>${VRK.dateTimeLabel(entry.at)} - ${VRK.escapeHtml(entry.by || entry.source || "system")}: ${VRK.escapeHtml(
              entry.note || changes
            )}</small>`;
          })
          .join("")}
      </div>
    `;
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

  const bookingCheckItems = [
    ["customerContacted", "Customer contacted"],
    ["routeVerified", "Pickup/drop verified"],
    ["scheduleConfirmed", "Date and time confirmed"],
    ["vehicleChecked", "Vehicle availability checked"],
    ["fareShared", "Final fare shared"],
    ["paymentChecked", "Payment proof checked"],
    ["driverInformed", "Driver informed"],
    ["tripCompleted", "Trip completed"]
  ];

  function bookingChecks(booking) {
    return { ...(booking.checks || {}) };
  }

  function bookingProgress(booking) {
    const checks = bookingChecks(booking);
    const done = bookingCheckItems.filter(([key]) => checks[key]).length;
    return Math.round((done / bookingCheckItems.length) * 100);
  }

  function nextBookingAction(booking) {
    const checks = bookingChecks(booking);
    if (["cancelled_by_customer", "cancelled_by_admin", "rejected"].includes(booking.status)) return "Booking stopped";
    if (booking.status === "request_submitted") return "Move to Under Review after checking the request";
    if (booking.status === "under_review") return "Prepare quotation and share route/fare details";
    if (booking.status === "quotation_accepted") return "Collect advance or mark advance pending";
    if (booking.status === "advance_pending") return "Wait for advance payment or follow up";
    if (booking.status === "advance_paid") return "Confirm booking and assign vehicle/driver";
    if (booking.status === "booking_confirmed") return "Assign driver and inform customer";
    if (booking.status === "trip_completed") return "Check balance payment and close bill";
    if (booking.status === "balance_pending") return "Collect final balance";
    if (booking.status === "fully_paid") return "Close booking after final verification";
    if (booking.status === "closed") return "Booking closed";
    if (!checks.customerContacted) return "Call or WhatsApp customer and confirm request";
    if (!checks.routeVerified || !checks.scheduleConfirmed) return "Verify route, date, time, passengers, and luggage";
    if (!checks.vehicleChecked || !booking.assignedCarId) return "Check car availability and assign vehicle";
    if (!booking.amount || booking.paymentStatus === "waiting_for_amount") return "Prepare final fare breakup and share amount";
    if (!checks.fareShared) return "Mark fare shared after customer confirmation";
    if (booking.paymentStatus === "payment_submitted" && !checks.paymentChecked) return "Verify payment proof and transaction ID";
    if (!booking.assignedDriverId || !checks.driverInformed) return "Assign/inform driver and share trip details";
    if (["driver_assigned", "driver_accepted", "driver_arriving", "driver_reached", "trip_started"].includes(booking.status)) {
      return "Monitor pickup and trip start";
    }
    if (booking.status === "on_trip" && !checks.tripCompleted) return "Follow trip and close after drop";
    return "Ready for final bill and completion";
  }

  function phoneDigits(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function contactLinks(booking) {
    const phone = phoneDigits(booking.phone);
    const whatsAppNumber = phoneDigits(booking.whatsappNumber || booking.phone);
    if (!phone && !whatsAppNumber) return "";
    const whatsAppPhone = whatsAppNumber.length === 10 ? `91${whatsAppNumber}` : whatsAppNumber;
    const message = encodeURIComponent(
      `Namaste ${booking.customerName}, this is VRK Tours and Travels about booking ${booking.id} for ${booking.packageTitle}.`
    );
    return `
      <div class="contact-actions">
        ${phone ? `<a class="ghost ticket-link" href="tel:${phone}">Call</a>` : ""}
        ${whatsAppPhone ? `<a class="ghost ticket-link" href="https://wa.me/${whatsAppPhone}?text=${message}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </div>
    `;
  }

  function bookingChecklistFields(booking) {
    const checks = bookingChecks(booking);
    return `
      <div class="booking-checklist full">
        <div>
          <b>Owner booking checks</b>
          <small>Use this before confirming payment, driver, and final bill.</small>
        </div>
        <div class="checklist-grid">
          ${bookingCheckItems
            .map(
              ([key, label]) => `
                <label class="switch-row">
                  <input name="${key}" type="checkbox" ${checks[key] ? "checked" : ""}>
                  ${label}
                </label>
              `
            )
            .join("")}
        </div>
      </div>
    `;
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
    const progress = bookingProgress(booking);
    return `
      <article class="booking-card">
        <div class="booking-main">
          <div>
            <span class="badge ${VRK.statusClass(booking.status)}">${VRK.statusLabel(booking.status)}</span>
            <span class="badge ${VRK.statusClass(booking.paymentStatus)}">${VRK.statusLabel(booking.paymentStatus)}</span>
            <span class="badge active">ID ${VRK.escapeHtml(booking.id)}</span>
            <h3>${VRK.escapeHtml(booking.packageTitle)}</h3>
            <p>${bookingTypeLabel(booking)} | ${VRK.dateLabel(booking.travelDate)} | ${VRK.escapeHtml(
      booking.passengers
    )} passengers</p>
          </div>
          <strong>${booking.amount ? VRK.money(booking.amount) : "Amount not set"}</strong>
        </div>
        <div class="booking-ops">
          <div>
            <span class="eyebrow">Next admin action</span>
            <strong>${VRK.escapeHtml(nextBookingAction(booking))}</strong>
          </div>
          <div class="ops-progress" aria-label="Booking checks ${progress}% complete">
            <span style="width:${progress}%"></span>
          </div>
          <small>${progress}% checks complete</small>
        </div>
        <div class="booking-detail-grid">
          <span><b>Customer</b>${VRK.escapeHtml(booking.customerName)} / ${VRK.escapeHtml(booking.phone)}</span>
          <span><b>Email</b>${VRK.escapeHtml(booking.email || "Not added")}</span>
          <span><b>Trip type</b>${VRK.escapeHtml(tripTypeLabel(booking))}</span>
          <span><b>Pickup time</b>${VRK.escapeHtml(booking.pickupTime || "Not added")}</span>
          <span><b>Pickup</b>${VRK.escapeHtml(booking.pickupLocation)}</span>
          <span><b>Drop</b>${VRK.escapeHtml(booking.dropLocation || "Not added")}</span>
          <span><b>Return</b>${VRK.escapeHtml(booking.returnDate ? VRK.dateLabel(booking.returnDate) : "One way / not added")}</span>
          <span><b>Driver</b>${VRK.escapeHtml(driver ? driver.name : "Not assigned")}</span>
          <span><b>Car</b>${VRK.escapeHtml(car ? car.name : "Not assigned")}</span>
          <span><b>Created</b>${VRK.dateTimeLabel(booking.createdAt)}</span>
          ${bookingDetailSpans(bookingTripDetails(booking).filter(([label]) => !["Trip type", "Pickup time", "WhatsApp"].includes(label)))}
        </div>
        ${contactLinks(booking)}
        ${booking.message ? `<p class="note-line">${VRK.escapeHtml(booking.message)}</p>` : ""}
        ${statusHistoryTimeline(booking)}
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
          ${bookingChecklistFields(booking)}
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
              ${bookingStatusOptions
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
              ${paymentStatusOptions
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
    bookingCheckItems.forEach(([key]) => {
      payload[key] = Boolean(form.elements[key] && form.elements[key].checked);
    });
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await VRK.request(`/api/admin/bookings/${bookingId}/assign`, {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify(payload)
      });
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function updateImagePreview(form, fieldName, value) {
    const preview = form.querySelector(`[data-image-preview="${fieldName}"]`);
    if (!preview) return;
    if (!value) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
      return;
    }
    preview.classList.remove("hidden");
    preview.innerHTML = `<img src="${VRK.escapeHtml(value)}" alt="Package image preview">`;
  }

  function resizeImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Choose a valid image file."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not load image preview."));
        img.onload = () => {
          const maxSize = 1200;
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const context = canvas.getContext("2d");
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function bindImageUploads(section, form) {
    sections[section].querySelectorAll("[data-image-upload]").forEach((input) => {
      input.addEventListener("change", async () => {
        const fieldName = input.dataset.imageUpload;
        const target = form.elements[fieldName];
        if (!target || !input.files || !input.files[0]) return;
        try {
          const dataUrl = await resizeImageFile(input.files[0]);
          target.value = dataUrl;
          updateImagePreview(form, fieldName, dataUrl);
        } catch (error) {
          alert(error.message);
          input.value = "";
        }
      });
    });
    sections[section].querySelectorAll("[data-image-value]").forEach((input) => {
      input.addEventListener("input", () => updateImagePreview(form, input.dataset.imageValue, input.value));
    });
  }

  function renderField(field, item) {
    const [name, label, type, config = {}] = field;
    const value = Array.isArray(item && item[name]) ? VRK.linesToText(item[name]) : (item && item[name]) || "";
    const attrs = [
      config.required ? "required" : "",
      config.pattern ? `pattern="${VRK.escapeHtml(config.pattern)}"` : "",
      config.placeholder ? `placeholder="${VRK.escapeHtml(config.placeholder)}"` : "",
      config.min !== undefined ? `min="${VRK.escapeHtml(config.min)}"` : "",
      config.step !== undefined ? `step="${VRK.escapeHtml(config.step)}"` : "",
      config.uppercase ? `data-uppercase="true"` : ""
    ]
      .filter(Boolean)
      .join(" ");
    if (type === "textarea") {
      return `
        <label class="full">
          ${label}
          <textarea name="${name}" rows="3">${VRK.escapeHtml(value)}</textarea>
        </label>
      `;
    }
    if (type === "checkbox") {
      const checked = item && item[name] !== undefined ? Boolean(item[name]) : Boolean(config.defaultChecked);
      return `
        <label class="switch-row full">
          <input name="${name}" type="checkbox" ${checked ? "checked" : ""}>
          ${label}
        </label>
      `;
    }
    if (type === "select") {
      const selectOptions = config.options || [];
      return `
        <label>
          ${label}
          <select name="${name}" ${config.required ? "required" : ""}>
            <option value="">Select ${VRK.escapeHtml(label.toLowerCase())}</option>
            ${selectOptions
              .map(
                (option) =>
                  `<option value="${VRK.escapeHtml(option)}" ${value === option ? "selected" : ""}>${VRK.escapeHtml(
                    option
                  )}</option>`
              )
              .join("")}
          </select>
        </label>
      `;
    }
    if (config.upload) {
      return `
        <label class="full image-upload-field">
          ${label}
          <input name="${name}" type="${type}" value="${VRK.escapeHtml(value)}" ${attrs} data-image-value="${name}">
          <input class="image-upload-input" type="file" accept="image/*" data-image-upload="${name}">
          <small>Upload a real trip/package image or paste a hosted image URL. Smaller images load faster for customers.</small>
          <div class="image-preview ${value ? "" : "hidden"}" data-image-preview="${name}">
            ${value ? `<img src="${VRK.escapeHtml(value)}" alt="${VRK.escapeHtml(label)} preview">` : ""}
          </div>
        </label>
      `;
    }
    return `
      <label>
        ${label}
        <input name="${name}" type="${type}" value="${VRK.escapeHtml(value)}" ${attrs}>
      </label>
    `;
  }

  function resetCollectionForm(form, meta) {
    form.reset();
    form.elements.id.value = "";
    form.elements.active.checked = true;
    meta.fields.forEach(([name, , type, config = {}]) => {
      if (type === "checkbox" && form.elements[name]) {
        form.elements[name].checked = Boolean(config.defaultChecked);
      }
      if (config.upload) {
        updateImagePreview(form, name, "");
      }
    });
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
    bindImageUploads(section, form);
    sections[section].querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => fillCollectionForm(section, button.dataset.edit));
    });
    sections[section].querySelectorAll("[data-archive]").forEach((button) => {
      button.addEventListener("click", () => archiveItem(section, button.dataset.archive));
    });
    sections[section].querySelectorAll("[data-show]").forEach((button) => {
      button.addEventListener("click", () => showItem(section, button.dataset.show));
    });
    sections[section].querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteItem(section, button.dataset.delete));
    });
    sections[section].querySelectorAll("[data-uppercase]").forEach((input) => {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      });
    });
  }

  function renderCollectionItem(section, item) {
    const title = item.name || item.title;
    const tourDuration =
      section === "tours"
        ? [item.days ? `${item.days} days` : "", item.nights ? `${item.nights} nights` : ""].filter(Boolean).join(" / ") ||
          item.duration
        : "";
    const subtitle =
      section === "cars"
        ? [
            item.brand,
            item.model,
            item.vehicleNumber,
            item.category,
            item.seats ? `${item.seats} seats` : "",
            item.available === false ? "unavailable" : "available"
          ]
            .filter(Boolean)
            .join(" | ")
        : section === "days"
          ? [item.packageType, item.place, item.hours].filter(Boolean).join(" | ")
          : section === "tours"
            ? [item.packageType, item.startingPlace, item.destinations || item.destination, tourDuration, item.suitableVehicles]
                .filter(Boolean)
                .join(" | ")
            : item.category || item.destination || item.place || item.phone;
    const price =
      section === "cars"
        ? [
            item.localRate ? `local ${item.localRate}/km` : "",
            item.outstationRate ? `outstation ${item.outstationRate}/km` : "",
            item.extraHourRate ? `extra hour ${item.extraHourRate}` : ""
          ]
            .filter(Boolean)
            .join(" | ")
        : section === "days" && item.price
          ? `starting ${item.price}`
          : section === "tours" && item.price
            ? `starting ${item.price}`
            : item.dayRate || item.price || item.rating;
    return `
      <article class="admin-row ${item.active ? "" : "muted"}">
        <div class="admin-row-main">
          ${
            (section === "days" || section === "tours") && item.image
              ? `<img class="admin-thumb" src="${VRK.escapeHtml(item.image)}" alt="${VRK.escapeHtml(title)}">`
              : ""
          }
          <div>
            <span class="badge ${item.active ? "good" : "danger"}">${item.active ? "active" : "hidden"}</span>
            ${
              section === "cars"
                ? `
                  <span class="badge ${item.available === false ? "warn" : "active"}">${
                    item.available === false ? "not available" : "available"
                  }</span>
                  ${item.featured ? `<span class="badge good">featured</span>` : ""}
                `
                : ""
            }
            ${section === "days" ? `<span class="badge active">one day</span>` : ""}
            ${section === "tours" ? `<span class="badge active">tour</span>` : ""}
            <h3>${VRK.escapeHtml(title)}</h3>
            <p>${VRK.escapeHtml(subtitle || "")}${price ? ` | ${VRK.escapeHtml(price)}` : ""}</p>
          </div>
        </div>
        <div class="row-actions">
          <button class="secondary" data-edit="${VRK.escapeHtml(item.id)}" type="button">Edit</button>
          ${
            item.active
              ? `<button class="ghost" data-archive="${VRK.escapeHtml(item.id)}" type="button">Hide</button>`
              : `<button class="ghost" data-show="${VRK.escapeHtml(item.id)}" type="button">Show</button>`
          }
          <button class="ghost danger-button" data-delete="${VRK.escapeHtml(item.id)}" type="button">Delete</button>
        </div>
      </article>
    `;
  }

  async function saveCollection(event, section) {
    event.preventDefault();
    const meta = collectionMeta(section);
    const form = event.currentTarget;
    const payload = VRK.formToObject(form);
    meta.fields.forEach(([name, , type]) => {
      if (type === "checkbox" && form.elements[name]) {
        payload[name] = form.elements[name].checked;
      }
    });
    payload.active = form.elements.active.checked;
    [
      "luggageCapacity",
      "localRate",
      "outstationRate",
      "extraKmRate",
      "extraHourRate",
      "ratePerKm",
      "dayRate",
      "price",
      "days",
      "nights",
      "driverAllowance",
      "nightAllowance",
      "rating",
      "sortOrder"
    ].forEach((field) => {
      if (payload[field] !== undefined && payload[field] !== "") payload[field] = Number(payload[field]);
    });
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await VRK.request(meta.endpoint, {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify(payload)
      });
      resetCollectionForm(form, meta);
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
    meta.fields.forEach(([name, , , config = {}]) => {
      if (!form.elements[name]) return;
      if (form.elements[name].type === "checkbox") {
        form.elements[name].checked = Boolean(item[name]);
      } else {
        form.elements[name].value = Array.isArray(item[name]) ? VRK.linesToText(item[name]) : item[name] || "";
      }
      if (config.upload) {
        updateImagePreview(form, name, form.elements[name].value);
      }
    });
    form.elements.active.checked = Boolean(item.active);
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function archiveItem(section, itemId) {
    const meta = collectionMeta(section);
    if (!confirm("Hide this item from customers?")) return;
    await VRK.request(`/api/admin/${meta.archive}/${itemId}/archive`, {
      method: "POST",
      headers: await adminHeaders()
    });
    await load();
  }

  async function showItem(section, itemId) {
    const meta = collectionMeta(section);
    await VRK.request(`/api/admin/${meta.archive}/${itemId}/show`, {
      method: "POST",
      headers: await adminHeaders()
    });
    await load();
  }

  async function deleteItem(section, itemId) {
    const meta = collectionMeta(section);
    const item = collectionFor(section).find((entry) => entry.id === itemId);
    const title = item ? item.name || item.title || item.phone || item.id : itemId;
    if (!confirm(`Permanently delete "${title}"? Use Hide instead if this item has booking history.`)) return;
    try {
      await VRK.request(`/api/admin/${meta.archive}/${itemId}/delete`, {
        method: "DELETE",
        headers: await adminHeaders()
      });
      await load();
    } catch (error) {
      alert(error.message);
    }
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
        headers: await adminHeaders(),
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
        headers: await adminHeaders(),
        body: JSON.stringify(payload)
      });
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

  async function verifyAdminSession(user) {
    const token = await user.getIdToken();
    const result = await VRK.request("/api/admin/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    state.auth.admin = result.admin;
    return result.admin;
  }

  function showLogin(message, tone) {
    adminApp.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    if (message) VRK.setMessage(loginMessage, message, tone || "");
  }

  function showAdminShell() {
    loginPanel.classList.add("hidden");
    adminApp.classList.remove("hidden");
    VRK.setMessage(loginMessage, "", "");
  }

  function authFriendlyError(error) {
    const code = error && error.code;
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return "Admin email or password is wrong.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many login attempts. Please wait and try again.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Enable Email/Password sign-in in Firebase Authentication.";
    }
    return (error && error.message) || "Admin login failed.";
  }

  async function setupAdminAuth() {
    const config = await VRK.request("/api/auth/config");
    state.auth.configured = Boolean(config.configured && config.firebaseConfig);
    if (!state.auth.configured) {
      showLogin("Firebase admin login is not configured in Render.", "danger");
      return;
    }
    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    state.auth.modules = authModule;
    state.auth.app = appModule.initializeApp(config.firebaseConfig);
    state.auth.instance = authModule.getAuth(state.auth.app);
    await authModule.setPersistence(state.auth.instance, authModule.browserSessionPersistence);
    authModule.onAuthStateChanged(state.auth.instance, async (user) => {
      state.auth.user = user;
      if (!user) {
        state.auth.admin = null;
        showLogin();
        return;
      }
      try {
        await verifyAdminSession(user);
        showAdminShell();
        await load();
      } catch (error) {
        state.auth.admin = null;
        await authModule.signOut(state.auth.instance);
        showLogin(error.message, "danger");
      }
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.auth.configured || !state.auth.modules || !state.auth.instance) {
      VRK.setMessage(loginMessage, "Firebase admin login is not ready. Check Render Firebase env vars.", "danger");
      return;
    }
    const email = String(loginForm.elements.email.value || "").trim();
    const password = String(loginForm.elements.password.value || "");
    VRK.setMessage(loginMessage, "Checking admin account...", "active");
    try {
      const credential = await state.auth.modules.signInWithEmailAndPassword(state.auth.instance, email, password);
      await verifyAdminSession(credential.user);
      await load();
    } catch (error) {
      VRK.setMessage(loginMessage, authFriendlyError(error), "danger");
    }
  });

  forgotPasswordButton.addEventListener("click", async () => {
    if (!state.auth.configured || !state.auth.modules || !state.auth.instance) {
      VRK.setMessage(loginMessage, "Firebase admin login is not ready.", "danger");
      return;
    }
    const email = String(loginForm.elements.email.value || "").trim();
    if (!email) {
      VRK.setMessage(loginMessage, "Enter admin email first, then click forgot password.", "danger");
      return;
    }
    try {
      await state.auth.modules.sendPasswordResetEmail(state.auth.instance, email);
      VRK.setMessage(loginMessage, "Password reset email sent. Check inbox and spam.", "good");
    } catch (error) {
      VRK.setMessage(loginMessage, authFriendlyError(error), "danger");
    }
  });

  document.querySelector("#logoutButton").addEventListener("click", async () => {
    state.auth.admin = null;
    state.auth.user = null;
    if (state.auth.modules && state.auth.instance) {
      await state.auth.modules.signOut(state.auth.instance);
    }
    showLogin("Logged out.", "good");
  });

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section));
  });

  VRK.watchLiveChanges(() => {
    if (state.auth.user) load().catch(console.error);
  });

  setupAdminAuth().catch((error) => showLogin(error.message, "danger"));
})();
