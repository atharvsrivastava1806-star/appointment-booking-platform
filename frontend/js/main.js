const escapeHTML = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

const formatBusinessTime = (value) => {
  const match = typeof value === "string" && value.match(/^(\d{1,2}):([0-5]\d)(?:\s*(AM|PM))?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3]?.toUpperCase();
  if (hour > 23 || (suffix && hour > 12)) return "";
  if (suffix) hour = hour % 12 + (suffix === "PM" ? 12 : 0);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
};

const summarizeBusinessHours = (business) => {
  const schedule = Array.isArray(business.weeklySchedule) ? business.weeklySchedule : [];
  if (schedule.length) {
    const patterns = schedule
      .filter((entry) => !entry.closed)
      .map((entry) => (entry.sessions || [])
        .map((session) => [formatBusinessTime(session.open), formatBusinessTime(session.close)])
        .filter(([open, close]) => open && close)
        .map(([open, close]) => `${open} – ${close}`)
        .join(", "))
      .filter(Boolean);
    if (!patterns.length) return "Closed";
    const uniquePatterns = [...new Set(patterns)];
    return uniquePatterns.length === 1 ? uniquePatterns[0] : "Hours vary by day";
  }

  const open = formatBusinessTime(business.openingHours);
  const close = formatBusinessTime(business.closingHours);
  return open && close ? `${open} – ${close}` : "Hours unavailable";
};

