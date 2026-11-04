# KITE Bite

## Run locally

Requirements: Node.js 20+ and MongoDB running locally (or a MongoDB connection URI).

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`. Set `MONGODB_URI` to your MongoDB connection string. For a hosted database, keep the URI and its password private in `.env`.
3. Replace `SESSION_SECRET` with a private random value of at least 32 characters. For example, generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
4. Start the app with `npm start`.
5. Open `http://localhost:3000` and create an account. Do not open the HTML files directly with `file://`; the forms need the app server.

The app stores user records in MongoDB with bcrypt-hashed passwords and stores login sessions in MongoDB. It does not store raw passwords. Set `NODE_ENV=production` and use HTTPS when deploying; production requires a strong `SESSION_SECRET` and sets secure session cookies.

## Ordering

Choose a food court to browse its menu, add items to the court-specific cart, select a pickup time, and continue to the demo checkout while signed in. The demo payment is simulated and never charges money. On success, the server marks the order paid and issues a private QR pickup pass containing an opaque pickup token and the order's court, counter, and selected pickup time (no personal details). Orders and item-price snapshots are stored in MongoDB and appear in the signed-in user's Profile, where the QR pass can be reopened. Menu prices and pickup details are validated by the server. This is a demo payment flow, not a live payment processor or vendor scanning dashboard; the vendor must verify the displayed order details manually.
