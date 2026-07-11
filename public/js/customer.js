(function () {
  const state = {
    data: null,
    tab: "cars",
    selected: null,
    infoItem: null,
    heroTimer: null,
    customerProfile: null,
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
      return JSON.parse(sessionStorage.getItem("vrkCustomerProfile") || "null");
    } catch {
      return null;
    }
  }

  function saveCustomerProfile(profile) {
    state.customerProfile = profile;
    sessionStorage.setItem("vrkCustomerProfile", JSON.stringify(profile));
    renderCustomerAccount();
    applyCustomerProfile();
  }

  function clearCustomerProfile() {
    const previous = state.customerProfile;
    state.customerProfile = null;
    sessionStorage.removeItem("vrkCustomerProfile");
    renderCustomerAccount();
    if (previous && customerLoginForm.elements) {
      customerLoginForm.elements.customerName.value = previous.customerName || "";
      customerLoginForm.elements.phone.value = previous.phone || "";
      customerLoginForm.elements.email.value = previous.email || "";
    }
  }

  function applyCustomerProfile() {
    if (!state.customerProfile) return;
    [bookingForm, modalBookingForm].forEach((form) => {
      if (!form || !form.elements) return;
      ["customerName", "phone", "email"].forEach((field) => {
        if (form.elements[field] && state.customerProfile[field]) {
          form.elements[field].value = state.customerProfile[field];
        }
      });
    });
  }

  function renderCustomerAccount() {
    const profile = state.customerProfile;
    if (!profile) {
      customerAccountStatus.textContent = "Use mobile number or email so your booking form is filled correctly.";
      accountButtonLabel.textContent = "Sign in";
      accountAvatar.textContent = "?";
      accountButton.classList.remove("signed-in");
      customerLoginForm.classList.remove("hidden");
      providerLoginRow.classList.remove("hidden");
      customerAccountSummary.classList.add("hidden");
      customerAccountSummary.innerHTML = "";
      return;
    }
    customerAccountStatus.textContent = "Signed in for this browser session.";
    accountButtonLabel.textContent = profile.customerName.split(/\s+/)[0] || "Account";
    accountAvatar.textContent = (profile.customerName || "A").slice(0, 1).toUpperCase();
    accountButton.classList.add("signed-in");
    customerLoginForm.classList.add("hidden");
    providerLoginRow.classList.add("hidden");
    customerAccountSummary.classList.remove("hidden");
    customerAccountSummary.innerHTML = `
      <div>
        <strong>${VRK.escapeHtml(profile.customerName)}</strong>
        <small>${VRK.escapeHtml(profile.phone)}${profile.email ? ` | ${VRK.escapeHtml(profile.email)}` : ""}</small>
      </div>
      <button class="ghost" data-customer-logout type="button">Change</button>
    `;
  }

  function openAccountModal() {
    accountModal.classList.remove("hidden");
  }

  function closeAccountModal() {
    accountModal.classList.add("hidden");
  }

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

  function kindForItem(item) {
    return (item && item.bookingType) || bookingTypeForTab();
  }

  function titleForItem(item) {
    return item.name || item.title || "Custom travel enquiry";
  }

  function amountForItem(item) {
    if (!item) return 0;
    return kindForItem(item) === "car" ? item.dayRate : item.price;
  }

  function priceForItem(item) {
    if (kindForItem(item) === "car" && item.dayRate !== undefined) {
      return `${VRK.money(item.dayRate)} per day / INR ${item.ratePerKm || 0} per km`;
    }
    return `${VRK.money(item.price)} starting price`;
  }

  function detailForItem(item) {
    const kind = kindForItem(item);
    if (kind === "car") {
      return `${item.category || "Car"} | ${item.seats || 4} seats | ${item.fuel || "Fuel"} | ${
        item.luggage || "Luggage"
      }`;
    }
    if (kind === "tour") {
      return `${item.packageType || "Tour"} | ${item.destination || "Destination"} | ${item.duration || "Duration"}`;
    }
    return `${item.packageType || "One day"} | ${item.place || "Place"} | ${item.hours || "Hours"}`;
  }

  function tagsForItem(item) {
    return item.features || item.inclusions || item.highlights || [];
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
            <button class="ghost" data-details="${VRK.escapeHtml(item.id)}" type="button">Details</button>
            <button class="secondary" data-book="${VRK.escapeHtml(item.id)}" type="button">Book</button>
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
    state.infoItem = service;
    infoEyebrow.textContent = detailForItem(service);
    infoTitle.textContent = titleForItem(service);
    infoSubtitle.textContent = service.overview || "Owner will confirm exact fare, vehicle, driver, and payment before trip.";
    infoBody.innerHTML = `
      <div class="info-price">
        <span>Starting price</span>
        <strong>${priceForItem(service)}</strong>
      </div>
      ${itemList("Included", includedForItem(service))}
      ${itemList("Extra charges / excluded", excludedForItem(service))}
      ${itemList("Itinerary", service.itinerary)}
      ${itemList("Terms and conditions", service.terms)}
    `;
    infoBook.classList.remove("hidden");
    infoModal.classList.remove("hidden");
  }

  function closeInfoModal() {
    infoModal.classList.add("hidden");
    state.infoItem = null;
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
    renderFooter();
    if (!state.selected) {
      const first = itemByTab()[0] || allItems()[0] || null;
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

  customerLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = VRK.formToObject(customerLoginForm);
    const profile = {
      customerName: String(payload.customerName || "").trim(),
      phone: String(payload.phone || "").trim(),
      email: String(payload.email || "").trim()
    };
    if (!profile.customerName || !profile.phone) {
      VRK.setMessage(customerLoginMessage, "Enter customer name and mobile number.", "danger");
      return;
    }
    saveCustomerProfile(profile);
    VRK.setMessage(customerLoginMessage, "", "");
    closeAccountModal();
  });

  accountButton.addEventListener("click", openAccountModal);
  accountClose.addEventListener("click", closeAccountModal);
  accountModal.addEventListener("click", (event) => {
    if (event.target === accountModal) closeAccountModal();
  });

  authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      authModeButtons.forEach((item) => item.classList.toggle("active", item === button));
      const isSignup = button.dataset.authMode === "signup";
      document.querySelector("#customer-account-title").textContent = isSignup ? "Create customer account" : "Login to customer account";
      customerLoginForm.querySelector("button[type='submit']").textContent = isSignup ? "Create account" : "Continue securely";
      customerAccountStatus.textContent = isSignup
        ? "Create account with verified mobile or email before booking."
        : "Login with verified mobile, email, or social account.";
    });
  });

  document.body.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-select]");
    const detailsButton = event.target.closest("[data-details]");
    const bookButton = event.target.closest("[data-book]");
    const bannerInfo = event.target.closest("[data-banner-info]");
    const openButton = event.target.closest("[data-open-booking]");
    const providerButton = event.target.closest("[data-auth-provider]");
    const customerLogout = event.target.closest("[data-customer-logout]");

    if (selectButton || bookButton) {
      const id = (selectButton || bookButton).dataset.select || (selectButton || bookButton).dataset.book;
      const item = itemByTab().find((entry) => entry.id === id);
      if (item) setSelected({ ...item, bookingType: bookingTypeForTab() }, Boolean(bookButton));
    }

    if (detailsButton) {
      const item = itemByTab().find((entry) => entry.id === detailsButton.dataset.details);
      if (item) openServiceInfo({ ...item, bookingType: bookingTypeForTab() });
    }

    if (bannerInfo) {
      const banner = (state.data.banners || []).find((item) => item.id === bannerInfo.dataset.bannerInfo);
      if (banner) openBannerInfo(banner);
    }

    if (openButton) openBookingModal();

    if (providerButton) {
      VRK.setMessage(
        customerLoginMessage,
        `${providerButton.dataset.authProvider} sign in needs production OAuth keys before enabling.`,
        "active"
      );
    }

    if (customerLogout) clearCustomerProfile();
  });

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
  state.customerProfile = loadCustomerProfile();
  renderCustomerAccount();
  VRK.watchLiveChanges(load);
  load().catch((error) => {
    catalog.innerHTML = `<div class="empty-state">${VRK.escapeHtml(error.message)}</div>`;
  });
})();
