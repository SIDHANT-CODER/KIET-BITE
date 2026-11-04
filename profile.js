const profileStatus = document.querySelector("#profile-status");
const profileContent = document.querySelector("#profile-content");
const signedOutMessage = document.querySelector("#profile-signed-out");
const logoutButton = document.querySelector("#profile-logout");
const logoutStatus = document.querySelector("#profile-logout-status");
const orderHistoryStatus = document.querySelector("#order-history-status");
const orderHistoryEmpty = document.querySelector("#order-history-empty");
const orderHistoryList = document.querySelector("#order-history-list");
const pickupPassDialog = document.querySelector("#pickup-pass-dialog");
const pickupPassClose = document.querySelector("#pickup-pass-close");
const pickupPassDialogStatus = document.querySelector("#pickup-pass-dialog-status");
const pickupPassDialogContent = document.querySelector("#pickup-pass-dialog-content");
const profilePickupPassQr = document.querySelector("#profile-pickup-pass-qr");
const profilePickupPassLocation = document.querySelector("#profile-pickup-pass-location");
const profilePickupPassTime = document.querySelector("#profile-pickup-pass-time");
const profilePickupPassOrder = document.querySelector("#profile-pickup-pass-order");

if (
  !(profileStatus instanceof HTMLElement) ||
  !(profileContent instanceof HTMLElement) ||
  !(signedOutMessage instanceof HTMLElement) ||
  !(logoutButton instanceof HTMLButtonElement) ||
  !(logoutStatus instanceof HTMLElement) ||
  !(orderHistoryStatus instanceof HTMLElement) ||
  !(orderHistoryEmpty instanceof HTMLElement) ||
  !(orderHistoryList instanceof HTMLElement) ||
  !(pickupPassDialog instanceof HTMLDialogElement) ||
  !(pickupPassClose instanceof HTMLButtonElement) ||
  !(pickupPassDialogStatus instanceof HTMLElement) ||
  !(pickupPassDialogContent instanceof HTMLElement) ||
  !(profilePickupPassQr instanceof HTMLImageElement) ||
  !(profilePickupPassLocation instanceof HTMLElement) ||
  !(profilePickupPassTime instanceof HTMLElement) ||
  !(profilePickupPassOrder instanceof HTMLElement)
) {
  throw new Error("The profile page is missing a required element.");
}

const orderStatuses = new Set(["awaiting_payment", "placed", "preparing", "ready", "collected", "cancelled"]);

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`The profile page is missing ${selector}.`);
  }
  element.textContent = value;
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formatMemberSince(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("The account creation date could not be read.");
  }
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function formatOrderDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("An order date could not be read.");
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function createOrderCard(order) {
  if (
    !order ||
    typeof order.orderNumber !== "string" ||
    typeof order.courtId !== "string" ||
    typeof order.courtName !== "string" ||
    typeof order.pickupLocation !== "string" ||
    typeof order.pickupSlot !== "string" ||
    !Array.isArray(order.items) ||
    !Number.isInteger(order.totalAmount) ||
    typeof order.createdAt !== "string" ||
    typeof order.status !== "string" ||
    !orderStatuses.has(order.status) ||
    typeof order.paymentStatus !== "string" ||
    !["pending", "paid"].includes(order.paymentStatus) ||
    typeof order.paymentLabel !== "string" ||
    typeof order.hasPickupPass !== "boolean"
  ) {
    throw new Error("An order record could not be displayed.");
  }

  const card = document.createElement("article");
  card.className = "profile-order-card";

  const top = document.createElement("div");
  top.className = "profile-order-top";
  const orderHeading = document.createElement("div");
  const orderNumber = document.createElement("h3");
  orderNumber.textContent = order.orderNumber;
  const date = document.createElement("p");
  date.className = "profile-order-date";
  date.textContent = formatOrderDate(order.createdAt);
  orderHeading.append(orderNumber, date);

  const status = document.createElement("span");
  status.className = `profile-order-status status-${order.status}`;
  status.textContent = order.status;
  top.append(orderHeading, status);

  const court = document.createElement("p");
  court.className = "profile-order-court";
  court.textContent = order.courtName;

  const items = document.createElement("ul");
  items.className = "profile-order-items";
  for (const item of order.items) {
    if (
      !item ||
      typeof item.name !== "string" ||
      !Number.isInteger(item.quantity) ||
      !Number.isInteger(item.unitPrice)
    ) {
      throw new Error("An order item could not be displayed.");
    }

    const listItem = document.createElement("li");
    listItem.textContent = `${item.quantity} × ${item.name} · ${formatPrice(item.unitPrice * item.quantity)}`;
    items.append(listItem);
  }

  const pickup = document.createElement("div");
  pickup.className = "profile-order-meta";
  const pickupTime = document.createElement("span");
  pickupTime.textContent = `Pickup: ${order.pickupSlot}`;
  const pickupPoint = document.createElement("span");
  pickupPoint.textContent = order.pickupLocation;
  pickup.append(pickupTime, pickupPoint);

  const total = document.createElement("div");
  total.className = "profile-order-total";
  const totalLabel = document.createElement("span");
  totalLabel.textContent = `Total · ${order.paymentStatus === "paid" ? order.paymentLabel : "Payment pending"}`;
  const totalAmount = document.createElement("strong");
  totalAmount.textContent = formatPrice(order.totalAmount);
  total.append(totalLabel, totalAmount);

  card.append(top, court, items, pickup, total);
  if (order.hasPickupPass) {
    const showPassButton = document.createElement("button");
    showPassButton.className = "btn btn-ghost btn-sm profile-pickup-pass-button";
    showPassButton.type = "button";
    showPassButton.textContent = "Show pickup QR";
    showPassButton.addEventListener("click", () => loadPickupPass(order.id));
    card.append(showPassButton);
  } else if (order.paymentStatus === "pending") {
    const continuePaymentLink = document.createElement("a");
    continuePaymentLink.className = "btn btn-ghost btn-sm profile-pickup-pass-button";
    continuePaymentLink.href = `court-menu.html?court=${encodeURIComponent(order.courtId)}`;
    continuePaymentLink.textContent = "Continue demo payment";
    card.append(continuePaymentLink);
  }
  return card;
}

