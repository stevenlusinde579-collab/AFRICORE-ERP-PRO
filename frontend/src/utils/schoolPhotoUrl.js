import { supabase } from "../services/supabase";

/**
 * Resolve a school-folder photo path to a short-lived signed URL.
 * Supports legacy public URLs already stored in photo_url.
 */
export async function resolveSchoolPhotoUrl(bucket, storedValue, expiresIn = 3600) {
  if (!storedValue || typeof storedValue !== "string") return "";

  let path = storedValue.trim();
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/object/public/${bucket}/`,
      `/object/sign/${bucket}/`,
    ];

    const marker = markers.find((candidate) => path.includes(candidate));
    if (!marker) return "";

    path = path.slice(path.indexOf(marker) + marker.length).split("?")[0];
    try {
      path = path.split("/").map((segment) => decodeURIComponent(segment)).join("/");
    } catch {
      return "";
    }
  } else if (path.startsWith(`${bucket}/`)) {
    path = path.slice(bucket.length + 1);
  }

  // Photo objects must be stored beneath a numeric school folder.
  const schoolFolder = path.split("/")[0];
  if (!/^\d+$/.test(schoolFolder)) return "";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("SCHOOL PHOTO SIGNING ERROR:", error.message);
    return "";
  }

  return data?.signedUrl || "";
}
