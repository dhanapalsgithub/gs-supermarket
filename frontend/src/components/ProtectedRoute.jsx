import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, staffOnly = false, ownerOnly = false, customerOnly = false }) {
  const { user, loading, isOwner, isStaff, isCustomer } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass px-6 py-3 text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && !isOwner) return <Navigate to="/admin/pos" replace />;
  if (staffOnly && !isStaff) return <Navigate to="/shop" replace />;
  if (customerOnly && !isCustomer) return <Navigate to="/admin/pos" replace />;
  return children;
}
