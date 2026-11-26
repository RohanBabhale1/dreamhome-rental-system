import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App.jsx";
import "./styles.css";
const theme = createTheme({
  palette: { primary: { main: "#146b59" }, background: { default: "#f4f7f8" } },
  typography: { fontFamily: "Inter, system-ui, sans-serif" },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", fontWeight: 650 } },
    },
  },
});
createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>,
);
