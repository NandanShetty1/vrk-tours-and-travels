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

  function statusLabel(value) {
    return String(value || "pending").replace(/_/g, " ");
  }

  function statusClass(value) {
    const status = String(value || "pending");
    if (["completed", "paid", "advance_paid", "payment_verified"].includes(status)) return "good";
    if (["cancelled"].includes(status)) return "danger";
    if (["assigned", "driver_accepted", "on_trip", "payment_submitted"].includes(status)) return "active";
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
    if (!window.EventSource) return null;
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
