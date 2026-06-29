import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import ReceptionHome from "./pages/ReceptionHome";
import ShipmentsHome from "./pages/ShipmentsHome";
import { useMe } from "./api/useMe";
import { Box, CircularProgress, Typography } from "@mui/material";

function Loading() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#0b0e14", color: "white" }}>
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, opacity: 0.75 }}>Ładowanie profilu…</Typography>
      </Box>
    </Box>
  );
}

function RoleRouter() {
  const { me, error } = useMe();
  if (error) return <Box sx={{ p: 4, color: "white" }}>{error}</Box>;
  if (!me) return <Loading />;
  return <Navigate to={me.is_reception ? "/reception" : "/shipments"} replace />;
}

export default function App() {
  return (
    <RequireAuth>
      <Routes>
        <Route path="/" element={<RoleRouter />} />
        <Route path="/reception" element={<ReceptionHome />} />
        <Route path="/shipments" element={<ShipmentsHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RequireAuth>
  );
}
