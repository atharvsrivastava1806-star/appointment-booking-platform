document.addEventListener("DOMContentLoaded", () => {
  const amountElement = document.getElementById("paymentAmount");
  const message = document.getElementById("paymentMessage");
  const payButton = document.getElementById("payButton");
  const bookingDataKey = "bookingData";
  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  });

  const setMessage = (text) => {
    message.textContent = text;
  };

  const setField = (field, elementId, value) => {
    const wrapper = document.querySelector(`[data-checkout-field="${field}"]`);
    const element = document.getElementById(elementId);
    const text = value == null ? "" : String(value).trim();
    const hasValue = text && !["undefined", "null"].includes(text.toLowerCase());

    if (!wrapper || !element) return false;
    wrapper.hidden = !hasValue;
    if (hasValue) element.textContent = text;
    return Boolean(hasValue);
  };

  let booking;
  try {
    const storedBooking = localStorage.getItem(bookingDataKey);
    booking = storedBooking ? JSON.parse(storedBooking) : null;
  } catch (error) {
    console.error("Unable to read booking details from localStorage:", error);
    setMessage("Your booking details could not be read. Return to the booking page and submit your appointment again.");
    payButton.disabled = true;
    return;
  }

  if (!booking || typeof booking !== "object" || Array.isArray(booking)) {
    setMessage("No booking details were found. Please book an appointment before paying.");
    payButton.disabled = true;
    return;
  }

  const servicePrice = Number(booking.servicePrice ?? booking.price);
  const charges = booking.charges == null ? 0 : Number(booking.charges);
  const storedTotal = booking.totalAmount == null ? NaN : Number(booking.totalAmount);
  const amount = Number.isFinite(storedTotal) ? storedTotal : servicePrice + charges;

  if (Number.isFinite(amount) && amount >= 0) {
    amountElement.textContent = currency.format(amount);
  }

  const displayedFields = [
    setField("bookingId", "checkoutBookingId", booking.bookingId),
    setField("customerName", "checkoutCustomerName", booking.name),
    setField("customerEmail", "checkoutCustomerEmail", booking.email),
    setField("customerPhone", "checkoutCustomerPhone", booking.phone),
    setField("serviceName", "checkoutServiceName", booking.serviceName),
    setField("staffName", "checkoutStaffName", booking.staffName),
    setField("date", "checkoutDate", booking.date),
    setField("time", "checkoutTime", booking.time),
    setField("servicePrice", "checkoutServicePrice", Number.isFinite(servicePrice) ? currency.format(servicePrice) : ""),
    setField("charges", "checkoutCharges", Number.isFinite(charges) ? currency.format(charges) : "")
  ];
  setField(
    "serviceDuration",
    "checkoutServiceDuration",
    Number.isFinite(Number(booking.serviceDuration)) && Number(booking.serviceDuration) > 0
      ? `${Number(booking.serviceDuration)} mins`
      : ""
  );

  const requiredBookingFields = [
    booking.bookingId,
    booking.appointmentId,
    booking.serviceId,
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
    Number.isFinite(amount) && amount > 0;

  if (!requiredBookingFields || !validAmounts || displayedFields.some((visible) => !visible)) {
    setMessage("Booking details are incomplete or the payable amount is invalid. Return to the booking page and submit your appointment again.");
    payButton.disabled = true;
    return;
  }

  payButton.addEventListener("click", async () => {
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    if (!selected) {
      setMessage("Please select a payment method.");
      return;
    }

    payButton.disabled = true;
    setMessage("");

    try {
      const result = await window.apiFetch("/api/payments", {
        method: "POST",
        body: {
          bookingId: booking.bookingId,
          appointmentId: booking.appointmentId,
          amount,
          paymentMethod: selected.value,
          customerId: booking.customerId || null,
          serviceId: booking.serviceId,
          notes: `Booking for ${booking.serviceName}`
        }
      });

      const payment = result?.payment;
      if (!payment || !payment._id || !payment.bookingId || !payment.status ||
          Number(payment.amount) !== amount) {
        throw new Error("The payment service returned incomplete confirmation details. Please contact the business before trying again.");
      }

      const confirmation = {
        bookingId: payment.bookingId,
        appointmentId: booking.appointmentId,
        customerId: booking.customerId || null,
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        serviceDuration: booking.serviceDuration,
        staffId: booking.staffId || null,
        staffName: booking.staffName,
        date: booking.date,
        time: booking.time,
        servicePrice,
        charges,
        totalAmount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.status,
        reference: payment.transactionId || payment._id
      };

      localStorage.setItem("paymentConfirmation", JSON.stringify(confirmation));
      window.location.href = window.shopRoute ? window.shopRoute("/payment-success.html") : "/payment-success.html";
    } catch (error) {
      console.error("Payment request failed:", error);
      setMessage(error.message || "Payment could not be processed.");
      payButton.disabled = false;
    }
  });
});
