const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const bcrypt = require("bcryptjs");
process.env.JWT_SECRET =
  "test-only-secret-with-more-than-thirty-two-characters";
process.env.APP_URL = "http://localhost:5173";
process.env.MAIL_MODE = "console";
process.env.NODE_ENV = "test";
const app = require("../app");
const models = require("../models");
const { billing, hash } = require("../lib");
let mongo, admin, client, other, clientUser, otherUser, property;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri("dreamhome-test");
  await require("../config/database")();
  await Promise.all(Object.values(models).map((m) => m.init()));
  const passwordHash = await bcrypt.hash("Testing-password-123", 4);
  const users = await models.User.create([
    {
      name: "Admin",
      email: "admin@test.example",
      role: "admin",
      verified: true,
      passwordHash,
    },
    {
      name: "Client",
      email: "client@test.example",
      role: "client",
      verified: true,
      passwordHash,
    },
    {
      name: "Other",
      email: "other@test.example",
      role: "client",
      verified: true,
      passwordHash,
    },
  ]);
  [, clientUser, otherUser] = users;
  [admin, client, other] = [
    request.agent(app),
    request.agent(app),
    request.agent(app),
  ];
  for (const [agent, email] of [
    [admin, users[0].email],
    [client, users[1].email],
    [other, users[2].email],
  ])
    await agent
      .post("/api/auth/login")
      .send({ email, password: "Testing-password-123" })
      .expect(200);
});
after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
const home = {
  title: "Test Apartment",
  address: "12 Test Road",
  city: "New York",
  state: "NY",
  postalCode: "10001",
  type: "apartment",
  bedrooms: 2,
  bathrooms: 1,
  squareFeet: 900,
  rent: 1500,
  description: "A bright and spacious apartment.",
  status: "available",
};
test("rental application workflows", async (t) => {
  await t.test(
    "health, origin protection and staff authorization",
    async () => {
      await request(app).get("/api/health").expect(200);
      await request(app).post("/api/properties").send(home).expect(401);
      await client.post("/api/properties").send(home).expect(403);
      await admin
        .post("/api/properties")
        .set("Origin", "https://attacker.example")
        .send(home)
        .expect(403);
      await admin
        .post("/api/properties")
        .send({ ...home, rent: -1 })
        .expect(400);
      property = (await admin.post("/api/properties").send(home).expect(201))
        .body;
      await client.get("/api/properties/all").expect(403);
      await request(app).get("/api/properties/not-an-id").expect(400);
    },
  );
  await t.test(
    "registration, hashed single-use verification and secure login",
    async () => {
      const log = console.log;
      let verificationUrl;
      console.log = (value) => {
        if (String(value).startsWith("Verify email: "))
          verificationUrl = String(value).slice(14);
      };
      try {
        await request(app)
          .post("/api/auth/register")
          .send({
            name: "New User",
            email: "NEW@test.example",
            password: "New-password-123",
            role: "admin",
          })
          .expect(201);
      } finally {
        console.log = log;
      }
      const user = await models.User.findOne({
        email: "new@test.example",
      }).select("+tokenHash +passwordHash");
      assert.equal(user.role, "client");
      assert.notEqual(user.passwordHash, "New-password-123");
      const token = new URL(verificationUrl).searchParams.get("token");
      assert.equal(user.tokenHash, hash(token));
      await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "New-password-123" })
        .expect(403);
      await request(app).post("/api/auth/verify").send({ token }).expect(200);
      await request(app).post("/api/auth/verify").send({ token }).expect(400);
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "New-password-123" })
        .expect(200);
      assert.match(response.headers["set-cookie"][0], /HttpOnly/);
      assert.equal(response.body.passwordHash, undefined);
      await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "Wrong-password" })
        .expect(401);
    },
  );
  await t.test("filters, literal regex escaping and validation", async () => {
    const result = await request(app)
      .get(
        "/api/properties?city=York&type=apartment&minRent=1000&maxRent=2000&bedrooms=2",
      )
      .expect(200);
    assert.equal(result.body.total, 1);
    assert.equal(
      (await request(app).get("/api/properties?city=%2E%2A").expect(200)).body
        .total,
      0,
    );
    await request(app).get("/api/properties?minRent=500&maxRent=1").expect(400);
    await request(app).get("/api/properties?bedrooms=-2").expect(400);
  });
  let viewing;
  await t.test("concurrent viewing requests cannot double-book", async () => {
    const date = new Date(Date.now() + 86400000);
    date.setUTCMinutes(0, 0, 0);
    const responses = await Promise.all(
      [client, other].map((agent) =>
        agent.post("/api/viewings").send({ property: property._id, date }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    viewing = responses.find((r) => r.status === 201).body;
    await admin.delete("/api/properties/" + property._id).expect(409);
    const stranger =
      String(viewing.client) === String(clientUser._id) ? other : client;
    assert.equal(
      (await stranger.get("/api/viewings").expect(200)).body.length,
      0,
    );
    await stranger
      .patch("/api/viewings/" + viewing._id)
      .send({ status: "cancelled" })
      .expect(404);
    await admin
      .patch("/api/viewings/" + viewing._id)
      .send({ status: "completed" })
      .expect(400);
  });
  let lease;
  await t.test(
    "concurrent lease creation reserves property atomically and cancels viewings",
    async () => {
      const startDate = new Date();
      startDate.setUTCDate(1);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
      const body = {
        property: property._id,
        client: String(clientUser._id),
        startDate,
        endDate,
        monthlyRent: 1500,
        deposit: 1500,
      };
      await client.post("/api/rentals").send(body).expect(403);
      const responses = await Promise.all([
        admin.post("/api/rentals").send(body),
        admin
          .post("/api/rentals")
          .send({ ...body, client: String(otherUser._id) }),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      lease = responses.find((r) => r.status === 201).body;
      assert.equal(
        (await models.Property.findById(property._id)).status,
        "rented",
      );
      assert.equal(
        (await models.Viewing.findById(viewing._id)).status,
        "cancelled",
      );
      await admin
        .put("/api/properties/" + property._id)
        .send(home)
        .expect(409);
      await admin.delete("/api/properties/" + property._id).expect(409);
      const tenant =
        String(lease.client) === String(clientUser._id) ? client : other;
      const stranger = tenant === client ? other : client;
      assert.equal((await tenant.get("/api/rentals")).body.length, 1);
      assert.equal((await stranger.get("/api/rentals")).body.length, 0);
    },
  );
  await t.test(
    "payment receipts, duplicate protection and balances",
    async () => {
      const payment = {
        amount: 500.25,
        date: new Date(),
        method: "bank_transfer",
        reference: "TEST-RECEIPT-1",
      };
      await client
        .post("/api/rentals/" + lease._id + "/payments")
        .send(payment)
        .expect(403);
      await admin
        .post("/api/rentals/" + lease._id + "/payments")
        .send(payment)
        .expect(201);
      await admin
        .post("/api/rentals/" + lease._id + "/payments")
        .send(payment)
        .expect(409);
      await admin
        .post("/api/rentals/" + lease._id + "/payments")
        .send({ ...payment, amount: 0, reference: "BAD" })
        .expect(400);
      const result = (await admin.get("/api/rentals")).body[0];
      assert.equal(result.billing.totalPaid, 500.25);
      assert.equal(result.billing.balance, result.billing.totalDue - 500.25);
    },
  );
  await t.test(
    "maintenance ownership, staff updates, completion and lease release",
    async () => {
      const tenant =
          String(lease.client) === String(clientUser._id) ? client : other,
        stranger = tenant === client ? other : client;
      const body = {
        property: property._id,
        description: "Kitchen tap is leaking constantly.",
        priority: "high",
      };
      await stranger.post("/api/maintenance").send(body).expect(403);
      const maintenance = (
        await tenant.post("/api/maintenance").send(body).expect(201)
      ).body;
      await tenant
        .patch("/api/maintenance/" + maintenance._id)
        .send({ status: "completed", resolution: "Done" })
        .expect(403);
      await admin
        .patch("/api/maintenance/" + maintenance._id)
        .send({ status: "completed" })
        .expect(400);
      await admin
        .patch("/api/maintenance/" + maintenance._id)
        .send({ status: "completed", resolution: "Replaced the tap washer." })
        .expect(200);
      assert.equal((await stranger.get("/api/maintenance")).body.length, 0);
      await admin
        .patch("/api/rentals/" + lease._id)
        .send({ status: "completed" })
        .expect(400);
      await admin
        .patch("/api/rentals/" + lease._id)
        .send({ status: "terminated" })
        .expect(200);
      assert.equal(
        (await models.Property.findById(property._id)).status,
        "available",
      );
      await admin
        .patch("/api/rentals/" + lease._id)
        .send({ status: "terminated" })
        .expect(409);
      await admin.delete("/api/properties/" + property._id).expect(200);
      await request(app)
        .get("/api/properties/" + property._id)
        .expect(404);
      assert.ok(await models.Rental.findById(lease._id));
    },
  );
  await t.test("branch management and admin-only role management", async () => {
    const branch = (
      await admin
        .post("/api/branches")
        .send({ name: "Test Branch", address: "123 Main St", city: "New York" })
        .expect(201)
    ).body;
    await admin
      .put("/api/branches/" + branch._id)
      .send({
        name: "Updated Branch",
        address: "123 Main St",
        city: "New York",
        phone: "555-1234",
      })
      .expect(200);
    await client.get("/api/users").expect(403);
    const newUser = await models.User.findOne({ email: "new@test.example" });
    await admin
      .patch("/api/users/" + newUser._id)
      .send({ role: "staff" })
      .expect(200);
    await admin
      .patch("/api/users/" + newUser._id)
      .send({ role: "admin" })
      .expect(400);
    await client.post("/api/auth/logout").expect(200);
    await client.get("/api/auth/me").expect(401);
  });
});
test("billing clamps month-end anniversaries and uses integer cents", () => {
  const rental = {
    startDate: "2026-01-31T00:00:00Z",
    endDate: "2026-04-30T00:00:00Z",
    monthlyRent: 100.1,
    deposit: 50,
  };
  assert.deepEqual(
    billing(
      rental,
      [{ amount: 0.1 }, { amount: 0.2 }],
      new Date("2026-02-28T12:00:00Z"),
    ),
    { instalmentsDue: 2, totalDue: 250.2, totalPaid: 0.3, balance: 249.9 },
  );
  assert.equal(billing(rental, [], new Date("2026-01-01")).totalDue, 0);
  assert.equal(billing(rental, [], new Date("2026-12-01")).instalmentsDue, 3);
});

test("pagination and price sorting exclude rented and archived listings", async () => {
  await models.Property.insertMany([
    ...Array.from({ length: 13 }, (_, i) => ({
      ...home,
      title: `Page fixture ${i}`,
      city: "Pagination City",
      rent: 1000 + i * 100,
    })),
    { ...home, city: "Pagination City", status: "rented", rent: 50 },
    { ...home, city: "Pagination City", archived: true, rent: 40 },
    { ...home, city: "Rented Only City", status: "rented" },
    { ...home, city: "Archived Only City", archived: true },
  ]);
  const first = (
    await request(app)
      .get("/api/properties?city=Pagination%20City&sort=price_asc")
      .expect(200)
  ).body;
  assert.equal(first.total, 13);
  assert.equal(first.pages, 2);
  assert.equal(first.items.length, 12);
  assert.equal(first.items[0].rent, 1000);
  assert.ok(first.cities.includes("Pagination City"));
  assert.ok(!first.cities.includes("Rented Only City"));
  assert.ok(!first.cities.includes("Archived Only City"));
  assert.deepEqual(
    first.cities,
    [...new Set(first.cities)].sort((a, b) => a.localeCompare(b)),
  );
  const second = (
    await request(app)
      .get("/api/properties?city=Pagination%20City&sort=price_asc&page=2")
      .expect(200)
  ).body;
  assert.equal(second.items.length, 1);
  assert.equal(second.items[0].rent, 2200);
  const descending = (
    await request(app)
      .get("/api/properties?city=Pagination%20City&sort=price_desc")
      .expect(200)
  ).body;
  assert.equal(descending.items[0].rent, 2200);
});

test("expired verification tokens and malformed JSON are rejected", async () => {
  const token = "a".repeat(64);
  await models.User.create({
    name: "Expired verification",
    email: "expired@test.example",
    tokenHash: hash(token),
    tokenExpires: new Date(Date.now() - 1000),
  });
  await request(app).post("/api/auth/verify").send({ token }).expect(400);
  assert.equal(
    (await models.User.findOne({ email: "expired@test.example" })).verified,
    false,
  );
  await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send("{invalid")
    .expect(400);
});

test("authentication requests are rate limited across requests", async () => {
  let lastStatus;
  for (let i = 0; i < 31; i++) {
    lastStatus = (
      await request(app)
        .post("/api/auth/resend")
        .send({ email: "not-registered@test.example" })
    ).status;
    assert.ok([200, 429].includes(lastStatus));
  }
  assert.equal(lastStatus, 429);
});
