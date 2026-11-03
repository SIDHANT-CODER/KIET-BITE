# KITE Bite

## Run locally

Requirements: Node.js 20+ and MongoDB running locally (or a MongoDB connection URI).

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`. Set `MONGODB_URI` to your MongoDB connection string. For a hosted database, keep the URI and its password private in `.env`.
3. Replace `SESSION_SECRET` with a private random value of at least 32 characters. For example, generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
4. Start the app with `npm start`.
5. Open `http://localhost:3000` and create an account. Do not open the HTML files directly with `file://`; the forms need the app server.

The app stores user records in MongoDB with bcrypt-hashed passwords and stores login sessions in MongoDB. It does not store raw passwords. Set `NODE_ENV=production` and use HTTPS when deploying; production requires a strong `SESSION_SECRET` and sets secure session cookies.
