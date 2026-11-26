require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  quiet: true,
});
const mongoose = require("mongoose");
const connect = require("../config/database");
const { Branch, Property } = require("../models");
const { seedHomes } = require("../data/demo-homes");
async function main() {
  await connect();
  await Property.init();
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
  console.log(JSON.stringify(await seedHomes(branch._id)));
}
main()
  .catch((error) => {
    console.error("Demo home initialization failed: " + error.name);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
