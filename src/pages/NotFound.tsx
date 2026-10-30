import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/journal/JournalProvider";
import { SoloScreen } from "@/journal/auth/parts";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();
  const signedIn = !!user || isDemoMode();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <SoloScreen
      title="Page not found"
      sub={<>There is nothing at <span className="auth-addr j-mono">{location.pathname}</span>. The link may be old, or the address mistyped.</>}
    >
      <div className="auth-actions">
        <Link to={signedIn ? "/dashboard" : "/"} className="j-btn primary">{signedIn ? "Go to overview" : "Go to home"}</Link>
        {signedIn ? <Link to="/trades" className="j-btn ghost">Open the journal</Link> : <Link to="/auth" className="j-btn ghost">Sign in</Link>}
      </div>
    </SoloScreen>
  );
};

export default NotFound;
