document.addEventListener("DOMContentLoaded", () => {
  const accountType = document.body.dataset.authRole;
  const isOwner = accountType === "owner";
  const heading = document.getElementById("authHeading");
  const form = document.getElementById("authForm");
  const nameField = document.getElementById("authNameField");
  const nameInput = document.getElementById("authName");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const submitButton = document.getElementById("authSubmit");
  const modeToggle = document.getElementById("authModeToggle");
  const messageHost = document.getElementById("authMessage");
  let mode = "login";

  if (!form || !modeToggle || !messageHost || !["customer", "owner"].includes(accountType)) {
    console.error("Authentication page is missing required form configuration.");
    return;
  }

  const setMessage = (message, type = "success") => {
    messageHost.replaceChildren();
    if (!message) return;
    const alert = document.createElement("div");
    alert.className = `alert ${type}`;
    alert.textContent = message;
    messageHost.appendChild(alert);
  };

  const updateMode = () => {
    const registering = mode === "register";
    heading.textContent = isOwner
      ? (registering ? "Create Salon Owner Account" : "Salon Owner Login")
      : (registering ? "Create Customer Account" : "Customer Login");
    nameField.hidden = !registering;
    nameInput.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    submitButton.textContent = registering
      ? (isOwner ? "Create Salon Owner Account" : "Create Customer Account")
      : (isOwner ? "Salon Owner Login" : "Customer Login");
    modeToggle.textContent = registering
      ? "Already registered? Sign in"
      : (isOwner ? "New salon owner? Create an account" : "New customer? Create an account");
    setMessage("");
  };

  modeToggle.addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    updateMode();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setMessage("");

    const endpoint = isOwner
      ? (mode === "register" ? "/api/auth/register" : "/api/auth/login")
      : (mode === "register" ? "/api/auth/customer/register" : "/api/auth/customer/login");
    const body = {
      email: emailInput.value.trim(),
      password: passwordInput.value
    };
    if (mode === "register") body.name = nameInput.value.trim();

    try {
      const data = await window.apiFetch(endpoint, { method: "POST", body });
      const expectedRole = isOwner ? "admin" : "customer";
      if (data.user?.role !== expectedRole || !data.token) {
        throw new Error("The server did not return a valid sign-in session for this account type.");
      }

      const tokenKey = isOwner ? "adminToken" : "customerToken";
      const userKey = isOwner ? "adminUser" : "customerUser";
      const otherTokenKey = isOwner ? "customerToken" : "adminToken";
      const otherUserKey = isOwner ? "customerUser" : "adminUser";
      localStorage.setItem(tokenKey, data.token);
      localStorage.setItem(userKey, JSON.stringify(data.user));
      localStorage.removeItem(otherTokenKey);
      localStorage.removeItem(otherUserKey);

      setMessage(isOwner ? "Signed in. Opening your salon dashboard…" : "Signed in. Opening the customer homepage…");
      window.location.href = isOwner
        ? "/dashboard.html"
        : (window.shopRoute ? window.shopRoute("/") : "/");
    } catch (error) {
      setMessage(error.message || "Unable to sign in.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  if (new URLSearchParams(window.location.search).get("mode") === "register") {
    mode = "register";
    updateMode();
  }
});
