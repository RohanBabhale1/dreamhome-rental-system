# DreamHome Requirements and Implementation

## Scope

The running system is React/JSX + Express/Node.js + MongoDB. The legacy SQL schema remains a reference; `web-app/server/models.js` defines the active data model. See [README](README.md) for operational rules and deployment.

## Functional requirements

| ID    | Requirement                          | Implementation                                                                                                       |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| FR1.1 | Registration with email verification | Client registration, bcrypt hashes, hashed 24-hour single-use tokens, SMTP delivery, resend and verification screens |
| FR1.2 | Secure login                         | Verified users only; one-day JWT in HTTP-only cookie; logout; current user endpoint                                  |
| FR1.3 | Client/staff roles                   | Server-side staff and ownership checks; admin-only staff promotion; no role selection at registration                |
| FR2.1 | Staff property CRUD                  | Full create/edit forms, archive action, lease/history protection                                                     |
| FR2.2 | Browse/search properties             | Listing/detail pages, image fallback, availability filter                                                            |
| FR2.3 | Location/type/rent/bedroom filters   | Validated API filters, price sorting and 12-item pages                                                               |
| FR3.1 | Create rental agreements             | Staff selects verified client and available property; transactional reservation                                      |
| FR3.2 | Track start/end dates                | Active/completed/terminated lifecycle, exclusive end dates, explicit release by staff                                |
| FR3.3 | Calculate and track payments         | Due instalments, deposit, receipt ledger, balances/credits and print statements                                      |
| FR4.1 | Client viewing scheduling            | Future 30-minute slots within 90 days; client-owned records                                                          |
| FR4.2 | Staff viewing notifications          | Dashboard list/count, schedule view and manual refresh                                                               |
| FR4.3 | Prevent double-booking               | Partial unique MongoDB indexes for property-slot and client-slot; transaction locks                                  |
| FR5.1 | Maintenance requests                 | Current tenants report issues for their home; staff can report issues                                                |
| FR5.2 | Maintenance handling                 | Priority, pending/in-progress/completed, required completion resolution                                              |
| FR6.1 | Branch management                    | Add/edit branches; associate properties with a branch                                                                |
| FR6.2 | Client management                    | Staff directory of verified/unverified accounts, contacts and roles                                                  |

## Non-functional requirements

| Requirement                              | Handling / validation                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Fast query responses                     | Indexed availability/location, paginated public search, small cached database pool, lazy-loaded dashboard |
| Under two seconds / 100 concurrent users | Original target retained; not benchmarked or guaranteed on free tiers                                     |
| Password security                        | bcrypt, 10-character minimum and 72-byte maximum at registration                                          |
| API authentication                       | JWT signature verification; current DB role checked on every protected request                            |
| Input/query safety                       | Zod schemas, explicit field allowlists, escaped city regex; Mongoose replaces SQL prepared statements     |
| Concurrency consistency                  | MongoDB replica-set transactions plus unique indexes; concurrent-request tests                            |
| Browser security                         | Same-origin API, HTTP-only cookies, origin checks, Helmet headers                                         |
| Abuse controls                           | MongoDB-backed 15-minute authentication request buckets with TTL expiry                                   |
| Responsive usability                     | Material UI forms, responsive layout, keyboard-operable controls and scrollable tables                    |
| Reliability                              | Error/loading/empty states; integration tests; browser workflow checks; history-preserving archive        |

## Boundaries

- Monetary amounts are USD; checkout simulates success/decline without a payment gateway or card data.
- Direct rental applications include staff review, versioned demo agreement acceptance, reservations and demo receipts.
- Staff explicitly close expired leases; no background scheduler.
- Staff notifications are dashboard-based, not push messages or emails.
- One active/future-reserved lease per property; no multiple future bookings.
- Email requires a separately configured SMTP provider in production.
- No password recovery, legally binding e-signature, uploads, refunds, payroll or branch-scoped staff permissions.
- Historical SQL data is not automatically imported. The MongoDB seed creates new example data.
- Hosted deployment and email delivery must be verified against the user's own accounts.
