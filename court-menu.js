const menuStatus = document.querySelector("#court-menu-status");
const menuContent = document.querySelector("#court-menu-content");
const menuError = document.querySelector("#court-menu-error");
const menuItems = document.querySelector("#court-menu-items");
const cartItems = document.querySelector("#cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const cartTotal = document.querySelector("#cart-total");
const pickupSlotSelect = document.querySelector("#pickup-slot");
const pickupLocation = document.querySelector("#pickup-location");
const checkoutForm = document.querySelector("#checkout-form");
const placeOrderButton = document.querySelector("#place-order");
const checkoutStatus = document.querySelector("#checkout-status");
const demoPayment = document.querySelector("#demo-payment");
const demoPaymentOrder = document.querySelector("#demo-payment-order");
const demoPaymentAmount = document.querySelector("#demo-payment-amount");
const completePaymentButton = document.querySelector("#complete-demo-payment");
const paymentStatus = document.querySelector("#payment-status");
const orderConfirmation = document.querySelector("#order-confirmation");
const orderConfirmationDetails = document.querySelector("#order-confirmation-details");
const pickupPassQr = document.querySelector("#pickup-pass-qr");
const pickupPassLocation = document.querySelector("#pickup-pass-location");
const pickupPassTime = document.querySelector("#pickup-pass-time");
const pickupPassOrder = document.querySelector("#pickup-pass-order");

if (
  !(menuStatus instanceof HTMLElement) ||
  !(menuContent instanceof HTMLElement) ||
  !(menuError instanceof HTMLElement) ||
  !(menuItems instanceof HTMLElement) ||
  !(cartItems instanceof HTMLUListElement) ||
  !(cartEmpty instanceof HTMLElement) ||
  !(cartTotal instanceof HTMLElement) ||
  !(pickupSlotSelect instanceof HTMLSelectElement) ||
  !(pickupLocation instanceof HTMLElement) ||
  !(checkoutForm instanceof HTMLFormElement) ||
  !(placeOrderButton instanceof HTMLButtonElement) ||
  !(checkoutStatus instanceof HTMLElement) ||
  !(demoPayment instanceof HTMLElement) ||
  !(demoPaymentOrder instanceof HTMLElement) ||
  !(demoPaymentAmount instanceof HTMLElement) ||
  !(completePaymentButton instanceof HTMLButtonElement) ||
  !(paymentStatus instanceof HTMLElement) ||
  !(orderConfirmation instanceof HTMLElement) ||
  !(orderConfirmationDetails instanceof HTMLElement) ||
  !(pickupPassQr instanceof HTMLImageElement) ||
  !(pickupPassLocation instanceof HTMLElement) ||
  !(pickupPassTime instanceof HTMLElement) ||
  !(pickupPassOrder instanceof HTMLElement)
) {
  throw new Error("The food court menu page is missing a required element.");
}

const selectedCourt = new URLSearchParams(window.location.search).get("court");
const validCourtId = /^[a-z]+(?:-[a-z]+)*$/;
let court;
let cart = [];
let cartStorageAvailable = true;
let checkoutKey;
let activeOrder;

function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function setCheckoutMessage(message) {
  checkoutStatus.textContent = message;
}

function getStoredCartKey() {
  return `kitebite-cart-${selectedCourt}`;
}

function getStoredCheckoutKey() {
  return `kitebite-checkout-${selectedCourt}`;
}

function getStoredPickupSlotKey() {
  return `kitebite-pickup-slot-${selectedCourt}`;
}

function resetCheckoutKey() {
  checkoutKey = undefined;
  try {
    sessionStorage.removeItem(getStoredCheckoutKey());
  } catch {
    checkoutStatus.textContent = "Checkout protection is unavailable in this browser. Keep this page open while placing your order.";
  }
}

function getCheckoutKey() {
  if (checkoutKey) return checkoutKey;

  try {
    const savedKey = sessionStorage.getItem(getStoredCheckoutKey());
    if (savedKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedKey)) {
      checkoutKey = savedKey;
      return checkoutKey;
    }

    checkoutKey = window.crypto.randomUUID();
    sessionStorage.setItem(getStoredCheckoutKey(), checkoutKey);
    return checkoutKey;
  } catch {
    if (!window.crypto || typeof window.crypto.randomUUID !== "function") {
      throw new Error("Secure checkout is not supported in this browser.");
    }
    checkoutKey = window.crypto.randomUUID();
    setCheckoutMessage("Checkout retry protection is unavailable. If checkout is interrupted, check Profile before trying again.");
    return checkoutKey;
  }
}

