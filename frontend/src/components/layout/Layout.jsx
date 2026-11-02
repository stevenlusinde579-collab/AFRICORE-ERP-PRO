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
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar profile={profile} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} />

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;