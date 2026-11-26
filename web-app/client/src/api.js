export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an invalid response" }));
  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
export const date = (value) =>
  new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" });
export const dateTime = (value) => new Date(value).toLocaleString();
