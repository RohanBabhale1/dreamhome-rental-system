const router = require("express").Router();
const mongoose = require("mongoose");
const {
  Rental,
  Property,
  User,
  Payment,
  Viewing,
  Application,
} = require("../models");
const {
  z,
  id,
  money,
  date,
  fail,
  auth,
  staff,
  scope,
  billing,
  text,
} = require("../lib");
router.use(auth);
router.get("/", async (req, res) => {
  const rentals = await Rental.find(scope(req))
    .populate("property")
    .populate("client", "name email")
    .sort({ createdAt: -1 })
    .lean();
  const payments = await Payment.find({
    rental: { $in: rentals.map((r) => r._id) },
  })
    .sort({ date: -1 })
    .lean();
  res.json(
    rentals.map((r) => {
      const ledger = payments.filter((p) => String(p.rental) === String(r._id));
      return { ...r, payments: ledger, billing: billing(r, ledger) };
    }),
  );
});
router.post("/", staff, async (req, res) => {
  const data = z
    .object({
      property: id,
      client: id,
      startDate: date,
      endDate: date,
      monthlyRent: money,
      deposit: z.coerce
        .number()
        .min(0)
        .max(10000000)
        .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001),
    })
    .parse(req.body);
  if (
    data.endDate <= data.startDate ||
    data.endDate - data.startDate > 10 * 366 * 86400000
  )
    fail(400, "End date must follow start date, within 10 years");
  if (
    !(await User.exists({ _id: data.client, role: "client", verified: true }))
  )
    fail(400, "Select a verified client");
  let rental;
  await mongoose.connection.transaction(async (session) => {
    const property = await Property.findOneAndUpdate(
      { _id: data.property, status: "available", archived: false },
      { $set: { status: "rented" }, $inc: { revision: 1 } },
      { session, new: true },
    );
    if (!property) fail(409, "Property is no longer available");
    [rental] = await Rental.create([{ ...data, staff: req.user._id }], {
      session,
    });
    await Viewing.updateMany(
      { property: data.property, status: "scheduled" },
      { $set: { status: "cancelled" } },
      { session },
    );
    await Application.updateMany(
      { property: data.property, status: "submitted" },
      {
        $set: {
          status: "rejected",
          open: false,
          decisionNote: "A lease was created for this home.",
        },
      },
      { session },
    );
  });
  res.status(201).json(rental);
});
router.patch("/:id", staff, async (req, res) => {
  const { status } = z
    .object({ status: z.enum(["completed", "terminated"]) })
    .parse(req.body);
  await mongoose.connection.transaction(async (session) => {
    const rental = await Rental.findOne({
      _id: id.parse(req.params.id),
      status: "active",
    }).session(session);
    if (!rental) fail(409, "Active lease not found");
    if (status === "completed" && rental.endDate > new Date())
      fail(400, "Use terminate to end a lease early");
    if (status === "terminated")
      rental.endDate = new Date(
        Math.max(Date.now(), rental.startDate.getTime()),
      );
    rental.status = status;
    await rental.save({ session });
    await Property.updateOne(
      { _id: rental.property },
      { $set: { status: "available" }, $inc: { revision: 1 } },
      { session },
    );
  });
  res.json({ message: "Lease closed and property made available" });
});
router.post("/:id/payments", staff, async (req, res) => {
  const rental = id.parse(req.params.id);
  if (!(await Rental.exists({ _id: rental }))) fail(404, "Lease not found");
  const data = z
    .object({
      amount: money,
      date: date,
      method: z.enum(["cash", "card", "bank_transfer"]),
      reference: text,
    })
    .parse(req.body);
  if (data.date > new Date()) fail(400, "Payment date cannot be in the future");
  res
    .status(201)
    .json(await Payment.create({ ...data, rental, recordedBy: req.user._id }));
});
module.exports = router;
