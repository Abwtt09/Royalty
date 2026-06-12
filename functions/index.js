"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

admin.initializeApp();

// ── Rate limiting (in-memory, per IP) ────────────────────────────────────────
const rateLimitStore = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_REQUESTS = 15;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart > RATE_WINDOW_MS) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count += 1;
  }

  rateLimitStore.set(ip, record);

  // Purge stale entries periodically to avoid unbounded memory growth
  if (rateLimitStore.size > 5000) {
    for (const [key, val] of rateLimitStore) {
      if (now - val.windowStart > RATE_WINDOW_MS * 2) rateLimitStore.delete(key);
    }
  }

  return record.count > RATE_MAX_REQUESTS;
}

// ── Resolve credentials ───────────────────────────────────────────────────────
// Supports both: firebase functions:config:set (v1 config) and process.env (v2 / .env)
function getCredentials() {
  const token =
    process.env.WHATSAPP_ACCESS_TOKEN ||
    (functions.config().whatsapp && functions.config().whatsapp.token);

  const phoneId =
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    (functions.config().whatsapp && functions.config().whatsapp.phoneid);

  return { token, phoneId };
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

app.use(
  cors({
    origin: [
      "https://royalty-real.web.app",
      "https://royalty-real.firebaseapp.com",
      /\.web\.app$/,
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// ── POST /sendWhatsAppMessage ─────────────────────────────────────────────────
app.post("/", async (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.ip ||
    "unknown";

  if (isRateLimited(clientIp)) {
    return res
      .status(429)
      .json({ success: false, error: "Too many requests. Try again later." });
  }

  const { phone, message } = req.body;

  if (!phone || typeof phone !== "string" || phone.trim() === "") {
    return res
      .status(400)
      .json({ success: false, error: "phone is required and must be a non-empty string." });
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
    return res
      .status(400)
      .json({ success: false, error: "message is required and must be a non-empty string." });
  }

  const { token, phoneId } = getCredentials();

  if (!token || !phoneId) {
    functions.logger.error("WhatsApp credentials not configured.");
    return res
      .status(500)
      .json({ success: false, error: "Server configuration error." });
  }

  const normalizedPhone = phone.trim().replace(/\s+/g, "");

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v25.0/${phoneId}/messages`,
      {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: { body: message.trim() },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const messageId =
      response.data?.messages?.[0]?.id || response.data?.messages?.[0]?.wamid;

    functions.logger.info("WhatsApp message sent", {
      to: normalizedPhone,
      messageId,
    });

    return res.status(200).json({ success: true, messageId });
  } catch (err) {
    const apiError =
      err.response?.data?.error?.message || err.message || "Unknown error";

    functions.logger.error("WhatsApp API error", {
      status: err.response?.status,
      error: apiError,
    });

    return res
      .status(err.response?.status || 500)
      .json({ success: false, error: apiError });
  }
});

// ── Export ────────────────────────────────────────────────────────────────────
exports.sendWhatsAppMessage = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .https.onRequest(app);
