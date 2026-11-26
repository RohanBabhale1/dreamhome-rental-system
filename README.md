# DreamHome

A complete rental workflow built with **React/JSX, Vite, Material UI, Node.js/Express and MongoDB**, configured for a single Vercel deployment.

- Property search, filters and detail pages
- Verified client accounts and secure role-based access
- Conflict-safe viewing bookings
- Staff property, branch and client management
- Rental agreements, payment receipts and balances
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

Follow the [MongoDB Atlas + Vercel steps](docs/README.md#free-deployment-mongodb-atlas--vercel). Import the **repository root**, configure server environment variables and SMTP, then deploy. No live deployment has been created automatically.

Vercel Hobby is for personal, non-commercial projects. Payment tracking records receipts; it does not charge cards. The original SQL files are historical references and are not used by the running app.
