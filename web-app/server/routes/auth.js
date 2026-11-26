const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { User } = require("../models");
const { z, text, fail, auth, publicUser, hash, limit } = require("../lib");
const credentials = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(72),
});
async function verification(user) {
  const token = crypto.randomBytes(32).toString("hex");
  user.tokenHash = hash(token);
  user.tokenExpires = new Date(Date.now() + 86400000);
  await user.save();
  const url = process.env.APP_URL + "/verify?token=" + token;
  if (
    process.env.MAIL_MODE === "console" &&
    process.env.NODE_ENV !== "production"
  ) {
    console.log("Verify email: " + url);
    return;
  }
  if (!process.env.SMTP_HOST)
    fail(503, "Email delivery is not configured. Contact the administrator.");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: "Verify your DreamHome email",
      text: "Verify your email within 24 hours: " + url,
    });
  } catch {
    fail(
      503,
      "Email delivery failed. Please use resend verification to try again.",
    );
  }
}
router.post("/register", limit, async (req, res) => {
  const data = credentials
    .extend({ name: text, phone: z.string().trim().max(30).default("") })
    .parse(req.body);
  if (Buffer.byteLength(data.password, "utf8") > 72)
    fail(400, "Password must be at most 72 UTF-8 bytes");
  if (await User.exists({ email: data.email }))
    fail(409, "Email is already registered. Sign in or resend verification.");
  const user = await User.create({
    name: data.name,
    email: data.email,
    phone: data.phone,
    passwordHash: await bcrypt.hash(data.password, 12),
  });
  await verification(user);
  res
    .status(201)
    .json({
      message: "Account created. Check your email to verify before signing in.",
    });
});
router.post("/resend", limit, async (req, res) => {
  const email = z.email().parse(req.body.email).toLowerCase();
  const user = await User.findOne({ email });
  if (user && !user.verified) await verification(user);
  res.json({
    message:
      "If an unverified account exists, a new verification link has been sent.",
  });
});
router.post("/verify", limit, async (req, res) => {
  const token = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(req.body.token);
  const user = await User.findOneAndUpdate(
    { tokenHash: hash(token), tokenExpires: { $gt: new Date() } },
    { $set: { verified: true }, $unset: { tokenHash: 1, tokenExpires: 1 } },
  );
  if (!user) fail(400, "Verification link is invalid or expired");
  res.json({ message: "Email verified. You can now sign in." });
});
router.post("/login", limit, async (req, res) => {
  const data = credentials.parse(req.body);
  const user = await User.findOne({ email: data.email }).select(
    "+passwordHash",
  );
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash)))
    fail(401, "Invalid email or password");
  if (!user.verified) fail(403, "Verify your email before signing in");
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: "1d",
    algorithm: "HS256",
  });
  res
    .cookie("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400000,
    })
    .json(publicUser(user));
});
router.get("/me", auth, (req, res) => res.json(publicUser(req.user)));
router.post("/logout", (req, res) =>
  res
    .clearCookie("session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })
    .json({ message: "Signed out" }),
);
module.exports = router;