function loadSavedPickupSlot(pickupSlots) {
  try {
    const savedSlot = localStorage.getItem(getStoredPickupSlotKey());
    if (pickupSlots.some((slot) => slot.id === savedSlot)) {
      pickupSlotSelect.value = savedSlot;
    }
  } catch {
    setCheckoutMessage("Pickup-time saving is unavailable in this browser. Choose your time again if you leave this page.");
  }
}

function savePickupSlot() {
  try {
    if (pickupSlotSelect.value) {
      localStorage.setItem(getStoredPickupSlotKey(), pickupSlotSelect.value);
    } else {
      localStorage.removeItem(getStoredPickupSlotKey());
    }
  } catch {
    setCheckoutMessage("Pickup-time saving is unavailable in this browser. Keep this page open until checkout.");
  }
}

function discardInvalidSavedCart() {
  try {
    localStorage.removeItem(getStoredCartKey());
    setCheckoutMessage("Your saved cart was invalid and has been cleared. Please add your items again.");
  } catch {
    cartStorageAvailable = false;
    setCheckoutMessage("Your saved cart couldn’t be read or cleared. Please add items again and keep this page open.");
  }
}

function loadSavedCart() {
  let savedCart;
  try {
    savedCart = localStorage.getItem(getStoredCartKey());
  } catch {
    cartStorageAvailable = false;
    setCheckoutMessage("Cart storage is unavailable in this browser. Keep this page open until checkout.");
    return [];
  }

  if (!savedCart) return [];

  let parsedCart;
  try {
    parsedCart = JSON.parse(savedCart);
  } catch {
    discardInvalidSavedCart();
    return [];
  }

  const validItemIds = new Set(court.items.map((item) => item.id));
  const validCart = Array.isArray(parsedCart) && parsedCart.every((item) =>
    item &&
    typeof item.itemId === "string" &&
    validItemIds.has(item.itemId) &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 10
  );
  if (!validCart) {
    discardInvalidSavedCart();
    return [];
  }
  return parsedCart;
}

function saveCart() {
  try {
    localStorage.setItem(getStoredCartKey(), JSON.stringify(cart));
    cartStorageAvailable = true;
  } catch {
    cartStorageAvailable = false;
    setCheckoutMessage("Cart saving is unavailable in this browser. Keep this page open until checkout.");
  }
}

function getCartTotal() {
  return cart.reduce((total, entry) => {
    const item = court.items.find((menuItem) => menuItem.id === entry.itemId);
    return total + (item ? item.price * entry.quantity : 0);
  }, 0);
}

function changeQuantity(itemId, amount) {
  const entry = cart.find((cartItem) => cartItem.itemId === itemId);
  if (!entry) return;

  entry.quantity += amount;
  if (entry.quantity < 1) {
    cart = cart.filter((cartItem) => cartItem.itemId !== itemId);
  } else if (entry.quantity > 10) {
    entry.quantity = 10;
    setCheckoutMessage("You can add up to 10 of each item.");
  } else {
    setCheckoutMessage("");
  }

  resetCheckoutKey();
  saveCart();
  renderCart();
}

function createQuantityButton(label, itemName, amount) {
  const button = document.createElement("button");
  button.className = "quantity-button";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", `${amount < 0 ? "Remove one" : "Add one"} ${itemName}`);
  return button;
}

