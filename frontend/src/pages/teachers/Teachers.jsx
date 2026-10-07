import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../services/supabase";

function Teachers() {
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");

  // ============================================================
  // API BASE URL
  // ============================================================

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    "https://africore-erp-pro.onrender.com/api";

  // ============================================================
  // LOAD STAFF & NON-STAFF
  // ============================================================

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setLoading(true);

    try {
      const {
        data,
        error
      } = await supabase
        .from("teachers")
        .select("*")
        .order("created_at", {
          ascending: false
        });

      if (error) {
        console.error(
          "LOAD STAFF ERROR:",
          error
        );

        alert(
          error.message ||
            "Unable to load Staff & Non-Staff."
        );

        return;
      }

      setTeachers(data || []);
    } catch (error) {
      console.error(
        "LOAD STAFF EXCEPTION:",
        error
      );

      alert(
        error?.message ||
          "Unable to load Staff & Non-Staff."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DELETE STAFF / NON-STAFF
  //
  // IMPORTANT:
  // Do NOT delete directly from Supabase here.
  //
  // Backend will:
  // 1. Check authentication
  // 2. Check delete_staff permission
  // 3. Check school scope
  // 4. Delete Supabase Auth account
  // 5. Remove/deactivate staff record safely
  // ============================================================

  const deleteTeacher = async (teacher) => {
    if (!teacher?.id) {
      alert(
        "Invalid Staff & Non-Staff member."
      );

      return;
    }

    const fullName =
      [
        teacher.first_name,
        teacher.middle_name,
        teacher.last_name
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

    const confirmDelete =
      window.confirm(
        `Are you sure you want to remove ${
          fullName || "this Staff & Non-Staff member"
        }?\n\n` +
          "This action will disable the member's login account. " +
          "Historical records will be preserved where necessary.\n\n" +
          "Click OK to continue or Cancel to stop."
      );

    if (!confirmDelete) {
      return;
    }

    try {
      setDeletingId(teacher.id);

      // ========================================================
      // GET CURRENT SESSION
      // ========================================================

      const {
        data: sessionData,
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken =
        sessionData?.session?.access_token;

      if (!accessToken) {
        alert(
          "Your login session has expired. Please login again."
        );

        return;
      }

      // ========================================================
      // SECURE BACKEND DELETE
      // ========================================================

      const response =
        await axios.delete(
          `${API_BASE_URL}/teachers/${teacher.id}`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`
            }
          }
        );

      const result =
        response?.data || {};

      // ========================================================
      // SUCCESS
      // ========================================================

      if (result.success) {
        alert(
          result.message ||
            "Staff & Non-Staff member removed successfully."
        );

        await loadTeachers();

        return;
      }

      // ========================================================
      // BACKEND RETURNED FAILURE
      // ========================================================

      throw new Error(
        result.message ||
          "Unable to remove Staff & Non-Staff member."
      );
    } catch (error) {
      console.error(
        "DELETE STAFF FRONTEND ERROR:",
        error
      );

      // ========================================================
      // AXIOS ERROR RESPONSE
      // ========================================================

      const backendMessage =
        error?.response?.data?.message;

      if (backendMessage) {
        alert(backendMessage);
      } else {
        alert(
          error?.message ||
            "Unable to remove Staff & Non-Staff member."
        );
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const filtered = teachers.filter(
    (teacher) => {
      const name = `
        ${teacher.first_name || ""}
        ${teacher.middle_name || ""}
        ${teacher.last_name || ""}
      `.toLowerCase();

      const employeeNumber =
        String(
          teacher.employee_number || ""
        ).toLowerCase();

      const phone =
        String(
          teacher.phone || ""
        ).toLowerCase();

      const email =
        String(
          teacher.email || ""
        ).toLowerCase();

      const searchValue =
        search.toLowerCase();

      return (
        name.includes(searchValue) ||
        employeeNumber.includes(searchValue) ||
        phone.includes(searchValue) ||
        email.includes(searchValue)
      );
    }
  );

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        Loading Staff & Non-Staff...
      </div>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div>
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Staff & Non-Staff Management
          </h1>

          <p className="text-gray-600 mt-1">
            Manage all staff and non-staff members
          </p>
        </div>

        <button
          onClick={() =>
            navigate("/teachers/add")
          }
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg transition"
        >
          + Add Staff & Non-Staff
        </button>
      </div>

      {/* ======================================================
          SEARCH
      ====================================================== */}

      <input
        placeholder="Search staff & non-staff..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        className="border border-gray-300 p-3 rounded-lg w-full mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* ======================================================
          TABLE
      ====================================================== */}

      <div className="bg-white shadow rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4 text-left">
                  Photo
                </th>

                <th className="p-4 text-left">
                  Name
                </th>

                <th className="p-4 text-left">
                  Employee No
                </th>

                <th className="p-4 text-left">
                  Gender
                </th>

                <th className="p-4 text-left">
                  Phone
                </th>

                <th className="p-4 text-left">
                  Specialization
                </th>

                <th className="p-4 text-left">
                  Status
                </th>

                <th className="p-4 text-left">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(
                (teacher) => {
                  const isDeleting =
                    deletingId ===
                    teacher.id;

                  return (
                    <tr
                      key={teacher.id}
                      className="border-t hover:bg-gray-50"
                    >
                      {/* PHOTO */}
                      <td className="p-4">
                        {teacher.photo_url ? (
                          <img
                            src={
                              teacher.photo_url
                            }
                            alt="Staff"
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                            {teacher.first_name
                              ? teacher.first_name
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()
                              : "S"}
                          </div>
                        )}
                      </td>

                      {/* NAME */}
                      <td className="p-4 font-semibold">
                        {teacher.first_name ||
                          ""}{" "}
                        {teacher.middle_name ||
                          ""}{" "}
                        {teacher.last_name ||
                          ""}
                      </td>

                      {/* EMPLOYEE NUMBER */}
                      <td className="p-4">
                        {teacher.employee_number ||
                          "-"}
                      </td>

                      {/* GENDER */}
                      <td className="p-4">
                        {teacher.gender ||
                          "-"}
                      </td>

                      {/* PHONE */}
                      <td className="p-4">
                        {teacher.phone ||
                          "-"}
                      </td>

                      {/* SPECIALIZATION */}
                      <td className="p-4">
                        {teacher.specialization ||
                          "-"}
                      </td>

                      {/* STATUS */}
                      <td className="p-4">
                        <span
                          className={
                            String(
                              teacher.status ||
                                "Active"
                            ).toLowerCase() ===
                            "inactive"
                              ? "inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"
                              : "inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"
                          }
                        >
                          {teacher.status ||
                            "Active"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="p-4">
                        <div className="flex gap-2 flex-wrap">
                          {/* VIEW */}
                          <button
                            onClick={() =>
                              navigate(
                                `/teachers/profile/${teacher.id}`
                              )
                            }
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded transition"
                          >
                            View
                          </button>

                          {/* EDIT */}
                          <button
                            onClick={() =>
                              navigate(
                                `/teachers/edit/${teacher.id}`
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition"
                          >
                            Edit
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() =>
                              deleteTeacher(
                                teacher
                              )
                            }
                            disabled={
                              isDeleting
                            }
                            className={`text-white px-3 py-2 rounded transition ${
                              isDeleting
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            {isDeleting
                              ? "Removing..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>

        {/* ====================================================
            EMPTY STATE
        ==================================================== */}

        {filtered.length ===
          0 && (
            <div className="p-8 text-center text-gray-500">
              {search
                ? "No Staff & Non-Staff member found."
                : "No Staff & Non-Staff members available."}
            </div>
          )}
      </div>
    </div>
  );
}

export default Teachers;