require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connect = require("../config/database");
const models = require("../models");
async function seed() {
  await connect();
  await Promise.all(Object.values(models).map((m) => m.init()));
  const { User, Branch, Property } = models;
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase(),
    password = process.env.SEED_ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    password.length < 10 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error(
      "Set SEED_ADMIN_EMAIL and a 10+ character SEED_ADMIN_PASSWORD (at most 72 UTF-8 bytes)",
    );
  const existing = await User.findOne({ email });
  if (existing && existing.role !== "admin")
    throw new Error(
      "Seed email belongs to an existing non-admin account; choose another email",
    );
  if (!existing)
    await User.create({
      name: "DreamHome Administrator",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      verified: true,
    });
  const branch = await Branch.findOneAndUpdate(
    { name: "Downtown Branch" },
    {
      $setOnInsert: {
        address: "123 Main St",
        city: "New York",
        phone: "555-1000",
      },
    },
    { upsert: true, new: true },
  );
  const catalog = await require("../data/demo-homes").seedHomes(branch._id);
  console.log("Demo catalog:", catalog);
  console.log(
    "Indexes ready. Administrator and sample properties initialized. Existing records were preserved.",
  );
}
seed()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