document.addEventListener("DOMContentLoaded", async () => {
  const guestWelcome = document.getElementById("guestWelcome");
  const fullHomeContent = document.getElementById("fullHomeContent");
  const isHomePage = Boolean(guestWelcome && fullHomeContent);
  const requiresAuthentication = document.body.hasAttribute("data-authentication-required");
  const savedCustomerToken = localStorage.getItem("customerToken") || "";
  const savedAdminToken = localStorage.getItem("adminToken") || "";
  const authToken = savedCustomerToken || savedAdminToken;
  let signedInUser = null;

  const brandNames = document.querySelectorAll("[data-brand-name]");
  const brandLogos = document.querySelectorAll("[data-brand-logo]");
  const phoneEls = document.querySelectorAll("[data-phone]");
  const emailEls = document.querySelectorAll("[data-email]");
  const addressEls = document.querySelectorAll("[data-address]");
  const whatsappEl = document.querySelector("[data-whatsapp]");
  const hoursEls = document.querySelectorAll("[data-hours]");
  const siteHeader = document.getElementById("siteHeader");
  const heroTitle = document.querySelector("[data-hero-title]");
  const heroDescription = document.querySelector("[data-hero-description]");
  const heroImage = document.querySelector("[data-hero-image]");
  const serviceList = document.getElementById("serviceList");
  const galleryList = document.getElementById("galleryList");
  const reviewList = document.getElementById("reviewList");
  const facilitiesList = document.getElementById("facilitiesList");
  const aboutTestimonials = document.getElementById("aboutTestimonials");
  const toggle = document.querySelector(".mobile-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (toggle && navLinks) {
    toggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });
  }

  if (authToken) {
    try {
      const { user } = await window.apiFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (user && ["customer", "admin"].includes(user.role)) {
        signedInUser = user;
      } else {
        throw new Error("This account cannot access customer pages.");
      }
    } catch (error) {
      console.error("Unable to verify the current account:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem(savedCustomerToken ? "customerToken" : "adminToken");
        localStorage.removeItem(savedCustomerToken ? "customerUser" : "adminUser");
      }
    }
  }

  if (isHomePage) {
    if (signedInUser?.role === "admin") {
      window.location.replace("/dashboard.html");
      return;
    }

    try {
      const welcome = await window.apiFetch("/api/business/welcome");
      if (welcome.name) {
        brandNames.forEach((element) => { element.textContent = welcome.name; });
      }
      brandLogos.forEach((element) => { element.src = welcome.logo || "/assets/logo-placeholder.svg"; });
      const welcomeImage = document.querySelector("[data-welcome-image]");
      if (welcomeImage && welcome.heroImage) welcomeImage.src = welcome.heroImage;
    } catch (error) {
      console.error("Unable to load public welcome information:", error);
    }

    if (!signedInUser) return;
    guestWelcome.hidden = true;
    fullHomeContent.hidden = false;
    document.body.classList.remove("welcome-entry");
    document.body.classList.add("customer-authenticated");
    if (siteHeader) siteHeader.hidden = false;
  } else if (requiresAuthentication && !signedInUser) {
    const loginPath = window.shopRoute ? window.shopRoute("/login.html") : "/login.html";
    window.location.replace(loginPath);
    return;
  }

  if (signedInUser && requiresAuthentication) {
    document.body.removeAttribute("data-authentication-required");
    document.body.classList.add("customer-authenticated");
  }

  try {
    const business = await window.apiFetch("/api/business");

    if (business && business.name) {
      brandNames.forEach((element) => { element.textContent = business.name; });
      brandLogos.forEach((element) => { element.src = business.logo || "/assets/logo-placeholder.svg"; });
      phoneEls.forEach((element) => { element.textContent = business.phone || ""; });
      emailEls.forEach((element) => { element.textContent = business.email || ""; });
      const fullAddress = [business.address, business.city, business.state, business.pinCode].filter(Boolean).join(", ");
      addressEls.forEach((element) => { element.textContent = fullAddress || "Address not provided"; });
      const hoursText = summarizeBusinessHours(business);
      hoursEls.forEach((element) => { element.textContent = hoursText; });
      const mapLink = document.querySelector("[data-business-map]");
      if (mapLink) {
        try {
          const mapUrl = new URL(business.mapLink);
          const validProtocol = mapUrl.protocol === "https:" || mapUrl.protocol === "http:";
          mapLink.hidden = !validProtocol;
          if (validProtocol) mapLink.href = mapUrl.href;
        } catch {
          mapLink.hidden = true;
        }
      }
      if (whatsappEl) {
        const clean = (business.whatsapp || "").replace(/\D/g, "");
        if (clean) {
          whatsappEl.href = `https://wa.me/${clean}`;
          whatsappEl.removeAttribute("aria-disabled");
        } else {
          whatsappEl.removeAttribute("href");
          whatsappEl.setAttribute("aria-disabled", "true");
        }
      }

      document.documentElement.style.setProperty("--primary-color", business.websiteColors?.primaryColor || "#8b5cf6");
      document.documentElement.style.setProperty("--secondary-color", business.websiteColors?.secondaryColor || "#f59e0b");
      document.documentElement.style.setProperty("--background-color", business.websiteColors?.backgroundColor || "#f6f7fb");
      document.documentElement.style.setProperty("--text-color", business.websiteColors?.textColor || "#101828");

      if (heroTitle) {
        heroTitle.textContent = isHomePage
          ? `Welcome, ${signedInUser?.name || "back"}`
          : business.name;
      }
      if (heroDescription) {
        heroDescription.textContent = isHomePage
          ? "Browse nearby salons or choose an appointment time that suits you."
          : business.description || "Professional services tailored to your needs.";
      }
      if (heroImage && (business.heroImage || business.aboutImage)) {
        heroImage.src = business.heroImage || business.aboutImage;
      }
    }

    if (reviewList) {
      let reviews = [];
      try {
        reviews = await window.apiFetch("/api/reviews");
      } catch (error) {
        console.error("Failed to load customer reviews:", error);
      }

      const actualReviews = Array.isArray(reviews)
        ? reviews.filter((review) => review && review.demo !== true).slice(0, 3)
        : [];
      const sampleReviews = Array.isArray(business.testimonials)
        ? business.testimonials.filter((review) => review && review.isDemo === true).slice(0, 3)
        : [];
      const displayedReviews = actualReviews.length ? actualReviews : sampleReviews;
      reviewList.innerHTML = displayedReviews.map((review) => {
        const name = String(review.name || "Customer");
        const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
        const rating = Math.min(5, Math.max(0, Math.round(Number(review.rating) || 0)));
        const demoLabel = review.isDemo === true || review.demo === true
          ? '<span class="demo-review-label">Demo Review</span>'
          : "";

        return `
          <article class="review-card">
            <div class="review-author">
              <span class="review-avatar" aria-hidden="true">${escapeHTML(initials)}</span>
              <div>
                <h3>${escapeHTML(name)}</h3>
                ${demoLabel}
              </div>
            </div>
            <div class="stars" role="img" aria-label="${rating} out of 5 stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
            <p>“${escapeHTML(review.review || "")}”</p>
          </article>
        `;
      }).join("");
    }

    const aboutHeading = document.querySelector("[data-about-heading]");
    const aboutDescription = document.querySelector("[data-about-description]");
    const aboutExperience = document.querySelector("[data-about-experience]");
    const aboutImage = document.querySelector("[data-about-image]");

    if (aboutHeading) aboutHeading.textContent = business.aboutHeading || "A welcoming experience, tailored to you";
    if (aboutDescription) aboutDescription.textContent = business.aboutDescription || business.description || "";
    if (aboutExperience) {
      aboutExperience.textContent = business.experienceDescription ||
        "From choosing a service to arriving for your appointment, we aim to make your experience comfortable, clear and easy.";
    }
    if (aboutImage) {
      aboutImage.src = business.aboutImage || business.heroImage ||
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85";
    }

    if (facilitiesList) {
      const facilities = Array.isArray(business.facilities) ? business.facilities : [];
      facilitiesList.innerHTML = facilities.length
        ? facilities.map((facility) => `
            <article class="facility-card">
              ${facility.image
                ? `<img class="facility-image" src="${escapeHTML(facility.image)}" alt="${escapeHTML(facility.title)}" loading="lazy" />`
                : `<span class="facility-icon" aria-hidden="true">${escapeHTML(facility.icon || "✦")}</span>`}
              <h3>${escapeHTML(facility.title)}</h3>
              <p>${escapeHTML(facility.description || "")}</p>
            </article>
          `).join("")
        : '<p class="empty-state">Facilities will be listed here soon.</p>';
    }

    if (aboutTestimonials) {
      let customerReviews = [];
      try {
        const reviews = await window.apiFetch("/api/reviews");
        customerReviews = Array.isArray(reviews) ? reviews.filter((review) => review && review.demo !== true) : [];
      } catch (error) {
        console.error("Failed to load approved customer reviews:", error);
      }

      const savedTestimonials = Array.isArray(business.testimonials)
        ? business.testimonials.map((review) => ({ ...review, isDemo: true }))
        : [];
      const testimonials = [
        ...customerReviews.map((review) => ({ ...review, isDemo: false })),
        ...savedTestimonials
      ];
      const displayedTestimonials = testimonials.slice(0, 6);

      aboutTestimonials.innerHTML = displayedTestimonials.length ? displayedTestimonials.map((review) => {
        const name = String(review.name || "Customer");
        const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
        const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5)));
        const sampleLabel = review.isDemo === true
          ? '<span class="demo-review-label">Demo Review</span>'
          : "";

        return `
          <article class="review-card">
            <div class="review-author">
              <span class="review-avatar" aria-hidden="true">${escapeHTML(initials)}</span>
              <div>
                <h3>${escapeHTML(name)}</h3>
                <span class="review-location">${escapeHTML(review.location || "Customer")}</span>
                ${sampleLabel}
              </div>
            </div>
            <div class="stars" role="img" aria-label="${rating} out of 5 stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
            <p>“${escapeHTML(review.review || "")}”</p>
          </article>
        `;
      }).join("") : '<p class="empty-state">No reviews have been published yet.</p>';
    }

    if (serviceList) {
      const services = await window.apiFetch("/api/services");
      if (Array.isArray(services) && services.length) {
        serviceList.innerHTML = services
          .slice(0, 6)
          .map(
            (service) => `
              <article class="service-card">
                <div class="icon">✦</div>
                <div>
                  <h3>${escapeHTML(service.name)}</h3>
                  <p>${escapeHTML(service.description || "")}</p>
                </div>
                <div class="service-meta">
                  <span>${escapeHTML(service.duration || 30)} min</span>
                  <span class="price">₹${escapeHTML(service.price || 0)}</span>
                </div>
                <div class="book-link">
                  <a class="btn btn-primary" href="/booking.html?serviceId=${encodeURIComponent(service._id)}">Book Now</a>
                </div>
              </article>
            `
          )
          .join("");
      } else {
        serviceList.innerHTML = "<p>No services currently available.</p>";
      }
    }

    if (galleryList && business.gallery && business.gallery.length) {
      galleryList.innerHTML = business.gallery
        .map(
          (item) => `
            <article class="gallery-item">
              <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" />
              <div class="gallery-content">
                <h3>${escapeHTML(item.title)}</h3>
                <p>${escapeHTML(item.description)}</p>
              </div>
            </article>
          `
        )
        .join("");
    }

  } catch (error) {
    console.error("Failed to load business page data:", error);
    const unavailableMessage = '<p class="empty-state">Business information is temporarily unavailable. Please try again later.</p>';
    if (facilitiesList && !facilitiesList.querySelector(".facility-card")) facilitiesList.innerHTML = unavailableMessage;
    if (aboutTestimonials && !aboutTestimonials.querySelector(".review-card")) aboutTestimonials.innerHTML = unavailableMessage;
    if (serviceList && !serviceList.querySelector(".service-card")) serviceList.innerHTML = unavailableMessage;
    if (galleryList && !galleryList.querySelector(".gallery-item")) galleryList.innerHTML = unavailableMessage;
  }
});