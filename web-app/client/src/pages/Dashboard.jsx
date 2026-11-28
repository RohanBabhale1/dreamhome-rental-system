import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Applications from "../components/Applications";
import { Alert, Button, Tab, Tabs } from "@mui/material";
import { useAuth } from "../App";
import { api, money, date, dateTime } from "../api";
import {
  Empty,
  Loading,
  Status,
  FormDialog,
  ConfirmDialog,
  options,
} from "../components/UI";
const field = (name, label, extra = {}) => ({ name, label, ...extra });
const propertyFields = (branches) => [
  field("title", "Property title"),
  field("address", "Street address"),
  field("city", "City"),
  field("state", "State", { required: false }),
  field("postalCode", "Postal code", { required: false }),
  field("type", "Home type", {
    options: ["apartment", "house", "condo", "villa"],
  }),
  field("bedrooms", "Bedrooms", { type: "number", min: 0, max: 50 }),
  field("bathrooms", "Bathrooms", { type: "number", min: 1, max: 50 }),
  field("squareFeet", "Area (sq ft)", { type: "number", min: 1 }),
  field("rent", "Monthly rent ($)", { type: "number", min: 0.01, step: 0.01 }),
  field("description", "Description", { multiline: true, minLength: 10 }),
  field("imageUrl", "House photo", { type: "image", required: false }),
  field("ownerName", "Owner / authorized contact name"),
  field("ownerPhone", "Owner contact phone"),
  field("ownerEmail", "Owner contact email", {
    type: "email",
    required: false,
  }),
  field("branch", "Branch", {
    required: false,
    options: [{ value: "", label: "No branch" }, ...options(branches)],
  }),
  field("status", "Availability", { options: ["available", "maintenance"] }),
];
const branchFields = [
  field("name", "Branch name"),
  field("address", "Address"),
  field("city", "City"),
  field("phone", "Phone", { required: false }),
];
function Table({ headers, children }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export default function Dashboard() {
  const { user } = useAuth(),
    isStaff = user.role !== "client";
  const [params] = useSearchParams();
  const [tab, setTab] = useState(
      params.get("tab") === "applications" ? "applications" : "overview",
    ),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [dialog, setDialog] = useState(null),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const paths = [
      "/summary",
      "/viewings",
      "/rentals",
      "/maintenance",
      ...(isStaff ? ["/properties/all", "/users", "/branches"] : []),
    ];
    const [
      summary,
      viewings,
      rentals,
      maintenance,
      properties = [],
      users = [],
      branches = [],
    ] = await Promise.all(paths.map((p) => api(p)));
    setData({
      summary,
      viewings,
      rentals,
      maintenance,
      properties,
      users,
      branches,
    });
  }, [isStaff]);
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  async function mutate(path, method, body) {
    await api(path, { method, body });
    setMessage("Changes saved.");
    try {
      await load();
    } catch (e) {
      setError("Saved, but refreshing failed: " + e.message);
    }
  }
  function form(title, fields, initial, path, method = "POST") {
    setDialog({
      title,
      fields,
      initial,
      onSave: (values) => mutate(path, method, values),
    });
  }
  function confirm(title, description, path, method, body) {
    setDialog({ title, description, onSave: () => mutate(path, method, body) });
  }
  function payment(rental) {
    form(
      "Record a received payment",
      [
        field("amount", "Amount ($)", {
          type: "number",
          min: 0.01,
          step: 0.01,
        }),
        field("date", "Payment date", { type: "date" }),
        field("method", "Method", {
          options: ["bank_transfer", "cash", "card"],
        }),
        field("reference", "Unique receipt / bank reference"),
      ],
      { date: new Date().toISOString().slice(0, 10), method: "bank_transfer" },
      "/rentals/" + rental._id + "/payments",
    );
  }
  function maintenance() {
    const homes = isStaff
      ? data.properties
      : data.rentals
          .filter(
            (r) =>
              r.status === "active" &&
              new Date(r.startDate) <= new Date() &&
              new Date(r.endDate) > new Date(),
          )
          .map((r) => r.property);
    form(
      "Report a maintenance issue",
      [
        field("property", "Property", { options: options(homes) }),
        field("description", "Describe the issue", {
          multiline: true,
          minLength: 10,
        }),
        field("priority", "Priority", { options: ["low", "medium", "high"] }),
      ],
      { priority: "medium", property: homes[0]?._id || "" },
      "/maintenance",
    );
  }
  if (loading) return <Loading />;
  if (!data)
    return (
      <main className="page">
        <Alert severity="error">{error}</Alert>
        <Button
          onClick={() => {
            setLoading(true);
            load()
              .catch((e) => setError(e.message))
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </Button>
      </main>
    );
  const tabs = [
    "overview",
    ...(isStaff ? ["properties"] : []),
    "applications",
    "viewings",
    "rentals",
    "maintenance",
    ...(isStaff ? ["people", "branches"] : []),
  ];
  return (
    <main className="page workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {isStaff ? "PROPERTY OPERATIONS" : "YOUR RENTAL, ALL TOGETHER"}
          </p>
          <h1>Hello, {user.name.split(" ")[0]}.</h1>
          <p>
            {isStaff
              ? "Keep every home and every resident moving forward."
              : "A little less paperwork. A little more feeling at home."}
          </p>
        </div>
        <Status value={user.role} />
      </div>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Workspace sections"
      >
        {tabs.map((t) => (
          <Tab
            value={t}
            key={t}
            label={t === "rentals" ? "Leases & payments" : t}
          />
        ))}
      </Tabs>
      <section className="workspace-panel">
        {tab === "applications" && (
          <Applications isStaff={isStaff} onChanged={load} />
        )}
        {tab === "overview" && (
          <>
            <div className="stats">
              {[
                ["rentals", "Active leases"],
                ["viewings", "Upcoming viewings"],
                ["maintenance", "Open requests"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className="stat"
                  onClick={() => setTab(key === "rentals" ? "rentals" : key)}
                >
                  <span>{label}</span>
                  <strong>{data.summary[key]}</strong>
                  <small>View details</small>
                </button>
              ))}
            </div>
            <div className="section-heading">
              <h2>{isStaff ? "Viewing notifications" : "Your next visits"}</h2>
              <Button onClick={() => setTab("viewings")}>View schedule</Button>
            </div>
            {data.viewings.filter((v) => v.status === "scheduled").length ? (
              data.viewings
                .filter((v) => v.status === "scheduled")
                .slice(0, 5)
                .map((v) => (
                  <div className="activity" key={v._id}>
                    <div>
                      <strong>{v.property?.title}</strong>
                      <p>{isStaff ? v.client?.name : v.property?.address}</p>
                    </div>
                    <span>{dateTime(v.date)}</span>
                    <Status value={v.status} />
                  </div>
                ))
            ) : (
              <Empty>
                {isStaff
                  ? "New viewing bookings will appear here."
                  : "Your next home is waiting. Browse homes to arrange a visit."}
              </Empty>
            )}
            <div className="workspace-note">
              <h3>
                {isStaff ? "Everything in its place." : "Make your next move."}
              </h3>
              <p>
                {isStaff
                  ? "Use the tabs to manage properties, resident records, leases and repairs."
                  : "Explore available homes, track your lease and tell us when something needs attention."}
              </p>
              <Button component={Link} to="/properties" variant="outlined">
                Browse homes
              </Button>
            </div>
          </>
        )}
        {tab === "properties" && (
          <>
            <div className="section-heading">
              <h2>Property portfolio</h2>
              <Button
                variant="contained"
                onClick={() =>
                  form(
                    "Add a property",
                    propertyFields(data.branches),
                    {
                      type: "apartment",
                      status: "available",
                      bedrooms: 1,
                      bathrooms: 1,
                    },
                    "/properties",
                  )
                }
              >
                Add property
              </Button>
            </div>
            {!data.properties.length ? (
              <Empty>
                Add your first property to start accepting viewings.
              </Empty>
            ) : (
              <Table
                headers={[
                  "Property",
                  "Type / space",
                  "Rent",
                  "Status",
                  "Actions",
                ]}
              >
                {data.properties.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <Link to={"/properties/" + p._id}>{p.title}</Link>
                      <small>
                        {p.address}, {p.city}
                      </small>
                    </td>
                    <td>
                      {p.type}
                      <small>
                        {p.bedrooms} beds · {p.squareFeet} sq ft
                      </small>
                    </td>
                    <td>{money(p.rent)}</td>
                    <td>
                      <Status value={p.status} />
                    </td>
                    <td>
                      <Button
                        disabled={["rented", "reserved"].includes(p.status)}
                        onClick={() =>
                          form(
                            "Edit property",
                            propertyFields(data.branches),
                            { ...p, branch: p.branch?._id || "" },
                            "/properties/" + p._id,
                            "PUT",
                          )
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        color="warning"
                        disabled={["rented", "reserved"].includes(p.status)}
                        onClick={() =>
                          confirm(
                            "Archive this property?",
                            "The listing will be hidden. Historical records remain available. Resolve open viewings and repairs first.",
                            "/properties/" + p._id,
                            "DELETE",
                          )
                        }
                      >
                        Archive
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            <p className="muted">
              Close the active lease or withdraw the approved application before
              editing or archiving its property.
            </p>
          </>
        )}
        {tab === "viewings" && (
          <>
            <div className="section-heading">
              <h2>Viewing schedule</h2>
              <Button component={Link} to="/properties">
                Find a home
              </Button>
            </div>
            <p className="muted">
              30-minute appointments. Times shown in your local timezone.
              Refresh to receive new bookings.
            </p>
            <Button onClick={() => load().catch((e) => setError(e.message))}>
              Refresh schedule
            </Button>
            {!data.viewings.length ? (
              <Empty>No viewings booked yet.</Empty>
            ) : (
              <Table
                headers={[
                  "Home",
                  "Appointment",
                  ...(isStaff ? ["Client"] : []),
                  "Notes",
                  "Status",
                  "Actions",
                ]}
              >
                {data.viewings.map((v) => (
                  <tr key={v._id}>
                    <td>
                      {v.property?.title}
                      <small>{v.property?.address}</small>
                    </td>
                    <td>{dateTime(v.date)}</td>
                    {isStaff && (
                      <td>
                        {v.client?.name}
                        <small>{v.client?.email}</small>
                      </td>
                    )}
                    <td>{v.notes || "—"}</td>
                    <td>
                      <Status value={v.status} />
                    </td>
                    <td>
                      {v.status === "scheduled" && (
                        <>
                          {isStaff && (
                            <Button
                              disabled={new Date(v.date) > new Date()}
                              onClick={() =>
                                confirm(
                                  "Complete viewing?",
                                  "Mark this visit as completed.",
                                  "/viewings/" + v._id,
                                  "PATCH",
                                  { status: "completed" },
                                )
                              }
                            >
                              Complete
                            </Button>
                          )}
                          <Button
                            color="warning"
                            onClick={() =>
                              confirm(
                                "Cancel viewing?",
                                "This time slot will become available to other clients.",
                                "/viewings/" + v._id,
                                "PATCH",
                                { status: "cancelled" },
                              )
                            }
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </>
        )}
        {tab === "rentals" && (
          <>
            <div className="section-heading">
              <h2>Leases & payments</h2>
              {isStaff && (
                <Button
                  variant="contained"
                  onClick={() =>
                    form(
                      "Create a rental agreement",
                      [
                        field("property", "Available property", {
                          options: options(
                            data.properties.filter(
                              (p) => p.status === "available",
                            ),
                          ),
                        }),
                        field("client", "Verified client", {
                          options: data.users
                            .filter((u) => u.role === "client" && u.verified)
                            .map((u) => ({
                              value: u._id,
                              label: u.name + " · " + u.email,
                            })),
                        }),
                        field("startDate", "Start date", { type: "date" }),
                        field("endDate", "End date (exclusive)", {
                          type: "date",
                        }),
                        field("monthlyRent", "Monthly rent ($)", {
                          type: "number",
                          min: 0.01,
                          step: 0.01,
                        }),
                        field("deposit", "Deposit ($)", {
                          type: "number",
                          min: 0,
                          step: 0.01,
                        }),
                      ],
                      { deposit: 0 },
                      "/rentals",
                    )
                  }
                >
                  Create lease
                </Button>
              )}
            </div>
            <p className="muted">
              Balances include the deposit and monthly instalments due so far.
              Manual receipts record payments received outside the app. Demo
              checkout receipts simulate payments; no real money is charged.
            </p>
            {!data.rentals.length ? (
              <Empty>No rental agreements yet.</Empty>
            ) : (
              data.rentals.map((r) => (
                <article key={r._id} className="lease-card">
                  <div className="section-heading">
                    <div>
                      <h3>{r.property?.title}</h3>
                      {r.simulated && (
                        <Alert severity="info">
                          Demo lease — checkout payment was simulated, not
                          collected.
                        </Alert>
                      )}
                      <p>
                        {isStaff ? r.client?.name + " · " : ""}
                        {date(r.startDate)} — {date(r.endDate)}
                      </p>
                      <small>Agreement {r._id}</small>
                    </div>
                    <Status value={r.status} />
                  </div>
                  <div className="lease-metrics">
                    <span>
                      Monthly rent<strong>{money(r.monthlyRent)}</strong>
                    </span>
                    <span>
                      Deposit<strong>{money(r.deposit)}</strong>
                    </span>
                    <span>
                      Due to date<strong>{money(r.billing.totalDue)}</strong>
                    </span>
                    <span>
                      Received<strong>{money(r.billing.totalPaid)}</strong>
                    </span>
                    <span>
                      {r.billing.balance < 0 ? "Credit" : "Balance"}
                      <strong>{money(Math.abs(r.billing.balance))}</strong>
                    </span>
                  </div>
                  <div className="actions">
                    <Button onClick={() => window.print()}>
                      Print statement
                    </Button>
                    {isStaff && (
                      <>
                        <Button onClick={() => payment(r)}>
                          Record payment
                        </Button>
                        {r.status === "active" && (
                          <>
                            <Button
                              disabled={new Date(r.endDate) > new Date()}
                              onClick={() =>
                                confirm(
                                  "Complete lease?",
                                  "Release this property for its next resident.",
                                  "/rentals/" + r._id,
                                  "PATCH",
                                  { status: "completed" },
                                )
                              }
                            >
                              Complete
                            </Button>
                            <Button
                              color="warning"
                              onClick={() =>
                                confirm(
                                  "Terminate lease early?",
                                  "End this lease today and release the property. Already-due instalments remain payable; partial months are not prorated.",
                                  "/rentals/" + r._id,
                                  "PATCH",
                                  { status: "terminated" },
                                )
                              }
                            >
                              Terminate
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <details>
                    <summary>Payment history ({r.payments.length})</summary>
                    {r.payments.length ? (
                      <Table
                        headers={[
                          "Date",
                          "Amount",
                          "Method",
                          "Receipt reference",
                        ]}
                      >
                        {r.payments.map((p) => (
                          <tr key={p._id}>
                            <td>{date(p.date)}</td>
                            <td>{money(p.amount)}</td>
                            <td>
                              {p.testMode
                                ? "Demo payment — no charge"
                                : p.method.replaceAll("_", " ")}
                            </td>
                            <td>{p.reference}</td>
                          </tr>
                        ))}
                      </Table>
                    ) : (
                      <p>No payments recorded.</p>
                    )}
                  </details>
                </article>
              ))
            )}
          </>
        )}
        {tab === "maintenance" && (
          <>
            <div className="section-heading">
              <h2>Maintenance requests</h2>
              <Button
                variant="contained"
                onClick={maintenance}
                disabled={
                  !isStaff &&
                  !data.rentals.some(
                    (r) =>
                      r.status === "active" &&
                      new Date(r.startDate) <= new Date() &&
                      new Date(r.endDate) > new Date(),
                  )
                }
              >
                Report an issue
              </Button>
            </div>
            {!data.maintenance.length ? (
              <Empty>
                No maintenance requests. Everything in one place when you need
                it.
              </Empty>
            ) : (
              <Table
                headers={[
                  "Property / issue",
                  "Priority",
                  "Status",
                  "Resolution",
                  ...(isStaff ? ["Actions"] : []),
                ]}
              >
                {data.maintenance.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <strong>{m.property?.title}</strong>
                      <p>{m.description}</p>
                      <small>
                        {date(m.createdAt)}
                        {isStaff ? " · " + m.client?.name : ""}
                      </small>
                    </td>
                    <td>
                      <Status value={m.priority} />
                    </td>
                    <td>
                      <Status value={m.status} />
                    </td>
                    <td>{m.resolution || "Awaiting update"}</td>
                    {isStaff && (
                      <td>
                        <Button
                          onClick={() =>
                            form(
                              "Update maintenance request",
                              [
                                field("status", "Status", {
                                  options: [
                                    "pending",
                                    "in_progress",
                                    "completed",
                                  ],
                                }),
                                field("resolution", "Resolution / work notes", {
                                  multiline: true,
                                  required: false,
                                }),
                              ],
                              m,
                              "/maintenance/" + m._id,
                              "PATCH",
                            )
                          }
                        >
                          Update
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </Table>
            )}
          </>
        )}
        {tab === "people" && (
          <>
            <h2>People directory</h2>
            <p className="muted">
              Clients register and verify their email. Administrators can
              promote a separate account to staff.
            </p>
            <Table
              headers={[
                "Name",
                "Contact",
                "Role",
                "Email verified",
                ...(user.role === "admin" ? ["Actions"] : []),
              ]}
            >
              {data.users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>
                    {u.email}
                    <small>{u.phone}</small>
                  </td>
                  <td>
                    <Status value={u.role} />
                  </td>
                  <td>{u.verified ? "Yes" : "Pending"}</td>
                  {user.role === "admin" && (
                    <td>
                      {u.role !== "admin" && (
                        <Button
                          onClick={() =>
                            confirm(
                              "Change account role?",
                              "This changes the permissions granted to " +
                                u.email +
                                ". Accounts with client history must remain clients.",
                              "/users/" + u._id,
                              "PATCH",
                              { role: u.role === "staff" ? "client" : "staff" },
                            )
                          }
                        >
                          {u.role === "staff" ? "Make client" : "Make staff"}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </Table>
          </>
        )}
        {tab === "branches" && (
          <>
            <div className="section-heading">
              <h2>Our branches</h2>
              <Button
                variant="contained"
                onClick={() =>
                  form("Add branch", branchFields, {}, "/branches")
                }
              >
                Add branch
              </Button>
            </div>
            {!data.branches.length ? (
              <Empty>No branches yet.</Empty>
            ) : (
              <Table headers={["Branch", "Location", "Contact", "Actions"]}>
                {data.branches.map((b) => (
                  <tr key={b._id}>
                    <td>{b.name}</td>
                    <td>
                      {b.address}, {b.city}
                    </td>
                    <td>{b.phone || "—"}</td>
                    <td>
                      <Button
                        onClick={() =>
                          form(
                            "Edit branch",
                            branchFields,
                            b,
                            "/branches/" + b._id,
                            "PUT",
                          )
                        }
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </>
        )}
      </section>
      {dialog &&
        (dialog.fields ? (
          <FormDialog {...dialog} onClose={() => setDialog(null)} />
        ) : (
          <ConfirmDialog {...dialog} onClose={() => setDialog(null)} />
        ))}
    </main>
  );
}
