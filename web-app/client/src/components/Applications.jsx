import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
} from "@mui/material";
import { api, money, date, dateTime } from "../api";
import { Empty, Loading, Status, FormDialog } from "./UI";

const initialTerms =
  "Personal-project demonstration only. The approved monthly rent and deposit are shown above. The first monthly instalment and deposit are due at checkout. Later rent is due monthly on the lease start-date anniversary. No real funds are collected by this demo. Contact staff about repairs or ending the tenancy.";
function Agreement({ application }) {
  const a = application.agreement;
  if (!a?.version) return null;
  return (
    <div className="agreement">
      <h3>Rental agreement</h3>
      <p>
        <strong>{a.propertyTitle}</strong>
        <br />
        {a.address}
      </p>
      <p>Tenant: {a.tenantName}</p>
      <p>
        {date(a.startDate)} to {date(a.endDate)} (end date exclusive)
      </p>
      <div className="lease-metrics">
        <span>
          Monthly rent<strong>{money(a.monthlyRent)}</strong>
        </span>
        <span>
          Deposit<strong>{money(a.deposit)}</strong>
        </span>
        <span>
          Due at checkout<strong>{money(a.monthlyRent + a.deposit)}</strong>
        </span>
      </div>
      <p className="description">{a.terms}</p>
      <small>Agreement version: {a.version}</small>
      {application.acceptedAt && (
        <p>
          Accepted by {application.acceptedName} on{" "}
          {dateTime(application.acceptedAt)}.
        </p>
      )}
    </div>
  );
}
function Acceptance({ application, onClose, onSave }) {
  const [name, setName] = useState(""),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog open fullWidth maxWidth="md" onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({
              version: application.agreement.version,
              name,
              accepted: checked,
            });
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <DialogTitle>Review and accept agreement</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            Personal-project demo. Acceptance and payments are simulated; no
            real rental contract or payment is created.
          </Alert>
          <Agreement application={application} />
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            fullWidth
            required
            margin="normal"
            label="Type your full name to accept"
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                required
              />
            }
            label="I have reviewed and accept these demo rental terms."
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={busy || !checked || !name.trim()}
          >
            Accept agreement
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
function Checkout({ application, onClose, onPay }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function pay(outcome) {
    setBusy(true);
    setError("");
    try {
      const result = await onPay(outcome);
      if (result.status === "paid") onClose();
      else setError(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open fullWidth maxWidth="sm" onClose={() => !busy && onClose()}>
      <DialogTitle>Demo checkout</DialogTitle>
      <DialogContent>
        <Alert severity="info">
          Simulation only. No money will be charged and no card or bank details
          are needed.
        </Alert>
        <h3>{application.agreement.propertyTitle}</h3>
        <p>
          First month: {money(application.agreement.monthlyRent)}
          <br />
          Deposit: {money(application.agreement.deposit)}
        </p>
        <h2>
          Total:{" "}
          {money(
            application.agreement.monthlyRent + application.agreement.deposit,
          )}
        </h2>
        {error && <Alert severity="warning">{error}</Alert>}
        <p>Choose an outcome to try the payment flow.</p>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button disabled={busy} onClick={onClose}>
          Close
        </Button>
        <Button color="warning" disabled={busy} onClick={() => pay("failure")}>
          Simulate decline
        </Button>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => pay("success")}
        >
          Simulate successful payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export default function Applications({ isStaff, onChanged }) {
  const [items, setItems] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dialog, setDialog] = useState(null);
  const load = useCallback(async () => {
    setItems(await api("/applications"));
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function change(application, action, body) {
    const result = await api(
      "/applications/" + application._id + "/" + action,
      { method: "POST", body },
    );
    setNotice(
      result.status === "failed"
        ? ""
        : ["simulate-payment", "withdraw"].includes(action)
          ? result.message || "Application updated."
          : "Application updated.",
    );
    await load();
    await onChanged();
    return result;
  }
  const approve = (a) =>
    setDialog({
      kind: "form",
      title: "Approve application and set terms",
      fields: [
        { name: "startDate", label: "Lease start date", type: "date" },
        { name: "endDate", label: "Lease end date (exclusive)", type: "date" },
        {
          name: "monthlyRent",
          label: "Monthly rent ($)",
          type: "number",
          min: 0.01,
          step: 0.01,
        },
        {
          name: "deposit",
          label: "Deposit ($)",
          type: "number",
          min: 0,
          step: 0.01,
        },
        {
          name: "terms",
          label: "Agreement terms",
          multiline: true,
          minLength: 20,
        },
      ],
      initial: {
        startDate: new Date(
          Math.max(Date.now(), new Date(a.preferredStart).getTime()),
        )
          .toISOString()
          .slice(0, 10),
        monthlyRent: a.property?.rent,
        deposit: a.property?.rent,
        terms: initialTerms,
      },
      onSave: (values) => change(a, "approve", values),
    });
  const reason = (a, action) =>
    setDialog({
      kind: "form",
      title:
        action === "reject"
          ? "Reject application"
          : "Withdraw application and release home",
      fields: [{ name: "reason", label: "Reason", maxLength: 200 }],
      onSave: (values) => change(a, action, values),
    });
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Rental applications</h2>
          <p>
            Apply without a viewing, review the agreement, then try demo
            checkout.
          </p>
        </div>
        <Button onClick={() => load().catch((e) => setError(e.message))}>
          Refresh applications
        </Button>
      </div>
      <Alert severity="info">
        All online payments in this personal project are simulations. No actual
        money is collected.
      </Alert>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      {!items ? (
        !error && <Loading />
      ) : !items.length ? (
        <Empty>
          No applications yet. <Link to="/properties">Explore homes</Link> to
          get started.
        </Empty>
      ) : (
        items.map((a) => (
          <article className="lease-card" key={a._id}>
            <div className="section-heading">
              <div>
                <h3>{a.property?.title || a.agreement?.propertyTitle}</h3>
                <p>
                  {isStaff
                    ? a.client?.name + " · " + a.client?.email
                    : "Your application"}
                  <br />
                  Requested move-in: {date(a.preferredStart)} · {a.occupants}{" "}
                  occupant(s)
                </p>
              </div>
              <Status
                value={
                  a.status === "paid" ? "demo payment completed" : a.status
                }
              />
            </div>
            {a.message && <p className="description">{a.message}</p>}
            {a.decisionNote && (
              <p>
                <strong>Update:</strong> {a.decisionNote}
              </p>
            )}
            {a.agreement?.version && (
              <details>
                <summary>View agreement and payment breakdown</summary>
                <Agreement application={a} />
              </details>
            )}
            {a.lastPaymentStatus === "failed" && a.status === "accepted" && (
              <Alert severity="warning">
                Your last demo payment was declined. Retry checkout or withdraw
                your application.
              </Alert>
            )}
            <div className="actions">
              {isStaff && a.status === "submitted" && (
                <>
                  <Button variant="contained" onClick={() => approve(a)}>
                    Approve and set terms
                  </Button>
                  <Button color="warning" onClick={() => reason(a, "reject")}>
                    Reject
                  </Button>
                </>
              )}
              {!isStaff && a.status === "approved" && (
                <Button
                  variant="contained"
                  onClick={() => setDialog({ kind: "accept", application: a })}
                >
                  Review and accept agreement
                </Button>
              )}
              {!isStaff && a.status === "accepted" && (
                <Button
                  variant="contained"
                  onClick={() =>
                    setDialog({ kind: "checkout", application: a })
                  }
                >
                  Pay deposit & first month (demo)
                </Button>
              )}
              {["submitted", "approved", "accepted"].includes(a.status) && (
                <Button color="warning" onClick={() => reason(a, "withdraw")}>
                  {isStaff ? "Withdraw / release home" : "Withdraw application"}
                </Button>
              )}
              {a.status === "paid" && (
                <p>
                  Demo receipt: DEMO-{a._id}. Open{" "}
                  <strong>Leases & payments</strong> to see your active demo
                  lease and payment history.
                </p>
              )}
            </div>
          </article>
        ))
      )}
      {dialog?.kind === "form" && (
        <FormDialog {...dialog} onClose={() => setDialog(null)} />
      )}{" "}
      {dialog?.kind === "accept" && (
        <Acceptance
          application={dialog.application}
          onClose={() => setDialog(null)}
          onSave={(body) => change(dialog.application, "accept", body)}
        />
      )}{" "}
      {dialog?.kind === "checkout" && (
        <Checkout
          application={dialog.application}
          onClose={() => setDialog(null)}
          onPay={(outcome) =>
            change(dialog.application, "simulate-payment", {
              outcome,
              confirmSimulation: true,
            })
          }
        />
      )}
    </>
  );
}
