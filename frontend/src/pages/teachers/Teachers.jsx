import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

function Teachers() {
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
    } else {
      setTeachers(data || []);
    }

    setLoading(false);
  };

  const deleteTeacher = async (id, photo_url) => {
    const confirmDelete = window.confirm(
      "Delete this staff or non-staff member?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("teachers")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      alert("Staff & Non-Staff member deleted successfully");
      loadTeachers();
    }
  };

  const filtered = teachers.filter((teacher) => {
    const name = `
      ${teacher.first_name || ""}
      ${teacher.middle_name || ""}
      ${teacher.last_name || ""}
    `.toLowerCase();

    return name.includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        Loading Staff & Non-Staff...
      </div>
    );
  }

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Staff & Non-Staff Management
          </h1>

          <p className="text-gray-600">
            Manage all staff and non-staff members
          </p>
        </div>

        <button
          onClick={() => navigate("/teachers/add")}
          className="bg-blue-600 text-white px-5 py-3 rounded-lg"
        >
          + Add Staff & Non-Staff
        </button>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search staff & non-staff..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-3 rounded-lg w-full mb-5"
      />

      {/* TABLE */}
      <div className="bg-white shadow rounded-xl overflow-hidden">
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
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((teacher) => (
              <tr
                key={teacher.id}
                className="border-t"
              >
                {/* PHOTO */}
                <td className="p-4">
                  {teacher.photo_url ? (
                    <img
                      src={teacher.photo_url}
                      alt="Staff"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      {teacher.first_name
                        ? teacher.first_name.charAt(0).toUpperCase()
                        : "S"}
                    </div>
                  )}
                </td>

                {/* NAME */}
                <td className="p-4 font-semibold">
                  {teacher.first_name || ""}{" "}
                  {teacher.middle_name || ""}{" "}
                  {teacher.last_name || ""}
                </td>

                {/* EMPLOYEE NUMBER */}
                <td className="p-4">
                  {teacher.employee_number}
                </td>

                {/* GENDER */}
                <td className="p-4">
                  {teacher.gender}
                </td>

                {/* PHONE */}
                <td className="p-4">
                  {teacher.phone}
                </td>

                {/* SPECIALIZATION */}
                <td className="p-4">
                  {teacher.specialization}
                </td>

                {/* ACTIONS */}
                <td className="p-4 flex gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/teachers/profile/${teacher.id}`
                      )
                    }
                    className="bg-green-600 text-white px-3 py-2 rounded"
                  >
                    View
                  </button>

                  <button
                    onClick={() =>
                      navigate(
                        `/teachers/edit/${teacher.id}`
                      )
                    }
                    className="bg-blue-600 text-white px-3 py-2 rounded"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      deleteTeacher(
                        teacher.id,
                        teacher.photo_url
                      )
                    }
                    className="bg-red-600 text-white px-3 py-2 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* EMPTY STATE */}
        {filtered.length === 0 && (
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