// Explicit opt-in: tests the running local app against its configured database.
// Only records tagged with this run's random QA identifier are removed afterwards.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const config = dotenv.parse(
  fs.readFileSync(path.join(__dirname, "../web-app/server/.env")),
);
const run = "QA-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex");
const email = run.toLowerCase() + "@example.com";
const password = crypto.randomBytes(18).toString("hex");
const report = {
  run,
  started: new Date().toISOString(),
  checks: [],
  limitations: [
    "SMTP delivery is not tested in local console mode.",
    "Live verification uses a known token fixture on the disposable QA client only.",
  ],
};
const secrets = [
  config.MONGODB_URI,
  config.SEED_ADMIN_PASSWORD,
  config.JWT_SECRET,
  password,
].filter(Boolean);
const clean = (value) =>
  secrets.reduce(
    (text, secret) => text.split(secret).join("[REDACTED]"),
    String(value),
  );
let browser, models, clientId, propertyId, branchId;
const out = path.join(__dirname, "../test-results");
fs.mkdirSync(out, { recursive: true });
const mark = (name) => {
  report.checks.push({ name, status: "passed" });
  console.log("PASS: " + name);
};
async function select(page, label, name) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
async function save(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20000 });
}
async function confirm(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20000 });
}
async function login(page, userEmail, userPassword) {
  await page.goto(config.APP_URL + "/login");
  await page.getByLabel("Email", { exact: false }).fill(userEmail);
  await page.getByLabel("Password (10–72 characters)").fill(userPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Hello,/ })).toBeVisible({
    timeout: 20000,
  });
}
async function status(response, expected) {
  assert.equal(
    response.status(),
    expected,
    "Unexpected response for " + new URL(response.url()).pathname,
  );
}
async function main() {
  if (!process.argv.includes("--live"))
    throw new Error(
      "Pass --live to explicitly test the configured running application.",
    );
  if (new URL(config.APP_URL).hostname !== "localhost")
    throw new Error("This script is restricted to localhost.");
  if (config.MAIL_MODE !== "console")
    throw new Error(
      "Live QA requires console mail mode to avoid sending real messages.",
    );
  if (!config.SEED_ADMIN_EMAIL || !config.SEED_ADMIN_PASSWORD)
    throw new Error("Administrator credentials must be configured locally.");
  Object.assign(process.env, config);
  await mongoose.connect(config.MONGODB_URI, {
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
  });
  models = require("../web-app/server/models");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const clientContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const admin = await adminContext.newPage(),
    client = await clientContext.newPage(),
    guest = await guestContext.newPage();
  const errors = [];
  for (const page of [admin, client, guest])
    page.on("pageerror", (e) => errors.push(clean(e.message)));
  await status(await guest.request.get(config.APP_URL + "/api/health"), 200);
  await guest.goto(config.APP_URL);
  await expect(
    guest.getByRole("heading", { name: "Your next chapter starts at home." }),
  ).toBeVisible();
  await expect(guest.getByText("Loading your workspace…")).toHaveCount(0);
  assert.equal(
    await guest.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await guest.screenshot({
    path: path.join(out, "live-home-mobile.png"),
    fullPage: true,
  });
  await guest.goto(config.APP_URL + "/dashboard");
  await expect(
    guest.getByRole("heading", { name: "Good to see you again." }),
  ).toBeVisible();
  await status(
    await guest.request.get(config.APP_URL + "/api/properties/all"),
    401,
  );
  mark(
    "Running app health, mobile home, protected route and unauthenticated API",
  );

  await client.goto(config.APP_URL + "/register");
  await client.getByLabel("Full name").fill(run + " Client");
  await client.getByLabel("Email").fill(email);
  await client.getByLabel("Phone").fill("555-0100");
  await client.getByLabel("Password (10–72 characters)").fill(password);
  await client
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(client.getByRole("alert")).toContainText("Account created", {
    timeout: 20000,
  });
  clientId = (await models.User.findOne({ email }))._id;
  await client
    .getByRole("button", { name: "Resend verification email" })
    .click();
  await expect(client.getByRole("alert")).toContainText(
    "If an unverified account exists",
  );
  await status(
    await client.request.post(config.APP_URL + "/api/auth/login", {
      data: { email, password },
    }),
    403,
  );
  const token = crypto.randomBytes(32).toString("hex");
  await models.User.updateOne(
    { _id: clientId, email },
    {
      $set: {
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        tokenExpires: new Date(Date.now() + 600000),
      },
    },
  );
  await client.goto(config.APP_URL + "/verify?token=" + token);
  await client.getByRole("button", { name: "Verify email address" }).click();
  await expect(client.getByRole("alert")).toContainText("Email verified");
  await status(
    await client.request.post(config.APP_URL + "/api/auth/verify", {
      data: { token },
    }),
    400,
  );
  await status(
    await client.request.post(config.APP_URL + "/api/auth/login", {
      data: { email, password: "Wrong-password-123" },
    }),
    401,
  );
  await login(client, email, password);
  await client.reload();
  await expect(client.getByRole("heading", { name: /^Hello,/ })).toBeVisible();
  await status(await client.request.get(config.APP_URL + "/api/users"), 403);
  mark(
    "Client registration, resend, verification, invalid credentials, persistent login and role protection",
  );

  await login(admin, config.SEED_ADMIN_EMAIL, config.SEED_ADMIN_PASSWORD);
  await admin.getByRole("tab", { name: "branches", exact: true }).click();
  await admin.getByRole("button", { name: "Add branch" }).click();
  await admin.getByLabel("Branch name").fill(run + " Branch");
  await admin.getByLabel("Address").fill("100 QA Test Street");
  await admin.getByLabel("City").fill("QA City");
  await admin.getByLabel("Phone").fill("555-0199");
  await save(admin);
  branchId = (await models.Branch.findOne({ name: run + " Branch" }))._id;
  await admin
    .getByRole("row")
    .filter({ hasText: run + " Branch" })
    .getByRole("button", { name: "Edit" })
    .click();
  await admin.getByLabel("Phone").fill("555-0188");
  await save(admin);
  await expect(
    admin.getByRole("row").filter({ hasText: run + " Branch" }),
  ).toContainText("555-0188");
  mark("Admin sign-in and branch creation/editing");

  await admin.getByRole("tab", { name: "people", exact: true }).click();
  const userRow = admin.getByRole("row").filter({ hasText: email });
  await userRow.getByRole("button", { name: "Make staff" }).click();
  await confirm(admin);
  await client.reload();
  await expect(
    client.getByRole("tab", { name: "properties", exact: true }),
  ).toBeVisible();
  await status(
    await client.request.patch(config.APP_URL + "/api/users/" + clientId, {
      data: { role: "client" },
    }),
    403,
  );
  await userRow.getByRole("button", { name: "Make client" }).click();
  await confirm(admin);
  await client.reload();
  await expect(
    client.getByRole("tab", { name: "properties", exact: true }),
  ).toHaveCount(0);
  mark("Admin role promotion/demotion and staff cannot manage roles");

  await admin.getByRole("tab", { name: "properties", exact: true }).click();
  await admin.getByRole("button", { name: "Add property" }).click();
  const title = run + " Apartment";
  for (const [label, value] of [
    ["Property title", title],
    ["Street address", "100 QA Test Street"],
    ["City", "QA City"],
    ["State", "QA"],
    ["Postal code", "10001"],
    ["Bedrooms", "2"],
    ["Bathrooms", "1"],
    ["Area (sq ft)", "900"],
    ["Monthly rent ($)", "1200"],
    ["Description", "Temporary QA property used only for feature testing."],
  ])
    await admin.getByLabel(label, { exact: false }).fill(value);
  await select(admin, "Branch", run + " Branch");
  await save(admin);
  propertyId = (await models.Property.findOne({ title }))._id;
  const propertyRow = admin.getByRole("row").filter({ hasText: title });
  await propertyRow.getByRole("button", { name: "Edit", exact: true }).click();
  await admin.getByLabel("Monthly rent ($)").fill("1250");
  await save(admin);
  await expect(propertyRow).toContainText("$1,250.00");
  await guest.goto(config.APP_URL + "/properties");
  await select(guest, "City", "QA City");
  await select(guest, "Home type", "apartment");
  await guest.getByLabel("Min bedrooms").fill("2");
  await guest.getByLabel("Min rent ($)").fill("1200");
  await guest.getByLabel("Max rent ($)").fill("1300");
  await select(guest, "Sort by", "Price: low to high");
  await guest.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await guest.getByLabel("Max rent ($)").fill("1000");
  await guest.getByRole("button", { name: "Search", exact: true }).click();
  await expect(guest.getByRole("alert")).toContainText(
    "Minimum rent cannot exceed maximum rent",
  );
  await guest.getByRole("button", { name: "Reset", exact: true }).click();
  await guest.getByLabel("Min rent ($)").fill("9999999");
  await guest.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    guest.getByText("No homes match this search.", { exact: false }),
  ).toBeVisible();
  await client.goto(config.APP_URL + "/properties/" + propertyId);
  await expect(
    client.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  mark(
    "Property create/edit, all search filters, sorting, validation, empty state and details",
  );

  const slot = new Date(Date.now() + 86400000);
  slot.setMinutes(0, 0, 0);
  const localSlot = new Date(slot.getTime() - slot.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await client.getByRole("button", { name: "Book a viewing" }).click();
  await client.getByLabel("Viewing time (local)").fill(localSlot);
  await client.getByLabel("Anything we should know?").fill("QA appointment");
  await client
    .getByRole("button", { name: "Book viewing", exact: true })
    .click();
  await expect(
    client.getByText("Your viewing is scheduled.", { exact: false }),
  ).toBeVisible();
  await status(
    await client.request.post(config.APP_URL + "/api/viewings", {
      data: { property: String(propertyId), date: slot.toISOString() },
    }),
    409,
  );
  await status(
    await admin.request.delete(
      config.APP_URL + "/api/properties/" + propertyId,
    ),
    409,
  );
  await client.goto(config.APP_URL + "/dashboard");
  await client.getByRole("tab", { name: "viewings", exact: true }).click();
  await client
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await confirm(client);
  await expect(
    client.getByRole("row").filter({ hasText: title }),
  ).toContainText("cancelled");
  // Rebook to test automatic viewing cancellation when the lease is created.
  await status(
    await client.request.post(config.APP_URL + "/api/viewings", {
      data: { property: String(propertyId), date: slot.toISOString() },
    }),
    201,
  );
  await admin.reload();
  await expect(
    admin.getByRole("heading", { name: "Viewing notifications" }),
  ).toBeVisible();
  await expect(
    admin.locator(".activity").filter({ hasText: title }),
  ).toBeVisible();
  mark(
    "Viewing booking, duplicate rejection, cancellation, archive protection and staff notification",
  );

  await admin
    .getByRole("tab", { name: "Leases & payments", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Create lease", exact: true })
    .click();
  await select(admin, "Available property", title);
  await select(admin, "Verified client", run + " Client · " + email);
  const start = new Date();
  start.setUTCDate(1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  await admin
    .getByLabel("Start date", { exact: false })
    .fill(start.toISOString().slice(0, 10));
  await admin
    .getByLabel("End date (exclusive)")
    .fill(end.toISOString().slice(0, 10));
  await admin.getByLabel("Monthly rent ($)").fill("1250");
  await admin.getByLabel("Deposit ($)").fill("500");
  await save(admin);
  const lease = admin.locator(".lease-card").filter({ hasText: title });
  await expect(lease).toContainText("$1,750.00");
  assert.equal((await models.Property.findById(propertyId)).status, "rented");
  assert.equal(
    await models.Viewing.countDocuments({
      property: propertyId,
      status: "scheduled",
    }),
    0,
  );
  await lease.getByRole("button", { name: "Record payment" }).click();
  await admin.getByLabel("Amount ($)").fill("750");
  await admin
    .getByLabel("Unique receipt / bank reference")
    .fill(run + "-receipt");
  await save(admin);
  await expect(lease).toContainText("$1,000.00");
  await lease.getByText("Payment history (1)").click();
  await expect(lease).toContainText(run + "-receipt");
  const rental = await models.Rental.findOne({ property: propertyId });
  await status(
    await admin.request.post(
      config.APP_URL + "/api/rentals/" + rental._id + "/payments",
      {
        data: {
          amount: 750,
          date: new Date().toISOString(),
          method: "cash",
          reference: run + "-receipt",
        },
      },
    ),
    409,
  );
  await status(
    await client.request.post(
      config.APP_URL + "/api/rentals/" + rental._id + "/payments",
      { data: { amount: 750 } },
    ),
    403,
  );
  await admin.evaluate(() => {
    window.print = () => {
      window.__qaPrintInvoked = true;
    };
  });
  await lease.getByRole("button", { name: "Print statement" }).click();
  assert.equal(await admin.evaluate(() => window.__qaPrintInvoked), true);
  await admin.emulateMedia({ media: "print" });
  await admin.screenshot({
    path: path.join(out, "live-print-statement.png"),
    fullPage: true,
  });
  await admin.emulateMedia({ media: "screen" });
  await admin.screenshot({
    path: path.join(out, "live-staff-leases.png"),
    fullPage: true,
  });
  mark(
    "Lease creation, reservation, viewing cancellation, payments, balance, duplicate receipt protection and print action",
  );

  await client.reload();
  await client
    .getByRole("tab", { name: "Leases & payments", exact: true })
    .click();
  await expect(client.locator(".lease-card")).toHaveCount(1);
  await expect(client.locator(".lease-card")).toContainText("$1,000.00");
  await client.getByRole("tab", { name: "maintenance", exact: true }).click();
  await client.getByRole("button", { name: "Report an issue" }).click();
  await client
    .getByLabel("Describe the issue")
    .fill("QA test: kitchen tap needs attention.");
  await select(client, "Priority", "high");
  await save(client);
  await admin.reload();
  await admin.getByRole("tab", { name: "maintenance", exact: true }).click();
  const repair = admin.getByRole("row").filter({ hasText: title });
  await repair.getByRole("button", { name: "Update", exact: true }).click();
  await select(admin, "Status", "in_progress");
  await save(admin);
  await expect(repair).toContainText("in progress");
  await repair.getByRole("button", { name: "Update", exact: true }).click();
  await select(admin, "Status", "completed");
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(admin.getByRole("dialog").getByRole("alert")).toContainText(
    "Add a resolution",
  );
  await admin
    .getByLabel("Resolution / work notes")
    .fill("QA test issue resolved. No actual repair performed.");
  await save(admin);
  await client.reload();
  await client.getByRole("tab", { name: "maintenance", exact: true }).click();
  await expect(
    client.getByRole("row").filter({ hasText: title }),
  ).toContainText("completed");
  await client.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await client.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await client.screenshot({
    path: path.join(out, "live-client-mobile.png"),
    fullPage: true,
  });
  mark(
    "Client lease visibility, maintenance creation, priorities, status transitions, required resolution and mobile workspace",
  );

  await admin
    .getByRole("tab", { name: "Leases & payments", exact: true })
    .click();
  await lease.getByRole("button", { name: "Terminate", exact: true }).click();
  await confirm(admin);
  await expect(lease).toContainText("terminated");
  // This run's disposable records only: exercise time-dependent completion paths.
  const pastViewing = await models.Viewing.create({
    property: propertyId,
    client: clientId,
    date: new Date(Date.now() - 3600000),
    notes: run + " past visit",
    status: "scheduled",
  });
  await admin.reload();
  await admin.getByRole("tab", { name: "viewings", exact: true }).click();
  const pastRow = admin
    .getByRole("row")
    .filter({ hasText: run + " past visit" });
  await pastRow.getByRole("button", { name: "Complete", exact: true }).click();
  await confirm(admin);
  await expect(pastRow).toContainText("completed");
  assert.equal(
    (await models.Viewing.findById(pastViewing._id)).status,
    "completed",
  );
  await admin
    .getByRole("tab", { name: "Leases & payments", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Create lease", exact: true })
    .click();
  await select(admin, "Available property", title);
  await select(admin, "Verified client", run + " Client · " + email);
  const pastStart = new Date(Date.now() - 60 * 86400000),
    pastEnd = new Date(Date.now() - 30 * 86400000);
  await admin
    .getByLabel("Start date", { exact: false })
    .fill(pastStart.toISOString().slice(0, 10));
  await admin
    .getByLabel("End date (exclusive)")
    .fill(pastEnd.toISOString().slice(0, 10));
  await admin.getByLabel("Monthly rent ($)").fill("1250");
  await save(admin);
  const expiredLease = admin
    .locator(".lease-card")
    .filter({ hasText: title })
    .filter({
      has: admin.getByRole("button", { name: "Complete", exact: true }),
    });
  await expiredLease
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  await confirm(admin);
  assert.equal(
    await models.Rental.countDocuments({
      property: propertyId,
      status: "completed",
    }),
    1,
  );
  mark(
    "Past viewing completion and expired lease completion release the property",
  );
  await admin.getByRole("tab", { name: "properties", exact: true }).click();
  await propertyRow
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await confirm(admin);
  await expect(propertyRow).toHaveCount(0);
  await status(
    await guest.request.get(config.APP_URL + "/api/properties/" + propertyId),
    404,
  );
  assert.ok(await models.Rental.findById(rental._id));
  await client.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    client.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await status(await client.request.get(config.APP_URL + "/api/auth/me"), 401);
  await guest.goto(config.APP_URL + "/does-not-exist");
  await expect(
    guest.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  mark(
    "Lease termination, property archival, preserved history, logout and 404 screen",
  );
  report.status = "passed";
}
async function cleanup() {
  if (browser) await browser.close();
  if (models) {
    // Discover only this exact run's records, including partially completed forms.
    const properties = await models.Property.find({
      title: run + " Apartment",
    }).select("_id");
    const ids = properties.map((p) => p._id);
    const rentals = await models.Rental.find({ property: { $in: ids } }).select(
      "_id",
    );
    await models.Payment.deleteMany({
      rental: { $in: rentals.map((r) => r._id) },
      reference: run + "-receipt",
    });
    await models.Maintenance.deleteMany({
      property: { $in: ids },
      client: clientId,
    });
    await models.Viewing.deleteMany({
      property: { $in: ids },
      client: clientId,
    });
    await models.Rental.deleteMany({
      _id: { $in: rentals.map((r) => r._id) },
      client: clientId,
    });
    await models.Property.deleteMany({
      _id: { $in: ids },
      title: run + " Apartment",
    });
    await models.Branch.deleteMany({ name: run + " Branch" });
    await models.User.deleteMany({ email });
    report.cleanup =
      "Removed only this run’s QA records; existing records preserved.";
  }
  await mongoose.disconnect();
  report.finished = new Date().toISOString();
  fs.writeFileSync(
    path.join(out, "live-feature-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(report.cleanup || "No QA database records created.");
}
main()
  .catch((error) => {
    report.status = "failed";
    report.error = clean(error.message);
    console.error(report.error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error("QA cleanup failed: " + clean(error.message));
      process.exitCode = 1;
    }
  });
