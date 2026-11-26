import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, TextField, MenuItem } from "@mui/material";
import { api, money } from "../api";
import { useAuth } from "../App";
import { Empty, Loading, FormDialog, Status } from "../components/UI";
function PropertyImage({ property, eager = false }) {
  const [failed, setFailed] = useState(false);
  return property.imageUrl && !failed ? (
    <img
      className="property-image"
      src={property.imageUrl}
      alt={property.title}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={"property-art " + property.type}
      aria-label={property.type + " illustration"}
      role="img"
    >
      <div className="building">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <span>
        {property.type} · {property.city}
      </span>
    </div>
  );
}
function Card({ property }) {
  return (
    <article className="property-card">
      <Link to={"/properties/" + property._id} className="image-link">
        <PropertyImage property={property} />
      </Link>
      <div className="card-body">
        <div className="row">
          <span className="eyebrow">
            {property.city}, {property.state}
          </span>
          <Status value={property.status} />
        </div>
        <h3>
          <Link to={"/properties/" + property._id}>{property.title}</Link>
        </h3>
        <p>{property.address}</p>
        {property.isDemo && (
          <span className="demo-label">Demo home · illustrative photo</span>
        )}
        <div className="facts">
          {property.bedrooms} beds <span>·</span> {property.bathrooms} baths{" "}
          <span>·</span> {property.squareFeet} sq ft
        </div>
        <div className="card-bottom">
          <strong>
            {money(property.rent)}
            <small> / month</small>
          </strong>
          <Button component={Link} to={"/properties/" + property._id}>
            View home
          </Button>
        </div>
      </div>
    </article>
  );
}
export function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">FIND YOUR SPACE. LIVE YOUR WAY.</p>
          <h1>
            Your next chapter
            <br />
            starts at home.
          </h1>
          <p>
            From a city apartment to a little more room to grow.
            <br />
            Discover a rental that feels like you.
          </p>
          <Button
            component={Link}
            to="/properties"
            variant="contained"
            size="large"
          >
            Explore available homes
          </Button>
          <div className="hero-note">
            <span>01 / DISCOVER</span>
            <span>02 / VISIT</span>
            <span>03 / SETTLE IN</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="sun" />
          <div className="house">
            <div className="window" />
            <div className="door" />
            <div className="window" />
          </div>
          <div className="hero-caption">
            <span>SPACE FOR WHAT MATTERS</span>
            <strong>Make room for living.</strong>
          </div>
        </div>
      </section>
      <section className="intro-strip">
        <div>
          <strong>Find a place</strong>
          <p>Filter by neighborhood, budget and the space you need.</p>
        </div>
        <div>
          <strong>See it for yourself</strong>
          <p>Choose a viewing time and manage it from your account.</p>
        </div>
        <div>
          <strong>Feel at home</strong>
          <p>Keep your lease, payments and maintenance together.</p>
        </div>
      </section>
      <Properties featured />
    </>
  );
}
export function Properties({ featured = false }) {
  const [params, setParams] = useSearchParams(),
    [filters, setFilters] = useState(Object.fromEntries(params)),
    [data, setData] = useState(null),
    [cities, setCities] = useState([]),
    [error, setError] = useState("");
  const query = featured ? "" : params.toString();
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api("/properties?" + query)
      .then((d) => {
        if (active) {
          setData(d);
          setCities(d.cities || []);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [query]);
  function search(e) {
    e.preventDefault();
    setParams(
      Object.fromEntries(
        Object.entries({ ...filters, page: "1" }).filter(
          ([, value]) => value !== "",
        ),
      ),
    );
  }
  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {featured ? "A PLACE TO CALL YOUR OWN" : "FIND YOUR NEXT ADDRESS"}
          </p>
          <h1>
            {featured ? "Discover your next home." : "Homes, with you in mind."}
          </h1>
        </div>
        {featured ? (
          <Button component={Link} to="/properties">
            Browse all homes
          </Button>
        ) : (
          <span>{data?.total ?? "…"} available homes</span>
        )}
      </div>
      {!featured && (
        <form className="filters" onSubmit={search}>
          <TextField
            select
            label="City"
            slotProps={{
              inputLabel: { shrink: true },
              select: { displayEmpty: true },
            }}
            value={filters.city || ""}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          >
            <MenuItem value="">All cities</MenuItem>
            {filters.city && !cities.includes(filters.city) && (
              <MenuItem value={filters.city}>
                {filters.city} (unavailable)
              </MenuItem>
            )}
            {cities.map((city) => (
              <MenuItem key={city} value={city}>
                {city}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Home type"
            value={filters.type || ""}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <MenuItem value="">All types</MenuItem>
            {["apartment", "house", "condo", "villa"].map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          {[
            ["bedrooms", "Min bedrooms"],
            ["minRent", "Min rent ($)"],
            ["maxRent", "Max rent ($)"],
          ].map(([name, label]) => (
            <TextField
              key={name}
              label={label}
              type="number"
              slotProps={{ htmlInput: { min: 0 } }}
              value={filters[name] || ""}
              onChange={(e) =>
                setFilters({ ...filters, [name]: e.target.value })
              }
            />
          ))}
          <TextField
            select
            label="Sort by"
            value={filters.sort || "newest"}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          >
            {[
              ["newest", "Newest"],
              ["price_asc", "Price: low to high"],
              ["price_desc", "Price: high to low"],
            ].map(([v, l]) => (
              <MenuItem key={v} value={v}>
                {l}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" type="submit">
            Search
          </Button>
          <Button
            onClick={() => {
              setFilters({});
              setParams({});
            }}
          >
            Reset
          </Button>
        </form>
      )}
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : !data ? (
        <Loading />
      ) : data.items.length ? (
        <div className="property-grid">
          {(featured ? data.items.slice(0, 3) : data.items).map((p) => (
            <Card key={p._id} property={p} />
          ))}
        </div>
      ) : (
        <Empty>
          No homes match this search. Try a different city or budget.
        </Empty>
      )}
      {!featured && data?.pages > 1 && (
        <div className="pagination">
          <Button
            disabled={data.page === 1}
            onClick={() =>
              setParams({
                ...Object.fromEntries(params),
                page: String(data.page - 1),
              })
            }
          >
            Previous
          </Button>
          <span>
            Page {data.page} of {data.pages}
          </span>
          <Button
            disabled={data.page === data.pages}
            onClick={() =>
              setParams({
                ...Object.fromEntries(params),
                page: String(data.page + 1),
              })
            }
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
export function PropertyDetail() {
  const { id } = useParams(),
    { user } = useAuth();
  const [property, setProperty] = useState(null),
    [error, setError] = useState(""),
    [booking, setBooking] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api("/properties/" + id)
      .then((p) => {
        if (active) setProperty(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (error)
    return (
      <main className="page">
        <Alert severity="error">{error}</Alert>
      </main>
    );
  if (!property) return <Loading />;
  return (
    <main className="page">
      <Link to="/properties">All homes</Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {property.city}, {property.state}
          </p>
          <h1>{property.title}</h1>
          <p>
            {property.address} {property.postalCode}
          </p>
        </div>
        <Status value={property.status} />
      </div>
      <div className="detail-grid">
        <section>
          <PropertyImage property={property} eager />
          {property.isDemo && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Demo listing: the address, rental terms and availability are
              sample data. Photos are illustrative and do not verify a real
              rental offer.
            </Alert>
          )}
          {property.imageUrl?.match(/^\/images\/homes\/(\d+)\.jpg$/) && (
            <p className="muted">
              Photo:{" "}
              <a
                href={
                  "https://www.pexels.com/photo/" +
                  property.imageUrl.match(/(\d+)\.jpg$/)[1] +
                  "/"
                }
                target="_blank"
                rel="noreferrer"
              >
                Pexels
              </a>{" "}
              · used as an illustration.
            </p>
          )}
          <div className="facts spacious">
            {property.bedrooms} bedrooms · {property.bathrooms} bathrooms ·{" "}
            {property.squareFeet} sq ft · {property.type}
          </div>
          <h2>Space to make your own</h2>
          <p className="description">{property.description}</p>
          {property.branch && (
            <p>
              Managed by {property.branch.name} · {property.branch.phone}
            </p>
          )}
        </section>
        <aside className="booking-card">
          <p>MONTHLY RENT</p>
          <h2>{money(property.rent)}</h2>
          <p>See the space in person. Viewing appointments last 30 minutes.</p>
          {message && (
            <Alert severity="success">
              {message} <Link to="/dashboard">Open workspace</Link>
            </Alert>
          )}
          {!user ? (
            <Button component={Link} to="/login" fullWidth variant="contained">
              Sign in to book a viewing
            </Button>
          ) : user.role === "client" ? (
            <Button
              fullWidth
              variant="contained"
              disabled={property.status !== "available"}
              onClick={() => setBooking(true)}
            >
              Book a viewing
            </Button>
          ) : (
            <Button component={Link} to="/dashboard">
              Manage in workspace
            </Button>
          )}
          <p className="muted">
            Choose a time on the hour or half hour within the next 90 days.
            Times are shown in your local timezone.
          </p>
        </aside>
      </div>
      {booking && (
        <FormDialog
          title="Arrange your viewing"
          fields={[
            {
              name: "date",
              label: "Viewing time (local)",
              type: "datetime-local",
              step: 1800,
            },
            {
              name: "notes",
              label: "Anything we should know?",
              multiline: true,
              required: false,
            },
          ]}
          onClose={() => setBooking(false)}
          submitLabel="Book viewing"
          onSave={async (values) => {
            await api("/viewings", {
              method: "POST",
              body: {
                ...values,
                property: id,
                date: new Date(values.date).toISOString(),
              },
            });
            setMessage("Your viewing is scheduled.");
          }}
        />
      )}
    </main>
  );
}
