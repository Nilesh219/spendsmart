// ============================================================
// SpendSmart Backend - Step 6 (server.js)
// Login / signup (JWT) + every user sees ONLY their own data.
// Also: month comparison, 6-month trends, CSV export.
//
// Install once:  npm install express mongoose cors bcryptjs jsonwebtoken dotenv
// Run:           node server.js
// ============================================================

require("dotenv").config(); // loads backend/.env into process.env (secrets live there, not in code)
const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3001; // hosting services tell us which port to use
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/spendsmart";
// Where the React app lives. Used to build the link inside the password-reset email.
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, ""); // no trailing slash
// A free ML service on Render "sleeps" and needs up to ~1 minute to wake, so we wait longer than before.
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS) || 15000;

// The secret used to sign login tokens. In production (Step 5 deploy) set a long random
// value in the JWT_SECRET environment variable. Anyone who knows it can fake logins!
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ JWT_SECRET must be set in production. Refusing to start.");
    process.exit(1);
  }
  console.warn("⚠️  JWT_SECRET not set in .env - using an insecure development secret.");
}

// DEV ONLY: when DEV_SHOW_PASSWORDS=true in .env, the real password is ALSO saved in a
// "devPassword" field so you can see it in Compass while learning. Login still uses the
// secure hash. The server refuses to run like this in production.
const DEV_SHOW_PASSWORDS = process.env.DEV_SHOW_PASSWORDS === "true";
if (DEV_SHOW_PASSWORDS) {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ DEV_SHOW_PASSWORDS must never be on in production. Refusing to start.");
    process.exit(1);
  }
  console.warn("⚠️  DEV_SHOW_PASSWORDS is ON: passwords are visible in MongoDB. Local testing only!");
}

const SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Behind Render's proxy every request looks like it comes from the proxy, so we trust the
// X-Forwarded-For header. Without this the login rate limiter would count ALL users as one.
app.set("trust proxy", 1);
// Only your own frontend (and local dev) may call this API from a browser.
app.use(cors({ origin: [FRONTEND_URL, "http://localhost:5173"] }));
app.use(express.json());

// ------------------------------------------------------------
// MODELS
// ------------------------------------------------------------
const CATEGORIES = ["Food", "Travel", "Bills", "Shopping", "Fun", "Health", "Education", "Other"];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }, // NEVER the real password
  resetTokenHash: { type: String }, // hash of the emailed reset token (never the token itself)
  resetExpires: { type: Date },
  devPassword: { type: String }, // only filled when DEV_SHOW_PASSWORDS=true
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  text: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, enum: CATEGORIES, default: "Other" },
  categorizedBy: { type: String, enum: ["user", "ai"], default: "user" },
  date: { type: Date, default: Date.now },
});
const Expense = mongoose.model("Expense", expenseSchema);

const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: String, enum: CATEGORIES, required: true },
  limit: { type: Number, required: true, min: 0 },
});
budgetSchema.index({ user: 1, category: 1 }, { unique: true }); // one budget per category PER USER
const Budget = mongoose.model("Budget", budgetSchema);

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");

async function getCategoryFromAI(text) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
    const response = await fetch(`${ML_SERVICE_URL}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`ML service returned ${response.status}`);
    const data = await response.json();
    return CATEGORIES.includes(data.category) ? data.category : "Other";
  } catch (err) {
    console.warn(`⚠️  ML service unavailable (${err.message}) -> using "Other"`);
    return "Other";
  }
}

function extractAmount(text) {
  const match = String(text).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
}

function monthRange(monthStr) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (monthStr) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) return null;
    year = parseInt(monthStr.slice(0, 4), 10);
    month = parseInt(monthStr.slice(5, 7), 10) - 1;
  }
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
    label: `${year}-${pad(month + 1)}`,
  };
}

// Optional expense date "YYYY-MM-DD". Empty = now. Returns null if invalid or in the future.
function parseExpenseDate(dateStr) {
  const now = new Date();
  if (!dateStr) return now;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (dateStr === todayStr) return now;
  if (dateStr > todayStr) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 64) return "Password must be 64 characters or fewer.";
  return null;
}

// Tiny in-memory limiter: max N requests per IP per window. Slows down password guessing.
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 5000) hits.clear(); // keep memory small
    next();
  };
}
const FIFTEEN_MIN = 15 * 60 * 1000;

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Sends the reset email. With no SMTP settings (normal while developing) it just prints
// the link in this terminal, so you can test the whole flow without any email account.
async function sendResetEmail(to, name, link) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n📧 DEV MODE (no SMTP configured). Password reset link for ${to}:\n${link}\n`);
    return false;
  }
  const nodemailer = require("nodemailer"); // only needed once you set up real email
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Reset your SpendSmart password",
    text: `Hi ${name},\n\nUse this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p><a href="${link}">Choose a new password</a> (link valid for 30 minutes).</p><p>If you did not ask for this, you can ignore this email.</p>`,
  });
  return true;
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// aggregate() does NOT auto-convert strings to ObjectIds, so we do it ourselves
const uid = (req) => new mongoose.Types.ObjectId(req.userId);

