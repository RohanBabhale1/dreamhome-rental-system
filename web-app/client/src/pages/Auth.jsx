import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, TextField } from "@mui/material";
import { api } from "../api";
import { useAuth } from "../App";
export function AuthPage({ register = false }) {
  const { user, setUser } = useAuth(),
    navigate = useNavigate();
  const [values, setValues] = useState({
      name: "",
      email: "",
      password: "",
      phone: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: values,
      });
      if (register) setMessage(result.message);
      else {
        setUser(result);
        navigate("/dashboard");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/resend", {
        method: "POST",
        body: { email: values.email },
      });
      setMessage(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <aside>
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>
          A home for every
          <br />
          kind of beginning.
        </h1>
        <p>
          Find your space, arrange a visit, and keep all the details of your
          rental in one place.
        </p>
        <div className="architecture">
          <div />
          <div />
          <div />
        </div>
      </aside>
      <section className="auth-card" key={String(register)}>
        <p className="eyebrow">WELCOME TO DREAMHOME</p>
        <h2>
          {register ? "Make yourself at home." : "Good to see you again."}
        </h2>
        <p>
          {register
            ? "Create your client account to arrange a viewing."
            : "Sign in to your rental workspace."}
        </p>
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        <form onSubmit={submit}>
          {(register
            ? ["name", "email", "phone", "password"]
            : ["email", "password"]
          ).map((name) => (
            <TextField
              key={name}
              label={
                name === "name"
                  ? "Full name"
                  : name === "password"
                    ? "Password (10–72 characters)"
                    : name[0].toUpperCase() + name.slice(1)
              }
              type={
                name === "password"
                  ? "password"
                  : name === "email"
                    ? "email"
                    : "text"
              }
              required={name !== "phone"}
              fullWidth
              margin="normal"
              value={values[name]}
              autoComplete={
                name === "password"
                  ? register
                    ? "new-password"
                    : "current-password"
                  : name === "name"
                    ? "name"
                    : name === "email"
                      ? "email"
                      : "tel"
              }
              slotProps={{
                htmlInput: {
                  minLength: name === "password" ? 10 : undefined,
                  maxLength: name === "password" ? 72 : 200,
                },
              }}
              onChange={(e) => setValues({ ...values, [name]: e.target.value })}
            />
          ))}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={busy}
            size="large"
          >
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </Button>
        </form>
        <Button onClick={resend} disabled={busy || !values.email}>
          Resend verification email
        </Button>
        <p>
          {register ? "Already have an account?" : "New to DreamHome?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
export function Verify() {
  const [params] = useSearchParams(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="page narrow">
      <h1>Verify your email</h1>
      <p>Confirm this email address to activate your DreamHome account.</p>
      {error && <Alert severity="error">{error}</Alert>}
      {message ? (
        <Alert severity="success">
          {message} <Link to="/login">Sign in</Link>
        </Alert>
      ) : (
        <Button
          variant="contained"
          disabled={busy || !params.get("token")}
          onClick={async () => {
            setBusy(true);
            try {
              setMessage(
                (
                  await api("/auth/verify", {
                    method: "POST",
                    body: { token: params.get("token") },
                  })
                ).message,
              );
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Verifying…" : "Verify email address"}
        </Button>
      )}
      {!params.get("token") && (
        <p>
          This link is missing its token. Request another email from the sign-in
          page.
        </p>
      )}
    </main>
  );
}
