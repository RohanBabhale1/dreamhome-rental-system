const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const bcrypt = require("bcryptjs");
process.env.JWT_SECRET = "application-test-only-secret-with-32-characters";
process.env.APP_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";
const app = require("../app");
const models = require("../models");
let mongo, admin, client, other, clientId, home;
const dateString = (offset) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const terms = {
  noticeDays: 30,
  lockInMonths: 0,
  maintenanceCharge: 0,
  annualIncreasePercent: 0,
  paymentPlan: "Demo transfer at signing and key handover",
  startDate: dateString(1),
  endDate: dateString(366),
  monthlyRent: 1250.25,
  deposit: 500.5,
  terms:
    "Demo terms: monthly rent and deposit are payable through simulated checkout. No real money is collected.",
};
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri("application-tests");
  await require("../config/database")();
  await Promise.all(Object.values(models).map((m) => m.init()));
  const passwordHash = await bcrypt.hash("Application-test-123", 4);
  const users = await models.User.create(
    ["admin", "client", "other"].map((name, i) => ({
      name,
      email: name + "@applications.example",
      role: i === 0 ? "admin" : "client",
      verified: true,
      passwordHash,
    })),
  );
  clientId = users[1]._id;
  [admin, client, other] = [
    request.agent(app),
    request.agent(app),
    request.agent(app),
  ];
  for (const [i, agent] of [admin, client, other].entries())
    await agent
      .post("/api/auth/login")
      .send({ email: users[i].email, password: "Application-test-123" })
      .expect(200);
  home = await models.Property.create({
    title: "Application test home",
    address: "10 Demo Road",
    city: "Austin",
    type: "house",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1500,
    rent: 1250.25,
    status: "available",
  });
});
after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
const apply = (agent, property = home._id) =>
  agent.post("/api/applications").send({
    property: String(property),
    preferredStart: dateString(1),
    occupants: 2,
    message: "Applying without a viewing.",
  });
