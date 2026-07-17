(function () {
  async function request(path, options) {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {})
      },
      ...options
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  function money(value) {
    return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
  }

  function dateLabel(value) {
    if (!value) return "Not set";
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function dateTimeLabel(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const statusLabels = {
    request_submitted: "Request Submitted",
    under_review: "Under Review",
    quotation_accepted: "Quotation Accepted",
    advance_pending: "Advance Pending",
    advance_paid: "Advance Paid",
    booking_confirmed: "Booking Confirmed",
    driver_assigned: "Driver assigned",
    driver_accepted: "Driver accepted",
    driver_arriving: "Driver arriving",
    driver_reached: "Driver reached",
    trip_started: "Trip started",
    on_trip: "On trip",
    trip_completed: "Trip Completed",
    balance_pending: "Balance pending",
    fully_paid: "Fully paid",
    closed: "Closed",
    rejected: "Rejected",
    cancelled_by_customer: "Cancelled by customer",
    cancelled_by_admin: "Cancelled by admin",
    refund_pending: "Refund pending",
    refunded: "Refunded",
    waiting_for_amount: "Quotation pending",
    payment_submitted: "Payment submitted",
    not_required: "Not required",
    pending_owner_confirmation: "Request Submitted",
    confirmed_waiting_payment: "Advance Pending",
    payment_required: "Advance Pending",
    payment_verified: "Booking Confirmed",
    assigned: "Driver assigned",
    completed: "Trip Completed",
    cancelled: "Cancelled by admin",
    paid: "Fully paid"
  };

  function statusLabel(value) {
    return statusLabels[value] || String(value || "pending").replace(/_/g, " ");
  }

  function statusClass(value) {
    const status = String(value || "pending");
    if (["trip_completed", "fully_paid", "closed", "advance_paid", "refunded", "completed", "paid", "payment_verified"].includes(status)) {
      return "good";
    }
    if (["rejected", "cancelled_by_customer", "cancelled_by_admin", "refund_pending", "cancelled"].includes(status)) return "danger";
    if (
      [
        "booking_confirmed",
        "driver_assigned",
        "driver_accepted",
        "driver_arriving",
        "driver_reached",
        "trip_started",
        "on_trip",
        "payment_submitted",
        "assigned"
      ].includes(status)
    ) {
      return "active";
    }
    return "warn";
  }

  function setMessage(element, message, tone) {
    element.textContent = message || "";
    element.dataset.tone = tone || "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function linesToText(items) {
    return (items || []).join("\n");
  }

  function formToObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function watchLiveChanges(callback) {
    const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!isLocal || !window.EventSource) {
      const timer = window.setInterval(callback, 30000);
      return { close: () => window.clearInterval(timer) };
    }
    const events = new EventSource("/api/events");
    events.addEventListener("change", callback);
    return events;
  }

  window.VRK = {
    request,
    money,
    dateLabel,
    dateTimeLabel,
    statusLabel,
    statusClass,
    setMessage,
    escapeHtml,
    linesToText,
    formToObject,
    watchLiveChanges
  };
})();
