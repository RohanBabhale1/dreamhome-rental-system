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

## Apply online and verify before payment

1. Sign in with a verified client account and click **Apply to rent** on an available home. Before staff approval, visit in person and confirm you reviewed ownership evidence.
2. Submit your preferred move-in date, occupants and optional message.
3. Staff open **Dashboard > Applications**, approve the application and set lease dates, rent, deposit and terms. Approval reserves the home and closes competing applications.
4. The client opens **Applications**, reviews the agreement, types their name and accepts the terms.
5. Staff confirm signing/key-handover readiness with an execution reference. Then choose **Pay deposit & first month (demo)** and confirm coordination. Try a simulated decline or successful payment. Success creates one active demo lease and a clearly labeled demo receipt in **Leases & payments**.

No payment-provider account or keys are required. Clients or staff can withdraw unpaid applications to release the home; reservations do not expire automatically. Agreement acceptance and checkout are for demonstration, not real contracts or collections. See the [implementation details](docs/README.md#rental-applications-and-demo-checkout) before adding real payments.

## House photos, owner contacts and verification order

Staff property forms now accept a JPEG, PNG or WebP file (maximum 1 MB and 16 megapixels) instead of asking for an image link. The API decodes, resizes and re-encodes it as JPEG, stripping original metadata, and stores it in MongoDB. No additional storage credentials are required. Existing image URLs remain supported for older records.

Staff enter the owner/authorized contact name, phone and optional email, with permission to publish them. The listing detail page displays these contacts; old listings without contact data show an explicit fallback rather than invented details.

The updated demo order is: apply -> applicant confirms physical visit and ownership-document review -> staff draft/approve terms -> client reviews and accepts -> staff confirm signing/key-handover readiness -> client confirms coordination and simulates balance payment. Approval and checkout enforce these prerequisites on the server. An appointment booked through DreamHome is optional; confirmation of an actual visit is required. These are self-reported checks, not independent title verification.

The optional token is skipped: this project requests no token advance. It does not implement token receipts/refunds, UPI, Aadhaar, biometrics, e-stamping or registration. Currency remains USD for the existing catalog; no rupee conversion or mandatory city-based rent/deposit rules are assumed. Notice, lock-in, maintenance, escalation and payment-plan terms are entered by staff and displayed for review. Maintenance and escalation are agreement disclosures, not automatically applied to the billing ledger. Only deposit and first month's rent are included in demo checkout.
