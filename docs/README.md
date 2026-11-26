# DreamHome Rental Management System

DreamHome is a React/JSX + Node.js/Express + MongoDB rental application. It includes public property discovery, a private client workspace, and staff/admin operations. The frontend and API deploy together in one Vercel project.

## What changed

The original repository had a partial React/Create React App frontend, missing entry/pages, unfinished staff forms, and MySQL routes without authentication/ownership enforcement. The current application replaces that runtime with Vite, JSX components, an Express API, Mongoose models, and verified cookie-based authentication.

The SQL files under `database/` are retained as historical design references only. They are **not** required or executed. Existing MySQL production data is **not automatically migrated**; the new MongoDB seed initializes sample properties and your chosen administrator without deleting existing records.

## Features and access

The City search dropdown is populated from currently available, non-archived homes in MongoDB, sorted alphabetically, with an **All cities** option. It updates when search results are refreshed and works alongside the home-type, bedroom, budget and sorting filters.

| Capability                                                 | Guest         | Client                   | Staff / admin            |
| ---------------------------------------------------------- | ------------- | ------------------------ | ------------------------ |
| Browse available homes, details, filters, sort, pagination | Yes           | Yes                      | Yes                      |
| Register, verify email, sign in, resend verification       | Yes           | Yes                      | Yes                      |
| Book and cancel own 30-minute viewings                     | Sign in first | Yes                      | View/manage all bookings |
| View own leases, due balances, payment history             | No            | Yes                      | View all                 |
| Create/close leases and record payment receipts            | No            | No                       | Yes                      |
| Report maintenance                                         | No            | Current leased home only | Any listed property      |
| Update repair status and resolution                        | No            | No                       | Yes                      |
| Add/edit/archive properties and manage branches            | No            | No                       | Yes                      |
| View client directory                                      | No            | No                       | Yes                      |
| Change client/staff roles                                  | No            | No                       | Admin only               |

Additional behavior:

- Password hashing with bcrypt; one-day JWT sessions in HTTP-only, SameSite cookies, Secure in production.
- Email verification uses hashed, expiring, single-use tokens. Production uses SMTP; local development can print links to the server terminal.
- Server-side request validation, role and ownership checks, origin protection, security headers, and a shared MongoDB authentication rate limit.
- No double-booking the same property or client in the same viewing slot; concurrent requests are covered by database unique indexes.
- Lease creation and property availability changes use MongoDB transactions. Booking a lease cancels outstanding viewings for that property.
- Property removal archives the listing while retaining historical records. Active leases, scheduled viewings, and unresolved repairs prevent archival.
- Dashboard viewing notifications are visible on load or refresh; they are not push notifications or staff emails.
- Responsive Material UI screens, accessible form labels, loading/error/empty states, optional HTTPS property images, and built-in illustration fallbacks.
- Printable lease/payment statements using the browser print dialog.

## Architecture and working

```mermaid
flowchart LR
  Visitor[Browser: React JSX + Material UI] -->|Same-origin /api requests| API[Express Node.js API]
  API --> Auth[JWT cookie + role + ownership checks]
  Auth --> Validation[Zod validation + business rules]
  Validation --> DB[(MongoDB Atlas)]
  API --> SMTP[SMTP verification email]
  CDN[Vercel static hosting] --> Visitor
  Function[Vercel Node.js Function] --> API
```

1. Visitors search available properties by city, type, rent range and bedrooms, then inspect a property.
2. A client registers and opens their verification link. Only verified accounts can sign in.
3. The browser stores the session in an HTTP-only cookie; it never stores a JWT in localStorage.
4. Clients book a future slot. The API assigns ownership from the session, not from a submitted client ID.
5. Staff see viewing requests, manage property/branch records and create a lease for a verified client.
6. Creating the lease reserves the property transactionally and removes it from public availability.
7. Staff record payments received outside the app. Both staff and the tenant can inspect the ledger and current balance.
8. A current tenant reports a repair. Staff progress it and provide a resolution.
9. Staff explicitly complete or terminate leases to release a home. History remains available.

