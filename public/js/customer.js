(function () {
  const state = {
    data: null,
    tab: "cars",
    selected: null
  };

  const catalog = document.querySelector("#catalog");
  const bookingForm = document.querySelector("#bookingForm");
  const trackForm = document.querySelector("#trackForm");
  const trackResult = document.querySelector("#trackResult");
  const selectedStrip = document.querySelector("#selectedStrip");
  const bookingMessage = document.querySelector("#bookingMessage");
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));

  function itemByTab() {
    if (!state.data) return [];
    if (state.tab === "cars") return state.data.cars;
    if (state.tab === "tours") return state.data.tourPackages;
    return state.data.dayPackages;
  }

  function bookingTypeForTab() {
    if (state.tab === "cars") return "car";
    if (state.tab === "tours") return "tour";
    return "day";
  }

  function titleForItem(item) {
    return item.name || item.title;
  }

  function priceForItem(item) {
    if (state.tab === "cars") {
      return `${VRK.money(item.dayRate)} per day / INR ${item.ratePerKm} per km`;
    }
    return `${VRK.money(item.price)} starting price`;
  }

  function detailForItem(item) {
    if (state.tab === "cars") {
      return `${item.category} | ${item.seats} seats | ${item.fuel || "Fuel"} | ${item.luggage || "Luggage"}`;
    }
    if (state.tab === "tours") {
      return `${item.packageType || "Tour"} | ${item.destination} | ${item.duration}`;
    }
    return `${item.packageType || "One day"} | ${item.place} | ${item.hours}`;
  }

  function tagsForItem(item) {
    return item.features || item.inclusions || item.highlights || [];
  }

  function card(item) {
    const selected = state.selected && state.selected.id === item.id;
    return `
      <article class="service-card ${selected ? "selected" : ""}">
        ${
          item.image
            ? `<img src="${VRK.escapeHtml(item.image)}" alt="${VRK.escapeHtml(titleForItem(item))}" loading="lazy">`
            : `<div class="image-placeholder">${VRK.escapeHtml(titleForItem(item))}</div>`
        }
        <div class="service-body">
          <div class="service-topline">
            <span>${VRK.escapeHtml(detailForItem(item))}</span>
            <strong>${priceForItem(item)}</strong>
          </div>
          <h3>${VRK.escapeHtml(titleForItem(item))}</h3>
          <p>${VRK.escapeHtml(item.overview || "Comfortable vehicle with verified driver and business support.")}</p>
          <div class="tag-row">
            ${tagsForItem(item).slice(0, 4).map((tag) => `<span>${VRK.escapeHtml(tag)}</span>`).join("")}
          </div>
          <button class="secondary" data-select="${VRK.escapeHtml(item.id)}" type="button">
            ${selected ? "Selected" : "Select for booking"}
          </button>
        </div>
      </article>
    `;
  }

  function renderCatalog() {
    const items = itemByTab();
    if (!items.length) {
      catalog.innerHTML = `<div class="empty-state">Owner has not published active items in this section yet.</div>`;
      return;
    }
    catalog.innerHTML = items.map(card).join("");
  }

  function setSelected(item) {
    state.selected = item;
    const type = bookingTypeForTab();
    document.querySelector("#bookingType").value = type;
    document.querySelector("#packageId").value = item.id;
    document.querySelector("#packageTitle").value = titleForItem(item);
    document.querySelector("#amount").value = state.tab === "cars" ? item.dayRate : item.price;
    selectedStrip.textContent = `${titleForItem(item)} selected - ${priceForItem(item)}`;
    renderCatalog();
  }

  async function load() {
    state.data = await VRK.request("/api/public-data");
    if (!state.selected) {
      const first = itemByTab()[0];
      if (first) setSelected(first);
    } else {
      renderCatalog();
    }
  }

  tabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.selected = null;
      tabs.forEach((item) => item.classList.toggle("active", item === button));
      const first = itemByTab()[0];
      if (first) setSelected(first);
      renderCatalog();
    });
  });

  catalog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select]");
    if (!button) return;
    const item = itemByTab().find((entry) => entry.id === button.dataset.select);
    if (item) setSelected(item);
  });

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selected) {
      VRK.setMessage(bookingMessage, "Please select a car or package first.", "danger");
      return;
    }

    const submitButton = bookingForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    VRK.setMessage(bookingMessage, "Sending booking request...", "active");

    try {
      const payload = VRK.formToObject(bookingForm);
      payload.passengers = Number(payload.passengers || 1);
      payload.amount = Number(payload.amount || 0);
      const result = await VRK.request("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      VRK.setMessage(
        bookingMessage,
        `Booking created: ${result.booking.id}. Owner will confirm final amount before payment.`,
        "good"
      );
      trackForm.elements.bookingId.value = result.booking.id;
      renderTrackedBooking(result.booking);
      bookingForm.reset();
      setSelected(state.selected);
    } catch (error) {
      VRK.setMessage(bookingMessage, error.message, "danger");
    } finally {
      submitButton.disabled = false;
    }
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

  function paymentForm(booking) {
    if (booking.paymentStatus === "payment_submitted") {
      return `<p class="note-line">Payment details submitted. Owner will verify and update the bill.</p>`;
    }
    if (["paid", "advance_paid"].includes(booking.paymentStatus)) {
      return `<p class="note-line">Payment verified by owner.</p>`;
    }
    if (!canSubmitPayment(booking)) return "";
    return `
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
            <option value="Bank transfer">Bank transfer</option>
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
        <small>${VRK.dateLabel(booking.travelDate)} | ${booking.amount ? VRK.money(booking.amount) : "Owner amount pending"}</small>
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

  VRK.watchLiveChanges(load);
  load().catch((error) => {
    catalog.innerHTML = `<div class="empty-state">${VRK.escapeHtml(error.message)}</div>`;
  });
})();
