// Isolated browser smoke test: uses a disposable replica set, never your .env database.
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { chromium, expect } = require("@playwright/test");
async function main() {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let server, browser;
  try {
    process.env.MONGODB_URI = mongo.getUri("dreamhome-browser");
    process.env.JWT_SECRET = "browser-test-only-secret-at-least-32-characters";
    process.env.APP_URL = "http://localhost:5099";
    process.env.NODE_ENV = "test";
    process.env.MAIL_MODE = "console";
    await require("../web-app/server/config/database")();
    const models = require("../web-app/server/models");
    await Promise.all(Object.values(models).map((m) => m.init()));
    const passwordHash = await bcrypt.hash("Browser-password-123", 4);
    const [admin, client] = await models.User.create([
      {
        name: "Test Admin",
        email: "admin@browser.example",
        passwordHash,
        role: "admin",
        verified: true,
      },
      {
        name: "Test Client",
        email: "client@browser.example",
        passwordHash,
        role: "client",
        verified: true,
      },
    ]);
    const property = await models.Property.create({
      title: "Oak Street Apartment",
      address: "789 Oak Street",
      city: "New York",
      state: "NY",
      type: "apartment",
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 900,
      rent: 2500,
      description: "A bright two-bedroom apartment close to the city.",
      status: "available",
    });
    const host = express();
    host.use("/api", (req, res, next) => {
      req.url = "/api" + req.url;
      require("../web-app/server/app")(req, res, next);
    });
    const dist = path.join(__dirname, "../web-app/client/dist");
    host.use(express.static(dist));
    host.get("/{*path}", (_, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
    server = await new Promise((resolve) => {
      const s = host.listen(5099, "127.0.0.1", () => resolve(s));
    });
    browser = await chromium.launch({
      channel: process.env.BROWSER_CHANNEL || "chrome",
      headless: true,
    });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    fs.mkdirSync(path.join(__dirname, "../test-results"), { recursive: true });
    await page.goto(process.env.APP_URL);
    await expect(
      page.getByRole("heading", { name: "Your next chapter starts at home." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Oak Street Apartment" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/home-desktop.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Find a home", exact: true }).click();
    await page.getByRole("combobox", { name: "City" }).click();
    await page.getByRole("option", { name: "New York", exact: true }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("1 available homes")).toBeVisible();
    await page.getByRole("link", { name: "View home", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Oak Street Apartment" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Sign in to book a viewing" }).click();
    await page.getByLabel("Email").fill(client.email);
    await page
      .getByLabel("Password (10–72 characters)")
      .fill("Browser-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Hello, Test." }),
    ).toBeVisible();
    await page.goto(process.env.APP_URL + "/properties/" + property._id);
    await page
      .getByRole("button", { name: "Book a viewing", exact: true })
      .click();
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setMinutes(0, 0, 0);
    const local = new Date(
      tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
    await page.getByLabel("Viewing time (local)").fill(local);
    await page
      .getByRole("button", { name: "Book viewing", exact: true })
      .click();
    await expect(
      page.getByText("Your viewing is scheduled.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Email").fill(admin.email);
    await page
      .getByLabel("Password (10–72 characters)")
      .fill("Browser-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Viewing notifications" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "properties", exact: true }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Property title").fill("Oak Street Retreat");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Oak Street Retreat" }),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Leases & payments", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create lease", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Available property" }).click();
    await page.getByRole("option", { name: "Oak Street Retreat" }).click();
    await page.getByRole("combobox", { name: "Verified client" }).click();
    await page
      .getByRole("option", { name: "Test Client · client@browser.example" })
      .click();
    const start = new Date();
    start.setUTCDate(1);
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    await page.getByLabel("Start date").fill(start.toISOString().slice(0, 10));
    await page
      .getByLabel("End date (exclusive)")
      .fill(end.toISOString().slice(0, 10));
    await page.getByLabel("Monthly rent ($)").fill("2500");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Oak Street Retreat" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Record payment" }).click();
    await page.getByLabel("Amount ($)").fill("2500");
    await page
      .getByLabel("Unique receipt / bank reference")
      .fill("BROWSER-RECEIPT-1");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Payment history (1)")).toBeVisible();
    await page.screenshot({
      path: "test-results/staff-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Email").fill(client.email);
    await page
      .getByLabel("Password (10–72 characters)")
      .fill("Browser-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("tab", { name: "maintenance", exact: true }).click();
    await page.getByRole("button", { name: "Report an issue" }).click();
    await page
      .getByLabel("Describe the issue")
      .fill("There is a leak under the kitchen sink.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("There is a leak under the kitchen sink."),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/client-mobile.png",
      fullPage: true,
    });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
    )
      throw new Error("Mobile dashboard overflows viewport");
    await page.goto(process.env.APP_URL);
    await page.screenshot({
      path: "test-results/home-mobile.png",
      fullPage: true,
    });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
    )
      throw new Error("Mobile homepage overflows viewport");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "Browser checks passed: browse, filter, login, booking, property editing, lease creation, payment recording, maintenance and mobile layouts.",
    );
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
