const test = require("node:test");
const assert = require("node:assert/strict");
const { MENU_CATALOG, PICKUP_SLOTS } = require("../menu-data");
const { normalizeOrder, OrderValidationError } = require("../order-utils");

test("normalizes menu items and calculates prices from the trusted catalog", () => {
  const order = normalizeOrder({
    courtId: "central-food-court",
    pickupSlot: "lunch-break",
    items: [
      { itemId: "chicken-biryani", quantity: 2 },
      { itemId: "paneer-wrap", quantity: 1, unitPrice: 1 }
    ]
  }, MENU_CATALOG, PICKUP_SLOTS);

  assert.equal(order.courtName, "Central Food Court");
  assert.equal(order.pickupLocation, "Counter 3 · Central Food Court");
  assert.equal(order.pickupSlot, "12:30 PM · Lunch break");
  assert.equal(order.totalAmount, 397);
  assert.equal(order.items[0].unitPrice, 149);
});

test("rejects a menu item belonging to a different court", () => {
  assert.throws(
    () => normalizeOrder({
      courtId: "central-food-court",
      pickupSlot: "lunch-break",
      items: [{ itemId: "chicken-burger", quantity: 1 }]
    }, MENU_CATALOG, PICKUP_SLOTS),
    OrderValidationError
  );
});

test("rejects invalid quantities and unavailable pickup slots", () => {
  const validOrder = {
    courtId: "coffee-and-co",
    pickupSlot: "lunch-break",
    items: [{ itemId: "cappuccino", quantity: 1 }]
  };

  assert.throws(
    () => normalizeOrder({ ...validOrder, items: [{ itemId: "cappuccino", quantity: 0 }] }, MENU_CATALOG, PICKUP_SLOTS),
    OrderValidationError
  );
  assert.throws(
    () => normalizeOrder({ ...validOrder, pickupSlot: "midnight" }, MENU_CATALOG, PICKUP_SLOTS),
    OrderValidationError
  );
});

test("rejects duplicate item lines and quantities above the per-item limit", () => {
  const order = {
    courtId: "central-food-court",
    pickupSlot: "short-break",
    items: [
      { itemId: "chicken-biryani", quantity: 1 },
      { itemId: "chicken-biryani", quantity: 2 }
    ]
  };

  assert.throws(() => normalizeOrder(order, MENU_CATALOG, PICKUP_SLOTS), OrderValidationError);
  assert.throws(
    () => normalizeOrder({
      ...order,
      items: [{ itemId: "chicken-biryani", quantity: 11 }]
    }, MENU_CATALOG, PICKUP_SLOTS),
    OrderValidationError
  );
});
