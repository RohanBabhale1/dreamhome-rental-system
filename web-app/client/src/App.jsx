import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { Alert, Button } from "@mui/material";
import { api } from "./api";
import { Loading } from "./components/UI";
import { Home, Properties, PropertyDetail } from "./pages/Properties.jsx";
import { AuthPage, Verify } from "./pages/Auth.jsx";
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
function Protected({ children }) {
  const { user } = useAuth();
  return user ? (
    <Suspense fallback={<Loading />}>{children}</Suspense>
  ) : (
    <Navigate to="/login" replace />
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <header className="header">
        <Link className="brand" to="/">
          <span className="brand-mark">⌂</span>DreamHome
          <span className="brand-sub">RENTAL LIVING</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/properties">Find a home</NavLink>
          {user ? (
            <>
              <NavLink to="/dashboard">My workspace</NavLink>
              <Button onClick={logout}>Sign out</Button>
            </>
          ) : (
            <>
              <NavLink to="/login">Sign in</NavLink>
              <Button component={Link} to="/register" variant="contained">
                Get started
              </Button>
            </>
          )}
        </nav>
      </header>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Loading />
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage register />} />
          <Route path="/verify" element={<Verify />} />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <main className="page">
                <h1>Page not found</h1>
                <Button component={Link} to="/">
                  Return home
                </Button>
              </main>
            }
          />
        </Routes>
      )}
      <footer>
        <strong>DreamHome</strong>
        <span>A place to belong. A simpler way to rent.</span>
        <Link to="/properties">Explore homes</Link>
      </footer>
    </AuthContext.Provider>
  );
}
