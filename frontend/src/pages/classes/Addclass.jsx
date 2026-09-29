import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

function Addclass() {
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

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // =====================================================
    // CLASS DATA
    // =====================================================

    const [classData, setClassData] = useState({
        class_name: "",
        academic_level: "",
        short_name: "",
    });

    // =====================================================
    // HANDLE CHANGE
    // =====================================================

    const handleChange = (e) => {
        const {
            name,
            value,
        } = e.target;

        setClassData({
            ...classData,
            [name]: value,
        });
    };

    // =====================================================
    // SAVE CLASS
    // =====================================================

    const saveClass = async (e) => {
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
        // VALIDATE CLASS NAME
        // =================================================

        if (!classData.class_name.trim()) {
            setMessage("Please enter class name.");

            return;
        }

        // =================================================
        // VALIDATE ACADEMIC LEVEL
        // =================================================

        if (!classData.academic_level) {
            setMessage("Please select academic level.");

            return;
        }

        setLoading(true);

        // =================================================
        // PAYLOAD
        // =================================================

        const payload = {
            class_name:
                classData.class_name.trim(),

            academic_level:
                classData.academic_level,

            short_name:
                classData.short_name.trim() || null,

            school_id:
                schoolId,

            academic_year_id:
                activeAcademicYearId,
        };

        console.log(
            "CLASS PAYLOAD:",
            payload
        );

        // =================================================
        // INSERT
        // =================================================

        const {
            data,
            error,
        } = await supabase
            .from("classes")
            .insert([payload])
            .select();

        console.log(
            "CLASS RESULT:",
            data
        );

        console.log(
            "CLASS ERROR:",
            error
        );

        // =================================================
        // ERROR
        // =================================================

        if (error) {
            console.error(
                "ADD CLASS ERROR:",
                error
            );

            setMessage(
                error.message
            );

            setLoading(false);

            return;
        }

        // =================================================
        // SUCCESS
        // =================================================

        setMessage(
            "Class added successfully ✅"
        );

        setTimeout(() => {
            navigate("/classes");
        }, 1000);

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
                    Add New Class
                </h1>

                <p className="text-gray-600 mt-2">
                    Create class in AfriCore ERP PRO
                </p>

                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 mt-6">

                    <h2 className="font-semibold">
                        No Active Academic Year
                    </h2>

                    <p className="text-sm mt-2">
                        {academicYearError ||
                            "Please activate an academic year in Settings before creating a class."}
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
    // FORM
    // =====================================================

    return (
        <div className="p-6">

            <h1 className="text-3xl font-bold text-gray-800">
                Add New Class
            </h1>

            <p className="text-gray-600 mt-2">
                Create class in AfriCore ERP PRO
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

            </div>

            {/* =================================================
                FORM
                ================================================= */}

            <form
                onSubmit={saveClass}
                className="bg-white shadow rounded-xl p-6 mt-6"
            >

                <div className="grid md:grid-cols-2 gap-5">

                    {/* CLASS NAME */}

                    <div>

                        <label className="block mb-2 font-medium">
                            Class Name
                        </label>

                        <input
                            type="text"
                            name="class_name"
                            value={classData.class_name}
                            onChange={handleChange}
                            placeholder="Example: Form One"
                            required
                            className="w-full border p-3 rounded-lg"
                        />

                    </div>

                    {/* ACADEMIC LEVEL */}

                    <div>

                        <label className="block mb-2 font-medium">
                            Academic Level
                        </label>

                        <select
                            name="academic_level"
                            value={classData.academic_level}
                            onChange={handleChange}
                            required
                            className="w-full border p-3 rounded-lg"
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

                    {/* SHORT NAME */}

                    <div>

                        <label className="block mb-2 font-medium">
                            Short Name
                        </label>

                        <input
                            type="text"
                            name="short_name"
                            value={classData.short_name}
                            onChange={handleChange}
                            placeholder="Example: F1"
                            className="w-full border p-3 rounded-lg"
                        />

                    </div>

                </div>

                {/* =================================================
                    MESSAGE
                    ================================================= */}

                {message && (
                    <div className="mt-5 bg-gray-100 p-3 rounded-lg">
                        {message}
                    </div>
                )}

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
                            ? "Saving..."
                            : "Save Class"}

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

export default Addclass;