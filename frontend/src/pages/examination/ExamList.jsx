import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
    FaArrowLeft,
    FaEye,
    FaPlus,
    FaTrash,
    FaSpinner,
    FaSearch
} from "react-icons/fa";

import { useSchool } from "../../context/SchoolContext";


function ExamList() {

    const navigate = useNavigate();

    // =====================================================
    // GLOBAL SCHOOL / ACADEMIC YEAR
    // =====================================================

    const {
        school,
        activeAcademicYearId,
        activeAcademicYearName,
        academicYearLoading
    } = useSchool();


    // =====================================================
    // STATE
    // =====================================================

    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");


    // =====================================================
    // API
    // =====================================================

    const API_BASE_URL =
        import.meta.env.VITE_API_URL ||
        "https://africore-erp-pro.onrender.com/api";


    const API_URL = API_BASE_URL.endsWith("/exams")
        ? API_BASE_URL
        : `${API_BASE_URL.replace(/\/$/, "")}/exams`;


    // =====================================================
    // LOAD EXAMINATIONS
    //
    // Global Academic Year is the source of truth.
    // School is also included to keep examinations
    // correctly scoped.
    // =====================================================

    useEffect(() => {

        if (academicYearLoading) {
            return;
        }

        if (!school?.id) {
            setExams([]);
            setLoading(false);
            setError("School information is not available.");
            return;
        }

        if (!activeAcademicYearId) {
            setExams([]);
            setLoading(false);
            setError(
                "No active academic year is currently selected."
            );
            return;
        }

        loadExams();

    }, [
        school?.id,
        activeAcademicYearId,
        academicYearLoading
    ]);


    // =====================================================
    // LOAD EXAMS
    // =====================================================

    const loadExams = async () => {

        try {

            setLoading(true);
            setError("");


            // -------------------------------------------------
            // SAFETY CHECK
            // -------------------------------------------------

            if (!school?.id) {
                setExams([]);
                setError(
                    "School information is not available."
                );
                return;
            }


            if (!activeAcademicYearId) {
                setExams([]);
                setError(
                    "No active academic year is currently selected."
                );
                return;
            }


            // -------------------------------------------------
            // GLOBAL SCHOOL + ACADEMIC YEAR SCOPE
            // -------------------------------------------------

            const params = {
                school_id: Number(school.id),
                academic_year_id:
                    Number(activeAcademicYearId)
            };


            console.log(
                "EXAM LIST REQUEST:",
                API_URL,
                params
            );


            const response =
                await axios.get(
                    API_URL,
                    {
                        params
                    }
                );


            // -------------------------------------------------
            // API RESPONSE
            // -------------------------------------------------

            if (response.data?.success) {

                setExams(
                    Array.isArray(response.data.exams)
                        ? response.data.exams
                        : []
                );

            } else {

                throw new Error(
                    response.data?.message ||
                    "Failed to load examinations."
                );

            }

        } catch (error) {

            console.error(
                "EXAM LIST ERROR:",
                error
            );

            setExams([]);

            setError(
                error?.response?.data?.message ||
                error?.message ||
                "Failed to load examinations."
            );

        } finally {

            setLoading(false);

        }

    };


    // =====================================================
    // DELETE EXAMINATION
    // =====================================================

    const handleDelete = async (id) => {

        const confirmed =
            window.confirm(
                "Are you sure you want to delete this examination?"
            );


        if (!confirmed) {
            return;
        }


        try {

            setDeletingId(id);
            setError("");


            // -------------------------------------------------
            // SAFETY CHECK
            // -------------------------------------------------

            if (!school?.id) {
                throw new Error(
                    "School information is not available."
                );
            }


            if (!activeAcademicYearId) {
                throw new Error(
                    "No active academic year is currently selected."
                );
            }


            // -------------------------------------------------
            // DELETE WITH GLOBAL SCOPE
            // -------------------------------------------------

            const response =
                await axios.delete(
                    `${API_URL}/${id}`,
                    {
                        params: {
                            school_id:
                                Number(school.id),

                            academic_year_id:
                                Number(activeAcademicYearId)
                        }
                    }
                );


            if (!response.data?.success) {

                throw new Error(
                    response.data?.message ||
                    "Failed to delete examination."
                );

            }


            // -------------------------------------------------
            // REMOVE FROM CURRENT UI
            // -------------------------------------------------

            setExams((current) =>
                current.filter(
                    (exam) =>
                        String(exam.id) !==
                        String(id)
                )
            );


        } catch (error) {

            console.error(
                "DELETE EXAM ERROR:",
                error
            );


            setError(
                error?.response?.data?.message ||
                error?.message ||
                "Failed to delete examination."
            );

        } finally {

            setDeletingId(null);

        }

    };


    // =====================================================
    // SEARCH
    // =====================================================

    const filteredExams =
        exams.filter((exam) => {

            const text = [

                exam.name,

                exam.exam_name,

                exam.examType,

                exam.exam_type,

                exam.term,

                exam.academicYear,

                exam.academic_year

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return text.includes(
                search.toLowerCase()
            );

        });


    // =====================================================
    // RENDER
    // =====================================================

    return (

        <div className="max-w-7xl mx-auto space-y-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                <div className="flex items-center gap-4">

                    <button
                        onClick={() =>
                            navigate("/examination")
                        }
                        className="w-10 h-10 rounded-xl border bg-white flex items-center justify-center hover:bg-gray-50"
                    >
                        <FaArrowLeft />
                    </button>


                    <div>

                        <h1 className="text-2xl font-bold text-gray-900">
                            Examination List
                        </h1>


                        <p className="text-gray-500">
                            View and manage all examinations.
                        </p>


                        {/* -----------------------------------------
                            ACTIVE ACADEMIC YEAR
                        ----------------------------------------- */}

                        {activeAcademicYearName && (

                            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">

                                Academic Year:

                                <span className="ml-1">
                                    {activeAcademicYearName}
                                </span>

                            </div>

                        )}

                    </div>

                </div>


                <button
                    onClick={() =>
                        navigate("/examination/create")
                    }
                    className="px-5 py-3 rounded-xl bg-blue-600 text-white flex items-center justify-center gap-2 hover:bg-blue-700"
                >
                    <FaPlus />
                    Create Examination
                </button>

            </div>


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                    {error}
                </div>

            )}


            {/* =================================================
                SEARCH
            ================================================= */}

            <div className="bg-white border rounded-2xl p-4 shadow-sm">

                <div className="relative">

                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />


                    <input
                        type="text"
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                        placeholder="Search examination..."
                        className="w-full border rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                </div>

            </div>


            {/* =================================================
                GLOBAL ACADEMIC YEAR LOADING
            ================================================= */}

            {academicYearLoading && (

                <div className="bg-white border rounded-2xl p-12 text-center">

                    <FaSpinner className="animate-spin text-3xl text-blue-600 mx-auto mb-4" />

                    <p className="text-gray-500">
                        Loading academic year...
                    </p>

                </div>

            )}


            {/* =================================================
                EXAMINATION LOADING
            ================================================= */}

            {!academicYearLoading &&
                loading && (

                    <div className="bg-white border rounded-2xl p-12 text-center">

                        <FaSpinner className="animate-spin text-3xl text-blue-600 mx-auto mb-4" />

                        <p className="text-gray-500">
                            Loading examinations...
                        </p>

                    </div>

                )}


            {/* =================================================
                EMPTY
            ================================================= */}

            {!academicYearLoading &&
                !loading &&
                filteredExams.length === 0 && (

                    <div className="bg-white border rounded-2xl p-12 text-center">

                        <h2 className="text-lg font-bold text-gray-800 mb-2">
                            No examinations found
                        </h2>


                        <p className="text-gray-500 mb-5">

                            {activeAcademicYearName
                                ? `No examinations found for academic year ${activeAcademicYearName}.`
                                : "Create an examination to see it here."
                            }

                        </p>


                        <button
                            onClick={() =>
                                navigate(
                                    "/examination/create"
                                )
                            }
                            className="px-5 py-3 rounded-xl bg-blue-600 text-white inline-flex items-center gap-2"
                        >
                            <FaPlus />
                            Create Examination
                        </button>

                    </div>

                )}


            {/* =================================================
                TABLE
            ================================================= */}

            {!academicYearLoading &&
                !loading &&
                filteredExams.length > 0 && (

                    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">

                        <div className="overflow-x-auto">

                            <table className="w-full">

                                <thead className="bg-gray-50 border-b">

                                    <tr>

                                        <th className="text-left px-5 py-4 text-sm font-semibold text-gray-600">
                                            #
                                        </th>


                                        <th className="text-left px-5 py-4 text-sm font-semibold text-gray-600">
                                            Examination
                                        </th>


                                        <th className="text-left px-5 py-4 text-sm font-semibold text-gray-600">
                                            Type
                                        </th>


                                        <th className="text-left px-5 py-4 text-sm font-semibold text-gray-600">
                                            Academic Year
                                        </th>


                                        <th className="text-left px-5 py-4 text-sm font-semibold text-gray-600">
                                            Term
                                        </th>


                                        <th className="text-right px-5 py-4 text-sm font-semibold text-gray-600">
                                            Actions
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {filteredExams.map(
                                        (exam, index) => {

                                            const name =
                                                exam.name ||
                                                exam.exam_name ||
                                                "Unnamed Examination";


                                            const type =
                                                exam.examType ||
                                                exam.exam_type ||
                                                "-";


                                            const academicYear =
                                                exam.academicYear ||
                                                exam.academic_year ||
                                                activeAcademicYearName ||
                                                "-";


                                            const term =
                                                exam.term ||
                                                "-";


                                            return (

                                                <tr
                                                    key={exam.id}
                                                    className="border-b last:border-b-0 hover:bg-gray-50"
                                                >

                                                    <td className="px-5 py-4 text-sm text-gray-500">
                                                        {index + 1}
                                                    </td>


                                                    <td className="px-5 py-4">

                                                        <div className="font-semibold text-gray-900">
                                                            {name}
                                                        </div>


                                                        <div className="text-xs text-gray-400 mt-1">
                                                            ID: {exam.id}
                                                        </div>

                                                    </td>


                                                    <td className="px-5 py-4">

                                                        <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                                            {type}
                                                        </span>

                                                    </td>


                                                    <td className="px-5 py-4 text-sm text-gray-700">
                                                        {academicYear}
                                                    </td>


                                                    <td className="px-5 py-4 text-sm text-gray-700">
                                                        {term}
                                                    </td>


                                                    <td className="px-5 py-4">

                                                        <div className="flex justify-end gap-2">

                                                            {/* VIEW */}

                                                            <button
                                                                onClick={() =>
                                                                    navigate(
                                                                        `/examination/${exam.id}`
                                                                    )
                                                                }
                                                                className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100"
                                                                title="View Examination"
                                                            >
                                                                <FaEye />
                                                            </button>


                                                            {/* DELETE */}

                                                            <button
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        exam.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    deletingId ===
                                                                    exam.id
                                                                }
                                                                className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 disabled:opacity-50"
                                                                title="Delete Examination"
                                                            >

                                                                {deletingId ===
                                                                exam.id ? (

                                                                    <FaSpinner className="animate-spin" />

                                                                ) : (

                                                                    <FaTrash />

                                                                )}

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

                    </div>

                )}

        </div>

    );

}


export default ExamList;
