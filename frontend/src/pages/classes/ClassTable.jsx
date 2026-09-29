import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";

function ClassTable({ filters = {} }) {
    const navigate = useNavigate();

    const {
        schoolId,
        activeAcademicYearId,
        activeAcademicYear,
        academicYearLoading,
        academicYearError,
    } = useSchool();

    const {
        selectedRoleId,
        selectedProfileRoleId,
        selectedRoleName,
    } = useRole();

    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    // =====================================================
    // SUBJECT TEACHER
    // =====================================================

    const isSubjectTeacher =
        Number(selectedRoleId) === 5 ||
        String(selectedRoleName || "")
            .trim()
            .toLowerCase() === "subject teacher";

    // =====================================================
    // FETCH CLASSES
    // =====================================================

    const fetchClasses = async () => {
        if (!schoolId || !activeAcademicYearId) {
            setClasses([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            // =================================================
            // NORMAL ROLES
            // =================================================

            if (!isSubjectTeacher) {
                const {
                    data,
                    error,
                } = await supabase
                    .from("classes")
                    .select("*")
                    .eq("school_id", schoolId)
                    .eq(
                        "academic_year_id",
                        activeAcademicYearId
                    )
                    .order("created_at", {
                        ascending: false,
                    });

                console.log("CLASSES:", data);
                console.log("ERROR:", error);

                if (error) {
                    console.error(
                        "FETCH CLASSES ERROR:",
                        error
                    );

                    setClasses([]);
                } else {
                    setClasses(data || []);
                }

                return;
            }

            // =================================================
            // SUBJECT TEACHER
            // =================================================

            const {
                data: authData,
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !authData?.user) {
                console.error(
                    "SUBJECT TEACHER AUTH ERROR:",
                    authError
                );

                setClasses([]);
                return;
            }

            const userId = authData.user.id;

            // =================================================
            // GET PROFILE
            // =================================================

            const {
                data: profile,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select(
                    "id, full_name, school_id, role_id, teacher_id"
                )
                .eq("id", userId)
                .maybeSingle();

            if (profileError) {
                console.error(
                    "FETCH TEACHER PROFILE ERROR:",
                    profileError
                );

                setClasses([]);
                return;
            }

            if (!profile) {
                console.error(
                    "SUBJECT TEACHER PROFILE NOT FOUND"
                );

                setClasses([]);
                return;
            }

            // =================================================
            // TEACHER ID
            // =================================================

            const teacherId = profile.teacher_id;

            if (!teacherId) {
                console.warn(
                    "SUBJECT TEACHER HAS NO teacher_id"
                );

                setClasses([]);
                return;
            }

            // =================================================
            // FETCH TEACHER ASSIGNMENTS
            // =================================================

            const {
                data: assignments,
                error: assignmentError,
            } = await supabase
                .from("teacher_assignments")
                .select(
                    "id, teacher_id, subject_id, class_id, school_id"
                )
                .eq("teacher_id", teacherId)
                .eq("school_id", schoolId);

            if (assignmentError) {
                console.error(
                    "FETCH TEACHER ASSIGNMENTS ERROR:",
                    assignmentError
                );

                setClasses([]);
                return;
            }

            console.log(
                "SUBJECT TEACHER ASSIGNMENTS:",
                assignments
            );

            if (
                !assignments ||
                assignments.length === 0
            ) {
                setClasses([]);
                return;
            }

            // =================================================
            // GET UNIQUE ASSIGNED CLASS IDS
            // =================================================

            const assignedClassIds = [
                ...new Set(
                    assignments
                        .map((assignment) =>
                            Number(assignment.class_id)
                        )
                        .filter(
                            (classId) =>
                                Number.isFinite(classId)
                        )
                ),
            ];

            console.log(
                "SUBJECT TEACHER CLASS IDS:",
                assignedClassIds
            );

            if (assignedClassIds.length === 0) {
                setClasses([]);
                return;
            }

            // =================================================
            // FETCH ONLY ASSIGNED CLASSES
            // =================================================

            const {
                data,
                error,
            } = await supabase
                .from("classes")
                .select("*")
                .eq("school_id", schoolId)
                .eq(
                    "academic_year_id",
                    activeAcademicYearId
                )
                .in("id", assignedClassIds)
                .order("created_at", {
                    ascending: false,
                });

            console.log(
                "SUBJECT TEACHER CLASSES:",
                data
            );

            console.log(
                "SUBJECT TEACHER CLASS ERROR:",
                error
            );

            if (error) {
                console.error(
                    "FETCH SUBJECT TEACHER CLASSES ERROR:",
                    error
                );

                setClasses([]);
            } else {
                setClasses(data || []);
            }
        } catch (error) {
            console.error(
                "FETCH CLASSES EXCEPTION:",
                error
            );

            setClasses([]);
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // LOAD DATA
    // =====================================================

    useEffect(() => {
        if (
            schoolId &&
            activeAcademicYearId &&
            !academicYearLoading
        ) {
            fetchClasses();
        }
    }, [
        schoolId,
        activeAcademicYearId,
        academicYearLoading,
        selectedRoleId,
        selectedProfileRoleId,
        selectedRoleName,
    ]);

    // =====================================================
    // DELETE CLASS
    // =====================================================

    const deleteClass = async (id) => {
        // Subject Teacher cannot delete classes.
        if (isSubjectTeacher) {
            return;
        }

        const confirmDelete = window.confirm(
            "Are you sure you want to delete this class?"
        );

        if (!confirmDelete) {
            return;
        }

        const { error } = await supabase
            .from("classes")
            .delete()
            .eq("id", id)
            .eq("school_id", schoolId)
            .eq(
                "academic_year_id",
                activeAcademicYearId
            );

        if (error) {
            console.error(
                "DELETE CLASS ERROR:",
                error
            );

            alert(error.message);
            return;
        }

        fetchClasses();
    };

    // =====================================================
    // SEARCH
    // =====================================================

    const searchText = (
        filters?.search || ""
    )
        .trim()
        .toLowerCase();

    const filteredClasses = classes.filter((item) => {
        if (!searchText) {
            return true;
        }

        return (
            String(item.class_name || "")
                .toLowerCase()
                .includes(searchText) ||
            String(item.academic_level || "")
                .toLowerCase()
                .includes(searchText) ||
            String(item.short_name || "")
                .toLowerCase()
                .includes(searchText)
        );
    });

    // =====================================================
    // ACADEMIC YEAR LOADING
    // =====================================================

    if (academicYearLoading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow">
                Loading academic year...
            </div>
        );
    }

    // =====================================================
    // ACADEMIC YEAR ERROR
    // =====================================================

    if (academicYearError) {
        return (
            <div className="bg-white p-6 rounded-xl shadow">
                <p className="text-red-600 font-medium">
                    Failed to load academic year.
                </p>

                <p className="text-gray-500 mt-2">
                    {academicYearError}
                </p>
            </div>
        );
    }

    // =====================================================
    // NO ACTIVE ACADEMIC YEAR
    // =====================================================

    if (!activeAcademicYearId) {
        return (
            <div className="bg-white p-6 rounded-xl shadow">
                <p className="text-yellow-700 font-medium">
                    No active academic year found.
                </p>

                <p className="text-gray-500 mt-2">
                    Please activate an academic year from
                    Settings.
                </p>
            </div>
        );
    }

    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow">
                Loading classes...
            </div>
        );
    }

    // =====================================================
    // TABLE
    // =====================================================

    return (
        <div className="bg-white rounded-xl shadow overflow-x-auto">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="px-6 py-4 border-b bg-gray-50">

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">

                    <div>

                        <h2 className="text-lg font-semibold text-gray-800">
                            {isSubjectTeacher
                                ? "My Classes"
                                : "Classes"}
                        </h2>

                        <p className="text-sm text-gray-500">
                            Academic Year:{" "}

                            <span className="font-medium text-gray-700">
                                {activeAcademicYear?.year_name ||
                                    "-"}
                            </span>
                        </p>

                    </div>

                    <div className="text-sm text-gray-500">
                        {filteredClasses.length} class
                        {filteredClasses.length !== 1
                            ? "es"
                            : ""}
                    </div>

                </div>

            </div>

            {/* =================================================
                TABLE
            ================================================= */}

            <table className="w-full">

                <thead className="bg-slate-900 text-white">

                    <tr>

                        <th className="p-4 text-left">
                            Class Name
                        </th>

                        <th className="p-4 text-left">
                            Level
                        </th>

                        <th className="p-4 text-left">
                            Stream
                        </th>

                        <th className="p-4 text-left">
                            Status
                        </th>

                        <th className="p-4 text-center">
                            Actions
                        </th>

                    </tr>

                </thead>

                <tbody>

                    {filteredClasses.length === 0 ? (

                        <tr>

                            <td
                                colSpan="5"
                                className="p-6 text-center text-gray-500"
                            >
                                {isSubjectTeacher
                                    ? "No classes have been assigned to you for the active academic year."
                                    : "No classes found for the active academic year."}
                            </td>

                        </tr>

                    ) : (

                        filteredClasses.map((item) => (

                            <tr
                                key={item.id}
                                className="border-b hover:bg-gray-50"
                            >

                                {/* CLASS NAME */}

                                <td className="p-4 font-medium text-gray-800">
                                    {item.class_name || "-"}
                                </td>

                                {/* LEVEL */}

                                <td className="p-4 text-gray-600">
                                    {item.academic_level || "-"}
                                </td>

                                {/* STREAM */}

                                <td className="p-4 text-gray-600">
                                    {item.stream || "-"}
                                </td>

                                {/* STATUS */}

                                <td className="p-4">

                                    <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">
                                        {item.status ||
                                            "Active"}
                                    </span>

                                </td>

                                {/* ACTIONS */}

                                <td className="p-4 text-center">

                                    {/* VIEW */}

                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/classes/profile/${item.id}`
                                            )
                                        }
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded mr-2"
                                    >
                                        View
                                    </button>

                                    {/* EDIT + DELETE */}

                                    {!isSubjectTeacher && (
                                        <>
                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/classes/edit/${item.id}`
                                                    )
                                                }
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded mr-2"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                onClick={() =>
                                                    deleteClass(
                                                        item.id
                                                    )
                                                }
                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}

                                </td>

                            </tr>

                        ))

                    )}

                </tbody>

            </table>

        </div>
    );
}

export default ClassTable;