function renderCart() {
  cartItems.replaceChildren();
  cartEmpty.hidden = cart.length > 0;

  for (const entry of cart) {
    const item = court.items.find((menuItem) => menuItem.id === entry.itemId);
    if (!item) continue;

    const row = document.createElement("li");
    row.className = "checkout-item";

    const details = document.createElement("div");
    details.className = "checkout-item-details";
    const name = document.createElement("strong");
    name.textContent = item.name;
    const lineTotal = document.createElement("span");
    lineTotal.textContent = formatPrice(item.price * entry.quantity);
    details.append(name, lineTotal);

    const controls = document.createElement("div");
    controls.className = "quantity-controls";
    const decrease = createQuantityButton("−", item.name, -1);
    const quantity = document.createElement("span");
    quantity.textContent = String(entry.quantity);
    const increase = createQuantityButton("+", item.name, 1);
    increase.disabled = entry.quantity >= 10;
    decrease.addEventListener("click", () => changeQuantity(item.id, -1));
    increase.addEventListener("click", () => changeQuantity(item.id, 1));
    controls.append(decrease, quantity, increase);

    row.append(details, controls);
    cartItems.append(row);
  }

  cartTotal.textContent = formatPrice(getCartTotal());
  placeOrderButton.disabled = cart.length === 0;
  if (cartStorageAvailable) saveCart();
}

async function showPickupPass(order) {
  const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/pickup-pass`, {
    credentials: "same-origin"
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Could not load your pickup QR code.");
  }
  if (
    typeof result.qrDataUrl !== "string" ||
    !result.qrDataUrl.startsWith("data:image/png;base64,") ||
    typeof result.pickupLocation !== "string" ||
    typeof result.pickupSlot !== "string" ||
    typeof result.orderNumber !== "string"
  ) {
    throw new Error("The pickup pass response was incomplete.");
  }

  pickupPassQr.src = result.qrDataUrl;
  pickupPassLocation.textContent = result.pickupLocation;
  pickupPassTime.textContent = `Pickup time: ${result.pickupSlot}`;
  pickupPassOrder.textContent = `Order ${result.orderNumber}`;
  orderConfirmationDetails.textContent =
    `${result.orderNumber} · ${formatPrice(order.totalAmount)} paid using demo checkout.`;
  demoPayment.hidden = true;
  orderConfirmation.hidden = false;
  orderConfirmation.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function completeDemoPayment() {
  if (!activeOrder) return;

  completePaymentButton.disabled = true;
  paymentStatus.textContent = "Processing demo payment…";
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(activeOrder.id)}/demo-payment`, {
      method: "POST",
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not complete demo payment.");
    }
    if (!result.order || result.order.paymentStatus !== "paid") {
      throw new Error("Payment could not be confirmed. Please try again.");
    }

    activeOrder = result.order;
    resetCheckoutKey();
    cart = [];
    saveCart();
    renderCart();
    pickupSlotSelect.value = "";
    savePickupSlot();
    await showPickupPass(activeOrder);
    paymentStatus.textContent = "";
  } catch (error) {
    paymentStatus.textContent = error instanceof TypeError
      ? "Could not confirm payment. Check Profile before retrying."
      : error.message;
  } finally {
    completePaymentButton.disabled = false;
  }
}

function createMenuItem(item) {
  const card = document.createElement("article");
  card.className = "card food-card court-menu-item";

  const media = document.createElement("div");
  media.className = "court-menu-placeholder";
  media.setAttribute("aria-hidden", "true");
  media.textContent = item.icon;

  const body = document.createElement("div");
  body.className = "food-body";

  const heading = document.createElement("div");
  heading.className = "food-top";
  const name = document.createElement("h2");
  name.textContent = item.name;
  heading.append(name);

  const description = document.createElement("p");
  description.textContent = item.description;

  const foot = document.createElement("div");
  foot.className = "food-foot";
  const price = document.createElement("span");
  price.className = "price";
  price.textContent = formatPrice(item.price);

  const addButton = document.createElement("button");
  addButton.className = "btn btn-primary btn-sm";
  addButton.type = "button";
  addButton.textContent = "Add to cart";
  addButton.addEventListener("click", () => {
    const existing = cart.find((entry) => entry.itemId === item.id);
    if (existing) {
      if (existing.quantity >= 10) {
        setCheckoutMessage("You can add up to 10 of each item.");
        return;
      }
      existing.quantity += 1;
    } else {
      cart.push({ itemId: item.id, quantity: 1 });
    }
    resetCheckoutKey();
    setCheckoutMessage("");
    orderConfirmation.hidden = true;
    saveCart();
    renderCart();
  });

  foot.append(price, addButton);
  body.append(heading, description, foot);
  card.append(media, body);
  return card;
}

