import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

/**
 * Displays only the active signature belonging to the selected staff member
 * in the current school. If no signature is registered, the handwritten line
 * remains available.
 */
export default function StaffSignatureImage({ schoolId, teacherId, profileId, className = "", alt = "Staff signature" }) {
  const [src, setSrc] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc("");
    setReady(false);
    if (!schoolId || (!teacherId && !profileId)) {
      setReady(true);
      return undefined;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("hr_staff_signatures")
          .select("storage_path")
          .eq("school_id", schoolId)
          .eq(profileId ? "profile_id" : "teacher_id", profileId || teacherId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data?.storage_path) {
          setReady(true);
          return;
        }

        const { data: signed, error: urlError } = await supabase.storage
          .from("hr-staff-signatures")
          .createSignedUrl(data.storage_path, 60 * 60);
        if (cancelled) return;
        if (!urlError && signed?.signedUrl) setSrc(signed.signedUrl);
        else setReady(true);
      } catch (error) {
        console.warn("STAFF SIGNATURE LOAD WARNING:", error);
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [schoolId, teacherId, profileId]);

  return (
    <div className={`staff-signature-image flex min-h-14 flex-col justify-end ${className}`} data-signature-ready={ready ? "true" : "false"}>
      {src ? (
        <img src={src} alt={alt} onLoad={() => setReady(true)} onError={() => setReady(true)} className="h-12 max-w-48 object-contain object-left-bottom" />
      ) : (
        <div className="h-12" aria-hidden="true" />
      )}
      <div className="border-t border-black" />
    </div>
  );
}
