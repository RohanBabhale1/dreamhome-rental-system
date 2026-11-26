const { z } = require("zod");
const jwt = require("jsonwebtoken");
const { User, Attempt } = require("./models");
const crypto = require("crypto");
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID");
const text = z.string().trim().min(1).max(200);
const money = z.coerce
  .number()
  .positive()
  .max(10000000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places",
  );
const date = z.coerce.date();
const auth = async (req, res, next) => {
  try {
    const payload = jwt.verify(
      req.cookies.session || "",
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] },
    );
    req.user = await User.findById(payload.sub);
  } catch {
    return res.status(401).json({ message: "Please sign in again" });
  }
  if (!req.user)
    return res.status(401).json({ message: "Please sign in again" });
  next();
};
const staff = (req, res, next) =>
  ["staff", "admin"].includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "Staff access required" });
const scope = (req) =>
  req.user.role === "client" ? { client: req.user._id } : {};
const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  verified: user.verified,
});
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const limit = async (req, res, next) => {
  const bucket = Math.floor(Date.now() / 900000);
  const key = hash(req.ip + ":" + bucket);
  const attempt = await Attempt.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expires: new Date((bucket + 1) * 900000) },
    },
    { upsert: true, new: true },
  );
  if (attempt.count > 30)
    return res
      .status(429)
      .json({ message: "Too many attempts. Try again in 15 minutes." });
  next();
};
// Monthly anniversaries before the exclusive end date; clamp short months.
function billing(rental, payments, now = new Date()) {
  const start = new Date(rental.startDate),
    end = new Date(rental.endDate);
  let months = 0;
  for (let i = 0; i < 1200; i++) {
    const due = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    const last = new Date(
      Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0),
    ).getUTCDate();
    due.setUTCDate(Math.min(start.getUTCDate(), last));
    if (due >= end || due > now) break;
    months++;
  }
  const paid = payments.reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
  const due =
    months * Math.round(rental.monthlyRent * 100) +
    (now >= start && end > start ? Math.round(rental.deposit * 100) : 0);
  return {
    instalmentsDue: months,
    totalDue: due / 100,
    totalPaid: paid / 100,
    balance: (due - paid) / 100,
  };
}
module.exports = {
  z,
  id,
  text,
  money,
  date,
  fail,
  auth,
  staff,
  scope,
  publicUser,
  hash,
  limit,
  billing,
};
