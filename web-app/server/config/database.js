const mongoose = require("mongoose");
let connection;
module.exports = async function connect() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (!connection)
    connection = mongoose
      .connect(process.env.MONGODB_URI, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 8000,
      })
      .catch((error) => {
        connection = null;
        throw error;
      });
  await connection;
};
