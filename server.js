require("dotenv").config();

const crypto = require("node:crypto");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const MongoStore = require("connect-mongo");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const session = require("express-session");
const helmet = require("helmet");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const { MENU_CATALOG, PICKUP_SLOTS } = require("./menu-data");
const { normalizeOrder, OrderValidationError } = require("./order-utils");

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kite_bite";
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;
let dummyPasswordHash;

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error("Set SESSION_SECRET to a random value of at least 32 characters in production.");
}

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(
  session({
    name: "kitebite.sid",
    secret: sessionSecret || crypto.randomBytes(48).toString("hex"),
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false }
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courtId: { type: String, required: true },
    courtName: { type: String, required: true },
    pickupLocation: { type: String, required: true },
    pickupSlot: { type: String, required: true, enum: PICKUP_SLOTS.map((slot) => slot.label) },
    items: [{
      itemId: { type: String, required: true },
      name: { type: String, required: true },
      unitPrice: { type: Number, required: true, min: 0 },
      quantity: { type: Number, required: true, min: 1, max: 10 }
    }],
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["pay-at-pickup", "demo"], default: "pay-at-pickup", required: true },
    paymentStatus: { type: String, enum: ["pending", "paid"] },
    paymentReference: { type: String },
    pickupToken: { type: String },
    status: {
      type: String,
      enum: ["awaiting_payment", "placed", "preparing", "ready", "collected", "cancelled"],
      default: "placed",
      required: true
    }
  },
  { timestamps: true }
);
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ pickupToken: 1 }, { unique: true, sparse: true });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
});

const orderRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many orders were placed. Please wait a few minutes and try again." }
});

function isValidEmail(email) {
  return typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setAuthenticatedSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      req.session.userId = user.id;
      req.session.save((saveError) => {
        if (saveError) {
          reject(saveError);
          return;
        }

        resolve();
      });
    });
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function publicOrder(order) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    courtId: order.courtId,
    courtName: order.courtName,
    pickupLocation: order.pickupLocation,
    pickupSlot: order.pickupSlot,
    items: order.items.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity
    })),
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus || (order.paymentMethod === "pay-at-pickup" ? "paid" : "pending"),
    paymentLabel: order.paymentMethod === "demo" ? "Demo payment" : "Pay at pickup",
    hasPickupPass: Boolean(order.paymentStatus === "paid" && order.pickupToken),
    status: order.status,
    createdAt: order.createdAt
  };
}

function validateRequestOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      res.status(403).json({ error: "Request origin was not accepted." });
      return;
    }

    if (originHost !== req.get("host")) {
      res.status(403).json({ error: "Request origin was not accepted." });
      return;
    }
  }

  next();
}

function requireAuthenticatedUser(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Sign in before placing or viewing orders." });
    return;
  }
  next();
}

app.use("/api/auth", validateRequestOrigin);
app.use("/api/orders", validateRequestOrigin);

app.get("/api/food-courts/:courtId/menu", (req, res) => {
  const court = MENU_CATALOG[req.params.courtId];
  if (!court) {
    res.status(404).json({ error: "Food court not found." });
    return;
  }

  res.json({ court, pickupSlots: PICKUP_SLOTS });
});

