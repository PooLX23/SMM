import { createTheme } from "@mui/material/styles";

const SIXT = {
  orange: "#F05000", // z Twojego logo
  black: "#0B0B0B",
  panel: "rgba(17, 24, 39, 0.72)",
};

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: SIXT.black,
      paper: SIXT.panel,
    },
    text: {
      primary: "#ffffff",
      secondary: "rgba(255,255,255,0.78)",
    },
    primary: {
      main: SIXT.orange,
      contrastText: "#000000",
    },
    success: { main: "#22c55e" },
    warning: { main: "#f59e0b" },
    error: { main: "#ef4444" },
    divider: "rgba(255,255,255,0.10)",
  },

  typography: {
    fontFamily: `"Inter", "Roboto", "Helvetica", "Arial", sans-serif`,
    h5: { fontWeight: 900 },
    button: { fontWeight: 900, textTransform: "none" },
    body1: { color: "#fff" },
    body2: { color: "rgba(255,255,255,0.85)" },
  },

  shape: { borderRadius: 14 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: SIXT.black,
          backgroundImage:
            "radial-gradient(1100px 520px at 18% 0%, rgba(240,80,0,0.14), transparent 60%)," +
            "radial-gradient(900px 420px at 85% 20%, rgba(255,255,255,0.06), transparent 60%)",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(17, 24, 39, 0.62)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          color: "rgba(255,255,255,0.92)",
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 14 },
        containedPrimary: {
          backgroundColor: SIXT.orange,
          color: "#000",
          boxShadow: "0 18px 40px rgba(240,80,0,0.22)",
        },
        outlined: {
          borderColor: "rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.92)",
        },
      },
    },

    MuiTextField: { defaultProps: { variant: "outlined" } },

    MuiInputLabel: {
      styleOverrides: { root: { color: "rgba(255,255,255,0.75)" } },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          background: "rgba(0,0,0,0.14)",
        },
        input: { color: "#fff" },
        notchedOutline: { borderColor: "rgba(255,255,255,0.18)" },
      },
    },

    MuiSelect: {
      styleOverrides: { icon: { color: "rgba(255,255,255,0.92)" } },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: "rgba(255,255,255,0.10)" } },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 800 },
        outlined: { borderColor: "rgba(255,255,255,0.18)" },
      },
    },

    MuiAlert: { styleOverrides: { root: { borderRadius: 14 } } },
  },
});

export default theme;
