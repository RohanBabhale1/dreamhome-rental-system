const router = require("express").Router();
const mongoose = require("mongoose");
const crypto = require("crypto");
const {
  Application,
  Property,
  User,
  Viewing,
  Rental,
  Payment,
} = require("../models");
const { z, id, text, money, fail, auth, staff, scope } = require("../lib");
const day = z.iso.date().transform((value) => new Date(value + "T00:00:00Z"));
const today = () =>
  new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const cents = (value) => Math.round(value * 100);
router.use(auth);
router.get("/", async (req, res) =>
  res.json(
    await Application.find(scope(req))
      .populate("property")
      .populate("client", "name email")
      .sort({ createdAt: -1 }),
  ),
);
router.post("/", async (req, res) => {
  if (req.user.role !== "client" || !req.user.verified)
    fail(403, "A verified client account is required");
  const data = z
    .object({
      property: id,
      preferredStart: day,
      occupants: z.coerce.number().int().min(1).max(20),
      message: z.string().trim().max(2000).default(""),
    })
    .parse(req.body);
  if (
    data.preferredStart < today() ||
    data.preferredStart > new Date(Date.now() + 366 * 86400000)
  )
    fail(400, "Choose a preferred start date within the next year");
  let application;
  await Application.init();
  await mongoose.connection.transaction(async (session) => {
    const home = await Property.findOneAndUpdate(
      { _id: data.property, status: "available", archived: false },
      { $inc: { revision: 1 } },
      { session },
    );
    if (!home) fail(409, "This home is no longer available");
    [application] = await Application.create(
      [{ ...data, client: req.user._id }],
      { session },
    );
  });
  res.status(201).json(application);
});
router.post("/:id/verification", async (req, res) => {
  if (req.user.role !== "client")
    fail(403, "Only the applicant can confirm their visit");
  z.object({
    visited: z.literal(true),
    ownershipReviewed: z.literal(true),
  }).parse(req.body);
  const application = await Application.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      client: req.user._id,
      status: { $in: ["submitted", "approved", "accepted"] },
    },
    { $set: { visitConfirmedAt: new Date(), ownershipReviewedAt: new Date() } },
    { new: true },
  );
  if (!application) fail(409, "An unpaid open application is required");
  res.json(application);
});
router.post("/:id/handover", staff, async (req, res) => {
  const { reference } = z
    .object({ reference: text, ready: z.literal(true) })
    .parse(req.body);
  const application = await Application.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      status: "accepted",
      visitConfirmedAt: { $ne: null },
      ownershipReviewedAt: { $ne: null },
    },
    {
      $set: {
        handoverConfirmedAt: new Date(),
        handoverConfirmedBy: req.user._id,
        handoverReference: reference,
      },
    },
    { new: true },
  );
  if (!application)
    fail(
      409,
      "Client must confirm verification and accept the agreement first",
    );
  res.json(application);
});
router.post("/:id/approve", staff, async (req, res) => {
  const terms = z
    .object({
      startDate: day,
      endDate: day,
      noticeDays: z.coerce.number().int().min(0).max(365),
      lockInMonths: z.coerce.number().int().min(0).max(120),
      maintenanceCharge: z.coerce.number().min(0).max(10000000),
      annualIncreasePercent: z.coerce.number().min(0).max(100),
      paymentPlan: text,
      monthlyRent: money,
      deposit: z.coerce
        .number()
        .min(0)
        .max(10000000)
        .refine((v) => Math.abs(v * 100 - cents(v)) < 0.00001),
      terms: z.string().trim().min(20).max(10000),
    })
    .parse(req.body);
  if (
    terms.startDate < today() ||
    terms.endDate <= terms.startDate ||
    terms.endDate - terms.startDate > 10 * 366 * 86400000
  )
    fail(
      400,
      "Choose a start date today or later and an end date within ten years",
    );
  let application;
  await mongoose.connection.transaction(async (session) => {
    application = await Application.findOne({
      _id: id.parse(req.params.id),
      status: "submitted",
    }).session(session);
    if (!application) fail(409, "Only submitted applications can be approved");
    if (!application.visitConfirmedAt || !application.ownershipReviewedAt)
      fail(
        409,
        "Client must confirm an in-person visit and ownership-document review first",
      );
    const tenant = await User.findOne({
      _id: application.client,
      role: "client",
      verified: true,
    }).session(session);
    if (!tenant) fail(409, "The applicant must be a verified client");
    const home = await Property.findOneAndUpdate(
      { _id: application.property, status: "available", archived: false },
      {
        $set: { status: "reserved", reservedBy: application._id },
        $inc: { revision: 1 },
      },
      { session, new: true },
    );
    if (!home)
      fail(409, "Another lease or approved application has reserved this home");
    application.status = "approved";
    application.reviewedBy = req.user._id;
    application.agreement = {
      ...terms,
      propertyTitle: home.title,
      address: [home.address, home.city, home.state].filter(Boolean).join(", "),
      tenantName: tenant.name,
      version: crypto.randomUUID(),
    };
    await application.save({ session });
    await Viewing.updateMany(
      { property: home._id, status: "scheduled" },
      { $set: { status: "cancelled" } },
      { session },
    );
    await Application.updateMany(
      {
        property: home._id,
        _id: { $ne: application._id },
        status: "submitted",
      },
      {
        $set: {
          status: "rejected",
          open: false,
          decisionNote: "Another application was approved for this home.",
        },
      },
      { session },
    );
  });
  res.json(application);
});
router.post("/:id/reject", staff, async (req, res) => {
  const { reason } = z.object({ reason: text }).parse(req.body);
  const application = await Application.findOneAndUpdate(
    { _id: id.parse(req.params.id), status: "submitted" },
    {
      $set: {
        status: "rejected",
        open: false,
        reviewedBy: req.user._id,
        decisionNote: reason,
      },
    },
    { new: true },
  );
  if (!application) fail(409, "Only submitted applications can be rejected");
  res.json(application);
});
router.post("/:id/accept", async (req, res) => {
  if (req.user.role !== "client")
    fail(403, "Only the applicant can accept an agreement");
  const data = z
    .object({ version: text, accepted: z.literal(true), name: text })
    .parse(req.body);
  const application = await Application.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      client: req.user._id,
      status: "approved",
      "agreement.version": data.version,
    },
    {
      $set: {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedName: data.name,
      },
    },
    { new: true },
  );
  if (!application)
    fail(
      409,
      "Approved agreement not found, already accepted, or changed. Refresh and review it again.",
    );
  res.json(application);
});
router.post("/:id/withdraw", async (req, res) => {
  const { reason } = z.object({ reason: text }).parse(req.body);
  await mongoose.connection.transaction(async (session) => {
    const application = await Application.findOne({
      _id: id.parse(req.params.id),
      ...scope(req),
      status: { $in: ["submitted", "approved", "accepted"] },
    }).session(session);
    if (!application) fail(409, "An unpaid open application is required");
    if (["approved", "accepted"].includes(application.status)) {
      const home = await Property.findOneAndUpdate(
        {
          _id: application.property,
          status: "reserved",
          reservedBy: application._id,
        },
        {
          $set: { status: "available" },
          $unset: { reservedBy: 1 },
          $inc: { revision: 1 },
        },
        { session },
      );
      if (!home)
        fail(409, "Property reservation changed; refresh and try again");
    }
    application.status = "withdrawn";
    application.open = false;
    application.decisionNote = reason;
    await application.save({ session });
  });
  res.json({ message: "Application withdrawn; any reservation released." });
});
// Demonstration only. A real gateway must fulfill payments from a signed webhook,
// not from a browser-provided outcome. No card or bank details are accepted here.
router.post("/:id/simulate-payment", async (req, res) => {
  if (req.user.role !== "client")
    fail(403, "Only the applicant can use demo checkout");
  const { outcome } = z
    .object({
      outcome: z.enum(["success", "failure"]),
      confirmSimulation: z.literal(true),
      signingAndKeysConfirmed: z.literal(true),
    })
    .strict()
    .parse(req.body);
  let result;
  await mongoose.connection.transaction(async (session) => {
    const application = await Application.findOne({
      _id: id.parse(req.params.id),
      client: req.user._id,
    }).session(session);
    if (!application) fail(404, "Application not found");
    if (application.status === "paid") {
      result = { status: "paid", rental: application.rental, simulated: true };
      return;
    }
    if (application.status !== "accepted")
      fail(409, "Accept the approved agreement before payment");
    if (
      !application.visitConfirmedAt ||
      !application.ownershipReviewedAt ||
      !application.handoverConfirmedAt
    )
      fail(
        409,
        "Verification and staff signing/key-handover confirmation are required before checkout",
      );
    application.paymentAttempts += 1;
    if (outcome === "failure") {
      application.lastPaymentStatus = "failed";
      await application.save({ session });
      result = {
        status: "failed",
        simulated: true,
        message:
          "Demo payment declined. No money was charged. You can retry or withdraw.",
      };
      return;
    }
    const home = await Property.findOneAndUpdate(
      {
        _id: application.property,
        status: "reserved",
        reservedBy: application._id,
        archived: false,
      },
      {
        $set: { status: "rented" },
        $unset: { reservedBy: 1 },
        $inc: { revision: 1 },
      },
      { session },
    );
    if (!home) fail(409, "The property reservation is no longer valid");
    const terms = application.agreement;
    const [rental] = await Rental.create(
      [
        {
          property: application.property,
          client: application.client,
          staff: application.reviewedBy,
          application: application._id,
          simulated: true,
          startDate: terms.startDate,
          endDate: terms.endDate,
          monthlyRent: terms.monthlyRent,
          deposit: terms.deposit,
        },
      ],
      { session },
    );
    const amount = (cents(terms.monthlyRent) + cents(terms.deposit)) / 100;
    await Payment.create(
      [
        {
          rental: rental._id,
          amount,
          date: new Date(),
          method: "simulation",
          provider: "demo",
          testMode: true,
          reference: "DEMO-" + application._id,
          recordedBy: req.user._id,
        },
      ],
      { session },
    );
    application.status = "paid";
    application.open = false;
    application.lastPaymentStatus = "completed";
    application.paidAt = new Date();
    application.rental = rental._id;
    await application.save({ session });
    result = {
      status: "paid",
      rental: rental._id,
      simulated: true,
      message:
        "Demo payment successful. Your demo lease is now active; no real money was charged.",
    };
  });
  res.json(result);
});
module.exports = router;
