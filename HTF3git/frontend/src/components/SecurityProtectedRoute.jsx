import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SecurityProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.role !== "security") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default SecurityProtectedRoute;

