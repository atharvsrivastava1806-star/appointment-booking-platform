document.addEventListener("DOMContentLoaded", () => {
  const errorElement = document.getElementById("bookingError");
  const confirmButton = document.getElementById("confirmPayment");
  const bookingDataKey = "bookingData";
  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  });

  const showError = (message) => {
    errorElement.textContent = message;
    errorElement.hidden = false;
  };

  const setField = (field, value) => {
    const wrapper = document.querySelector(`[data-summary-field="${field}"]`);
    const valueElement = wrapper?.querySelector("strong");
    const text = value == null ? "" : String(value).trim();
    const hasValue = text && !["undefined", "null"].includes(text.toLowerCase());

    if (!wrapper || !valueElement) return false;
    wrapper.hidden = !hasValue;
    if (hasValue) valueElement.textContent = text;
    return Boolean(hasValue);
  };

  let booking;
  try {
    const storedBooking = localStorage.getItem(bookingDataKey);
    booking = storedBooking ? JSON.parse(storedBooking) : null;
  } catch (error) {
    console.error("Unable to read booking details from localStorage:", error);
    showError("Your saved booking details could not be read. Please return to the booking page and submit your appointment again.");
    return;
  }

  if (!booking || typeof booking !== "object" || Array.isArray(booking)) {
    showError("No booking details were found. Please book an appointment before continuing to payment.");
    return;
  }

  const servicePrice = Number(booking.servicePrice ?? booking.price);
  const charges = booking.charges == null ? 0 : Number(booking.charges);
  const savedTotal = booking.totalAmount == null ? NaN : Number(booking.totalAmount);
  const totalAmount = Number.isFinite(savedTotal) ? savedTotal : servicePrice + charges;

  const visibleFields = [
    setField("bookingId", booking.bookingId),
    setField("customerName", booking.name),
    setField("customerEmail", booking.email),
    setField("customerPhone", booking.phone),
    setField("serviceName", booking.serviceName),
    setField("staffName", booking.staffName),
    setField("date", booking.date),
    setField("time", booking.time),
    setField("servicePrice", Number.isFinite(servicePrice) ? currency.format(servicePrice) : ""),
    setField("charges", Number.isFinite(charges) ? currency.format(charges) : "")
  ];
  setField(
    "serviceDuration",
    Number.isFinite(Number(booking.serviceDuration)) && Number(booking.serviceDuration) > 0
      ? `${Number(booking.serviceDuration)} mins`
      : ""
  );

  const totalElement = document.getElementById("totalPrice");
  if (Number.isFinite(totalAmount) && totalAmount >= 0) {
    totalElement.textContent = currency.format(totalAmount);
  }

  const requiredValuesPresent = [
    booking.bookingId,
    booking.appointmentId,
    booking.name,
    booking.email,
    booking.phone,
    booking.serviceName,
    booking.staffName,
    booking.date,
    booking.time
  ].every((value) => value != null && String(value).trim() !== "");
  const validAmounts = Number.isFinite(servicePrice) && servicePrice >= 0 &&
    Number.isFinite(charges) && charges >= 0 &&
    Number.isFinite(totalAmount) && totalAmount > 0;

  if (!requiredValuesPresent || !validAmounts || visibleFields.some((visible) => !visible)) {
    showError("Some booking details are missing or invalid. Please return to the booking page and submit your appointment again before paying.");
    return;
  }

  confirmButton.disabled = false;
  confirmButton.addEventListener("click", () => {
    window.location.href = window.shopRoute ? window.shopRoute("/payment.html") : "/payment.html";
  });
});