function showInvalidCourt() {
  menuStatus.textContent = "";
  menuError.hidden = false;
}

async function loadCourtMenu() {
  if (!selectedCourt || !validCourtId.test(selectedCourt)) {
    showInvalidCourt();
    return;
  }

  try {
    const response = await fetch(`/api/food-courts/${encodeURIComponent(selectedCourt)}/menu`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not load this food court’s menu.");
    }

    if (
      !result.court ||
      typeof result.court.name !== "string" ||
      typeof result.court.pickupLocation !== "string" ||
      !Array.isArray(result.court.items) ||
      !Array.isArray(result.pickupSlots)
    ) {
      throw new Error("The food court menu response was incomplete.");
    }

    court = result.court;
    document.title = `${court.name} Menu | KITE Bite`;

    const location = document.querySelector("#court-menu-location");
    const title = document.querySelector("#court-menu-title");
    const description = document.querySelector("#court-menu-description");
    if (
      !(location instanceof HTMLElement) ||
      !(title instanceof HTMLElement) ||
      !(description instanceof HTMLElement)
    ) {
      throw new Error("The food court menu details could not be displayed.");
    }

    location.textContent = court.location;
    title.textContent = court.name;
    description.textContent = court.description;
    pickupLocation.textContent = court.pickupLocation;
    for (const slot of result.pickupSlots) {
      if (typeof slot.id !== "string" || typeof slot.label !== "string") {
        throw new Error("The pickup time options could not be displayed.");
      }
      const option = document.createElement("option");
      option.value = slot.id;
      option.textContent = slot.label;
      pickupSlotSelect.append(option);
    }

    loadSavedPickupSlot(result.pickupSlots);
    cart = loadSavedCart();
    for (const item of court.items) {
      menuItems.append(createMenuItem(item));
    }
    renderCart();
    menuStatus.textContent = "";
    menuContent.hidden = false;
  } catch (error) {
    menuStatus.textContent = error instanceof TypeError
      ? "Could not connect to KITE Bite. Make sure the app server is running."
      : error.message;
  }
}

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!court || cart.length === 0) return;

  placeOrderButton.disabled = true;
  setCheckoutMessage("Placing your order…");
  orderConfirmation.hidden = true;

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": getCheckoutKey()
      },
      credentials: "same-origin",
      body: JSON.stringify({
        courtId: selectedCourt,
        pickupSlot: pickupSlotSelect.value,
        items: cart
      })
    });
    const result = response.status === 204 ? {} : await response.json();

    if (response.status === 401) {
      window.location.assign(`login.html?orderCourt=${encodeURIComponent(selectedCourt)}`);
      return;
    }
    if (!response.ok) {
      throw new Error(result.error || "Could not place your order.");
    }
    if (
      !result.order ||
      typeof result.order.orderNumber !== "string" ||
      typeof result.order.id !== "string" ||
      typeof result.order.paymentStatus !== "string"
    ) {
      throw new Error("The order was created, but its payment details could not be read. Check your Profile before retrying.");
    }

    activeOrder = result.order;
    if (activeOrder.paymentStatus === "paid") {
      resetCheckoutKey();
      cart = [];
      saveCart();
      renderCart();
      pickupSlotSelect.value = "";
      savePickupSlot();
      await showPickupPass(activeOrder);
    } else {
      demoPaymentOrder.textContent = `Order ${activeOrder.orderNumber}`;
      demoPaymentAmount.textContent = formatPrice(activeOrder.totalAmount);
      demoPayment.hidden = false;
      demoPayment.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    setCheckoutMessage("");
  } catch (error) {
    setCheckoutMessage(error instanceof TypeError
      ? "We couldn’t confirm the order. Your cart is saved; check Profile before retrying."
      : error.message);
  } finally {
    placeOrderButton.disabled = cart.length === 0;
  }
});

completePaymentButton.addEventListener("click", completeDemoPayment);

pickupSlotSelect.addEventListener("change", () => {
  resetCheckoutKey();
  savePickupSlot();
});

loadCourtMenu();