### MongoDB collections

| Collection/model | Purpose and relationships                                            |
| ---------------- | -------------------------------------------------------------------- |
| User             | Authentication, verified email, name, phone, client/staff/admin role |
| Branch           | Office name, address, city, contact                                  |
| Property         | Listing, availability, optional Branch reference                     |
| Viewing          | Property + client User + date/slot + status                          |
| Rental           | Property + client User + creating staff User + lease terms           |
| Payment          | Rental + recording User + unique receipt reference                   |
| Maintenance      | Property + reporting User + priority/status/resolution               |
| Attempt          | Shared authentication request counters with TTL expiry               |

Client/staff profile identity is consolidated in User, replacing separate SQL identity tables. The original salary/employee fields are outside the rental workflows; payroll is not implemented.

### Business rules

- Currency is **USD**, matching the original sample data. Change the formatter and labels together if adapting the application to another currency.
- Viewings last 30 minutes, start on the hour or half hour, and must be within the next 90 days. Times are stored in UTC and displayed in the viewer's local timezone.
- One active lease per property. Future-dated leases reserve the property immediately; this is not a calendar of multiple future leases.
- Lease end dates are exclusive. Monthly rent is due on the start-date anniversary; shorter months clamp to the final day. The deposit is due at the start.
- The balance is accrued rent plus deposit minus recorded payments. Calculations use integer cents. Negative balances represent credit.
- Terminating early changes the end date to today (or the start date for a not-yet-started lease). Already-due monthly instalments remain due; no daily proration, refund processing, tax, late fees, or deposit settlement is automated.
- Expired leases remain reserved until staff complete them; there is no scheduled background job.
- Payments are an immutable receipt ledger with unique references. **This is not a payment gateway** and no card/bank details are collected.
- Registered accounts always start as clients. Only an administrator can promote a separate account to staff. Accounts with client history cannot be promoted.
- All staff operate across all branches; branch-specific staff permissions are not implemented.

## Project structure

```text
api/index.js                    Vercel function exporting the Express app
vercel.json                     Build output and SPA/API routing
package.json                    npm workspaces and root commands
package-lock.json               Shared reproducible dependency lockfile
web-app/client/
  index.html                    Vite HTML entry
  vite.config.js                React build and local API proxy
  src/main.jsx                  React mount and Material UI theme
  src/App.jsx                   Router, auth context, navigation
  src/api.js                    Same-origin API client and formatters
  src/pages/                    Property, auth, and workspace screens
  src/components/UI.jsx         Shared forms/dialogs/status components
  src/styles.css                Responsive styles and print layout
web-app/server/
  app.js                        Serverless-compatible Express app
  server.js                     Local Node.js listener
  config/database.js            Cached MongoDB connection (pool size 5)
  models.js                     Mongoose schemas and unique indexes
  lib.js                        Auth, validation helpers, billing
  routes/                       Authentication and domain endpoints
  scripts/seed.js                Non-destructive initializer
  test/app.test.js               API + concurrency + billing tests
scripts/browser-smoke.cjs        Isolated browser workflow test
database/*.sql                  Historical MySQL references
docs/requirements.md            Requirements and implementation mapping
```

## Local setup

Prerequisites: Node.js **24 LTS** and npm, a MongoDB Atlas free cluster (or a local MongoDB **replica set**), and optionally SMTP credentials. Standalone MongoDB without replica-set support cannot run the lease/viewing transactions.

From the repository root:

```powershell
npm install
Copy-Item web-app/server/.env.example web-app/server/.env
```

On macOS/Linux use `cp` instead of `Copy-Item`.

Edit `web-app/server/.env`:

