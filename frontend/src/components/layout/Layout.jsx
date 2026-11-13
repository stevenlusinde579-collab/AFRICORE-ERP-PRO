import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";

function Layout() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState({
    fullName: "",
    avatarUrl: "",
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const loadUserProfile = async () => {
      if (authLoading) return;

      if (!user) {
        if (active) setProfile({ fullName: "", avatarUrl: "" });
        return;
      }

      const metadata = user.user_metadata || {};
      const fallbackName =
        metadata.full_name ||
        metadata.name ||
        user.email ||
        "User";
      const avatarUrl =
        metadata.avatar_url ||
        metadata.picture ||
        metadata.photo_url ||
        "";

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (active) {
          setProfile({
            fullName: data?.full_name?.trim() || fallbackName,
            avatarUrl,
          });
        }
      } catch (error) {
        console.warn("DASHBOARD PROFILE LOAD ERROR:", error);
        if (active) {
          setProfile({
            fullName: fallbackName,
            avatarUrl,
          });
        }
      }
    };

    loadUserProfile();

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-gray-100">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <Sidebar
        profile={profile}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar profile={profile} onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="min-w-0 w-full flex-1 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;