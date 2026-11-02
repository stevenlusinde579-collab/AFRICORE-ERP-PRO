import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import RoleSwitcher from "../RoleSwitcher";
import { supabase } from "../../services/supabase";

function Topbar({ profile }) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      setLogoutError("");

      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;

      navigate("/", { replace: true });
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
      setLogoutError(error?.message || "Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  };

  return (
    <header className="relative flex min-h-16 items-center justify-between gap-3 bg-white px-4 py-3 shadow sm:px-6">
      {/* LEFT: KEEP ROLE SWITCHING AVAILABLE */}
      <div className="z-10 flex min-w-0 items-center">
        <RoleSwitcher />
      </div>

      {/* CENTER: PERSONAL WELCOME */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center px-28 text-center">
        <h2 className="truncate text-sm font-bold text-slate-800 sm:text-lg">
          Welcome, {profile?.fullName || "User"}
        </h2>
      </div>

      {/* RIGHT: LOGOUT */}
      <div className="z-10 ml-auto flex shrink-0 items-center gap-2">
        {logoutError && (
          <span className="max-w-40 text-right text-xs text-red-600 sm:max-w-64">
            {logoutError}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
          aria-label="Log out"
        >
          <LogOut size={16} />
          <span>{loggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </header>
  );
}

export default Topbar;