document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const statsContainer = document.getElementById("statsContainer");
  const appointmentsTable = document.getElementById("appointmentsTable");
  const serviceList = document.getElementById("serviceList");
  const staffList = document.getElementById("staffList");
  const reviewList = document.getElementById("reviewList");
  const formStatus = document.getElementById("formStatus");

  const serviceForm = document.getElementById("serviceForm");
  const staffForm = document.getElementById("staffForm");
  const businessForm = document.getElementById("businessForm");
  const businessSchedule = document.getElementById("businessSchedule");
  const specialHolidayEditor = document.getElementById("specialHolidayEditor");
  const facilityEditor = document.getElementById("facilityEditor");
  const testimonialEditor = document.getElementById("testimonialEditor");
  const availabilityStaffSelect = document.getElementById("availabilityStaffSelect");
  const staffAvailabilitySchedule = document.getElementById("staffAvailabilitySchedule");
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  let editingServiceId = null;
  let editingStaffId = null;
  let currentBusiness = null;
  let currentStaff = [];
  let pendingLogo = "";
  let pendingAboutImage = "";

  const escapeHTML = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  const fetchWithAuth = async (url, options = {}) => {
    return window.apiFetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });
  };

  const showMessage = (message, type = "success") => {
    if (!formStatus) return;
    const alert = document.createElement("div");
    alert.className = `alert ${type}`;
    alert.textContent = message;
    formStatus.replaceChildren(alert);
    setTimeout(() => {
      formStatus.replaceChildren();
    }, 4000);
  };

  const fileToImageData = (file) => new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      reject(new Error("Choose a PNG, JPEG or WebP image."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Choose an image smaller than 8 MB."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("This browser cannot process the selected image."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 900000 && quality > 0.48) {
        quality -= 0.1;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (data.length > 900000) {
        reject(new Error("This image is too large to save. Choose a smaller image."));
        return;
      }
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = objectUrl;
  });

  const parseSessionInput = (text, label) => {
    const value = String(text || "").trim();
    if (!value) return [];
    const sessions = value.split(",").map((part) => {
      const match = part.trim().match(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/);
      if (!match) throw new Error(`${label}: use 24-hour ranges such as 09:00-14:00,15:00-20:00.`);
      const [open, close] = part.trim().split("-");
      if (open >= close) throw new Error(`${label}: each closing time must be after its opening time.`);
      return { open, close };
    });
    for (let index = 1; index < sessions.length; index += 1) {
      if (sessions[index].open < sessions[index - 1].close) {
        throw new Error(`${label}: sessions must be ordered and must not overlap.`);
      }
    }
    if (sessions.length > 4) throw new Error(`${label}: add no more than four sessions.`);
    return sessions;
  };

  const renderBusinessSchedule = (schedule = []) => {
    const scheduleByDay = new Map(schedule.map((entry) => [entry.day, entry]));
    businessSchedule.innerHTML = weekdays.map((day) => {
      const entry = scheduleByDay.get(day) || { closed: day === "sunday", sessions: [] };
      const sessions = (entry.sessions || []).map((session) => `${session.open}-${session.close}`).join(",");
      return `
        <div class="schedule-row" data-business-day="${day}">
          <strong>${day[0].toUpperCase()}${day.slice(1)}</strong>
          <label class="closed-control"><input type="checkbox" data-day-closed ${entry.closed ? "checked" : ""} /> Closed</label>
          <input type="text" data-day-sessions value="${escapeHTML(sessions)}" placeholder="09:00-14:00,15:00-20:00" ${entry.closed ? "disabled" : ""} aria-label="${day} sessions" />
        </div>
      `;
    }).join("");
  };

  const renderSpecialHolidays = (holidays = []) => {
    specialHolidayEditor.innerHTML = holidays.map((holiday) => `
      <div class="holiday-editor-row">
        <div class="row">
          <input type="date" data-holiday-date value="${escapeHTML(holiday.date || "")}" aria-label="Holiday date" />
          <input type="text" data-holiday-reason value="${escapeHTML(holiday.reason || "")}" placeholder="Reason (optional)" maxlength="120" aria-label="Holiday reason" />
        </div>
        <input type="text" data-holiday-sessions value="${escapeHTML((holiday.sessions || []).map((session) => `${session.open}-${session.close}`).join(","))}" placeholder="Leave blank to close all day; or 09:00-13:00 for special hours" aria-label="Special holiday hours" />
        <button type="button" class="small-btn danger-btn" data-remove-holiday>Remove date</button>
      </div>
    `).join("");
  };

  const renderFacilities = (facilities = []) => {
    facilityEditor.innerHTML = facilities.map((facility) => `
      <div class="facility-editor-row">
        <div class="row">
          <input type="text" data-facility-title value="${escapeHTML(facility.title || "")}" placeholder="Facility title" maxlength="100" />
          <input type="text" data-facility-icon value="${escapeHTML(facility.icon || "✦")}" placeholder="Icon" maxlength="16" />
        </div>
        <textarea data-facility-description rows="2" placeholder="Short description" maxlength="500">${escapeHTML(facility.description || "")}</textarea>
        <input type="file" data-facility-image accept="image/png,image/jpeg,image/webp" aria-label="Facility image" />
        <div class="facility-image-preview">
          <div class="facility-image-placeholder" data-facility-placeholder ${facility.image ? "hidden" : ""}>
            <span aria-hidden="true">✦</span>
            <small>No image selected</small>
          </div>
          <img data-facility-preview alt="Facility image preview" ${facility.image ? `src="${escapeHTML(facility.image)}"` : "hidden"} />
        </div>
        <button type="button" class="small-btn danger-btn" data-remove-facility>Remove facility</button>
        <input type="hidden" data-facility-saved-image value="${escapeHTML(facility.image || "")}" />
      </div>
    `).join("");
  };

  const renderTestimonials = (testimonials = []) => {
    testimonialEditor.innerHTML = testimonials.map((testimonial) => `
      <div class="testimonial-editor-row">
        <div class="row">
          <input type="text" data-testimonial-name value="${escapeHTML(testimonial.name || "")}" placeholder="Customer name" maxlength="80" />
          <input type="text" data-testimonial-location value="${escapeHTML(testimonial.location || "")}" placeholder="City / location" maxlength="100" />
        </div>
        <div class="row">
          <select data-testimonial-rating aria-label="Star rating">
            ${[5, 4, 3, 2, 1].map((rating) => `<option value="${rating}" ${Number(testimonial.rating) === rating ? "selected" : ""}>${rating} stars</option>`).join("")}
          </select>
          <strong class="settings-help">Manual testimonials are displayed as Demo Review.</strong>
        </div>
        <textarea data-testimonial-review rows="3" placeholder="Review text" maxlength="500">${escapeHTML(testimonial.review || "")}</textarea>
        <button type="button" class="small-btn danger-btn" data-remove-testimonial>Remove testimonial</button>
      </div>
    `).join("");
  };

  const renderStaffAvailability = (member) => {
    if (!member) {
      staffAvailabilitySchedule.innerHTML = '<p class="settings-help">Select a staff member to edit their hours.</p>';
      return;
    }
    const entries = Array.isArray(member.availability) ? member.availability : [];
    const scheduleByDay = new Map(entries.map((entry) => [String(entry.day || "").toLowerCase(), entry]));
    staffAvailabilitySchedule.innerHTML = weekdays.map((day) => {
      const entry = scheduleByDay.get(day) || scheduleByDay.get(day.slice(0, 3));
      const closed = entry ? entry.closed === true : false;
      const useBusinessHours = entry ? entry.useBusinessHours === true : !entry;
      const sessions = (entry?.sessions || []).map((session) => `${session.open}-${session.close}`).join(",");
      const slots = (entry?.slots || []).join(",");
      return `
        <div class="schedule-row staff-schedule-row" data-staff-day="${day}">
          <strong>${day[0].toUpperCase()}${day.slice(1)}</strong>
          <label class="staff-hours-mode"><input type="checkbox" data-staff-use-business ${useBusinessHours ? "checked" : ""} ${closed ? "disabled" : ""} /> Use shop hours</label>
          <label class="closed-control"><input type="checkbox" data-staff-closed ${closed ? "checked" : ""} /> Closed</label>
          <input type="text" data-staff-sessions value="${escapeHTML(sessions)}" placeholder="09:00-14:00,15:00-20:00" aria-label="${day} staff sessions" ${useBusinessHours || closed ? "disabled" : ""} />
          <input type="text" data-staff-slots value="${escapeHTML(slots)}" placeholder="Optional start-time limits: 09:00,11:00" aria-label="${day} allowed start times" ${useBusinessHours || closed ? "disabled" : ""} />
        </div>
      `;
    }).join("");
  };

  const renderStaffAvailabilityOptions = (staff) => {
    const selectedId = availabilityStaffSelect.value;
    availabilityStaffSelect.innerHTML = '<option value="">Select staff</option>' +
      staff.map((member) => `<option value="${escapeHTML(member._id)}">${escapeHTML(member.name)}</option>`).join("");
    if (staff.some((member) => member._id === selectedId)) availabilityStaffSelect.value = selectedId;
    const selected = staff.find((member) => member._id === availabilityStaffSelect.value);
    renderStaffAvailability(selected);
  };

  const renderStats = (stats = {}) => {
    if (!statsContainer) return;
    const cards = [
      { label: "Total Bookings", value: stats.totalAppointments || 0 },
      { label: "Pending", value: stats.pendingAppointments || 0 },
      { label: "Confirmed", value: stats.confirmedAppointments || 0 },
      { label: "Cancelled", value: stats.cancelledAppointments || 0 },
      { label: "Customers", value: stats.totalCustomers || 0 },
      { label: "Services", value: stats.totalServices || 0 }
    ];

    statsContainer.innerHTML = cards
      .map(
        (card) => `
          <article class="card stat-card">
            <small>${card.label}</small>
            <div class="value">${card.value}</div>
          </article>
        `
      )
      .join("");
  };

  const renderAppointments = (appointments = []) => {
    if (!appointmentsTable) return;

    if (!appointments.length) {
      appointmentsTable.innerHTML = '<tr><td colspan="7"><div class="empty-state">No appointments yet.</div></td></tr>';
      return;
    }

    appointmentsTable.innerHTML = appointments
      .map((appointment) => {
        const status = String(appointment.status || "PENDING").trim().toUpperCase();
        const statusClass = status.toLowerCase().replace(/[^a-z-]/g, "");
        const allowedActions = {
          PENDING: [
            { status: "CONFIRMED", label: "Confirm", className: "primary-btn" },
            { status: "CANCELLED", label: "Cancel", className: "danger-btn" }
          ],
          CONFIRMED: [
            { status: "COMPLETED", label: "Complete", className: "primary-btn" },
            { status: "CANCELLED", label: "Cancel", className: "danger-btn" }
          ]
        }[status] || [];
        const actionButtons = allowedActions.length
          ? `<div class="action-buttons">${allowedActions.map((action) => `
              <button type="button" class="small-btn ${action.className}" data-status-action="${escapeHTML(appointment._id)}" data-status="${action.status}">${action.label}</button>
            `).join("")}</div>`
          : '<span class="table-muted">—</span>';
        return `
          <tr>
            <td>${escapeHTML(appointment.bookingId || "N/A")}</td>
            <td>${escapeHTML(appointment.customer?.name || "Guest")}</td>
            <td>${escapeHTML(appointment.service?.name || "Service")}</td>
            <td>${escapeHTML(appointment.staff?.name || "Any")}</td>
            <td>${escapeHTML(appointment.date || "-")}</td>
            <td><span class="status-badge status-${statusClass}">${escapeHTML(status)}</span></td>
            <td>${actionButtons}</td>
          </tr>
        `;
      })
      .join("");
  };

  const renderServices = (services = []) => {
    if (!serviceList) return;
    if (!services.length) {
      serviceList.innerHTML = '<div class="empty-state">No services yet.</div>';
      return;
    }

    serviceList.innerHTML = services
      .map((service) => `
        <div class="card" style="margin-top: 12px; padding: 14px;">
          <h4>${escapeHTML(service.name)}</h4>
          <p>${escapeHTML(service.description || "No description.")}</p>
          <div><strong>₹${escapeHTML(service.price || 0)}</strong> • ${escapeHTML(service.duration || 30)} min • ${escapeHTML(service.category || "General")}</div>
          <div style="margin-top: 10px;">
            <button class="small-btn primary-btn" data-edit-service="${escapeHTML(service._id)}">Edit</button>
            <button class="small-btn danger-btn" data-delete-service="${escapeHTML(service._id)}">Delete</button>
          </div>
        </div>
      `)
      .join("");
  };

  const renderStaff = (staff = []) => {
    if (!staffList) return;
    if (!staff.length) {
      staffList.innerHTML = '<div class="empty-state">No staff yet.</div>';
      return;
    }

    staffList.innerHTML = staff
      .map((member) => `
        <div class="card" style="margin-top: 12px; padding: 14px;">
          <h4>${escapeHTML(member.name)}</h4>
          <p>${escapeHTML(member.role || "Staff")}</p>
          <div style="margin-top: 10px;">
            <button class="small-btn primary-btn" data-edit-staff="${escapeHTML(member._id)}">Edit</button>
            <button class="small-btn danger-btn" data-delete-staff="${escapeHTML(member._id)}">Delete</button>
          </div>
        </div>
      `)
      .join("");
  };

  const renderReviews = (reviews = []) => {
    if (!reviewList) return;
    if (!reviews.length) {
      reviewList.innerHTML = '<div class="empty-state">No reviews yet.</div>';
      return;
    }

    reviewList.innerHTML = reviews
      .map((review) => {
        const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5)));
        return `
          <div class="card" style="margin-top: 12px; padding: 14px;">
            <div>${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
            <p>“${escapeHTML(review.review)}”</p>
            <strong>${escapeHTML(review.name)}</strong>
            <div style="margin-top: 10px;">
              <button class="small-btn primary-btn" data-approve-review="${escapeHTML(review._id)}">Approve</button>
              <button class="small-btn danger-btn" data-delete-review="${escapeHTML(review._id)}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const loadBusiness = async () => {
    const business = await fetchWithAuth("/api/business/settings");
    currentBusiness = business;
    const publicLink = document.getElementById("businessPublicLink");
    if (publicLink && business.slug) {
      publicLink.href = `${window.location.origin}/shop/${encodeURIComponent(business.slug)}`;
      publicLink.textContent = publicLink.href;
    }
    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (element && value != null) element.value = value;
    };

    setValue("businessName", business.name);
    setValue("businessType", business.businessType);
    setValue("businessPhone", business.phone);
    setValue("businessEmail", business.email);
    setValue("businessWhatsapp", business.whatsapp);
    setValue("businessAddress", business.address);
    setValue("businessCity", business.city);
    setValue("businessState", business.state);
    setValue("businessPinCode", business.pinCode);
    setValue("businessMapLink", business.mapLink);
    setValue("businessTimeZone", business.timeZone || "Asia/Kolkata");
    setValue("bookingSlotIntervalMinutes", business.bookingSlotIntervalMinutes || 30);
    setValue("businessDescription", business.description);
    setValue("aboutHeading", business.aboutHeading);
    setValue("aboutDescription", business.aboutDescription || business.description);
    setValue("experienceDescription", business.experienceDescription);
    const logoPreview = document.getElementById("businessLogoPreview");
    const aboutPreview = document.getElementById("aboutImagePreview");
    if (logoPreview) {
      logoPreview.src = business.logo || "/assets/logo-placeholder.svg";
      logoPreview.hidden = !business.logo;
    }
    if (aboutPreview) {
      const savedImage = business.aboutImage || business.heroImage || "";
      if (savedImage) aboutPreview.src = savedImage;
      aboutPreview.hidden = !savedImage;
    }
    pendingLogo = "";
    pendingAboutImage = "";
    renderBusinessSchedule(business.weeklySchedule || []);
    renderSpecialHolidays(business.specialHolidays || []);
    renderFacilities(business.facilities || []);
    renderTestimonials(business.testimonials || []);
  };

  const loadDashboardData = async () => {
    try {
      await loadBusiness();
      const [stats, appointments, services, staff, reviews] = await Promise.all([
        fetchWithAuth("/api/appointments/stats"),
        fetchWithAuth("/api/appointments"),
        fetchWithAuth("/api/services"),
        fetchWithAuth("/api/staff"),
        fetchWithAuth("/api/reviews/admin")
      ]);

      renderStats(stats);
      renderAppointments(Array.isArray(appointments) ? appointments : []);
      renderServices(Array.isArray(services) ? services : []);
      currentStaff = Array.isArray(staff) ? staff : [];
      renderStaff(currentStaff);
      renderStaffAvailabilityOptions(currentStaff);
      renderReviews(Array.isArray(reviews) ? reviews : []);
    } catch (error) {
      console.error(error);
      showMessage("Unable to load dashboard data.", "error");
    }
  };

  businessSchedule.addEventListener("change", (event) => {
    const row = event.target.closest("[data-business-day]");
    if (!row || !event.target.matches("[data-day-closed]")) return;
    const sessions = row.querySelector("[data-day-sessions]");
    sessions.disabled = event.target.checked;
    if (event.target.checked) sessions.value = "";
  });

  staffAvailabilitySchedule.addEventListener("change", (event) => {
    const row = event.target.closest("[data-staff-day]");
    if (!row) return;
    const useBusinessHours = row.querySelector("[data-staff-use-business]");
    const closed = row.querySelector("[data-staff-closed]");
    const sessions = row.querySelector("[data-staff-sessions]");
    const slots = row.querySelector("[data-staff-slots]");
    if (event.target.matches("[data-staff-use-business]") && useBusinessHours.checked) {
      closed.checked = false;
      sessions.value = "";
      slots.value = "";
    }
    if (event.target.matches("[data-staff-closed]") && closed.checked) {
      useBusinessHours.checked = false;
      sessions.value = "";
      slots.value = "";
    }
    sessions.disabled = useBusinessHours.checked || closed.checked;
    slots.disabled = useBusinessHours.checked || closed.checked;
    useBusinessHours.disabled = closed.checked;
  });

  const imageUploadHandler = (inputId, previewId, savePendingImage) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    input.addEventListener("change", async () => {
      if (!input.files?.[0]) return;
      try {
        const imageData = await fileToImageData(input.files[0]);
        savePendingImage(imageData);
        preview.src = imageData;
        preview.hidden = false;
      } catch (error) {
        input.value = "";
        showMessage(error.message, "error");
      }
    });
  };
  imageUploadHandler("businessLogo", "businessLogoPreview", (image) => { pendingLogo = image; });
  imageUploadHandler("aboutImageUpload", "aboutImagePreview", (image) => { pendingAboutImage = image; });

  document.getElementById("addSpecialHoliday").addEventListener("click", () => {
    try {
      renderSpecialHolidays([
        ...Array.from(specialHolidayEditor.querySelectorAll(".holiday-editor-row")).map((row) => ({
          date: row.querySelector("[data-holiday-date]").value,
          reason: row.querySelector("[data-holiday-reason]").value,
          sessions: parseSessionInput(row.querySelector("[data-holiday-sessions]").value, "Special holiday hours")
        })),
        { date: "", reason: "", sessions: [] }
      ]);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
  specialHolidayEditor.addEventListener("click", (event) => {
    if (!event.target.matches("[data-remove-holiday]")) return;
    event.target.closest(".holiday-editor-row").remove();
  });

  document.getElementById("addFacility").addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "facility-editor-row";
    row.innerHTML = `
      <div class="row">
        <input type="text" data-facility-title placeholder="Facility title" maxlength="100" />
        <input type="text" data-facility-icon value="✦" placeholder="Icon" maxlength="16" />
      </div>
      <textarea data-facility-description rows="2" placeholder="Short description" maxlength="500"></textarea>
      <input type="file" data-facility-image accept="image/png,image/jpeg,image/webp" aria-label="Facility image" />
      <div class="facility-image-preview">
        <div class="facility-image-placeholder" data-facility-placeholder>
          <span aria-hidden="true">✦</span>
          <small>No image selected</small>
        </div>
        <img data-facility-preview alt="Facility image preview" hidden />
      </div>
      <input type="hidden" data-facility-saved-image value="" />
      <button type="button" class="small-btn danger-btn" data-remove-facility>Remove facility</button>
    `;
    facilityEditor.append(row);
  });
  facilityEditor.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-facility]")) event.target.closest(".facility-editor-row").remove();
  });
  facilityEditor.addEventListener("load", (event) => {
    if (!event.target.matches("[data-facility-preview]")) return;
    event.target.hidden = false;
    event.target.closest(".facility-editor-row").querySelector("[data-facility-placeholder]").hidden = true;
  }, true);
  facilityEditor.addEventListener("error", (event) => {
    if (!event.target.matches("[data-facility-preview]")) return;
    event.target.hidden = true;
    event.target.closest(".facility-editor-row").querySelector("[data-facility-placeholder]").hidden = false;
  }, true);
  facilityEditor.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-facility-image]") || !event.target.files?.[0]) return;
    const row = event.target.closest(".facility-editor-row");
    const preview = row.querySelector("[data-facility-preview]");
    const savedImage = row.querySelector("[data-facility-saved-image]");
    try {
      const imageData = await fileToImageData(event.target.files[0]);
      savedImage.value = imageData;
      preview.src = imageData;
      preview.hidden = false;
      row.querySelector("[data-facility-placeholder]").hidden = true;
    } catch (error) {
      event.target.value = "";
      showMessage(error.message, "error");
    }
  });

  document.getElementById("addTestimonial").addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "testimonial-editor-row";
    row.innerHTML = `
      <div class="row">
        <input type="text" data-testimonial-name placeholder="Customer name" maxlength="80" />
        <input type="text" data-testimonial-location placeholder="City / location" maxlength="100" />
      </div>
      <div class="row">
        <select data-testimonial-rating aria-label="Star rating">
          ${[5, 4, 3, 2, 1].map((rating) => `<option value="${rating}">${rating} stars</option>`).join("")}
        </select>
        <strong class="settings-help">Manual testimonials are displayed as Demo Review.</strong>
      </div>
      <textarea data-testimonial-review rows="3" placeholder="Review text" maxlength="500"></textarea>
      <button type="button" class="small-btn danger-btn" data-remove-testimonial>Remove testimonial</button>
    `;
    testimonialEditor.append(row);
  });
  testimonialEditor.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-testimonial]")) event.target.closest(".testimonial-editor-row").remove();
  });

  availabilityStaffSelect.addEventListener("change", () => {
    renderStaffAvailability(currentStaff.find((member) => member._id === availabilityStaffSelect.value));
  });
  document.getElementById("saveStaffAvailability").addEventListener("click", async () => {
    const member = currentStaff.find((item) => item._id === availabilityStaffSelect.value);
    if (!member) {
      showMessage("Select a staff member first.", "error");
      return;
    }
    try {
      const availability = Array.from(staffAvailabilitySchedule.querySelectorAll("[data-staff-day]")).map((row) => {
        const day = row.dataset.staffDay;
        const useBusinessHours = row.querySelector("[data-staff-use-business]").checked;
        const closed = row.querySelector("[data-staff-closed]").checked;
        const sessions = useBusinessHours || closed
          ? []
          : parseSessionInput(row.querySelector("[data-staff-sessions]").value, `${day} staff hours`);
        const slots = useBusinessHours || closed
          ? []
          : row.querySelector("[data-staff-slots]").value.split(",").map((slot) => slot.trim()).filter(Boolean);
        if (!useBusinessHours && !closed && !sessions.length && !slots.length) {
          throw new Error(`${day}: enter staff hours, allowed start times, use shop hours, or mark the day closed.`);
        }
        if (slots.some((slot) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))) {
          throw new Error(`${day}: allowed start times must use HH:mm format.`);
        }
        return { day, useBusinessHours, closed, sessions, slots };
      });

      await fetchWithAuth(`/api/staff/${member._id}`, { method: "PUT", body: { availability } });
      showMessage("Staff availability saved.");
      await loadDashboardData();
      availabilityStaffSelect.value = member._id;
      renderStaffAvailability(currentStaff.find((item) => item._id === member._id));
    } catch (error) {
      showMessage(error.message || "Unable to save staff availability.", "error");
    }
  });

  document.addEventListener("click", async (event) => {
    const statusButton = event.target.closest("[data-status-action]");
    if (statusButton) {
      const id = statusButton.getAttribute("data-status-action");
      const status = statusButton.getAttribute("data-status");

      try {
        const response = await fetchWithAuth(`/api/appointments/${id}/status`, {
          method: "PUT",
          body: { status }
        });
        showMessage(`Appointment ${status.toLowerCase()} saved.`);
        await loadDashboardData();
      } catch (error) {
        showMessage(error.message || "Failed to update appointment.", "error");
      }
      return;
    }

    const editServiceButton = event.target.closest("[data-edit-service]");
    if (editServiceButton) {
      const id = editServiceButton.getAttribute("data-edit-service");
      const services = await fetchWithAuth("/api/services");
      const service = services.find((item) => item._id === id);
      if (!service) return;
      editingServiceId = id;
      document.getElementById("serviceName").value = service.name || "";
      document.getElementById("serviceCategory").value = service.category || "";
      document.getElementById("serviceDescription").value = service.description || "";
      document.getElementById("servicePrice").value = service.price || 0;
      document.getElementById("serviceDuration").value = service.duration || 30;
      document.getElementById("serviceStatus").value = String(service.isActive !== false);
      const button = serviceForm.querySelector("button[type='submit']");
      if (button) button.textContent = "Update Service";
      serviceForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const deleteServiceButton = event.target.closest("[data-delete-service]");
    if (deleteServiceButton) {
      const id = deleteServiceButton.getAttribute("data-delete-service");
      if (!window.confirm("Delete this service?")) return;
      try {
        await fetchWithAuth(`/api/services/${id}`, { method: "DELETE" });
        showMessage("Service deleted.");
        await loadDashboardData();
      } catch (error) {
        showMessage(error.message || "Failed to delete service.", "error");
      }
      return;
    }

    const editStaffButton = event.target.closest("[data-edit-staff]");
    if (editStaffButton) {
      const id = editStaffButton.getAttribute("data-edit-staff");
      const staff = await fetchWithAuth("/api/staff");
      const member = staff.find((item) => item._id === id);
      if (!member) return;
      editingStaffId = id;
      document.getElementById("staffName").value = member.name || "";
      document.getElementById("staffRole").value = member.role || "";
      const button = staffForm.querySelector("button[type='submit']");
      if (button) button.textContent = "Update Staff";
      staffForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const deleteStaffButton = event.target.closest("[data-delete-staff]");
    if (deleteStaffButton) {
      const id = deleteStaffButton.getAttribute("data-delete-staff");
      if (!window.confirm("Delete this staff member?")) return;
      try {
        await fetchWithAuth(`/api/staff/${id}`, { method: "DELETE" });
        showMessage("Staff deleted.");
        await loadDashboardData();
      } catch (error) {
        showMessage(error.message || "Failed to delete staff.", "error");
      }
      return;
    }

    const approveReviewButton = event.target.closest("[data-approve-review]");
    if (approveReviewButton) {
      const id = approveReviewButton.getAttribute("data-approve-review");
      try {
        await fetchWithAuth(`/api/reviews/${id}/approve`, { method: "PUT" });
        showMessage("Review approved.");
        await loadDashboardData();
      } catch (error) {
        showMessage(error.message || "Failed to approve review.", "error");
      }
      return;
    }

    const deleteReviewButton = event.target.closest("[data-delete-review]");
    if (deleteReviewButton) {
      const id = deleteReviewButton.getAttribute("data-delete-review");
      if (!window.confirm("Delete this review?")) return;
      try {
        await fetchWithAuth(`/api/reviews/${id}`, { method: "DELETE" });
        showMessage("Review deleted.");
        await loadDashboardData();
      } catch (error) {
        showMessage(error.message || "Failed to delete review.", "error");
      }
    }
  });

  serviceForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById("serviceName").value.trim(),
      category: document.getElementById("serviceCategory").value.trim(),
      description: document.getElementById("serviceDescription").value.trim(),
      price: Number(document.getElementById("servicePrice").value),
      duration: Number(document.getElementById("serviceDuration").value),
      isActive: document.getElementById("serviceStatus").value === "true"
    };

    try {
      if (editingServiceId) {
        await fetchWithAuth(`/api/services/${editingServiceId}`, {
          method: "PUT",
          body: payload
        });
        showMessage("Service updated.");
      } else {
        await fetchWithAuth("/api/services", {
          method: "POST",
          body: payload
        });
        showMessage("Service added.");
      }

      serviceForm.reset();
      editingServiceId = null;
      const button = serviceForm.querySelector("button[type='submit']");
      if (button) button.textContent = "Add Service";
      await loadDashboardData();
    } catch (error) {
      showMessage(error.message || "Failed to save service.", "error");
    }
  });

  staffForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById("staffName").value.trim(),
      role: document.getElementById("staffRole").value.trim()
    };

    try {
      if (editingStaffId) {
        await fetchWithAuth(`/api/staff/${editingStaffId}`, {
          method: "PUT",
          body: payload
        });
        showMessage("Staff updated.");
      } else {
        await fetchWithAuth("/api/staff", {
          method: "POST",
          body: payload
        });
        showMessage("Staff added.");
      }

      staffForm.reset();
      editingStaffId = null;
      const button = staffForm.querySelector("button[type='submit']");
      if (button) button.textContent = "Add Staff";
      await loadDashboardData();
    } catch (error) {
      showMessage(error.message || "Failed to save staff.", "error");
    }
  });

  businessForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const weeklySchedule = Array.from(businessSchedule.querySelectorAll("[data-business-day]")).map((row) => {
        const day = row.dataset.businessDay;
        const closed = row.querySelector("[data-day-closed]").checked;
        const sessions = closed ? [] : parseSessionInput(row.querySelector("[data-day-sessions]").value, day);
        if (!closed && !sessions.length) throw new Error(`${day}: add opening hours or mark the day closed.`);
        return { day, closed, sessions };
      });
      const specialHolidays = Array.from(specialHolidayEditor.querySelectorAll(".holiday-editor-row"))
        .map((row) => {
          const date = row.querySelector("[data-holiday-date]").value;
          const reason = row.querySelector("[data-holiday-reason]").value.trim();
          const sessionsText = row.querySelector("[data-holiday-sessions]").value;
          if (!date && !reason && !sessionsText.trim()) return null;
          if (!date) throw new Error("Choose a date for each special holiday or closure.");
          return {
            date,
            reason,
            sessions: parseSessionInput(sessionsText, `Holiday ${date}`)
          };
        })
        .filter(Boolean);
      const facilities = Array.from(facilityEditor.querySelectorAll(".facility-editor-row"))
        .map((row) => ({
          title: row.querySelector("[data-facility-title]").value.trim(),
          icon: row.querySelector("[data-facility-icon]").value.trim() || "✦",
          description: row.querySelector("[data-facility-description]").value.trim(),
          image: row.querySelector("[data-facility-saved-image]").value
        }))
        .filter((facility) => facility.title || facility.description || facility.image);
      const testimonials = Array.from(testimonialEditor.querySelectorAll(".testimonial-editor-row"))
        .map((row) => ({
          name: row.querySelector("[data-testimonial-name]").value.trim(),
          location: row.querySelector("[data-testimonial-location]").value.trim(),
          rating: Number(row.querySelector("[data-testimonial-rating]").value),
          review: row.querySelector("[data-testimonial-review]").value.trim(),
          isDemo: true
        }))
        .filter((review) => review.name || review.review);
      const firstSession = weeklySchedule.find((day) => !day.closed)?.sessions?.[0];
      const payload = {
        name: document.getElementById("businessName").value.trim(),
        businessType: document.getElementById("businessType").value,
        logo: pendingLogo || currentBusiness.logo || "",
        heroImage: pendingAboutImage || currentBusiness.heroImage || currentBusiness.aboutImage || "",
        phone: document.getElementById("businessPhone").value.trim(),
        email: document.getElementById("businessEmail").value.trim(),
        whatsapp: document.getElementById("businessWhatsapp").value.trim(),
        address: document.getElementById("businessAddress").value.trim(),
        city: document.getElementById("businessCity").value.trim(),
        state: document.getElementById("businessState").value.trim(),
        pinCode: document.getElementById("businessPinCode").value.trim(),
        mapLink: document.getElementById("businessMapLink").value.trim(),
        description: document.getElementById("businessDescription").value.trim(),
        aboutHeading: document.getElementById("aboutHeading").value.trim(),
        aboutDescription: document.getElementById("aboutDescription").value.trim(),
        experienceDescription: document.getElementById("experienceDescription").value.trim(),
        aboutImage: pendingAboutImage || currentBusiness.aboutImage || currentBusiness.heroImage || "",
        timeZone: document.getElementById("businessTimeZone").value.trim(),
        bookingSlotIntervalMinutes: Number(document.getElementById("bookingSlotIntervalMinutes").value),
        openingHours: firstSession?.open || "",
        closingHours: firstSession?.close || "",
        weeklySchedule,
        specialHolidays,
        facilities,
        testimonials
      };

      const result = await fetchWithAuth("/api/business", {
        method: "PUT",
        body: payload
      });
      currentBusiness = result.business;
      showMessage(result.message || "Business settings saved.");
      await loadDashboardData();
    } catch (error) {
      showMessage(error.message || "Failed to save business settings.", "error");
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
      await window.apiFetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Server-side admin logout failed:", error);
      window.alert(`The local session will be cleared, but the server could not revoke this token: ${error.message}`);
    } finally {
      try {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
      } catch (error) {
        console.error("Unable to clear the local admin sign-in state:", error);
        window.alert(`The browser could not clear the saved sign-in data: ${error.message}`);
      }
      window.location.href = "/login.html";
    }
  });

  await loadDashboardData();
});