async function loadPickupPass(orderId) {
  pickupPassDialogStatus.textContent = "Loading your pickup pass…";
  pickupPassDialogContent.hidden = true;
  pickupPassDialog.showModal();

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/pickup-pass`, {
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not load your pickup pass.");
    }
    if (
      typeof result.qrDataUrl !== "string" ||
      !result.qrDataUrl.startsWith("data:image/png;base64,") ||
      typeof result.orderNumber !== "string" ||
      typeof result.pickupLocation !== "string" ||
      typeof result.pickupSlot !== "string"
    ) {
      throw new Error("The pickup pass response was incomplete.");
    }

    profilePickupPassQr.src = result.qrDataUrl;
    profilePickupPassLocation.textContent = result.pickupLocation;
    profilePickupPassTime.textContent = `Pickup time: ${result.pickupSlot}`;
    profilePickupPassOrder.textContent = `Order ${result.orderNumber}`;
    pickupPassDialogStatus.textContent = "";
    pickupPassDialogContent.hidden = false;
  } catch (error) {
    pickupPassDialogStatus.textContent = error instanceof TypeError
      ? "Could not connect to KITE Bite to load your pickup pass."
      : error.message;
  }
}

async function loadOrderHistory() {
  orderHistoryStatus.textContent = "Loading your orders…";

  try {
    const response = await fetch("/api/orders", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not load your order history.");
    }
    if (!Array.isArray(result.orders)) {
      throw new Error("Your order history response was incomplete.");
    }

    orderHistoryList.replaceChildren();
    if (result.orders.length === 0) {
      orderHistoryEmpty.hidden = false;
      orderHistoryList.hidden = true;
    } else {
      for (const order of result.orders) {
        orderHistoryList.append(createOrderCard(order));
      }
      orderHistoryEmpty.hidden = true;
      orderHistoryList.hidden = false;
    }
    orderHistoryStatus.textContent = "";
  } catch (error) {
    orderHistoryStatus.textContent = error instanceof TypeError
      ? "Could not connect to KITE Bite to load your orders."
      : error.message;
  }
}

async function loadProfile() {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });

    if (response.status === 401) {
      profileStatus.textContent = "";
      signedOutMessage.hidden = false;
      return;
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not load your profile.");
    }

    if (
      !result.user ||
      typeof result.user.name !== "string" ||
      typeof result.user.email !== "string" ||
      typeof result.user.createdAt !== "string"
    ) {
      throw new Error("Your profile details could not be read.");
    }

    setText("#profile-name", result.user.name);
    setText("#profile-email", result.user.email);
    setText("#profile-detail-name", result.user.name);
    setText("#profile-detail-email", result.user.email);
    setText("#profile-member-since", formatMemberSince(result.user.createdAt));
    setText("#profile-avatar", getInitials(result.user.name) || "KB");

    profileStatus.textContent = "";
    profileContent.hidden = false;
    await loadOrderHistory();
  } catch (error) {
    profileStatus.textContent = error instanceof TypeError
      ? "Could not connect to KITE Bite. Make sure the app server is running."
      : error.message;
  }
}

pickupPassClose.addEventListener("click", () => pickupPassDialog.close());

pickupPassDialog.addEventListener("click", (event) => {
  if (event.target === pickupPassDialog) pickupPassDialog.close();
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutStatus.textContent = "Logging out…";

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin"
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Could not log out.");
    }

    window.location.assign("login.html");
  } catch (error) {
    logoutStatus.textContent = error instanceof TypeError
      ? "Could not connect to KITE Bite. Please try again."
      : error.message;
    logoutButton.disabled = false;
  }
});

loadProfile();
