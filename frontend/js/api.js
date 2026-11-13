window.API_CONFIG = window.API_CONFIG || {};
const API_BASE_URL = window.API_CONFIG.baseUrl || window.location.origin;
const shopPathMatch = window.location.pathname.match(/^\/shop\/([^/]+)(?:\/|$)/);
const shopSlug = shopPathMatch ? decodeURIComponent(shopPathMatch[1]) : "";
const publicPageRoutes = new Map([
  ["/", ""],
  ["/index.html", ""],
  ["/about.html", "about"],
  ["/services.html", "services"],
  ["/contact.html", "contact"],
  ["/booking.html", "booking"],
  ["/my-bookings.html", "my-bookings"],
  ["/payment-summary.html", "payment-summary"],
  ["/payment.html", "payment"],
  ["/payment-success.html", "payment-success"],
  ["/login.html", "login"],
  ["/salon-owner-login.html", "salon-owner-login"]
]);

window.API_BASE_URL = API_BASE_URL;
window.SHOP_SLUG = shopSlug;
window.shopRoute = (page = "") => {
  const url = new URL(page.startsWith("/") ? page : `/${page}`, window.location.origin);
  if (!shopSlug) return `${url.pathname}${url.search}${url.hash}`;
  const route = publicPageRoutes.get(url.pathname);
  if (route === undefined) return `${url.pathname}${url.search}${url.hash}`;
  const path = route ? `/shop/${encodeURIComponent(shopSlug)}/${route}` : `/shop/${encodeURIComponent(shopSlug)}`;
  return `${path}${url.search}${url.hash}`;
};

if (shopSlug && document.body) {
  const rewriteLinks = (root) => {
    const anchors = [];
    if (root.matches && root.matches('a[href^="/"]')) anchors.push(root);
    if (root.querySelectorAll) anchors.push(...root.querySelectorAll('a[href^="/"]'));

    anchors.forEach((anchor) => {
      const url = new URL(anchor.getAttribute("href"), window.location.origin);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/shop/")) return;
      const route = publicPageRoutes.get(url.pathname);
      if (route === undefined) return;
      const path = route ? `/shop/${encodeURIComponent(shopSlug)}/${route}` : `/shop/${encodeURIComponent(shopSlug)}`;
      anchor.setAttribute("href", `${path}${url.search}${url.hash}`);
    });
  };

  rewriteLinks(document);
  new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) rewriteLinks(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}

window.apiFetch = async function apiFetch(path, options = {}) {
  const isJsonRequest = !(options.body instanceof FormData) && !options.headers?.["Content-Type"]?.startsWith("multipart/");
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem("customerToken") || localStorage.getItem("adminToken");
  const hasAuthorization = Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
  if (token && !hasAuthorization) headers.Authorization = `Bearer ${token}`;

  if (isJsonRequest && options.body && typeof options.body !== "string") {
    options.body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  const requestUrl = new URL(`${API_BASE_URL}${path}`);
  if (shopSlug && requestUrl.pathname.startsWith("/api/")) {
    requestUrl.searchParams.set("businessSlug", shopSlug);
  }
  const response = await fetch(requestUrl, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) throw new Error("The server returned an invalid response.");
      data = {
        message: response.status === 413
          ? "The request is too large. Reduce uploaded image sizes and try again."
          : `The request failed with status ${response.status}.`
      };
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.response = response;
    error.data = data;
    throw error;
  }

  return data;
};
