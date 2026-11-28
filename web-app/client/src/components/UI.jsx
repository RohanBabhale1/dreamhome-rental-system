import { useState } from "react";
import ImageUpload from "./ImageUpload";
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Chip,
} from "@mui/material";
export function Status({ value }) {
  return (
    <Chip
      size="small"
      label={value?.replaceAll("_", " ")}
      color={
        ["available", "active", "completed"].includes(value)
          ? "success"
          : ["cancelled", "terminated", "high"].includes(value)
            ? "warning"
            : "default"
      }
    />
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <CircularProgress size={28} />
      <p>Loading your workspace…</p>
    </div>
  );
}
export function Empty({ children = "Nothing here yet." }) {
  return <div className="empty">{children}</div>;
}
export function FormFields({ fields, values, setValues, onUploadBusy }) {
  return (
    <div className="form-grid">
      {fields.map((field) =>
        field.type === "image" ? (
          <ImageUpload
            onBusy={onUploadBusy}
            key={field.name}
            value={values[field.name]}
            onChange={(url) =>
              setValues((old) => ({ ...old, [field.name]: url }))
            }
          />
        ) : (
          <TextField
            key={field.name}
            label={field.label}
            type={field.type || "text"}
            select={!!field.options}
            required={field.required !== false}
            fullWidth
            multiline={field.multiline}
            minRows={field.multiline ? 3 : undefined}
            value={values[field.name] ?? ""}
            onChange={(event) =>
              setValues({ ...values, [field.name]: event.target.value })
            }
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: {
                min: field.min,
                max: field.max,
                step: field.step,
                minLength: field.minLength,
                maxLength: field.maxLength,
              },
            }}
          >
            {field.options?.map((option) => (
              <MenuItem
                key={option.value ?? option}
                value={option.value ?? option}
              >
                {option.label ?? option}
              </MenuItem>
            ))}
          </TextField>
        ),
      )}
    </div>
  );
}
export function FormDialog({
  title,
  fields,
  initial = {},
  onSave,
  onClose,
  submitLabel = "Save",
}) {
  const [uploadBusy, setUploadBusy] = useState(false);
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (uploadBusy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(values);
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <FormFields
            fields={fields}
            values={values}
            setValues={setValues}
            onUploadBusy={setUploadBusy}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || uploadBusy}
          >
            {busy ? "Saving…" : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
export function ConfirmDialog({ title, description, onSave, onClose }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog open onClose={() => !busy && onClose()}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <p>{description}</p>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="warning"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave();
              onClose();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export const options = (items) =>
  items.map((item) => ({
    value: item._id,
    label: item.title || item.name || item.address,
  }));
