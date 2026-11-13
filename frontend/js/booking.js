document.addEventListener("DOMContentLoaded", async () => {
  const customerToken = localStorage.getItem("customerToken") || "";
  const adminToken = localStorage.getItem("adminToken") || "";
  const authToken = customerToken || adminToken;
  const loginUrl = window.shopRoute ? window.shopRoute("/login.html") : "/login.html";
  if (!authToken) {
    window.location.replace(loginUrl);
    return;
  }

  const serviceList = document.getElementById("bookingServiceList");
  const staffList = document.getElementById("staffList");
  const timeSlots = document.getElementById("timeSlots");
  const appointmentDate = document.getElementById("appointmentDate");
  const confirmButton = document.getElementById("confirmBooking");
  const bookingMessage = document.getElementById("bookingMessage");
  const customerNameInput = document.getElementById("customerName");
  const customerEmailInput = document.getElementById("customerEmail");

  const summaryService = document.getElementById("summaryService");
  const summaryDuration = document.getElementById("summaryDuration");
  const summaryStaff = document.getElementById("summaryStaff");
  const summaryDate = document.getElementById("summaryDate");
  const summaryTime = document.getElementById("summaryTime");
  const summaryPrice = document.getElementById("summaryPrice");
  const summaryTotal = document.getElementById("summaryTotal");
  const requestedServiceId = new URLSearchParams(window.location.search).get("serviceId");

  const state = {
    services: [],
    staff: [],
    selectedServiceId: "",
    selectedServiceName: "",
    selectedServiceDuration: 0,
    selectedServicePrice: 0,
    selectedStaffId: "",
    selectedStaffName: "Any Available Staff",
    selectedTime: "",
    selectedDate: "",
    availableTimes: []
  };
  const escapeHTML = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  const setMessage = (text, type = "error") => {
    bookingMessage.innerHTML = `<div class="alert ${type === "error" ? "error" : "success"}" style="padding:10px 12px; border-radius:10px; background:${type === "error" ? "#fee2e2" : "#dcfce7"}; color:${type === "error" ? "#991b1b" : "#166534"};">${text}</div>`;
  };
  let availabilityRequest = 0;
  let signedInUser = null;

  try {
    const { user } = await window.apiFetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!user || !["customer", "admin"].includes(user.role)) {
      throw new Error("Please sign in with a customer account to book an appointment.");
    }
    signedInUser = user;
  } catch (error) {
    console.error("Unable to verify booking access:", error);
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem(customerToken ? "customerToken" : "adminToken");
      localStorage.removeItem(customerToken ? "customerUser" : "adminUser");
    }
    setMessage(error.message || "Unable to verify your sign-in. Please try again.", "error");
    window.location.replace(loginUrl);
    return;
  }

  const updateSummary = () => {
    summaryService.textContent = state.selectedServiceName || "Not selected";
    summaryDuration.textContent = state.selectedServiceId ? `${state.selectedServiceDuration} mins` : "-";
    summaryStaff.textContent = state.selectedStaffName || "Any";
    summaryDate.textContent = state.selectedDate || "-";
    summaryTime.textContent = state.selectedTime || "-";
    summaryPrice.textContent = `₹${state.selectedServicePrice}`;
    summaryTotal.textContent = `₹${state.selectedServicePrice}`;
  };

  const selectService = (serviceId) => {
    const service = state.services.find((item) => String(item._id) === String(serviceId));
    if (!service) return false;

    state.selectedServiceId = String(service._id);
    state.selectedServiceName = String(service.name || "").trim();
    state.selectedServiceDuration = Number(service.duration ?? 30);
    state.selectedServicePrice = Number(service.price);

    serviceList.querySelectorAll(".option-card").forEach((card) => {
      const selected = card.dataset.serviceId === state.selectedServiceId;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });

    updateSummary();
    loadTimeSlots();
    return true;
  };

  const loadServices = async () => {
    const services = await window.apiFetch("/api/services");
    const seenIds = new Set();
    state.services = Array.isArray(services) ? services.filter((service) => {
      const id = service?._id == null ? "" : String(service._id);
      const price = Number(service?.price);
      const duration = Number(service?.duration);
      if (!id || seenIds.has(id) || !String(service?.name || "").trim() ||
          !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 1) {
        console.error("Ignoring a service with an invalid ID or booking value:", service);
        return false;
      }
      seenIds.add(id);
      return true;
    }) : [];
    const filtered = state.services;

    if (!filtered.length) {
      serviceList.innerHTML = '<div class="helper">No services are available yet. Please contact the business.</div>';
      state.selectedServiceId = "";
      state.selectedServiceName = "";
      state.selectedServiceDuration = 0;
      state.selectedServicePrice = 0;
      updateSummary();
      return;
    }

    serviceList.innerHTML = filtered.map((service) => `
      <button id="service-option-${escapeHTML(service._id)}" type="button" class="option-card" data-service-id="${escapeHTML(service._id)}" aria-pressed="false">
        <strong>${escapeHTML(service.name)}</strong>
        <small>${escapeHTML(service.duration)} mins</small>
        <div style="margin-top: 8px; font-weight: 700; color: #8b5cf6;">₹${escapeHTML(service.price)}</div>
      </button>
    `).join("");

    serviceList.querySelectorAll(".option-card").forEach((button) => {
      button.addEventListener("click", () => {
        selectService(button.dataset.serviceId);
      });
    });

    const initialServiceId = requestedServiceId || state.selectedServiceId || filtered[0]._id;
    if (!selectService(initialServiceId)) {
      state.selectedServiceId = "";
      state.selectedServiceName = "";
      state.selectedServiceDuration = 0;
      state.selectedServicePrice = 0;
      updateSummary();
      setMessage("The service selected from the previous page is no longer available. Please choose another service.", "error");
    }
  };

  const loadStaff = async () => {
    const staff = await window.apiFetch("/api/staff");
    state.staff = Array.isArray(staff) ? staff : [];

    if (!state.staff.length) {
      staffList.innerHTML = '<div class="helper">No staff available.</div>';
      return;
    }

    staffList.innerHTML = `
      <button type="button" class="staff-card any-staff-card ${state.selectedStaffId ? "" : "selected"}" data-staff-id="" data-staff-name="Any Available Staff" aria-pressed="${String(!state.selectedStaffId)}">
        <strong>Any Available Staff</strong>
        <small>Book with a team member who has an open time</small>
      </button>
      ${state.staff.map((member) => `
      <button type="button" class="staff-card ${state.selectedStaffId === member._id ? "selected" : ""}" data-staff-id="${escapeHTML(member._id)}" data-staff-name="${escapeHTML(member.name || "Team member")}" aria-pressed="${String(state.selectedStaffId === member._id)}">
        <strong>${escapeHTML(member.name || "Team member")}</strong>
        <small>${escapeHTML(member.role || "Team member")}</small>
      </button>
    `).join("")}
    `;

    staffList.querySelectorAll(".staff-card").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedStaffId = button.dataset.staffId || "";
        state.selectedStaffName = button.dataset.staffName;
        staffList.querySelectorAll(".staff-card").forEach((card) => {
          const selected = card.dataset.staffId === state.selectedStaffId;
          card.classList.toggle("selected", selected);
          card.setAttribute("aria-pressed", String(selected));
        });
        updateSummary();
        loadTimeSlots();
      });
    });
  };

  const loadTimeSlots = async () => {
    const requestId = ++availabilityRequest;
    state.selectedTime = "";
    state.availableTimes = [];
    updateSummary();
    if (!state.selectedDate || !state.selectedServiceId) {
      timeSlots.innerHTML = '<div class="helper">Choose a service and date to see available times.</div>';
      return;
    }

    timeSlots.innerHTML = '<div class="helper">Checking available times…</div>';
    const params = new URLSearchParams({
      date: state.selectedDate,
      serviceId: state.selectedServiceId
    });
    if (state.selectedStaffId) params.set("staffId", state.selectedStaffId);

    try {
      const result = await window.apiFetch(`/api/appointments/availability?${params.toString()}`);
      if (requestId !== availabilityRequest) return;
      const slots = Array.isArray(result?.slots) ? result.slots : [];
      if (!slots.length) {
        const selectedStaff = state.staff.find((member) => String(member._id) === state.selectedStaffId);
        const assignedServices = Array.isArray(selectedStaff?.services) ? selectedStaff.services : [];
        const serviceIsAssigned = assignedServices.some((service) =>
          String(service?._id || service) === state.selectedServiceId
        );
        let message = "No appointment times are available for any staff member on this date. Try another date.";
        if (selectedStaff && assignedServices.length && !serviceIsAssigned) {
          message = `${escapeHTML(state.selectedStaffName)} is not assigned to this service. Choose another staff member or ask the business to update staff services.`;
        } else if (state.selectedStaffId) {
          message = `No available times for ${escapeHTML(state.selectedStaffName)} on this date. Try another date or choose Any Available Staff.`;
        }
        timeSlots.innerHTML = `<div class="helper">${message}</div>`;
        return;
      }

      state.availableTimes = slots.filter((slot) => typeof slot === "string");
      timeSlots.innerHTML = slots.map((slot) => `
        <button type="button" class="time-slot" data-slot="${escapeHTML(slot)}">${escapeHTML(slot)}</button>
      `).join("");
    } catch (error) {
      if (requestId !== availabilityRequest) return;
      console.error("Unable to load appointment availability:", error);
      timeSlots.innerHTML = `<div class="helper">Availability could not be checked: ${escapeHTML(error.message || "Please try again.")}</div>`;
      return;
    }

    timeSlots.querySelectorAll(".time-slot").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedTime = button.dataset.slot;
        timeSlots.querySelectorAll(".time-slot").forEach((slot) => slot.classList.toggle("selected", slot.dataset.slot === state.selectedTime));
        updateSummary();
      });
    });
  };

  const setMinDate = async () => {
    let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    try {
      const business = await window.apiFetch("/api/business");
      timeZone = business.timeZone || timeZone;
    } catch (error) {
      console.error("Unable to load business time zone:", error);
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const today = `${values.year}-${values.month}-${values.day}`;
    appointmentDate.min = today;
    if (!appointmentDate.value || appointmentDate.value < today) appointmentDate.value = today;
    state.selectedDate = appointmentDate.value;
    updateSummary();
  };

  appointmentDate.addEventListener("change", () => {
    state.selectedDate = appointmentDate.value;
    updateSummary();
    loadTimeSlots();
  });

  confirmButton.addEventListener("click", async () => {
    const name = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const notes = document.getElementById("customerNotes").value.trim();
    const selectedService = state.services.find((item) => item._id === state.selectedServiceId);

    if (!selectedService || !state.selectedDate ||
        !state.availableTimes.includes(state.selectedTime) || !name || !phone || !email) {
      setMessage("Please fill in all required fields before continuing.", "error");
      return;
    }

    try {
      const payload = {
        serviceId: state.selectedServiceId,
        staffId: state.selectedStaffId || null,
        date: state.selectedDate,
        time: state.selectedTime,
        name,
        phone,
        email,
        message: notes,
        serviceName: selectedService.name,
        servicePrice: Number(selectedService.price),
        serviceDuration: Number(selectedService.duration)
      };

      const appointment = await window.apiFetch("/api/appointments", {
        method: "POST",
        body: payload,
        headers: localStorage.getItem("customerToken")
          ? { Authorization: `Bearer ${localStorage.getItem("customerToken")}` }
          : {}
      });

      if (!appointment.bookingId || !appointment.appointmentId) {
        throw new Error("The appointment was saved, but its confirmation details were incomplete. Please contact the business before paying.");
      }

      const servicePrice = Number(appointment.servicePrice ?? selectedService.price);
      const serviceDuration = Number(appointment.serviceDuration ?? selectedService.duration ?? 30);
      if (!Number.isFinite(servicePrice) || servicePrice < 0) {
        throw new Error("The service price could not be confirmed. Please contact the business before paying.");
      }
      if (!Number.isFinite(serviceDuration) || serviceDuration <= 0) {
        throw new Error("The service duration could not be confirmed. Please contact the business before paying.");
      }

      const charges = 0;
      const bookingData = {
        bookingId: appointment.bookingId,
        appointmentId: appointment.appointmentId,
        customerId: appointment.customerId || null,
        serviceId: state.selectedServiceId,
        serviceName: appointment.serviceName || selectedService.name,
        serviceDuration,
        staffId: appointment.staffId || state.selectedStaffId,
        staffName: appointment.staffName || state.selectedStaffName,
        date: appointment.date || state.selectedDate,
        time: appointment.time || state.selectedTime,
        servicePrice,
        charges,
        totalAmount: servicePrice + charges,
        name: appointment.customer?.name || name,
        phone,
        email: appointment.customer?.email || email,
        notes
      };

      localStorage.setItem("bookingData", JSON.stringify(bookingData));
      window.location.href = window.shopRoute ? window.shopRoute("/payment-summary.html") : "/payment-summary.html";
    } catch (error) {
      setMessage(error.message || "Unable to save this booking.", "error");
    }
  });

  try {
    await Promise.all([loadServices(), loadStaff(), setMinDate()]);
    await loadTimeSlots();
  } catch (error) {
    console.error("Unable to load booking options:", error);
    setMessage("Unable to load services or staff right now. Please refresh and try again.", "error");
  }
  if (signedInUser?.role === "customer") {
    customerNameInput.value = signedInUser.name || "";
    customerEmailInput.value = signedInUser.email || "";
    customerNameInput.readOnly = true;
    customerEmailInput.readOnly = true;
  }
  updateSummary();
});
