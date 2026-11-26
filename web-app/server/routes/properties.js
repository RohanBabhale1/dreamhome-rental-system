const router = require("express").Router();
const { Property, Branch } = require("../models");
const { z, id, text, money, fail, auth, staff } = require("../lib");
const schema = z.object({
  title: text,
  address: text,
  city: text,
  state: z.string().max(100).default(""),
  postalCode: z.string().max(20).default(""),
  type: z.enum(["apartment", "house", "condo", "villa"]),
  bedrooms: z.coerce.number().int().min(0).max(50),
  bathrooms: z.coerce.number().int().min(1).max(50),
  squareFeet: z.coerce.number().int().min(1).max(1000000),
  rent: money,
  description: z.string().trim().min(10).max(5000),
  imageUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .regex(
          /^\/images\/homes\/\d+\.jpg$/,
          "Choose a bundled home photo or an HTTPS image URL",
        ),
      z.url().refine((v) => v.startsWith("https://"), "Use an HTTPS image URL"),
    ])
    .default(""),
  branch: z.union([id, z.literal("")]).optional(),
  status: z.enum(["available", "maintenance"]).optional(),
});
router.get("/all", auth, staff, async (req, res) =>
  res.json(
    await Property.find({ archived: false })
      .populate("branch")
      .sort({ createdAt: -1 }),
  ),
);
router.get("/", async (req, res) => {
  const q = z
    .object({
      city: z.string().max(100).optional(),
      type: z.enum(["apartment", "house", "condo", "villa"]).optional(),
      minRent: z.coerce.number().min(0).optional(),
      maxRent: z.coerce.number().min(0).optional(),
      bedrooms: z.coerce.number().int().min(0).optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
    })
    .parse(req.query);
  if (
    q.minRent !== undefined &&
    q.maxRent !== undefined &&
    q.minRent > q.maxRent
  )
    fail(400, "Minimum rent cannot exceed maximum rent");
  const filter = { status: "available", archived: false };
  if (q.city)
    filter.city = new RegExp(
      q.city.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&"),
      "i",
    );
  if (q.type) filter.type = q.type;
  if (q.bedrooms !== undefined) filter.bedrooms = { $gte: q.bedrooms };
  if (q.minRent !== undefined || q.maxRent !== undefined)
    filter.rent = {
      ...(q.minRent !== undefined ? { $gte: q.minRent } : {}),
      ...(q.maxRent !== undefined ? { $lte: q.maxRent } : {}),
    };
  const [items, total, cities] = await Promise.all([
    Property.find(filter)
      .sort(
        q.sort === "newest"
          ? { createdAt: -1 }
          : { rent: q.sort === "price_asc" ? 1 : -1 },
      )
      .skip((q.page - 1) * 12)
      .limit(12),
    Property.countDocuments(filter),
    Property.distinct("city", { status: "available", archived: false }),
  ]);
  res.json({
    items,
    total,
    page: q.page,
    pages: Math.ceil(total / 12),
    cities: cities.filter(Boolean).sort((a, b) => a.localeCompare(b)),
  });
});
router.get("/:id", async (req, res) => {
  const property = await Property.findOne({
    _id: id.parse(req.params.id),
    archived: false,
  }).populate("branch");
  if (!property) fail(404, "Property not found");
  res.json(property);
});
async function data(body) {
  const value = schema.parse(body);
  if (value.branch && !(await Branch.exists({ _id: value.branch })))
    fail(400, "Branch not found");
  value.branch = value.branch || null;
  return value;
}
router.post("/", auth, staff, async (req, res) =>
  res.status(201).json(await Property.create(await data(req.body))),
);
router.put("/:id", auth, staff, async (req, res) => {
  const value = await data(req.body);
  const property = await Property.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      archived: false,
      status: { $ne: "rented" },
    },
    { $set: value, $inc: { revision: 1 } },
    { new: true },
  );
  if (!property) fail(409, "Property is rented or unavailable for editing");
  res.json(property);
});
router.delete("/:id", auth, staff, async (req, res) => {
  const mongoose = require("mongoose");
  const { Viewing, Maintenance } = require("../models");
  await mongoose.connection.transaction(async (session) => {
    const property = await Property.findOneAndUpdate(
      {
        _id: id.parse(req.params.id),
        archived: false,
        status: { $ne: "rented" },
      },
      { $set: { archived: true }, $inc: { revision: 1 } },
      { session, new: true },
    );
    if (!property) fail(409, "Rented properties cannot be archived");
    if (
      (await Viewing.exists({
        property: property._id,
        status: "scheduled",
      }).session(session)) ||
      (await Maintenance.exists({
        property: property._id,
        status: { $ne: "completed" },
      }).session(session))
    )
      fail(409, "Resolve scheduled viewings and open maintenance first");
  });
  res.json({ message: "Property archived; historical records retained" });
});
module.exports = router;
