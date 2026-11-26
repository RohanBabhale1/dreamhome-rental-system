const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const connect = require("./config/database");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(cookieParser());
app.use("/api", async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    !process.env.APP_URL
  )
    return res
      .status(503)
      .json({ message: "Server configuration is incomplete" });
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      (origin && origin !== new URL(process.env.APP_URL).origin) ||
      req.get("sec-fetch-site") === "cross-site"
    )
      return res.status(403).json({ message: "Request origin is not allowed" });
  }
  await connect();
  next();
});
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", database: "connected" }),
);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/properties", require("./routes/properties"));
app.use("/api/viewings", require("./routes/viewings"));
app.use("/api/rentals", require("./routes/rentals"));
app.use("/api", require("./routes/operations"));
app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));
app.use((error, req, res, next) => {
  if (error.name === "ZodError")
    return res
      .status(400)
      .json({
        message: error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      });
  if (error.code === 11000)
    return res
      .status(409)
      .json({
        message:
          "This record or time slot already exists. Refresh and try another.",
      });
  if (error.name === "CastError" || error.type === "entity.parse.failed")
    return res.status(400).json({ message: "Invalid request" });
  if (error.status)
    return res.status(error.status).json({ message: error.message });
  console.error(error.name + ": " + error.message);
  res
    .status(500)
    .json({ message: "Unable to complete this request. Please try again." });
});
module.exports = app;
