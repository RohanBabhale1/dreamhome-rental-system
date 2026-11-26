# DreamHome

A complete rental workflow built with **React/JSX, Vite, Material UI, Node.js/Express and MongoDB**, configured for a single Vercel deployment.

- Property search, filters and detail pages
- Verified client accounts and secure role-based access
- Conflict-safe viewing bookings
- Staff property, branch and client management
- Apply to rent without a viewing, staff approval and agreement acceptance
- Simulated checkout for the deposit and first month, demo receipts and balances
- Maintenance requests and responsive dashboards

Read the [full setup, architecture and free deployment guide](docs/README.md) and [requirements mapping](docs/requirements.md).

## Run locally

Install Node.js 24 LTS, create a MongoDB Atlas free cluster, then run from this directory:

```powershell
npm install
Copy-Item web-app/server/.env.example web-app/server/.env
# Fill in MongoDB URI, JWT secret and your chosen administrator credentials.
npm run seed
npm run dev
```

Open http://localhost:5173. Local verification links appear in the API terminal.

```sh
npm test
npm run build
npm run test:browser
```

Browser tests require Google Chrome. Tests use isolated temporary databases.

## Deploy

Follow the [MongoDB Atlas + Vercel steps](docs/README.md#free-deployment-mongodb-atlas--vercel). Import the **repository root**, configure server environment variables and SMTP, then deploy. Pushes to the connected production branch trigger a new Vercel deployment.

Vercel Hobby is for personal, non-commercial projects. Online checkout simulates success or decline; it never charges money or asks for card details. Staff can also record external payment receipts. The original SQL files are historical references and are not used by the running app.

## Rent without booking a viewing

1. Sign in with a verified client account and click **Apply to rent** on an available home.
2. Submit your preferred move-in date, occupants and optional message.
3. Staff open **Dashboard > Applications**, approve the application and set lease dates, rent, deposit and terms. Approval reserves the home and closes competing applications.
4. The client opens **Applications**, reviews the agreement, types their name and accepts the terms.
5. Choose **Pay deposit & first month (demo)**. Try a simulated decline or successful payment. Success creates one active demo lease and a clearly labeled demo receipt in **Leases & payments**.

No payment-provider account or keys are required. Clients or staff can withdraw unpaid applications to release the home; reservations do not expire automatically. Agreement acceptance and checkout are for demonstration, not real contracts or collections. See the [implementation details](docs/README.md#rental-applications-and-demo-checkout) before adding real payments.
