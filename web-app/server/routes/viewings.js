const router = require("express").Router();
const mongoose = require("mongoose");
const { Viewing, Property } = require("../models");
const { z, id, date, fail, auth, scope } = require("../lib");
router.use(auth);
router.get("/", async (req, res) =>
  res.json(
    await Viewing.find(scope(req))
      .populate("property")
      .populate("client", "name email")
      .sort({ date: 1 }),
  ),
);
router.post("/", async (req, res) => {
  if (req.user.role !== "client")
    fail(403, "Use a client account to book a viewing");
  const data = z
    .object({
      property: id,
      date: date,
      notes: z.string().max(1000).default(""),
    })
    .parse(req.body);
  if (
    data.date <= new Date() ||
    data.date > new Date(Date.now() + 90 * 86400000)
  )
    fail(400, "Choose a future date within 90 days");
  if (
    data.date.getUTCMinutes() % 30 ||
    data.date.getUTCSeconds() ||
    data.date.getUTCMilliseconds()
  )
    fail(400, "Viewings start on the hour or half hour");
  let viewing;
  await mongoose.connection.transaction(async (session) => {
    const property = await Property.findOneAndUpdate(
      { _id: data.property, status: "available", archived: false },
      { $inc: { revision: 1 } },
      { session },
    );
    if (!property) fail(409, "Property is no longer available");
    [viewing] = await Viewing.create([{ ...data, client: req.user._id }], {
      session,
    });
  });
  res.status(201).json(viewing);
});
router.patch("/:id", async (req, res) => {
  const { status } = z
    .object({ status: z.enum(["completed", "cancelled"]) })
    .parse(req.body);
  if (req.user.role === "client" && status !== "cancelled")
    fail(403, "Clients can only cancel");
  const viewing = await Viewing.findOne({
    _id: id.parse(req.params.id),
    ...scope(req),
  });
  if (!viewing) fail(404, "Viewing not found");
  if (viewing.status !== "scheduled") fail(409, "Viewing is already closed");
  if (status === "completed" && viewing.date > new Date())
    fail(400, "A future viewing cannot be completed");
  const updated = await Viewing.findOneAndUpdate(
    { _id: viewing._id, status: "scheduled" },
    { $set: { status } },
    { new: true },
  );
  if (!updated) fail(409, "Viewing is already closed");
  res.json(updated);
});
module.exports = router;
