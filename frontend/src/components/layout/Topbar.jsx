import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import RoleSwitcher from "../RoleSwitcher";
import { supabase } from "../../services/supabase";

function Topbar({ profile, onMenuClick }) {
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
    <header className="sticky top-0 z-30 flex min-h-16 w-full min-w-0 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
        aria-label="Open navigation menu"
        aria-haspopup="true"
      >
        <Menu size={21} />
      </button>

      <div className="z-10 flex min-w-0 max-w-[42%] items-center sm:max-w-none">
        <RoleSwitcher />
      </div>

      <div className="min-w-0 flex-1 text-center sm:pointer-events-none sm:absolute sm:inset-x-0 sm:flex sm:justify-center sm:px-28">
        <h2 className="truncate text-xs font-bold text-slate-800 sm:text-lg">
          <span className="sm:hidden">AfriCore ERP PRO</span>
          <span className="hidden sm:inline">
            Welcome, {profile?.fullName || "User"}
          </span>
        </h2>
      </div>

      <div className="z-10 ml-auto flex shrink-0 items-center gap-2">
        {logoutError && (
          <span className="max-w-28 text-right text-[11px] leading-tight text-red-600 sm:max-w-64 sm:text-xs">
            {logoutError}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
          aria-label="Log out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">
            {loggingOut ? "Logging out..." : "Logout"}
          </span>
        </button>
      </div>
    </header>
  );
}

export default Topbar;