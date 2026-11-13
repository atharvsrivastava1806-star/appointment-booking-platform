(() => {
  const storageKey = "appointment-platform-theme";
  const root = document.documentElement;
  const preferences = ["light", "dark"];
  const escapeHTML = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
  let preference = "light";

  try {
    const saved = localStorage.getItem(storageKey);
    if (preferences.includes(saved)) {
      preference = saved;
    } else if (saved === "system") {
      preference = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      localStorage.setItem(storageKey, preference);
    }
  } catch (error) {
    console.error("Unable to read the saved appearance preference:", error);
  }

  const applyTheme = (persist = true) => {
    root.dataset.theme = preference;
    root.dataset.themePreference = preference;
    toggle.textContent = preference === "dark" ? "☾ Dark mode" : "☼ Light mode";
    const nextPreference = preference === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", `Appearance: ${preference} mode. Activate to use ${nextPreference} mode.`);
    if (persist) {
      try {
        localStorage.setItem(storageKey, preference);
      } catch (error) {
        console.error("Unable to save the selected appearance preference:", error);
      }
    }

    updateAppearanceButtons();
  };

  const updateAppearanceButtons = () => {
    document.querySelectorAll("[data-appearance-preference]").forEach((button) => {
      const selected = button.dataset.appearancePreference === preference;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("btn-primary", selected);
    });
  };

  window.setAppearancePreference = (nextPreference) => {
    if (!preferences.includes(nextPreference)) {
      throw new Error("Choose Light or Dark appearance.");
    }
    preference = nextPreference;
    applyTheme();
  };

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "theme-toggle";
  toggle.hidden = true;
  toggle.addEventListener("click", () => {
    window.setAppearancePreference(preference === "dark" ? "light" : "dark");
  });
  document.body.appendChild(toggle);
  applyTheme(false);

  if (document.querySelector(".auth-shell")) {
    toggle.hidden = false;
    return;
  }

  const shopHref = (path) => {
    if (typeof window.shopRoute === "function") return window.shopRoute(path);
    const match = window.location.pathname.match(/^\/shop\/([^/]+)(?:\/|$)/);
    if (!match) return path;
    const routeNames = {
      "/": "",
      "/index.html": "",
      "/services.html": "services",
      "/about.html": "about",
      "/contact.html": "contact",
      "/booking.html": "booking",
      "/login.html": "login",
      "/salon-owner-login.html": "salon-owner-login",
      "/my-bookings.html": "my-bookings",
      "/payment-summary.html": "payment-summary",
      "/payment.html": "payment",
      "/payment-success.html": "payment-success"
    };
    const url = new URL(path, window.location.origin);
    const route = routeNames[url.pathname];
    if (route === undefined) return path;
    return `/shop/${encodeURIComponent(decodeURIComponent(match[1]))}${route ? `/${route}` : ""}${url.search}${url.hash}`;
  };

  const pageRoutes = [
    { label: "Home", paths: ["/", "/index.html"], href: "/" },
    { label: "Book Appointment", paths: ["/booking.html", "/booking"], href: "/booking.html" },
    { label: "Services", paths: ["/services.html", "/services"], href: "/services.html" },
    { label: "Contact", paths: ["/contact.html", "/contact"], href: "/contact.html" },
    { label: "About Us", paths: ["/about.html", "/about"], href: "/about.html" },
    { label: "Dashboard", paths: ["/dashboard.html", "/dashboard"], href: "/dashboard.html" },
    { label: "My Bookings", paths: ["/my-bookings.html", "/my-bookings"], href: "/my-bookings.html" },
    { label: "Payment Summary", paths: ["/payment-summary.html", "/payment-summary"], href: "/payment-summary.html" },
    { label: "Payment", paths: ["/payment.html", "/payment"], href: "/payment.html" },
    { label: "Payment Success", paths: ["/payment-success.html", "/payment-success"], href: "/payment-success.html" }
  ];
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  const currentPage = pageRoutes.find(({ paths }) =>
    paths.some((path) => currentPath === path || (path !== "/" && currentPath.endsWith(path)))
  ) || (/^\/shop\/[^/]+$/.test(currentPath) ? pageRoutes[0] : null);
  const pageNav = document.querySelector(".nav-links");
  const currentPageLink = pageNav?.querySelector("a");
  if (currentPage && currentPageLink) {
    currentPageLink.textContent = currentPage.label;
    currentPageLink.href = shopHref(currentPage.href);
    currentPageLink.setAttribute("aria-current", "page");
  }

  const isDashboard = Boolean(document.querySelector(".dashboard-shell"));
  if (isDashboard) {
    const title = document.getElementById("dashboardPageTitle");
    const description = document.getElementById("dashboardPageDescription");
    const breadcrumb = document.getElementById("dashboardBreadcrumb");
    const updateDashboardLocation = () => {
      const section = window.location.hash.slice(1);
      const current = section === "contact-details"
        ? "contact-details"
        : section === "business-settings"
          ? "business-settings"
          : "dashboard";
      const page = {
        dashboard: {
          title: "Dashboard",
          description: "Manage bookings, services, staff and business info",
          crumbs: [{ label: "Dashboard", href: "/dashboard.html", current: true }]
        },
        "business-settings": {
          title: "Business Settings",
          description: "Update the information, hours and facilities shown on your shop pages.",
          crumbs: [
            { label: "Dashboard", href: "/dashboard.html" },
            { label: "Business Settings", href: "#business-settings", current: true }
          ]
        },
        "contact-details": {
          title: "Contact Details",
          description: "Manage the phone, email and address shown to your customers.",
          crumbs: [
            { label: "Dashboard", href: "/dashboard.html" },
            { label: "Business Settings", href: "#business-settings" },
            { label: "Contact Details", href: "#contact-details", current: true }
          ]
        }
      }[current];

      if (title) title.textContent = page.title;
      if (description) description.textContent = page.description;
      if (breadcrumb) {
        breadcrumb.innerHTML = page.crumbs.map((crumb, index) => `
          ${index ? '<span aria-hidden="true">/</span>' : ""}
          ${crumb.current
            ? `<span aria-current="page">${escapeHTML(crumb.label)}</span>`
            : `<a href="${escapeHTML(crumb.href)}">${escapeHTML(crumb.label)}</a>`}
        `).join("");
      }
      document.querySelectorAll("[data-dashboard-nav]").forEach((link) => {
        const selected = link.dataset.dashboardNav === (current === "dashboard" ? "dashboard" : "business-settings");
        if (selected) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    };
    updateDashboardLocation();
    window.addEventListener("hashchange", updateDashboardLocation);
  }

  const navHost = document.querySelector(".nav-actions");
  if (!navHost && !isDashboard && !document.querySelector(".payment-container") && !document.querySelector(".my-bookings")) {
    toggle.hidden = false;
    return;
  }
  const host = navHost || document.body;
  const profileHost = document.createElement("div");
  profileHost.className = `profile-menu-host${navHost ? "" : " profile-menu-floating"}`;
  profileHost.innerHTML = `
    <button class="profile-menu-trigger" type="button" aria-haspopup="true" aria-expanded="false">
      Login / Sign Up
    </button>
    <section class="profile-menu-popover" aria-label="Profile and navigation" hidden>
      <div class="profile-menu-heading"></div>
      <nav class="profile-menu-links" aria-label="Profile navigation"></nav>
      <button class="profile-menu-settings-toggle" type="button" aria-expanded="false" hidden>Settings</button>
      <section class="profile-menu-settings" aria-label="Settings" hidden>
        <section class="appearance-settings" aria-label="Appearance">
          <h3>Appearance</h3>
          <div class="appearance-options" role="group" aria-label="Choose light or dark mode">
            <button type="button" class="appearance-option" data-appearance-preference="light" aria-pressed="false">
              <span class="appearance-icon" aria-hidden="true">☼</span>
              <strong>Light Mode</strong>
              <small>Bright and clear</small>
            </button>
            <button type="button" class="appearance-option" data-appearance-preference="dark" aria-pressed="false">
              <span class="appearance-icon" aria-hidden="true">☾</span>
              <strong>Dark Mode</strong>
              <small>Easy on the eyes</small>
            </button>
          </div>
        </section>
        <form class="profile-menu-profile-form" hidden>
          <label for="profileDisplayName">Profile name</label>
          <input id="profileDisplayName" name="name" maxlength="80" required />
          <label for="profileEmail">Email</label>
          <input id="profileEmail" type="email" readonly />
          <button class="btn btn-primary" type="submit">Save profile</button>
          <p class="profile-menu-status" aria-live="polite"></p>
        </form>
        <div class="profile-menu-account" hidden>
          <strong>Account settings</strong>
          <p>Manage your profile details or end this session securely.</p>
        </div>
      </section>
      <button class="profile-menu-logout" type="button" hidden>Log Out</button>
      <p class="profile-menu-status profile-menu-general-status" aria-live="polite"></p>
    </section>
  `;
  if (navHost) {
    const oldAdminLink = navHost.querySelector('a[href*="login.html"]');
    if (oldAdminLink) oldAdminLink.remove();
    navHost.insertBefore(profileHost, navHost.querySelector(".mobile-toggle") || null);
  } else {
    host.appendChild(profileHost);
  }

  const trigger = profileHost.querySelector(".profile-menu-trigger");
  const popover = profileHost.querySelector(".profile-menu-popover");
  const heading = profileHost.querySelector(".profile-menu-heading");
  const links = profileHost.querySelector(".profile-menu-links");
  const settingsToggle = profileHost.querySelector(".profile-menu-settings-toggle");
  const settingsPanel = profileHost.querySelector(".profile-menu-settings");
  const profileForm = profileHost.querySelector(".profile-menu-profile-form");
  const accountPanel = profileHost.querySelector(".profile-menu-account");
  const logoutButton = profileHost.querySelector(".profile-menu-logout");
  const generalStatus = profileHost.querySelector(".profile-menu-general-status");
  const profileName = profileHost.querySelector("#profileDisplayName");
  const profileEmail = profileHost.querySelector("#profileEmail");
  let currentToken = "";
  let currentRole = "";
  let currentUser = null;

  const publicLinks = [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services.html" },
    { label: "About Us", href: "/about.html" },
    { label: "Contact", href: "/contact.html" }
  ];
  const setLinks = (items) => {
    links.innerHTML = items.map((item) => `<a href="${escapeHTML(shopHref(item.href))}">${escapeHTML(item.label)}</a>`).join("");
  };

  const renderProfile = () => {
    if (currentRole === "customer" || currentRole === "admin") {
      const name = currentUser?.name || currentUser?.email || "Account";
      const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
      trigger.textContent = initials || "Account";
      trigger.setAttribute("aria-label", `Open profile menu for ${name}`);
      heading.innerHTML = `<strong>${escapeHTML(name)}</strong><small>${escapeHTML(currentUser?.email || "")}</small>`;
      const items = [];
      if (currentRole === "customer") {
        items.push({ label: "My Profile", action: "profile" });
        items.push({ label: "My Bookings", href: "/my-bookings.html" });
      } else {
        items.push({ label: "Salon Owner Dashboard", href: "/dashboard.html" });
      }
      items.push(...publicLinks);
      links.innerHTML = items.map((item) => item.action
        ? `<button type="button" data-profile-action="${item.action}">${escapeHTML(item.label)}</button>`
        : `<a href="${escapeHTML(shopHref(item.href))}">${escapeHTML(item.label)}</a>`).join("");
      settingsToggle.hidden = false;
      logoutButton.hidden = false;
      accountPanel.hidden = false;
      profileForm.hidden = currentRole !== "customer";
      profileName.value = currentUser?.name || "";
      profileEmail.value = currentUser?.email || "";
      updateAppearanceButtons();
    } else {
      trigger.textContent = "Login / Sign Up";
      trigger.setAttribute("aria-label", "Open login and public navigation");
      heading.innerHTML = "<strong>Explore</strong>";
      setLinks([
        { label: "Login", href: "/login.html" },
        { label: "Sign Up", href: "/login.html?mode=register" },
        { label: "Salon Owner Login", href: "/salon-owner-login.html" },
        { label: "Salon Owner Sign Up", href: "/salon-owner-login.html?mode=register" },
        { label: "Home", href: "/" }
      ]);
      settingsToggle.hidden = true;
      logoutButton.hidden = true;
      accountPanel.hidden = true;
      profileForm.hidden = true;
    }
  };

  const loadSession = async () => {
    try {
      currentToken = localStorage.getItem("customerToken") || "";
      currentRole = currentToken ? "customer" : "";
      if (!currentToken) {
        currentToken = localStorage.getItem("adminToken") || "";
        currentRole = currentToken ? "admin" : "";
      }
      if (!currentToken) {
        renderProfile();
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" }
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(currentRole === "customer" ? "customerToken" : "adminToken");
          localStorage.removeItem(currentRole === "customer" ? "customerUser" : "adminUser");
          currentToken = "";
          currentRole = "";
          renderProfile();
          return;
        }
        throw new Error(`Unable to verify the account (HTTP ${response.status}).`);
      }

      const data = await response.json();
      currentUser = data.user;
      if (currentUser?.role !== currentRole) {
        localStorage.removeItem(currentRole === "customer" ? "customerToken" : "adminToken");
        localStorage.removeItem(currentRole === "customer" ? "customerUser" : "adminUser");
        currentToken = "";
        currentRole = "";
        renderProfile();
        return;
      }
      localStorage.setItem(currentRole === "customer" ? "customerUser" : "adminUser", JSON.stringify(currentUser));
      renderProfile();
    } catch (error) {
      console.error("Unable to load the signed-in profile:", error);
      generalStatus.textContent = "Profile details could not be refreshed. The saved session is still available.";
      try {
        const key = currentRole === "customer" ? "customerUser" : "adminUser";
        const saved = localStorage.getItem(key);
        currentUser = saved ? JSON.parse(saved) : null;
      } catch (storageError) {
        console.error("Unable to read saved profile details:", storageError);
      }
      renderProfile();
    }
  };

  const closePopover = (restoreFocus = false) => {
    popover.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  trigger.addEventListener("click", () => {
    const shouldOpen = popover.hidden;
    popover.hidden = !shouldOpen;
    trigger.setAttribute("aria-expanded", String(shouldOpen));
    if (shouldOpen) {
      const firstLink = popover.querySelector("a, button:not([hidden])");
      firstLink?.focus();
    }
  });
  popover.addEventListener("click", (event) => {
    const appearance = event.target.closest("[data-appearance-preference]");
    if (appearance) {
      window.setAppearancePreference(appearance.dataset.appearancePreference);
      return;
    }
    const action = event.target.closest("[data-profile-action]");
    if (action?.dataset.profileAction === "profile") {
      settingsPanel.hidden = false;
      settingsToggle.setAttribute("aria-expanded", "true");
      profileForm.hidden = false;
      profileName.focus();
    }
  });
  settingsToggle.addEventListener("click", () => {
    settingsPanel.hidden = !settingsPanel.hidden;
    settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
    if (!settingsPanel.hidden) settingsPanel.querySelector('[data-appearance-preference][aria-pressed="true"]')?.focus();
  });
  document.addEventListener("click", (event) => {
    if (!profileHost.contains(event.target)) closePopover();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popover.hidden) closePopover(true);
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveButton = profileForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    const status = profileForm.querySelector(".profile-menu-status");
    status.textContent = "";
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ name: profileName.value.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update your profile.");
      currentUser = data.user;
      localStorage.setItem("customerUser", JSON.stringify(currentUser));
      renderProfile();
      status.textContent = "Profile saved.";
    } catch (error) {
      status.textContent = error.message || "Unable to update your profile.";
    } finally {
      saveButton.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    let revocationError = null;
    let localClearError = null;
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Logout could not be confirmed (HTTP ${response.status}).`);
      }
    } catch (error) {
      revocationError = error;
      console.error("Server-side logout failed:", error);
    } finally {
      try {
        localStorage.removeItem("customerToken");
        localStorage.removeItem("customerUser");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
      } catch (error) {
        localClearError = error;
        console.error("Unable to clear the local sign-in state:", error);
      }
    }
    if (revocationError) {
      window.alert(`You were signed out on this device, but server-side token revocation failed: ${revocationError.message}`);
    }
    if (localClearError) {
      window.alert(`The server session was closed, but this browser could not clear the saved sign-in data: ${localClearError.message}`);
    }
    window.location.href = shopHref("/");
  });

  renderProfile();
  const sessionPromise = loadSession();
  document.addEventListener("click", async (event) => {
    const anchor = event.target.closest("a[href]");
    if (!anchor) return;
    const target = new URL(anchor.href, window.location.href);
    const pathname = target.pathname.replace(/\/$/, "");
    if (!pathname.endsWith("/booking.html") && !/\/shop\/[^/]+\/booking$/.test(pathname)) return;

    event.preventDefault();
    await sessionPromise;
    window.location.href = currentRole === "customer" || currentRole === "admin"
      ? anchor.href
      : shopHref("/login.html");
  });
})();