```dotenv
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/dreamhome?retryWrites=true&w=majority
JWT_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
APP_URL=http://localhost:5173
PORT=5000
MAIL_MODE=console
SEED_ADMIN_EMAIL=your-admin-email@example.com
SEED_ADMIN_PASSWORD=YOUR_OWN_STRONG_PASSWORD
```

Generate a secret with:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not commit `.env`. The MongoDB database user/password are different from the DreamHome administrator account.

```sh
npm run seed
npm run dev
```

Open **http://localhost:5173**. The API runs at **http://127.0.0.1:5000** and Vite forwards `/api` calls. Use the exact `APP_URL` hostname: switching between `localhost` and `127.0.0.1` causes origin validation to reject mutations.

The seed creates indexes, your verified administrator, one branch and 12 demo homes. It is safe to rerun: existing records and passwords are not overwritten. There are no public default credentials. The old SQL fixture password hashes were placeholders and are not used.

For a client walkthrough, register a different email, copy the verification URL printed in the **API terminal**, open it, click **Verify email address**, then sign in. In production these links are sent by email and are never printed.

### Commands

| Command from root      | Result                                         |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start Vite and API together                    |
| `npm start`            | Start API only                                 |
| `npm run seed`         | Create indexes, admin, sample listings         |
| `npm run build`        | Build frontend into `web-app/client/dist`      |
| `npm test`             | Run isolated API and billing tests             |
| `npm run test:browser` | Build, then run isolated Chrome browser checks |
| `npm audit`            | Check installed dependencies                   |

Tests use a temporary MongoDB replica set and **do not use your .env database**. The first run downloads a MongoDB binary, which can be large on Windows. Browser checks require installed Google Chrome; use `BROWSER_CHANNEL=msedge` if using Edge (PowerShell: `$env:BROWSER_CHANNEL='msedge'`). Screenshots go to ignored `test-results/`.

## Free deployment: MongoDB Atlas + Vercel

