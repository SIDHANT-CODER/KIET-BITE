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

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
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
  return { id: user.id, name: user.name, email: user.email };
}

app.use("/api/auth", (req, res, next) => {
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
  ["/menu.html", "menu.html"],
  ["/signup.html", "signup.html"],
  ["/login.html", "login.html"],
  ["/style.css", "style.css"],
  ["/signup.js", "signup.js"],
  ["/login.js", "login.js"],
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

module.exports = { app, startServer, User };
