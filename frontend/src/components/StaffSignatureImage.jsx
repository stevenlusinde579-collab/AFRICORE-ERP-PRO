import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

/**
 * Displays only the active signature belonging to the selected staff member
 * in the current school. If no signature is registered, the handwritten line
 * remains available.
 */
export default function StaffSignatureImage({ schoolId, teacherId, profileId, className = "", alt = "Staff signature" }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSrc("");
    if (!schoolId || (!teacherId && !profileId)) return undefined;

    (async () => {
      const { data, error } = await supabase
        .from("hr_staff_signatures")
        .select("storage_path")
        .eq("school_id", schoolId)
        .eq(profileId ? "profile_id" : "teacher_id", profileId || teacherId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data?.storage_path || cancelled) return;

      const { data: signed, error: urlError } = await supabase.storage
        .from("hr-staff-signatures")
        .createSignedUrl(data.storage_path, 60 * 60);
      if (!urlError && signed?.signedUrl && !cancelled) setSrc(signed.signedUrl);
    })();

    return () => { cancelled = true; };
  }, [schoolId, teacherId, profileId]);

  return (
    <div className={`flex min-h-14 flex-col justify-end ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-12 max-w-48 object-contain object-left-bottom" />
      ) : (
        <div className="h-12" aria-hidden="true" />
      )}
      <div className="border-t border-black" />
    </div>
  );
}