This setup is suitable for a student project or personal demonstration. **Vercel Hobby permits personal, non-commercial use**; an actual commercial rental business needs an appropriate plan. Free tiers have limits and are not an availability/performance guarantee. See [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [Atlas free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

### 1. Create the MongoDB database

1. Create a MongoDB Atlas account/project and choose the **Free / M0** cluster, not a paid tier.
2. Create a database user with a strong password and read/write access to the `dreamhome` database.
3. Under **Network Access**, add your current IP for local setup and seeding.
4. For standard Vercel dynamic outbound IPs, MongoDB's Vercel tutorial uses **Allow Access From Anywhere**, `0.0.0.0/0`. This makes the network endpoint public; strong database credentials, least-privilege access and keeping the URI server-only are essential. For stricter production networking use a suitable paid/static-egress setup. See [MongoDB's Vercel integration guide](https://www.mongodb.com/docs/drivers/node/current/integrations/next-vercel/).
5. Choose **Connect → Drivers → Node.js** and copy the URI. Replace credentials, URL-encode special characters in the password, and include `/dreamhome` before the query string.
6. Put that URI in your local server `.env`, choose administrator credentials, and run `npm run seed` once. This prepares the deployment database and its uniqueness indexes.

### 2. Configure verification email

Choose an SMTP mailbox or transactional email service whose free allowance suits your demo. Its account/sender verification requirements and quotas are separate from Vercel and Atlas.

Set:

```dotenv
MAIL_MODE=smtp
SMTP_HOST=your-provider-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
MAIL_FROM=DreamHome <your-verified-sender@example.com>
```

Port 465 enables implicit TLS; port 587 uses STARTTLS. Use your provider's instructions for sender verification and app-specific passwords. The code includes the SMTP integration, but no email provider account is created for you.

Without SMTP, the seeded admin can still sign in, but new clients cannot complete production registration. `MAIL_MODE=console` is explicitly disallowed as an email delivery mechanism in production.

### 3. Push the repository to GitHub

Create a repository, then commit/push this project using GitHub Desktop, your IDE, or Git. Include the root `package-lock.json`, `api/`, `vercel.json`, and both workspaces. Exclude `.env`, `node_modules`, `dist`, test screenshots and credentials.

### 4. Import into Vercel

1. Sign in to Vercel and choose **Add New → Project**, then import the GitHub repository.
2. Set **Root Directory to the repository root**. Do not choose `web-app/client`; the API and server dependencies must be included.
3. Choose framework preset **Other**. The committed `vercel.json` supplies:
   - Build command: `npm run build`
   - Output directory: `web-app/client/dist`
   - Install command: `npm install` (or `npm ci`)
4. Select **Node.js 24.x** in project settings.
5. Add the following **Production** environment variables:

| Variable                                           | Value                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                      | Atlas URI including the `dreamhome` database                                            |
| `JWT_SECRET`                                       | Random secret of at least 32 characters                                                 |
| `APP_URL`                                          | Exact production origin, e.g. `https://your-project.vercel.app`, without trailing slash |
| `NODE_ENV`                                         | `production`                                                                            |
| `MAIL_MODE`                                        | `smtp`                                                                                  |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Provider credentials                                                                    |
| `MAIL_FROM`                                        | Verified sender address                                                                 |

Do **not** add `SEED_ADMIN_PASSWORD` to Vercel. It is only needed during local seeding. Do not prefix server secrets with `VITE_`; that would expose them to the frontend.

6. Deploy. If the assigned production domain differs from `APP_URL`, update `APP_URL` and **redeploy**. Environment changes apply to new deployments.
7. Use the stable production URL. Preview deployments need their own matching `APP_URL`, preferably a separate test database and SMTP settings; otherwise writes are intentionally rejected.

### 5. Verify the deployment

1. Open `https://your-project.vercel.app/api/health`; expect `{"status":"ok","database":"connected"}`.
2. Open `/properties` directly and refresh to check SPA fallback routing.
3. Sign in with the administrator credentials selected during seeding.
4. Register a client, receive the verification email, verify, and sign in.
5. Book a viewing; confirm it appears in the staff dashboard.
6. Create a lease for that client and check that the home is no longer available.
7. Record a receipt and confirm the client sees the updated balance.
8. Submit a client maintenance request and resolve it as staff.

The API runs as a Vercel Node.js Function, not a persistent local server. The exported Express app and cached MongoDB connection support that execution model; all durable state lives in MongoDB. See [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js).

### Troubleshooting

| Symptom                                           | Check                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Server configuration is incomplete                | `JWT_SECRET` length and `APP_URL`; redeploy after setting variables                   |
| Database connection timeout                       | Atlas network list, URI credentials, cluster availability and database name           |
| Transaction numbers only allowed on a replica set | Use Atlas or a local replica set, not standalone MongoDB                              |
| Request origin is not allowed                     | Exact `APP_URL` scheme/host/port; use production domain, not an unmatched preview URL |
| Registration saved but email failed               | SMTP sender/credentials/quotas; use **Resend verification email** after fixing        |
| Duplicate record / slot                           | Unique email, receipt reference or already-booked viewing; refresh                    |
| Rented property cannot be edited                  | Close its active lease first                                                          |
| Archived property blocked                         | Resolve open viewings and maintenance requests first                                  |
| API returns HTML / page refresh gives 404         | Import root directory; keep `api/index.js` and `vercel.json` rewrites                 |
| Old users/data are missing                        | SQL records are not automatically migrated; new app uses MongoDB                      |

## Validation and limits

The implementation includes API integration tests covering authorization, verification, client isolation, search validation, concurrent bookings and leases, receipt deduplication, maintenance ownership, branch/role management, and month-end billing. The browser smoke test covers the main client and admin workflows at desktop and mobile widths.

The original targets of 100 concurrent users and responses under two seconds have **not** been load-tested. Vercel cold starts, email delivery and Atlas free-tier limits affect latency. Atlas free storage is limited to 0.5 GB and idle free clusters can pause; review current provider limits before relying on the service.

No live Vercel deployment or real SMTP delivery is performed by local tests. Configure your own accounts and run the deployment checks above. Real payment collection, legally binding electronic signatures, password recovery, file uploads, staff payroll, automatic lease expiry, refunds, and real-time push notifications are outside this implementation.

## Demo homes and photography

The catalog contains 12 fictional rental listings across New York, Austin, Denver, Seattle, Miami and Boston, with apartments, houses, condos and villas from $1,450 to $4,200 per month. Demo labels distinguish them from real offers. Stock photos illustrate the listing style; they do not verify the listed address or availability.

Eight downloaded Pexels photos are bundled in `web-app/client/public/images/homes/` and served from the same origin on Vercel. Photo sources and the license link are recorded in [credits.json](../web-app/client/public/images/homes/credits.json). Each demo detail page links to its photo source.

Run `npm run seed:homes` to add missing demo homes and fill blank photos on the exact original seed listings, without resetting rents, availability, leases, custom photos or archived status. Re-running does not duplicate the catalog. `npm run seed` also initializes the same catalog for a new installation. Staff image fields accept HTTPS URLs or bundled `/images/homes/123.jpg` paths.

## Rental applications and demo checkout

Verified clients can apply directly from a property page without scheduling a viewing. The Applications dashboard supports staff approval/rejection, client acceptance, and demo checkout. The flow is `submitted -> approved -> accepted -> paid`; unpaid applications can be withdrawn, and submitted ones can be rejected.

Approval stores an immutable agreement snapshot (property/address, tenant, dates, rent, deposit, terms and version). It reserves the property, cancels scheduled viewings and rejects competing applications. A reserved home cannot be edited, archived or manually leased. Withdrawal releases the reservation; there is no automatic reservation expiry. Rejected applicants can apply again if the home becomes available.

Acceptance requires the applicant's typed name, explicit consent and matching agreement version; its timestamp is recorded. Checkout uses only the approved amounts. Simulated declines create no lease or receipt and can be retried. Success atomically creates a demo lease, a `simulation` payment with `testMode: true`, and marks the home rented. Repeated/concurrent successes return the same lease without duplicate receipts. These entries affect the demonstration balance and must not be treated as actual revenue.

The `Application` collection links client, property, reviewer, agreement and resulting rental. A partial unique index prevents multiple open applications by the same client for the same home. Property reservations and lease/payment creation use MongoDB transactions (Atlas or a local replica set required).

Authenticated endpoints:

| Endpoint                                      | Access and purpose                                 |
| --------------------------------------------- | -------------------------------------------------- |
| `GET /api/applications`                       | Clients see their own; staff see all               |
| `POST /api/applications`                      | Verified client submits an application             |
| `POST /api/applications/:id/approve`          | Staff set terms and reserve the home               |
| `POST /api/applications/:id/reject`           | Staff reject a submitted application               |
| `POST /api/applications/:id/accept`           | Applicant accepts the versioned agreement          |
| `POST /api/applications/:id/withdraw`         | Applicant or staff releases an unpaid application  |
| `POST /api/applications/:id/simulate-payment` | Applicant selects success/failure after acceptance |

No new environment variables, gateway accounts or payment keys are needed. The demo endpoint accepts an outcome and explicit simulation acknowledgement, never card details or client-provided amounts. For a real product, replace browser-selected outcomes with a gateway adapter and verified server-side webhook fulfillment, plus appropriate contract, cancellation and refund handling. Never reuse simulated receipts as evidence of payment.

`npm test` covers ownership, agreement consent/version, competing approvals, retries, duplicate payments, withdrawal and archival. `npm run test:browser` also exercises the full application/approval/acceptance/decline/success flow using an isolated database and Chrome.
