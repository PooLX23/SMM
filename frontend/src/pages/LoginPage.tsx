import { Box, Button, Card, CardContent, Typography, Stack, Divider } from "@mui/material";
import MicrosoftIcon from "@mui/icons-material/Microsoft";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../auth/msal";

import sixtLogo from "../assets/sixt_logo.png";
import loginBg from "../assets/loginsmm.png";

export default function LoginPage() {
  const { instance } = useMsal();

  const signIn = async () => {
    await instance.loginRedirect(loginRequest);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "#0b0b0b",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* TŁO */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${loginBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.85)",
        }}
      />

      {/* Ciemna nakładka premium */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      <Card
        elevation={0}
        sx={{
          width: { xs: "92%", sm: 520 },
          borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(15, 15, 15, 0.75)",
          backdropFilter: "blur(18px)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.75)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Pasek akcentu SIXT */}
        <Box
          sx={{
            height: 4,
            width: "100%",
            background:
              "linear-gradient(90deg, #F05000 0%, rgba(240,80,0,0.35) 60%, rgba(255,255,255,0.0) 100%)",
          }}
        />

        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2.5}>
            {/* LOGO + nazwa */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  background: "#ffffff",
                  borderRadius: 2,
                  px: 1.2,
                  py: 0.8,
                  border: "1px solid rgba(0,0,0,0.10)",
                }}
              >
                <img
                  src={sixtLogo}
                  alt="SIXT"
                  style={{ height: 22, display: "block" }}
                />
              </Box>

              <Box>
                <Typography
                  sx={{
                    fontWeight: 950,
                    letterSpacing: 0.2,
                    color: "rgba(255,255,255,0.95)",
                    lineHeight: 1.2,
                  }}
                >
                  SIXT MailManager
                </Typography>
                <Typography sx={{ opacity: 0.70, fontSize: 12 }}>
                 SMM
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ opacity: 0.12 }} />

            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.95)",
                }}
              >
                Zaloguj się
              </Typography>

              <Typography sx={{ color: "rgba(255,255,255,0.75)", mt: 1 }}>
                Użyj konta Microsoft Entra ID, aby uzyskać dostęp do systemu.
              </Typography>
            </Box>

            <Button
              onClick={signIn}
              size="large"
              startIcon={<MicrosoftIcon />}
              sx={{
                py: 1.4,
                borderRadius: 3,
                textTransform: "none",
                fontWeight: 900,
                letterSpacing: 0.2,
                color: "#000",
                background: "#F05000",
                boxShadow: "0 18px 40px rgba(240,80,0,0.35)",
                "&:hover": {
                  background: "#ff620d",
                  boxShadow: "0 22px 60px rgba(240,80,0,0.45)",
                },
              }}
            >
              Zaloguj przez Microsoft
            </Button>

            <Typography sx={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
              W razie problemów skontaktuj się z działem IT.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
