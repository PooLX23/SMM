import { Box, Button, Card, CardContent, Typography, Stack } from "@mui/material";
import { useMsal } from "@azure/msal-react";
import { useMe } from "../api/useMe";

export default function Dashboard() {
  const { instance } = useMsal();
  const { me, error } = useMe();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0b0e14", color: "white", p: 4 }}>
      <Card
        elevation={0}
        sx={{
          maxWidth: 680,
          mx: "auto",
          borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(17, 24, 39, 0.62)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Panel
            </Typography>

            {error && (
              <Typography sx={{ color: "rgba(255,120,120,0.95)" }}>
                {error}
              </Typography>
            )}

            {!error && !me && (
              <Typography sx={{ opacity: 0.8 }}>
                Pobieram profil użytkownika…
              </Typography>
            )}

            {me && (
              <>
                <Typography sx={{ opacity: 0.85 }}>
                  {me.name} ({me.upn})
                </Typography>

                <Typography
                  sx={{
                    display: "inline-block",
                    width: "fit-content",
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 2,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: me.is_reception
                      ? "rgba(59,130,246,0.18)"
                      : "rgba(110,231,183,0.14)",
                  }}
                >
                  Rola: {me.is_reception ? "RECEPCJA" : "ZLECAJĄCY"}
                </Typography>

                {"groups_count" in me && (
                  <Typography sx={{ opacity: 0.6, fontSize: 12 }}>
                    groups_count: {me.groups_count}
                  </Typography>
                )}
              </>
            )}

            <Box>
              <Button
                variant="outlined"
                sx={{ borderColor: "rgba(255,255,255,0.25)", color: "white" }}
                onClick={() => instance.logoutRedirect()}
              >
                Wyloguj
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
