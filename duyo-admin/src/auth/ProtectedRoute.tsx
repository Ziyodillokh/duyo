import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { admin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="animate-spin text-duyo-blue" size={28} />
      </div>
    );
  }
  if (!admin) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
