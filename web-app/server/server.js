require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const app = require("./app");
const connect = require("./config/database");
connect()
  .then(() =>
    app.listen(process.env.PORT || 5000, () =>
      console.log("DreamHome API ready on port " + (process.env.PORT || 5000)),
    ),
  )
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
