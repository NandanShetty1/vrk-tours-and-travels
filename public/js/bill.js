(function () {
  const root = document.querySelector("#billRoot");
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("id") || "";
  const trackingPhone = params.get("phone") || "";
  const trackingCode = params.get("code") || params.get("trackingCode") || "";

  function rows(items, amount) {
    if (!items || !items.length) {
      return `<tr><td>Owner confirmed fare</td><td>${VRK.money(amount)}</td></tr>`;
    }
    return items
      .map((item) => `<tr><td>${VRK.escapeHtml(item.label)}</td><td>${VRK.money(item.amount)}</td></tr>`)
      .join("");
  }

  function list(items) {
    if (!items || !items.length) return `<li>As confirmed by owner/admin</li>`;
    return items.map((item) => `<li>${VRK.escapeHtml(item)}</li>`).join("");
  }

  function paymentLine(booking) {
    if (!booking.payment) return "Payment not submitted";
    return `${booking.payment.paymentMethod} | ${booking.payment.transactionId || "reference not provided"} | ${VRK.money(
      booking.payment.paidAmount
    )}`;
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

  function listText(value) {
    if (Array.isArray(value)) return value.join(" | ");
    return value || "";
  }

  function tripDetails(booking) {
    return [
      ["Trip type", tripTypeLabels[booking.tripType] || "Custom trip"],
      ["Pickup time", booking.pickupTime],
      ["WhatsApp", booking.whatsappNumber],
      ["Luggage", booking.luggageCount || booking.luggageCount === 0 ? `${booking.luggageCount}` : ""],
      ["Vehicle preference", booking.vehiclePreference],
      ["Stops", listText(booking.multipleDestinations)],
      ["Local rental", booking.localRentalPackage],
      ["Days", booking.numberOfDays ? `${booking.numberOfDays}` : ""],
      ["Airport", booking.airportName],
      ["Flight", booking.flightNumber],
      ["Terminal", booking.terminal],
      ["Flight time", booking.flightTime],
      ["Custom route", listText(booking.customDestinations)],
      ["Budget", booking.budget ? VRK.money(booking.budget) : ""],
      ["Special requirements", booking.specialRequirements]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
  }

  function detailList(details) {
    return details.map(([label, value]) => `<p><b>${VRK.escapeHtml(label)}</b>${VRK.escapeHtml(value)}</p>`).join("");
  }

  function render(data) {
    const { business, booking } = data;
    const invoiceNo = `${business.invoicePrefix || "VRK"}-${booking.id}`;
    root.innerHTML = `
      <section class="ticket">
        <div class="ticket-actions no-print">
          <a class="ghost" href="/">Back</a>
          <button class="primary" type="button" id="printButton">Print / Save PDF</button>
        </div>

        <header class="ticket-head">
          <div>
            <span class="brand-mark">VRK</span>
            <h1>${VRK.escapeHtml(business.name)}</h1>
            <p>${VRK.escapeHtml(business.tagline || "Car booking and travel packages")}</p>
          </div>
          <div class="ticket-id">
            <span>Booking Bill</span>
            <strong>${VRK.escapeHtml(invoiceNo)}</strong>
            <small>${VRK.dateTimeLabel(booking.createdAt)}</small>
          </div>
        </header>

        <div class="ticket-status">
          <span class="badge ${VRK.statusClass(booking.status)}">${VRK.statusLabel(booking.status)}</span>
          <span class="badge ${VRK.statusClass(booking.paymentStatus)}">${VRK.statusLabel(booking.paymentStatus)}</span>
          <strong>Total: ${VRK.money(booking.amount)}</strong>
        </div>

        <section class="ticket-grid">
          <article>
            <h2>Customer</h2>
            <p><b>Name</b>${VRK.escapeHtml(booking.customerName)}</p>
            <p><b>Phone</b>${VRK.escapeHtml(booking.phone)}</p>
            <p><b>Email</b>${VRK.escapeHtml(booking.email || "Not provided")}</p>
            <p><b>Passengers</b>${VRK.escapeHtml(booking.passengers)}</p>
          </article>
          <article>
            <h2>Journey</h2>
            <p><b>Service</b>${VRK.escapeHtml(booking.packageTitle)}</p>
            <p><b>Travel date</b>${VRK.dateLabel(booking.travelDate)}</p>
            <p><b>Pickup time</b>${VRK.escapeHtml(booking.pickupTime || "Not added")}</p>
            <p><b>Pickup</b>${VRK.escapeHtml(booking.pickupLocation)}</p>
            <p><b>Drop</b>${VRK.escapeHtml(booking.dropLocation || "Not added")}</p>
          </article>
          <article>
            <h2>Vehicle & Driver</h2>
            <p><b>Car</b>${VRK.escapeHtml(booking.car ? booking.car.name : "Not assigned")}</p>
            <p><b>Driver</b>${VRK.escapeHtml(booking.driver ? booking.driver.name : "Not assigned")}</p>
            <p><b>Driver phone</b>${VRK.escapeHtml(booking.driver ? booking.driver.phone : "Not assigned")}</p>
            <p><b>Payment</b>${VRK.escapeHtml(paymentLine(booking))}</p>
          </article>
        </section>

        <section class="ticket-grid two">
          <article>
            <h2>Trip Details</h2>
            ${detailList(tripDetails(booking))}
          </article>
          <article>
            <h2>Customer Notes</h2>
            <p>${VRK.escapeHtml(booking.message || "No extra notes added")}</p>
          </article>
        </section>

        <section class="fare-table-wrap">
          <h2>Fare Breakup</h2>
          <table class="fare-table">
            <tbody>
              ${rows(booking.costItems, booking.amount)}
            </tbody>
            <tfoot>
              <tr><th>Total payable</th><th>${VRK.money(booking.amount)}</th></tr>
              <tr><th>Paid</th><th>${VRK.money(booking.paidAmount)}</th></tr>
              <tr><th>Balance</th><th>${VRK.money(booking.balanceAmount)}</th></tr>
            </tfoot>
          </table>
        </section>

        <section class="ticket-grid two">
          <article>
            <h2>Included</h2>
            <ul>${list(booking.includedItems)}</ul>
          </article>
          <article>
            <h2>Extra / Excluded</h2>
            <ul>${list(booking.excludedItems)}</ul>
          </article>
        </section>

        <section class="ticket-foot">
          <div>
            <h2>Payment Details</h2>
            <p>${VRK.escapeHtml(business.paymentInstructions || "Owner will share payment details after confirmation.")}</p>
            ${business.qrImage ? `<img class="bill-qr" src="${VRK.escapeHtml(business.qrImage)}" alt="Payment QR">` : ""}
            ${business.upiId ? `<p><b>UPI</b>${VRK.escapeHtml(business.upiId)}</p>` : ""}
            ${business.bankDetails ? `<p><b>Bank</b>${VRK.escapeHtml(business.bankDetails)}</p>` : ""}
          </div>
          <div class="qr-box">
            <span>${VRK.escapeHtml(booking.id)}</span>
          </div>
        </section>

        <section class="terms">
          <h2>Terms</h2>
          <ul>${list(business.terms)}</ul>
        </section>
      </section>
    `;
    document.querySelector("#printButton").addEventListener("click", () => window.print());
  }

  if (!bookingId || !trackingPhone || !trackingCode) {
    root.innerHTML = `<div class="empty-state">Booking ID, registered mobile number, and tracking code are required to open this bill.</div>`;
  } else {
    VRK.request(
      `/api/bill/${encodeURIComponent(bookingId)}?phone=${encodeURIComponent(trackingPhone)}&trackingCode=${encodeURIComponent(
        trackingCode
      )}`
    )
      .then(render)
      .catch((error) => {
        root.innerHTML = `<div class="empty-state">${VRK.escapeHtml(error.message)}</div>`;
      });
  }
})();