test("application approval, acceptance and demo checkout", async (t) => {
  let application, competing;
  await t.test(
    "verified clients apply without a viewing; duplicates and access violations fail",
    async () => {
      await request(app).get("/api/applications").expect(401);
      await apply(admin).expect(403);
      const results = await Promise.all([apply(client), apply(client)]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      application = results.find((r) => r.status === 201).body;
      assert.equal(
        await models.Viewing.countDocuments({ client: clientId }),
        0,
      );
      assert.equal((await other.get("/api/applications")).body.length, 0);
      competing = (await apply(other).expect(201)).body;
      await client
        .post("/api/applications/" + application._id + "/approve")
        .send(terms)
        .expect(403);
      await client
        .post("/api/applications/" + application._id + "/simulate-payment")
        .send({
          outcome: "success",
          confirmSimulation: true,
          signingAndKeysConfirmed: true,
        })
        .expect(409);
    },
  );
  await t.test(
    "approval reserves exclusively, rejects competing applications and freezes terms",
    async () => {
      await admin
        .post("/api/applications/" + application._id + "/approve")
        .send({ ...terms, endDate: terms.startDate })
        .expect(400);
      await admin
        .post("/api/applications/" + application._id + "/approve")
        .send(terms)
        .expect(409);
      await other
        .post("/api/applications/" + application._id + "/verification")
        .send({ visited: true, ownershipReviewed: true })
        .expect(409);
      await client
        .post("/api/applications/" + application._id + "/verification")
        .send({ visited: false, ownershipReviewed: true })
        .expect(400);
      await client
        .post("/api/applications/" + application._id + "/verification")
        .send({ visited: true, ownershipReviewed: true })
        .expect(200);
      await other
        .post("/api/applications/" + competing._id + "/verification")
        .send({ visited: true, ownershipReviewed: true })
        .expect(200);
      const results = await Promise.all(
        [application, competing].map((a) =>
          admin.post("/api/applications/" + a._id + "/approve").send(terms),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const approved = results.find((r) => r.status === 200).body;
      // Use the winning client for the remainder regardless of transaction order.
      if (approved._id !== application._id) {
        [client, other] = [other, client];
        application = competing;
      }
      application = approved;
      assert.equal(
        (await models.Property.findById(home._id)).status,
        "reserved",
      );
      assert.equal((await request(app).get("/api/properties")).body.total, 0);
      await admin.delete("/api/properties/" + home._id).expect(409);
      await admin
        .post("/api/rentals")
        .send({
          property: String(home._id),
          client: String(application.client),
          ...terms,
        })
        .expect(409);
      await admin
        .post("/api/applications/" + application._id + "/approve")
        .send({ ...terms, monthlyRent: 1 })
        .expect(409);
    },
  );
  await t.test(
    "only applicant can accept the exact agreement with explicit consent",
    async () => {
      const body = {
        name: "Test Tenant",
        accepted: true,
        version: application.agreement.version,
      };
      await other
        .post("/api/applications/" + application._id + "/accept")
        .send(body)
        .expect(409);
      await client
        .post("/api/applications/" + application._id + "/accept")
        .send({ ...body, accepted: false })
        .expect(400);
      await client
        .post("/api/applications/" + application._id + "/accept")
        .send({ ...body, version: "outdated" })
        .expect(409);
      const accepted = (
        await client
          .post("/api/applications/" + application._id + "/accept")
          .send(body)
          .expect(200)
      ).body;
      assert.ok(accepted.acceptedAt);
      assert.equal(accepted.acceptedName, "Test Tenant");
    },
  );
  await t.test(
    "declines are retryable and do not create money or leases",
    async () => {
      await client
        .post("/api/applications/" + application._id + "/simulate-payment")
        .send({
          outcome: "success",
          confirmSimulation: true,
          signingAndKeysConfirmed: true,
        })
        .expect(409);
      await client
        .post("/api/applications/" + application._id + "/handover")
        .send({ reference: "Demo execution", ready: true })
        .expect(403);
      await admin
        .post("/api/applications/" + application._id + "/handover")
        .send({ reference: "Demo execution and keys", ready: true })
        .expect(200);
      const response = await client
        .post("/api/applications/" + application._id + "/simulate-payment")
        .send({
          outcome: "failure",
          confirmSimulation: true,
          signingAndKeysConfirmed: true,
        })
        .expect(200);
      assert.equal(response.body.status, "failed");
      assert.equal(await models.Rental.countDocuments(), 0);
      assert.equal(await models.Payment.countDocuments(), 0);
      assert.equal(
        (await models.Application.findById(application._id)).status,
        "accepted",
      );
      await client
        .post("/api/applications/" + application._id + "/simulate-payment")
        .send({
          outcome: "success",
          confirmSimulation: true,
          signingAndKeysConfirmed: true,
          amount: 1,
        })
        .expect(400);
      await other
        .post("/api/applications/" + application._id + "/simulate-payment")
        .send({
          outcome: "success",
          confirmSimulation: true,
          signingAndKeysConfirmed: true,
        })
        .expect(404);
    },
  );
  await t.test(
    "duplicate successful demo payments create exactly one lease and labeled receipt",
    async () => {
      const responses = await Promise.all(
        [1, 2].map(() =>
          client
            .post("/api/applications/" + application._id + "/simulate-payment")
            .send({
              outcome: "success",
              confirmSimulation: true,
              signingAndKeysConfirmed: true,
            }),
        ),
      );
      assert.deepEqual(
        responses.map((r) => r.status),
        [200, 200],
      );
      assert.equal(await models.Rental.countDocuments(), 1);
      assert.equal(await models.Payment.countDocuments(), 1);
      const receipt = await models.Payment.findOne();
      assert.equal(receipt.amount, 1750.75);
      assert.equal(receipt.testMode, true);
      assert.equal(receipt.method, "simulation");
      const rental = await models.Rental.findOne();
      assert.equal(rental.simulated, true);
      assert.equal(String(rental.application), application._id);
      assert.equal((await models.Property.findById(home._id)).status, "rented");
      await client
        .post("/api/applications/" + application._id + "/withdraw")
        .send({ reason: "Too late" })
        .expect(409);
      assert.equal(
        (await client.get("/api/rentals")).body[0].billing.totalPaid,
        1750.75,
      );
    },
  );
});
test("withdrawal releases accepted reservations; rejection and archival close pending applications", async () => {
  const home2 = await models.Property.create({
    title: "Withdrawal test",
    address: "20 Demo Road",
    city: "Austin",
    status: "available",
    rent: 1250,
  });
  const application = (await apply(client, home2._id).expect(201)).body;
  await client
    .post("/api/applications/" + application._id + "/verification")
    .send({ visited: true, ownershipReviewed: true })
    .expect(200);
  const approved = (
    await admin
      .post("/api/applications/" + application._id + "/approve")
      .send(terms)
      .expect(200)
  ).body;
  await client
    .post("/api/applications/" + application._id + "/accept")
    .send({
      version: approved.agreement.version,
      name: "Test Tenant",
      accepted: true,
    })
    .expect(200);
  await client
    .post("/api/applications/" + application._id + "/withdraw")
    .send({ reason: "Changed plans" })
    .expect(200);
  assert.equal((await models.Property.findById(home2._id)).status, "available");
  await client
    .post("/api/applications/" + application._id + "/simulate-payment")
    .send({
      outcome: "success",
      confirmSimulation: true,
      signingAndKeysConfirmed: true,
    })
    .expect(409);
  const retry = (await apply(client, home2._id).expect(201)).body;
  await admin
    .post("/api/applications/" + retry._id + "/reject")
    .send({ reason: "Requested dates unavailable" })
    .expect(200);
  const archived = (await apply(client, home2._id).expect(201)).body;
  await admin.delete("/api/properties/" + home2._id).expect(200);
  assert.equal(
    (await models.Application.findById(archived._id)).status,
    "rejected",
  );
});

test("staff image uploads validate contents and serve durable JPEGs", async () => {
  await client.post("/api/images").send({ image: "bad" }).expect(403);
  await admin
    .post("/api/images")
    .send({ image: "data:image/png;base64,ZmFrZQ==" })
    .expect(400);
  await admin
    .post("/api/images")
    .send({ image: "data:image/svg+xml;base64,PHN2Zz4=" })
    .expect(400);
  const png = await require("sharp")({
    create: { width: 4, height: 4, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const uploaded = await admin
    .post("/api/images")
    .send({ image: "data:image/png;base64," + png.toString("base64") })
    .expect(201);
  const listing = await admin
    .post("/api/properties")
    .send({
      title: "Uploaded home",
      address: "Sample Road",
      city: "Boston",
      type: "house",
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 800,
      rent: 1200,
      description: "A fictional listing for testing.",
      imageUrl: uploaded.body.imageUrl,
      ownerName: "Demo Owner",
      ownerPhone: "+12025550123",
      ownerEmail: "owner@example.com",
    })
    .expect(201);
  const publicListing = await request(app)
    .get("/api/properties/" + listing.body._id)
    .expect(200);
  assert.equal(publicListing.body.imageUrl, uploaded.body.imageUrl);
  assert.equal(publicListing.body.ownerPhone, "+12025550123");
  const response = await request(app)
    .get(uploaded.body.imageUrl)
    .expect(200)
    .expect("Content-Type", /image\/jpeg/);
  assert.equal(
    (await require("sharp")(response.body).metadata()).format,
    "jpeg",
  );
  await admin
    .put("/api/properties/" + new mongoose.Types.ObjectId())
    .send({})
    .expect(400);
});
