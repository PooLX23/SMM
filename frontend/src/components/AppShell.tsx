import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { useMsal } from "@azure/msal-react";
import type { ReactNode } from "react";

import sixtLogo from "../assets/sixt_logo.png";

export default function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { instance } = useMsal();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0b0b0b", color: "white" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(11, 11, 11, 0.72)",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(14px)",
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1100,
            width: "100%",
            mx: "auto",
            minHeight: 64,
            gap: 2,
          }}
        >
          {/* LOGO (na jasnej podkładce, bo logo jest czarne) */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              borderRadius: 2,
              px: 1.2,
              py: 0.8,
              border: "1px solid rgba(0,0,0,0.08)",
              flex: "0 0 auto",
            }}
          >
            <img
              src={sixtLogo}
              alt="SIXT"
              style={{ height: 22, display: "block" }}
            />
          </Box>

          {/* Tytuł strony */}
          <Typography
            sx={{
              fontWeight: 900,
              letterSpacing: 0.3,
              color: "rgba(255,255,255,0.92)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Button
            variant="outlined"
            onClick={() => instance.logoutRedirect()}
            sx={{
              borderColor: "rgba(255,255,255,0.22)",
              color: "rgba(255,255,255,0.92)",
              borderRadius: 2,
              fontWeight: 900,
              textTransform: "none",
              "&:hover": {
                borderColor: "rgba(240,80,0,0.60)", // SIXT orange hover
                background: "rgba(240,80,0,0.10)",
              },
            }}
          >
            Wyloguj
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 1100, mx: "auto", p: 3 }}>{children}</Box>
    </Box>
  );
}
