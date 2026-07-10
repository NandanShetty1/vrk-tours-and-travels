(function () {
  const state = {
    data: null,
    tab: "cars",
    selected: null,
    popupShown: false
  };

  const heroCarousel = document.querySelector("#heroCarousel");
  const catalog = document.querySelector("#catalog");
  const galleryGrid = document.querySelector("#galleryGrid");
  const bookingForm = document.querySelector("#bookingForm");
  const modalBookingForm = document.querySelector("#modalBookingForm");
  const bookingModal = document.querySelector("#bookingModal");
  const modalClose = document.querySelector("#modalClose");
  const trackForm = document.querySelector("#trackForm");
  const trackResult = document.querySelector("#trackResult");
  const bookingMessage = document.querySelector("#bookingMessage");
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));

  function itemByTab() {
    if (!state.data) return [];
    if (state.tab === "cars") return state.data.cars;
    if (state.tab === "tours") return state.data.tourPackages;
    return state.data.dayPackages;
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

  function titleForItem(item) {
    return item.name || item.title || "Custom travel enquiry";
  }

  function amountForItem(item) {
    if (!item) return 0;
    return state.tab === "cars" || item.bookingType === "car" ? item.dayRate : item.price;
  }

  function priceForItem(item) {
    if ((state.tab === "cars" || item.bookingType === "car") && item.dayRate !== undefined) {
      return `${VRK.money(item.dayRate)} per day / INR ${item.ratePerKm || 0} per km`;
    }
    return `${VRK.money(item.price)} starting price`;
  }

  function detailForItem(item) {
    if (state.tab === "cars" || item.bookingType === "car") {
      return `${item.category || "Car"} | ${item.seats || 4} seats | ${item.fuel || "Fuel"} | ${
        item.luggage || "Luggage"
      }`;
    }
    if (state.tab === "tours" || item.bookingType === "tour") {
      return `${item.packageType || "Tour"} | ${item.destination || "Destination"} | ${item.duration || "Duration"}`;
    }
    return `${item.packageType || "One day"} | ${item.place || "Place"} | ${item.hours || "Hours"}`;
  }

  function tagsForItem(item) {
    return item.features || item.inclusions || item.highlights || [];
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
    if (!banners.length) {
      heroCarousel.innerHTML = `
        <article class="hero-slide" style="${styleForText("VRK Tours")}">
          <div>
            <span class="eyebrow">VRK Tours and Travels</span>
            <h1>Cars, one way trips, tours, and day packages</h1>
            <p>Owner-confirmed pricing, driver assignment, and printable booking bill.</p>
            <button class="primary" data-open-booking type="button">Book now</button>
          </div>
        </article>
      `;
      return;
    }

    heroCarousel.innerHTML = banners
      .map(
        (banner) => `
          <article class="hero-slide" style="${
            banner.image
              ? `background-image: linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.18)), url('${VRK.escapeHtml(
                  banner.image
                )}')`
              : styleForText(banner.prompt || banner.title)
          }">
            <div>
              <span class="eyebrow">${VRK.escapeHtml(banner.prompt || "Featured offer")}</span>
              <h1>${VRK.escapeHtml(banner.title)}</h1>
              <p>${VRK.escapeHtml(banner.subtitle || "Book now and owner will confirm the best travel plan.")}</p>
              <button class="primary" data-banner-book="${VRK.escapeHtml(banner.id)}" type="button">
                ${VRK.escapeHtml(banner.ctaLabel || "Book now")}
              </button>
            </div>
          </article>
        `
      )
      .join("");
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
          <p>${VRK.escapeHtml(item.overview || "Comfortable service with owner-confirmed fare and verified driver.")}</p>
          <div class="tag-row">
            ${tagsForItem(item).slice(0, 4).map((tag) => `<span>${VRK.escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="card-actions">
            <button class="ghost" data-select="${VRK.escapeHtml(item.id)}" type="button">Select</button>
            <button class="secondary" data-book="${VRK.escapeHtml(item.id)}" type="button">Book</button>
          </div>
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

  function renderGallery() {
    const items = state.data.gallery || [];
    if (!items.length) {
      galleryGrid.innerHTML = `<div class="empty-state">Gallery will appear after owner adds completed trip photos or videos.</div>`;
      return;
    }
    galleryGrid.innerHTML = items
      .map(
        (item) => `
          <article class="gallery-card">
            ${
              item.mediaType === "video"
                ? `<video src="${VRK.escapeHtml(item.mediaUrl)}" controls preload="metadata"></video>`
                : `<img src="${VRK.escapeHtml(item.mediaUrl)}" alt="${VRK.escapeHtml(item.title)}" loading="lazy">`
            }
            <div>
              <h3>${VRK.escapeHtml(item.title)}</h3>
              <p>${VRK.escapeHtml(item.caption || "")}</p>
              <div class="tag-row">${(item.tags || [])
                .slice(0, 3)
                .map((tag) => `<span>${VRK.escapeHtml(tag)}</span>`)
                .join("")}</div>
            </div>
          </article>
        `
      )
      .join("");
  }

  function setSelected(item, openModal) {
    state.selected = item || null;
    document.querySelectorAll(".selected-strip").forEach((strip) => {
      strip.textContent = state.selected
        ? `${titleForItem(state.selected)} selected - ${priceForItem(state.selected)}`
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
    if (!state.selected) {
      const first = itemByTab()[0] || allItems()[0] || null;
      setSelected(first, false);
    } else {
      renderCatalog();
      updateFormSelection(bookingForm);
      updateFormSelection(modalBookingForm);
    }
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

  document.body.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-select]");
    const bookButton = event.target.closest("[data-book]");
    const bannerButton = event.target.closest("[data-banner-book]");
    const openButton = event.target.closest("[data-open-booking]");

    if (selectButton || bookButton) {
      const id = (selectButton || bookButton).dataset.select || (selectButton || bookButton).dataset.book;
      const item = itemByTab().find((entry) => entry.id === id);
      if (item) setSelected({ ...item, bookingType: bookingTypeForTab() }, Boolean(bookButton));
    }

    if (bannerButton) {
      const banner = (state.data.banners || []).find((item) => item.id === bannerButton.dataset.bannerBook);
      const target = banner && banner.targetId ? allItems().find((item) => item.id === banner.targetId) : allItems()[0];
      setSelected(target || null, true);
    }

    if (openButton) openBookingModal();
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
