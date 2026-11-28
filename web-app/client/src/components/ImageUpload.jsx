import { useState } from "react";
import { Alert, Button } from "@mui/material";
import { api } from "../api";
export default function ImageUpload({ value, onChange, onBusy }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <label>
        House photo (JPEG, PNG or WebP; up to 1 MB)
        <input
          aria-label="Upload house photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = "";
            setError("");
            if (file.size > 1024 * 1024) {
              setError("Choose an image of at most 1 MB.");
              return;
            }
            setBusy(true);
            onBusy?.(true);
            try {
              const image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              const result = await api("/images", {
                method: "POST",
                body: { image },
              });
              onChange(result.imageUrl);
            } catch (err) {
              setError(err.message || "Upload failed. Try again.");
            } finally {
              setBusy(false);
              onBusy?.(false);
            }
          }}
        />
      </label>
      {busy && (
        <p role="status">
          Uploading photo. Wait for the preview before saving.
        </p>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {value && (
        <>
          <img
            src={value}
            alt="Selected house photo"
            style={{ width: "100%", maxHeight: 220, objectFit: "contain" }}
          />
          <Button disabled={busy} onClick={() => onChange("")}>
            Remove photo
          </Button>
        </>
      )}
      <p>
        Only publish photos and contact details you have permission to share.
      </p>
    </div>
  );
}
