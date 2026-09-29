import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

function EditClass() {
    const { id } = useParams();
    const navigate = useNavigate();

    // =====================================================
    // GLOBAL SCHOOL + ACADEMIC YEAR
    // =====================================================

    const {
        schoolId,
        activeAcademicYear,
        activeAcademicYearId,
        academicYearLoading,
        academicYearError,
    } = useSchool();

    // =====================================================
    // STATE
    // =====================================================

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [message, setMessage] = useState("");

    const [form, setForm] = useState({
        academic_level: "",
        class_name: "",
        short_name: "",
    });

    // =====================================================
    // FETCH CLASS
    // =====================================================

    const fetchData = async () => {
        if (!schoolId || !activeAcademicYearId) {
            setFetching(false);
            return;
        }

        setFetching(true);
        setMessage("");

        const {
            data: classData,
            error: classError,
        } = await supabase
            .from("classes")
            .select("*")
            .eq("id", id)
            .eq("school_id", schoolId)
            .eq("academic_year_id", activeAcademicYearId)
            .single();

        console.log(
            "EDIT CLASS:",
            classData
        );

        console.log(
            "EDIT CLASS ERROR:",
            classError
        );

        if (classError) {
            console.error(
                "FETCH CLASS ERROR:",
                classError
            );

            setMessage(
                classError.message ||
                    "Class not found."
            );

            setFetching(false);

            return;
        }

        setForm({
            academic_level:
                classData.academic_level || "",

            class_name:
                classData.class_name || "",

            short_name:
                classData.short_name || "",
        });

        setFetching(false);
    };

    // =====================================================
    // LOAD CLASS WHEN GLOBAL CONTEXT IS READY
    // =====================================================

    useEffect(() => {
        if (
            schoolId &&
            activeAcademicYearId &&
            !academicYearLoading
        ) {
            fetchData();
        }
    }, [
        id,
        schoolId,
        activeAcademicYearId,
        academicYearLoading,
    ]);

    // =====================================================
    // HANDLE CHANGE
    // =====================================================

    const handleChange = (e) => {
        const {
            name,
            value,
        } = e.target;

        setForm({
            ...form,
            [name]: value,
        });
    };

    // =====================================================
    // UPDATE CLASS
    // =====================================================

    const updateClass = async (e) => {
        e.preventDefault();

        setMessage("");

        // =================================================
        // CHECK SCHOOL
        // =================================================

        if (!schoolId) {
            setMessage(
                "School information is not available. Please refresh and try again."
            );

            return;
        }

        // =================================================
        // CHECK ACTIVE ACADEMIC YEAR
        // =================================================

        if (!activeAcademicYearId) {
            setMessage(
                academicYearError ||
                    "No active academic year found. Please activate an academic year in Settings first."
            );

            return;
        }

        // =================================================
        // VALIDATION
        // =================================================

        if (!form.class_name.trim()) {
            setMessage(
                "Please enter class name."
            );

            return;
        }

        if (!form.academic_level) {
            setMessage(
                "Please select academic level."
            );

            return;
        }

        setLoading(true);

        // =================================================
        // UPDATE ONLY CLASS INFORMATION
        // =================================================

        const updatePayload = {
            academic_level:
                form.academic_level,

            class_name:
                form.class_name.trim(),

            short_name:
                form.short_name.trim() || null,
        };

        console.log(
            "UPDATE CLASS PAYLOAD:",
            updatePayload
        );

        const {
            data,
            error,
        } = await supabase
            .from("classes")
            .update(updatePayload)
            .eq("id", id)
            .eq("school_id", schoolId)
            .eq("academic_year_id", activeAcademicYearId)
            .select();

        console.log(
            "UPDATED CLASS:",
            data
        );

        console.log(
            "UPDATE CLASS ERROR:",
            error
        );

        // =================================================
        // ERROR
        // =================================================

        if (error) {
            console.error(
                "UPDATE CLASS ERROR:",
                error
            );

            setMessage(
                "ERROR: " + error.message
            );

            setLoading(false);

            return;
        }

        // =================================================
        // SUCCESS
        // =================================================

        setMessage(
            "Class updated successfully ✅"
        );

        setTimeout(() => {
            navigate("/classes");
        }, 1200);

        setLoading(false);
    };

    // =====================================================
    // ACADEMIC YEAR LOADING
    // =====================================================

    if (academicYearLoading) {
        return (
            <div className="p-6">

                <div className="bg-white shadow rounded-xl p-6">

                    <p className="text-gray-600">
                        Loading academic year...
                    </p>

                </div>

            </div>
        );
    }

    // =====================================================
    // NO ACTIVE ACADEMIC YEAR
    // =====================================================

    if (!activeAcademicYearId) {
        return (
            <div className="p-6">

                <h1 className="text-3xl font-bold text-gray-800">
                    Edit Class
                </h1>

                <p className="text-gray-600 mt-2">
                    Update class information
                </p>

                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 mt-6">

                    <h2 className="font-semibold">
                        No Active Academic Year
                    </h2>

                    <p className="text-sm mt-2">
                        {academicYearError ||
                            "Please activate an academic year in Settings before editing classes."}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/classes")
                        }
                        className="mt-4 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg"
                    >
                        Back
                    </button>

                </div>

            </div>
        );
    }

    // =====================================================
    // FETCHING CLASS
    // =====================================================

    if (fetching) {
        return (
            <div className="p-6">

                <div className="bg-white shadow rounded-xl p-6">

                    <p className="text-gray-600">
                        Loading class...
                    </p>

                </div>

            </div>
        );
    }

    // =====================================================
    // FORM
    // =====================================================

    return (
        <div className="p-6">

            <h1 className="text-3xl font-bold text-gray-800">
                Edit Class
            </h1>

            <p className="text-gray-600 mt-2">
                Update class information
            </p>

            {/* =================================================
                ACTIVE ACADEMIC YEAR
                ================================================= */}

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">

                <p className="text-sm text-blue-700">
                    Academic Year
                </p>

                <p className="font-semibold text-blue-900 mt-1">
                    {activeAcademicYear?.year_name || "-"}
                    {activeAcademicYear?.term
                        ? ` (${activeAcademicYear.term})`
                        : ""}
                </p>

                <p className="text-xs text-blue-600 mt-1">
                    Academic year is controlled globally from Settings.
                </p>

            </div>

            {/* =================================================
                ERROR / MESSAGE
                ================================================= */}

            {message && (
                <div className="mt-5 p-3 bg-gray-100 rounded-lg">
                    {message}
                </div>
            )}

            {/* =================================================
                FORM
                ================================================= */}

            <form
                onSubmit={updateClass}
                className="bg-white shadow rounded-xl p-6 mt-6"
            >

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* ACADEMIC LEVEL */}

                    <div>

                        <label className="block mb-2 font-medium">
                            Academic Level
                        </label>

                        <select
                            name="academic_level"
                            value={form.academic_level}
                            onChange={handleChange}
                            className="w-full border p-3 rounded-lg"
                            required
                        >

                            <option value="">
                                Select Level
                            </option>

                            <option value="Primary">
                                Primary
                            </option>

                            <option value="Secondary">
                                Secondary
                            </option>

                            <option value="Advanced">
                                Advanced
                            </option>

                        </select>

                    </div>

                    {/* CLASS NAME */}

                    <div>

                        <label className="block mb-2 font-medium">
                            Class Name
                        </label>

                        <input
                            name="class_name"
                            value={form.class_name}
                            onChange={handleChange}
                            placeholder="Class Name"
                            className="w-full border p-3 rounded-lg"
                            required
                        />

                    </div>

                    {/* SHORT NAME */}

                    <div>

                        <label className="block mb-2 font-medium">
                            Short Name
                        </label>

                        <input
                            name="short_name"
                            value={form.short_name}
                            onChange={handleChange}
                            placeholder="Short Name"
                            className="w-full border p-3 rounded-lg"
                        />

                    </div>

                </div>

                {/* =================================================
                    BUTTONS
                    ================================================= */}

                <div className="flex gap-4 mt-6">

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg"
                    >

                        {loading
                            ? "Updating..."
                            : "Update Class"}

                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/classes")
                        }
                        className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg"
                    >
                        Back
                    </button>

                </div>

            </form>

        </div>
    );
}

export default EditClass;