const publicUser = (u) => ({ id: u._id.toString(), name: u.name, email: u.email });
const signToken = (u) => jwt.sign({ id: u._id.toString() }, JWT_SECRET, { expiresIn: "7d" });

// ------------------------------------------------------------
// AUTH ROUTES (public: no login needed)
// ------------------------------------------------------------
app.get("/", (req, res) => {
  res.send("SpendSmart backend is running! ✅ (MongoDB + AI + login)");
});

app.post("/api/auth/signup", rateLimit(20, FIFTEEN_MIN), wrap(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  if (await User.findOne({ email })) {
    return res.status(409).json({ error: "An account with this email already exists. Try logging in." });
  }

  const passwordHash = await bcrypt.hash(password, 10); // one-way scrambling, cannot be reversed
  const user = await User.create({ name, email, passwordHash, ...(DEV_SHOW_PASSWORDS && { devPassword: password }) });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

app.post("/api/auth/login", rateLimit(20, FIFTEEN_MIN), wrap(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await User.findOne({ email });
  // Same message for "no such email" and "wrong password" so attackers learn nothing
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: "Wrong email or password." });

  // keep devPassword in step with the switch (adds it for existing users on login, removes it when OFF)
  if (DEV_SHOW_PASSWORDS && user.devPassword !== password) {
    user.devPassword = password;
    await user.save();
  } else if (!DEV_SHOW_PASSWORDS && user.devPassword) {
    user.devPassword = undefined;
    await user.save();
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// ---- Forgot password ----
// 1) /forgot: user gives an email. We create a random token, store only its HASH, and email a link.
app.post("/api/auth/forgot", rateLimit(5, FIFTEEN_MIN), wrap(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });

  const user = await User.findOne({ email });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000); // valid for 30 minutes
    await user.save();
    try {
      await sendResetEmail(user.email, user.name, `${FRONTEND_URL}/?reset=${token}`);
    } catch (err) {
      console.error("Could not send reset email:", err.message);
    }
  }
  // Same answer whether or not the email exists, so nobody can use this to find who has an account.
  const devNote = !process.env.SMTP_HOST && process.env.NODE_ENV !== "production"
    ? "Dev mode: email is not set up, so the link was printed in the backend terminal."
    : undefined;
  res.json({ message: "If an account exists for that email, a reset link has been sent.", devNote });
}));

// 2) /reset: user comes back with the token from the link and chooses a new password.
app.post("/api/auth/reset", rateLimit(10, FIFTEEN_MIN), wrap(async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });
  if (!token) return res.status(400).json({ error: "This reset link is not valid." });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({ resetTokenHash: tokenHash, resetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });

  user.passwordHash = await bcrypt.hash(password, 10);
  if (DEV_SHOW_PASSWORDS) user.devPassword = password;
  user.resetTokenHash = undefined; // one-time use
  user.resetExpires = undefined;
  await user.save();
  res.json({ message: "Password changed. You can log in now." });
}));

// ------------------------------------------------------------
// LOGIN GATE: every route below this line needs a valid token
// ------------------------------------------------------------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please log in." });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: "Your session expired. Please log in again." });
  }
}
app.use("/api", requireAuth);

app.get("/api/auth/me", wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Account not found." });
  res.json({ user: publicUser(user) });
}));

// ---- Expenses (always filtered by the logged-in user) ----

app.get("/api/expenses", wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  if (!range) return res.status(400).json({ error: "month must look like 2026-11" });
  const list = await Expense.find({ user: req.userId, date: { $gte: range.start, $lt: range.end } }).sort({ date: -1 });
  res.json(list);
}));

app.post("/api/expenses", wrap(async (req, res) => {
  const { text, category, date } = req.body;
  let { amount } = req.body;

  if (!text || !String(text).trim()) return res.status(400).json({ error: "text is required" });
  if (amount === undefined) amount = extractAmount(text);
  amount = Number(amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "amount is required (type a number in the text or send amount)" });
  }
  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
  }
  const when = parseExpenseDate(date);
  if (!when) return res.status(400).json({ error: "date must be today or earlier, like 2026-11-17" });

  let finalCategory = category;
  let categorizedBy = "user";
  if (!finalCategory) {
    finalCategory = await getCategoryFromAI(String(text).trim());
    categorizedBy = "ai";
  }

  const saved = await Expense.create({
    user: req.userId,
    text: String(text).trim(),
    amount,
    category: finalCategory,
    categorizedBy,
    date: when,
  });
  res.status(201).json(saved);
}));