app.get("/api/orders", requireAuthenticatedUser, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ orders: orders.map(publicOrder) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", requireAuthenticatedUser, orderRateLimit, async (req, res, next) => {
  try {
    const idempotencyKey = req.get("Idempotency-Key");
    if (
      typeof idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
    ) {
      res.status(400).json({ error: "The checkout request could not be verified. Please try again." });
      return;
    }

    const orderDetails = normalizeOrder(req.body, MENU_CATALOG, PICKUP_SLOTS);
    const requestFingerprint = crypto.createHash("sha256")
      .update(JSON.stringify(orderDetails))
      .digest("hex");
    const existingOrder = await Order.findOne({
      userId: req.session.userId,
      idempotencyKey
    });

    if (existingOrder) {
      if (existingOrder.requestFingerprint !== requestFingerprint) {
        res.status(409).json({ error: "This checkout request was already used. Refresh your cart and try again." });
        return;
      }
      res.json({ order: publicOrder(existingOrder) });
      return;
    }

    try {
      const order = await Order.create({
        ...orderDetails,
        orderNumber: `KB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        idempotencyKey,
        requestFingerprint,
        userId: req.session.userId,
        paymentMethod: "demo",
        paymentStatus: "pending",
        status: "awaiting_payment"
      });
      res.status(201).json({ order: publicOrder(order) });
    } catch (error) {
      if (error && error.code === 11000) {
        const duplicateOrder = await Order.findOne({ userId: req.session.userId, idempotencyKey });
        if (duplicateOrder) {
          if (duplicateOrder.requestFingerprint !== requestFingerprint) {
            res.status(409).json({ error: "This checkout request was already used. Refresh your cart and try again." });
            return;
          }
          res.json({ order: publicOrder(duplicateOrder) });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof OrderValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/orders/:orderId/demo-payment", requireAuthenticatedUser, orderRateLimit, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    const orderQuery = { _id: req.params.orderId, userId: req.session.userId };
    const order = await Order.findOne(orderQuery);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.paymentMethod !== "demo") {
      res.status(409).json({ error: "This order is not using demo payment." });
      return;
    }
    if (order.paymentStatus === "paid") {
      res.json({ order: publicOrder(order) });
      return;
    }
    if (order.status === "cancelled") {
      res.status(409).json({ error: "This order has been cancelled." });
      return;
    }
    if (order.status !== "awaiting_payment") {
      res.status(409).json({ error: "This order is not awaiting payment." });
      return;
    }

    const pickupToken = crypto.randomBytes(32).toString("hex");
    const paidOrder = await Order.findOneAndUpdate(
      { ...orderQuery, paymentStatus: "pending", paymentMethod: "demo", status: "awaiting_payment" },
      {
        $set: {
          paymentStatus: "paid",
          status: "placed",
          paymentReference: `DEMO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
          pickupToken
        }
      },
      { new: true, runValidators: true }
    );

    if (paidOrder) {
      res.json({ order: publicOrder(paidOrder) });
      return;
    }

    const latestOrder = await Order.findOne(orderQuery);
    if (latestOrder && latestOrder.paymentStatus === "paid") {
      res.json({ order: publicOrder(latestOrder) });
      return;
    }
    res.status(409).json({ error: "The demo payment could not be completed. Please try again." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/:orderId/pickup-pass", requireAuthenticatedUser, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
      res.status(404).json({ error: "Pickup pass not found." });
      return;
    }

    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.session.userId,
      paymentStatus: "paid",
      pickupToken: { $exists: true, $ne: "" }
    });
    if (!order) {
      res.status(404).json({ error: "A pickup pass is available after payment is completed." });
      return;
    }

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({
      orderNumber: order.orderNumber,
      pickupToken: order.pickupToken,
      courtId: order.courtId,
      pickupLocation: order.pickupLocation,
      pickupSlot: order.pickupSlot
    }), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: { dark: "#1f2b3d", light: "#ffffff" }
    });
    res.json({
      orderNumber: order.orderNumber,
      courtName: order.courtName,
      pickupLocation: order.pickupLocation,
      pickupSlot: order.pickupSlot,
      qrDataUrl
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/signup", authRateLimit, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;

    if (!name || name.length > 80 || !isValidEmail(email)) {
      res.status(400).json({ error: "Enter a name (up to 80 characters) and a valid email address." });
      return;
    }

    if (
      typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      res.status(400).json({ error: "Password must be between 8 and 72 bytes." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    await setAuthenticatedSession(req, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error && error.code === 11000) {
      res.status(409).json({ error: "An account with that email already exists. Try logging in." });
      return;
    }

    next(error);
  }
});

app.post("/api/auth/login", authRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;

    if (!isValidEmail(email) || typeof password !== "string" || password.length === 0) {
      res.status(400).json({ error: "Enter a valid email address and password." });
      return;
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordMatches = await bcrypt.compare(
      password,
      user ? user.passwordHash : dummyPasswordHash
    );

    if (!user || !passwordMatches) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    await setAuthenticatedSession(req, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    if (!req.session.userId) {
      res.status(401).json({ error: "You are not signed in." });
      return;
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy((error) => {
        if (error) {
          next(error);
          return;
        }

        res.clearCookie("kitebite.sid");
        res.status(401).json({ error: "You are not signed in." });
      });
      return;
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie("kitebite.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction
    });
    res.status(204).end();
  });
});

const pageFiles = new Map([
  ["/", "landing-page.html"],
  ["/landing-page.html", "landing-page.html"],
  ["/index.html", "index.html"],
  ["/food-courts.html", "food-courts.html"],
  ["/court-menu.html", "court-menu.html"],
  ["/profile", "profile.html"],
  ["/profile.html", "profile.html"],
  ["/signup.html", "signup.html"],
  ["/login.html", "login.html"],
  ["/style.css", "style.css"],
  ["/signup.js", "signup.js"],
  ["/login.js", "login.js"],
  ["/profile.js", "profile.js"],
  ["/court-menu.js", "court-menu.js"],
  ["/landing-image.jpeg", "WhatsApp Image 2026-09-24 at 9.43.02 PM.jpeg"]
]);

for (const [url, file] of pageFiles) {
  app.get(url, (req, res, next) => {
    res.sendFile(path.join(__dirname, file), (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "API endpoint not found." });
    return;
  }

  res.status(404).type("text").send("Page not found.");
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  console.error("Request failed:", error.message);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  const message = status === 400
    ? "Request body is invalid."
    : status === 413
      ? "Request body is too large."
      : "Something went wrong. Please try again.";
  res.status(status).json({ error: message });
});

async function startServer() {
  await mongoose.connect(mongoUri);
  dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const server = app.listen(port, () => {
    console.log(`KITE Bite is running at http://localhost:${port}`);
  });

  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Could not start KITE Bite:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer, User, Order };
