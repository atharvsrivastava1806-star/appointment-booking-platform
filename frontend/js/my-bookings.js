(() => {
  const message = document.getElementById("bookingsMessage");
  const list = document.getElementById("bookingList");
  const escapeHTML = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  const dateLabel = (value) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
  };

  const loadBookings = async () => {
    let token = "";
    try {
      token = localStorage.getItem("customerToken") || "";
    } catch (error) {
      console.error("Unable to read customer sign-in:", error);
    }

    if (!token) {
      message.innerHTML = `Sign in to view bookings linked to your account. <a href="${escapeHTML(window.shopRoute("/login.html"))}">Login / Sign Up</a>`;
      return;
    }

    try {
      const bookings = await window.apiFetch("/api/appointments/mine", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!Array.isArray(bookings)) {
        throw new Error("The server returned an invalid bookings list.");
      }
      if (!bookings.length) {
        message.textContent = "No bookings have been linked to this customer account for this business yet.";
        return;
      }

      message.textContent = `${bookings.length} appointment${bookings.length === 1 ? "" : "s"} found.`;
      list.innerHTML = bookings.map((booking) => {
        const service = booking.service?.name || "Service information unavailable";
        const amount = Number(booking.servicePrice);
        const price = Number.isFinite(amount)
          ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)
          : "Not available";
        return `
          <article class="booking-card">
            <header>
              <h2>${escapeHTML(service)}</h2>
              <span class="booking-status">${escapeHTML(booking.status || "Pending")}</span>
            </header>
            <p>Booking ID: <strong>${escapeHTML(booking.bookingId || "Unavailable")}</strong></p>
            <dl>
              <div><dt>Date</dt><dd>${escapeHTML(dateLabel(booking.date || ""))}</dd></div>
              <div><dt>Time</dt><dd>${escapeHTML(booking.time || "Unavailable")}</dd></div>
              <div><dt>Staff</dt><dd>${escapeHTML(booking.staff?.name || "Any available staff")}</dd></div>
              <div><dt>Service price</dt><dd>${escapeHTML(price)}</dd></div>
            </dl>
          </article>
        `;
      }).join("");
    } catch (error) {
      console.error("Unable to load customer bookings:", error);
      if (error.response?.status === 401) {
        message.innerHTML = `Your sign-in has expired. <a href="${escapeHTML(window.shopRoute("/login.html"))}">Sign in again</a>.`;
        return;
      }
      message.textContent = error.message || "Unable to load your bookings right now.";
    }
  };

  void loadBookings();
})();
