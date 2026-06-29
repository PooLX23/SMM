import type { ReactNode } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import LoginPage from "../pages/LoginPage";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const isAuth = useIsAuthenticated();
  if (!isAuth) return <LoginPage />;
  return <>{children}</>;
}
