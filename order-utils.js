class OrderValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OrderValidationError";
  }
}

function normalizeOrder(body, menuCatalog, pickupSlots) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new OrderValidationError("Order details are invalid.");
  }

  const courtId = body.courtId;
  const court = typeof courtId === "string" ? menuCatalog[courtId] : undefined;
  if (!court) {
    throw new OrderValidationError("Choose a valid food court.");
  }

  const pickupSlot = pickupSlots.find((slot) => slot.id === body.pickupSlot);
  if (!pickupSlot) {
    throw new OrderValidationError("Choose an available pickup time.");
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 10) {
    throw new OrderValidationError("Add between 1 and 10 different menu items.");
  }

  const seenItems = new Set();
  const items = body.items.map((requestedItem) => {
    if (
      !requestedItem ||
      typeof requestedItem !== "object" ||
      Array.isArray(requestedItem) ||
      typeof requestedItem.itemId !== "string" ||
      !Number.isInteger(requestedItem.quantity) ||
      requestedItem.quantity < 1 ||
      requestedItem.quantity > 10
    ) {
      throw new OrderValidationError("Each item must have a valid item ID and quantity from 1 to 10.");
    }

    if (seenItems.has(requestedItem.itemId)) {
      throw new OrderValidationError("Each menu item can only appear once in the cart.");
    }
    seenItems.add(requestedItem.itemId);

    const menuItem = court.items.find((item) => item.id === requestedItem.itemId);
    if (!menuItem) {
      throw new OrderValidationError("One of the selected items is not available at this food court.");
    }

    return {
      itemId: menuItem.id,
      name: menuItem.name,
      unitPrice: menuItem.price,
      quantity: requestedItem.quantity
    };
  });

  return {
    courtId,
    courtName: court.name,
    pickupLocation: court.pickupLocation,
    pickupSlot: pickupSlot.label,
    items,
    totalAmount: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
  };
}

module.exports = { normalizeOrder, OrderValidationError };
