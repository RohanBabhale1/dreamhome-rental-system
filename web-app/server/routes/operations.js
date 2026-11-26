const router = require("express").Router();
const {
  User,
  Branch,
  Property,
  Rental,
  Viewing,
  Maintenance,
  Application,
} = require("../models");
const { z, id, text, fail, auth, staff, scope, publicUser } = require("../lib");
router.use(auth);
router.get("/summary", async (req, res) => {
  const filter = scope(req);
  const [rentals, viewings, maintenance] = await Promise.all([
    Rental.countDocuments({ ...filter, status: "active" }),
    Viewing.countDocuments({ ...filter, status: "scheduled" }),
    Maintenance.countDocuments({ ...filter, status: { $ne: "completed" } }),
  ]);
  res.json({ rentals, viewings, maintenance });
});
router.get("/users", staff, async (req, res) =>
  res.json((await User.find().sort({ name: 1 })).map(publicUser)),
);
router.patch("/users/:id", staff, async (req, res) => {
  if (req.user.role !== "admin") fail(403, "Administrator access required");
  const role = z.enum(["client", "staff"]).parse(req.body.role);
  const user = await User.findById(id.parse(req.params.id));
  if (!user) fail(404, "User not found");
  if (user.role === "admin")
    fail(403, "Administrator roles cannot be changed here");
  if (
    role === "staff" &&
    ((await Rental.exists({ client: user._id })) ||
      (await Viewing.exists({ client: user._id })) ||
      (await Maintenance.exists({ client: user._id })) ||
      (await Application.exists({ client: user._id })))
  )
    fail(409, "This account has client history. Use a separate staff account.");
  user.role = role;
  await user.save();
  res.json(publicUser(user));
});
router.get("/branches", staff, async (req, res) =>
  res.json(await Branch.find().sort({ name: 1 })),
);
const branchSchema = z.object({
  name: text,
  address: text,
  city: text,
  phone: z.string().max(30).default(""),
});
router.post("/branches", staff, async (req, res) =>
  res.status(201).json(await Branch.create(branchSchema.parse(req.body))),
);
router.put("/branches/:id", staff, async (req, res) => {
  const branch = await Branch.findByIdAndUpdate(
    id.parse(req.params.id),
    branchSchema.parse(req.body),
    { new: true },
  );
  if (!branch) fail(404, "Branch not found");
  res.json(branch);
});
router.get("/maintenance", async (req, res) =>
  res.json(
    await Maintenance.find(scope(req))
      .populate("property")
      .populate("client", "name email")
      .sort({ createdAt: -1 }),
  ),
);
router.post("/maintenance", async (req, res) => {
  const data = z
    .object({
      property: id,
      description: z.string().trim().min(10).max(3000),
      priority: z.enum(["low", "medium", "high"]),
    })
    .parse(req.body);
  if (!(await Property.exists({ _id: data.property, archived: false })))
    fail(404, "Property not found");
  if (
    req.user.role === "client" &&
    !(await Rental.exists({
      property: data.property,
      client: req.user._id,
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() },
    }))
  )
    fail(403, "An active current lease is required for this property");
  let request;
  await require("mongoose").connection.transaction(async (session) => {
    const property = await Property.findOneAndUpdate(
      { _id: data.property, archived: false },
      { $inc: { revision: 1 } },
      { session },
    );
    if (!property) fail(409, "Property is no longer available");
    if (
      req.user.role === "client" &&
      !(await Rental.exists({
        property: data.property,
        client: req.user._id,
        status: "active",
        startDate: { $lte: new Date() },
        endDate: { $gt: new Date() },
      }).session(session))
    )
      fail(403, "An active current lease is required for this property");
    [request] = await Maintenance.create([{ ...data, client: req.user._id }], {
      session,
    });
  });
  res.status(201).json(request);
});
router.patch("/maintenance/:id", staff, async (req, res) => {
  const data = z
    .object({
      status: z.enum(["pending", "in_progress", "completed"]),
      resolution: z.string().max(3000).default(""),
    })
    .parse(req.body);
  if (data.status === "completed" && !data.resolution.trim())
    fail(400, "Add a resolution before completing a request");
  const result = await Maintenance.findByIdAndUpdate(
    id.parse(req.params.id),
    data,
    { new: true },
  );
  if (!result) fail(404, "Request not found");
  res.json(result);
});
module.exports = router;