app.patch("/api/expenses/:id", wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "invalid id" });
  const { category } = req.body;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
  }
  const updated = await Expense.findOneAndUpdate(
    { _id: req.params.id, user: req.userId }, // user check: you can't edit someone else's expense
    { category, categorizedBy: "user" },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: "expense not found" });
  res.json(updated);
}));

app.delete("/api/expenses/:id", wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "invalid id" });
  const deleted = await Expense.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!deleted) return res.status(404).json({ error: "expense not found" });
  res.json({ deleted: true });
}));

// ---- Budgets ----

app.get("/api/budgets", wrap(async (req, res) => {
  res.json(await Budget.find({ user: req.userId }).sort({ category: 1 }));
}));

app.put("/api/budgets/:category", wrap(async (req, res) => {
  const { category } = req.params;
  const limit = Number(req.body.limit);
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "unknown category" });
  if (!Number.isFinite(limit) || limit < 0) return res.status(400).json({ error: "limit must be a positive number" });
  const budget = await Budget.findOneAndUpdate(
    { user: req.userId, category },
    { limit },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(budget);
}));

app.delete("/api/budgets/:category", wrap(async (req, res) => {
  await Budget.deleteOne({ user: req.userId, category: req.params.category });
  res.json({ deleted: true });
}));

// ---- Dashboard summary ----
app.get("/api/summary", wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  if (!range) return res.status(400).json({ error: "month must look like 2026-11" });
  const userId = uid(req);

  const grouped = await Expense.aggregate([
    { $match: { user: userId, date: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  const budgets = await Budget.find({ user: req.userId });
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.category, b.limit]));

  const byCategory = grouped.map((g) => {
    const limit = budgetMap[g._id] ?? null;
    return { category: g._id, total: g.total, count: g.count, limit, exceeded: limit !== null && g.total > limit };
  });
  const grandTotal = byCategory.reduce((sum, c) => sum + c.total, 0);

  // Previous month total. If we are INSIDE the current month, compare only the same
  // number of days (day 1-17 vs day 1-17) so the comparison is fair.
  const prevStart = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
  let prevEnd = range.start;
  const now = new Date();
  if (now >= range.start && now < range.end) {
    const cut = new Date(prevStart.getFullYear(), prevStart.getMonth(), now.getDate() + 1);
    prevEnd = cut < range.start ? cut : range.start;
  }
  const prevRows = await Expense.aggregate([
    { $match: { user: userId, date: { $gte: prevStart, $lt: prevEnd } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  res.json({
    month: range.label,
    grandTotal,
    prevTotal: prevRows[0]?.total || 0,
    byCategory,
    alerts: byCategory.filter((c) => c.exceeded),
  });
}));

// ---- Last N months, for the trend chart ----
app.get("/api/trends", wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  if (!range) return res.status(400).json({ error: "month must look like 2026-11" });
  const n = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
  const start = new Date(range.start.getFullYear(), range.start.getMonth() - (n - 1), 1);

  const rows = await Expense.aggregate([
    { $match: { user: uid(req), date: { $gte: start, $lt: range.end } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: SERVER_TZ } }, total: { $sum: "$amount" } } },
  ]);
  const totals = Object.fromEntries(rows.map((r) => [r._id, r.total]));

  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    out.push({ month: key, label: d.toLocaleDateString("en-IN", { month: "short" }), total: totals[key] || 0 });
  }
  res.json(out);
}));

// ---- CSV export ----
app.get("/api/export/csv", wrap(async (req, res) => {
  let filter = { user: req.userId };
  let label = "all";
  if (req.query.month) {
    const range = monthRange(req.query.month);
    if (!range) return res.status(400).json({ error: "month must look like 2026-11" });
    filter.date = { $gte: range.start, $lt: range.end };
    label = range.label;
  }
  const list = await Expense.find(filter).sort({ date: 1 });

  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [["Date", "Description", "Amount", "Category", "Categorized By"].join(",")];
  for (const e of list) {
    rows.push([e.date.toISOString().slice(0, 10), esc(e.text), e.amount, e.category, e.categorizedBy].join(","));
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="spendsmart-${label}.csv"`);
  res.send(rows.join("\n"));
}));

// ------------------------------------------------------------
// ERROR HANDLER (after all routes)
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Request body is not valid JSON",
      hint: 'Send header Content-Type: application/json and a body like {"text":"300 movie"}',
    });
  }
  if (err.code === 11000) return res.status(409).json({ error: "That already exists." });
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ------------------------------------------------------------
// START
// ------------------------------------------------------------
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    // Budgets used to be unique per category; now they are unique per user + category.
    // syncIndexes removes the old index so two users can both have a "Food" budget.
    await Budget.syncIndexes();
    app.listen(PORT, () => {
      console.log(`✅ SpendSmart backend listening at http://localhost:${PORT}`);
      console.log(`🧠 AI service expected at ${ML_SERVICE_URL}`);
    });
  })
  .catch((err) => {
    console.error("❌ Could not connect to MongoDB:", err.message);
    process.exit(1);
  });