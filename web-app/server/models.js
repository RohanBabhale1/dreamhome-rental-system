const mongoose = require("mongoose");
const { Schema } = mongoose;
const ref = (name) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required: true,
});
const model = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true });
  indexes.forEach(([keys, options]) => schema.index(keys, options));
  return mongoose.model(name, schema);
};
const User = model("User", {
  name: String,
  email: { type: String, unique: true },
  passwordHash: { type: String, select: false },
  phone: String,
  role: { type: String, enum: ["client", "staff", "admin"], default: "client" },
  verified: { type: Boolean, default: false },
  tokenHash: { type: String, select: false },
  tokenExpires: { type: Date, select: false },
});
const Branch = model("Branch", {
  name: String,
  address: String,
  city: String,
  phone: String,
});
const Property = model(
  "Property",
  {
    title: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    type: { type: String, enum: ["apartment", "house", "condo", "villa"] },
    bedrooms: Number,
    bathrooms: Number,
    squareFeet: Number,
    rent: Number,
    description: String,
    imageUrl: String,
    ownerName: String,
    ownerPhone: String,
    ownerEmail: String,
    isDemo: { type: Boolean, default: false },
    seedKey: { type: String, unique: true, sparse: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch" },
    status: {
      type: String,
      enum: ["available", "reserved", "rented", "maintenance"],
      default: "available",
    },
    archived: { type: Boolean, default: false },
    revision: { type: Number, default: 0 },
    reservedBy: { type: Schema.Types.ObjectId, ref: "Application" },
  },
  [[{ city: 1, status: 1 }, {}]],
);
const Viewing = model(
  "Viewing",
  {
    property: ref("Property"),
    client: ref("User"),
    date: Date,
    notes: String,
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
  },
  [
    [
      { property: 1, date: 1 },
      { unique: true, partialFilterExpression: { status: "scheduled" } },
    ],
    [
      { client: 1, date: 1 },
      { unique: true, partialFilterExpression: { status: "scheduled" } },
    ],
  ],
);
const Rental = model(
  "Rental",
  {
    property: ref("Property"),
    client: ref("User"),
    staff: ref("User"),
    startDate: Date,
    endDate: Date,
    monthlyRent: Number,
    deposit: Number,
    simulated: { type: Boolean, default: false },
    application: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "terminated"],
      default: "active",
    },
  },
  [
    [
      { property: 1 },
      { unique: true, partialFilterExpression: { status: "active" } },
    ],
  ],
);
const Payment = model("Payment", {
  rental: ref("Rental"),
  amount: Number,
  date: Date,
  method: {
    type: String,
    enum: ["cash", "card", "bank_transfer", "simulation"],
  },
  reference: { type: String, unique: true },
  recordedBy: ref("User"),
  provider: String,
  testMode: Boolean,
});
const Application = model(
  "Application",
  {
    property: ref("Property"),
    client: ref("User"),
    preferredStart: Date,
    occupants: Number,
    message: String,
    status: {
      type: String,
      enum: [
        "submitted",
        "approved",
        "accepted",
        "paid",
        "rejected",
        "withdrawn",
      ],
      default: "submitted",
    },
    open: { type: Boolean, default: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decisionNote: String,
    agreement: {
      propertyTitle: String,
      address: String,
      tenantName: String,
      noticeDays: Number,
      lockInMonths: Number,
      maintenanceCharge: Number,
      annualIncreasePercent: Number,
      paymentPlan: String,
      startDate: Date,
      endDate: Date,
      monthlyRent: Number,
      deposit: Number,
      terms: String,
      version: String,
    },
    visitConfirmedAt: Date,
    ownershipReviewedAt: Date,
    handoverConfirmedAt: Date,
    handoverConfirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    handoverReference: String,
    acceptedAt: Date,
    acceptedName: String,
    paymentAttempts: { type: Number, default: 0 },
    lastPaymentStatus: String,
    paidAt: Date,
    rental: { type: Schema.Types.ObjectId, ref: "Rental" },
  },
  [
    [
      { property: 1, client: 1 },
      { unique: true, partialFilterExpression: { open: true } },
    ],
  ],
);
const Maintenance = model("Maintenance", {
  property: ref("Property"),
  client: ref("User"),
  description: String,
  priority: { type: String, enum: ["low", "medium", "high"] },
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed"],
    default: "pending",
  },
  resolution: String,
});
const Attempt = model(
  "Attempt",
  { key: { type: String, unique: true }, count: Number, expires: Date },
  [[{ expires: 1 }, { expireAfterSeconds: 0 }]],
);
const HomeImage = model("HomeImage", { data: Buffer, uploadedBy: ref("User") });
module.exports = {
  HomeImage,
  User,
  Branch,
  Property,
  Viewing,
  Rental,
  Payment,
  Maintenance,
  Attempt,
  Application,
};
