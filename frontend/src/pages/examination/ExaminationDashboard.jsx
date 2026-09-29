// frontend/src/pages/examination/ExaminationDashboard.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
    FaPlus,
    FaList,
    FaUpload,
    FaLayerGroup,
    FaCheckCircle,
    FaPen,
    FaChartBar,
    FaBookOpen,
    FaArrowRight,
    FaClipboardCheck,
    FaFileAlt,
    FaBrain
} from "react-icons/fa";

import { useSchool } from "../../context/SchoolContext";


// =====================================================
// API URL
// =====================================================

const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api";


function ExaminationDashboard() {

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

    const [error, setError] = useState("");


    // =====================================================
    // LOAD EXAMINATIONS
    //
    // Global Academic Year is the source of truth.
    // =====================================================

    useEffect(() => {

        if (academicYearLoading) {
            return;
        }


        if (!school?.id) {

            setExams([]);

            setLoading(false);

            setError(
                "School information is not available."
            );

            return;

        }


        if (!activeAcademicYearId) {

            setExams([]);

            setLoading(false);

            setError(
                "Active academic year is required."
            );

            return;

        }


        loadExams();

    }, [
        school?.id,
        activeAcademicYearId,
        academicYearLoading
    ]);


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
                    "Active academic year is required."
                );

                return;

            }


            // -------------------------------------------------
            // LOAD ONLY CURRENT SCHOOL + ACTIVE YEAR
            // -------------------------------------------------

            const response = await axios.get(
                `${API_URL}/exams`,
                {
                    params: {
                        school_id: Number(school.id),
                        academic_year_id:
                            Number(activeAcademicYearId)
                    }
                }
            );


            if (
                response.data &&
                response.data.success
            ) {

                setExams(
                    Array.isArray(
                        response.data.exams
                    )
                        ? response.data.exams
                        : []
                );

            } else {

                setExams([]);

                setError(
                    response.data?.message ||
                    "Unable to load examinations."
                );

            }

        } catch (err) {

            console.error(
                "EXAMINATION DASHBOARD ERROR:",
                err
            );


            setExams([]);


            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Unable to connect to Examination server."
            );

        } finally {

            setLoading(false);

        }

    };


    // =====================================================
    // LATEST EXAMINATION
    // =====================================================

    const latestExam = useMemo(() => {

        if (!exams.length) {
            return null;
        }


        return [...exams].sort((a, b) => {

            const dateA =
                new Date(
                    a.created_at || 0
                ).getTime();


            const dateB =
                new Date(
                    b.created_at || 0
                ).getTime();


            return dateB - dateA;

        })[0];

    }, [exams]);


    // =====================================================
    // SUMMARY
    // =====================================================

    const totalExams =
        exams.length;


    const approvedExams =
        exams.filter(
            (exam) =>
                String(
                    exam.status || ""
                )
                    .toLowerCase()
                    .includes("approved")
        ).length;


    const pendingExams =
        exams.filter((exam) => {

            const status =
                String(
                    exam.status || ""
                ).toLowerCase();


            return (
                !status.includes("approved") &&
                !status.includes("completed")
            );

        }).length;


    const completedExams =
        exams.filter((exam) =>
            String(
                exam.status || ""
            )
                .toLowerCase()
                .includes("completed")
        ).length;


    // =====================================================
    // NAVIGATION
    // =====================================================

    const openExamList = () => {

        navigate(
            "/examination/list"
        );

    };


    const openCreateExam = () => {

        navigate(
            "/examination/create"
        );

    };


    const openExamAction = (action) => {

        if (!latestExam?.id) {

            navigate(
                "/examination/list"
            );

            return;

        }


        navigate(
            `/examination/${latestExam.id}/${action}`
        );

    };


    /*
     * IMPORTANT:
     *
     * Classify Examination lazima kwanza iende
     * kwenye Examination Subjects.
     *
     * Hapa ndipo exam_id inaunganishwa na:
     *
     * subject_id
     * class_id
     * full_marks
     * pass_marks
     *
     * Bila exam_subjects, EnterMarks haiwezi kupata
     * class wala subject.
     */

    const openClassification = () => {

        if (!latestExam?.id) {

            navigate(
                "/examination/list"
            );

            return;

        }


        navigate(
            `/examination/${latestExam.id}/subjects`
        );

    };


    // =====================================================
    // ACTION CARDS
    // =====================================================

    const cards = [

        {
            title: "Create Examination",

            description:
                "Create a new examination and define its basic examination details.",

            icon: <FaPlus />,

            color: "blue",

            action: openCreateExam,

            button: "Create"
        },


        {
            title: "Upload Examination",

            description:
                "Upload the examination paper for the selected examination.",

            icon: <FaUpload />,

            color: "purple",

            action: () =>
                openExamAction("upload"),

            button: "Upload"
        },


        {
            title: "Classify Examination",

            description:
                "Assign classes and subjects to the examination and define marks before entering student marks.",

            icon: <FaLayerGroup />,

            color: "orange",

            action: openClassification,

            button: "Classify"
        },


        {
            title: "Approval Chain",

            description:
                "Process the examination through the required academic approval stages.",

            icon: <FaCheckCircle />,

            color: "green",

            action: () =>
                openExamAction("approval"),

            button: "Approve"
        },


        {
            title: "Enter Marks",

            description:
                "Select Class → Subject and enter student marks for the examination.",

            icon: <FaPen />,

            color: "indigo",

            action: () =>
                openExamAction("marks"),

            button: "Enter Marks"
        },


        {
            title: "Results",

            description:
                "View examination results and performance information after marks are entered.",

            icon: <FaClipboardCheck />,

            color: "teal",

            action: () =>
                openExamAction(
                    "results-analysis"
                ),

            button: "Results"
        },


        {
            title: "Analysis",

            description:
                "Analyze examination performance by subject, topic and student.",

            icon: <FaChartBar />,

            color: "rose",

            action: () =>
                openExamAction(
                    "results-analysis"
                ),

            button: "Analyze"
        }

    ];


    // =====================================================
    // COLORS
    // =====================================================

    const colorClasses = {

        blue: {

            icon:
                "bg-blue-100 text-blue-600",

            button:
                "bg-blue-600 hover:bg-blue-700"

        },


        purple: {

            icon:
                "bg-purple-100 text-purple-600",

            button:
                "bg-purple-600 hover:bg-purple-700"

        },


        orange: {

            icon:
                "bg-orange-100 text-orange-600",

            button:
                "bg-orange-600 hover:bg-orange-700"

        },


        green: {

            icon:
                "bg-green-100 text-green-600",

            button:
                "bg-green-600 hover:bg-green-700"

        },


        indigo: {

            icon:
                "bg-indigo-100 text-indigo-600",

            button:
                "bg-indigo-600 hover:bg-indigo-700"

        },


        teal: {

            icon:
                "bg-teal-100 text-teal-600",

            button:
                "bg-teal-600 hover:bg-teal-700"

        },


        rose: {

            icon:
                "bg-rose-100 text-rose-600",

            button:
                "bg-rose-600 hover:bg-rose-700"

        }

    };


    // =====================================================
    // RENDER
    // =====================================================

    return (

        <div className="space-y-6">


            {/* =====================================================
                HEADER
            ===================================================== */}

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                <div>

                    <div className="flex items-center gap-3">

                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">

                            <FaBookOpen />

                        </div>


                        <div>

                            <h1 className="text-2xl font-bold text-gray-900">

                                Examination

                            </h1>


                            <p className="text-sm text-gray-500">

                                Examination management workflow

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

                </div>


                <div className="flex gap-3">

                    <button
                        type="button"
                        onClick={openExamList}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >

                        <FaList />

                        All Examinations

                    </button>


                    <button
                        type="button"
                        onClick={openCreateExam}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >

                        <FaPlus />

                        Create Examination

                    </button>

                </div>

            </div>


            {/* =====================================================
                ERROR
            ===================================================== */}

            {error && (

                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between">

                    <span>

                        {error}

                    </span>


                    <button
                        type="button"
                        onClick={loadExams}
                        className="font-semibold underline"
                    >

                        Retry

                    </button>

                </div>

            )}


            {/* =====================================================
                ACADEMIC YEAR LOADING
            ===================================================== */}

            {academicYearLoading && (

                <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-500">

                    Loading academic year...

                </div>

            )}


            {/* =====================================================
                SUMMARY
            ===================================================== */}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                <div className="bg-white border border-gray-200 rounded-2xl p-5">

                    <div className="flex items-center justify-between">

                        <div>

                            <p className="text-sm text-gray-500">

                                Total Examinations

                            </p>


                            <p className="text-2xl font-bold text-gray-900 mt-1">

                                {loading
                                    ? "..."
                                    : totalExams}

                            </p>

                        </div>


                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">

                            <FaFileAlt />

                        </div>

                    </div>

                </div>


                <div className="bg-white border border-gray-200 rounded-2xl p-5">

                    <div className="flex items-center justify-between">

                        <div>

                            <p className="text-sm text-gray-500">

                                Pending

                            </p>


                            <p className="text-2xl font-bold text-orange-600 mt-1">

                                {loading
                                    ? "..."
                                    : pendingExams}

                            </p>

                        </div>


                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">

                            <FaClipboardCheck />

                        </div>

                    </div>

                </div>


                <div className="bg-white border border-gray-200 rounded-2xl p-5">

                    <div className="flex items-center justify-between">

                        <div>

                            <p className="text-sm text-gray-500">

                                Approved

                            </p>


                            <p className="text-2xl font-bold text-green-600 mt-1">

                                {loading
                                    ? "..."
                                    : approvedExams}

                            </p>

                        </div>


                        <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">

                            <FaCheckCircle />

                        </div>

                    </div>

                </div>


                <div className="bg-white border border-gray-200 rounded-2xl p-5">

                    <div className="flex items-center justify-between">

                        <div>

                            <p className="text-sm text-gray-500">

                                Completed

                            </p>


                            <p className="text-2xl font-bold text-indigo-600 mt-1">

                                {loading
                                    ? "..."
                                    : completedExams}

                            </p>

                        </div>


                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">

                            <FaChartBar />

                        </div>

                    </div>

                </div>

            </div>


            {/* =====================================================
                WORKFLOW
            ===================================================== */}

            <div className="bg-white border border-gray-200 rounded-2xl p-5">

                <div className="flex items-center gap-2 mb-5">

                    <FaBrain className="text-blue-600" />


                    <div>

                        <h2 className="font-bold text-gray-900">

                            Examination Workflow

                        </h2>


                        <p className="text-sm text-gray-500">

                            Follow the examination from creation to analysis.

                        </p>

                    </div>

                </div>


                <div className="flex flex-wrap items-center gap-2 text-sm">

                    <span className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium">

                        1. Create

                    </span>


                    <FaArrowRight className="text-gray-300" />


                    <span className="px-3 py-2 rounded-lg bg-purple-50 text-purple-700 font-medium">

                        2. Upload

                    </span>


                    <FaArrowRight className="text-gray-300" />


                    <span className="px-3 py-2 rounded-lg bg-orange-50 text-orange-700 font-medium">

                        3. Classify

                    </span>


                    <FaArrowRight className="text-gray-300" />


                    <span className="px-3 py-2 rounded-lg bg-green-50 text-green-700 font-medium">

                        4. Approval

                    </span>


                    <FaArrowRight className="text-gray-300" />


                    <span className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-medium">

                        5. Marks

                    </span>


                    <FaArrowRight className="text-gray-300" />


                    <span className="px-3 py-2 rounded-lg bg-teal-50 text-teal-700 font-medium">

                        6. Results

                    </span>


                    <FaArrowRight className="text-gray-300" />


                    <span className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 font-medium">

                        7. Analysis

                    </span>

                </div>

            </div>


            {/* =====================================================
                MAIN ACTION CARDS
            ===================================================== */}

            <div>

                <div className="flex items-center justify-between mb-4">

                    <div>

                        <h2 className="text-lg font-bold text-gray-900">

                            Examination Management

                        </h2>


                        <p className="text-sm text-gray-500">

                            Select an operation to continue.

                        </p>

                    </div>


                    {latestExam && (

                        <div className="text-right hidden md:block">

                            <p className="text-xs text-gray-400">

                                Latest Examination

                            </p>


                            <p className="text-sm font-semibold text-gray-800">

                                {
                                    latestExam.exam_name ||
                                    latestExam.name ||
                                    "Unnamed Examination"
                                }

                            </p>

                        </div>

                    )}

                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                    {cards.map((card) => {

                        const colors =
                            colorClasses[
                                card.color
                            ];


                        return (

                            <div
                                key={card.title}
                                className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow"
                            >

                                <div className="flex items-start justify-between gap-4">

                                    <div
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg ${colors.icon}`}
                                    >

                                        {card.icon}

                                    </div>

                                </div>


                                <h3 className="font-bold text-gray-900 mt-4">

                                    {card.title}

                                </h3>


                                <p className="text-sm text-gray-500 mt-2 leading-6 min-h-[72px]">

                                    {card.description}

                                </p>


                                <button
                                    type="button"
                                    onClick={card.action}
                                    className={`mt-4 w-full text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors ${colors.button}`}
                                >

                                    {card.button}

                                    <FaArrowRight className="text-xs" />

                                </button>

                            </div>

                        );

                    })}

                </div>

            </div>


            {/* =====================================================
                LATEST EXAM
            ===================================================== */}

            {latestExam && (

                <div className="bg-white border border-gray-200 rounded-2xl p-5">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>

                            <p className="text-xs uppercase tracking-wide text-gray-400">

                                Latest Examination

                            </p>


                            <h2 className="text-xl font-bold text-gray-900 mt-1">

                                {
                                    latestExam.exam_name ||
                                    latestExam.name ||
                                    "Unnamed Examination"
                                }

                            </h2>


                            <div className="flex flex-wrap gap-2 mt-3">

                                {latestExam.exam_type && (

                                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">

                                        {latestExam.exam_type}

                                    </span>

                                )}


                                {latestExam.term && (

                                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">

                                        {latestExam.term}

                                    </span>

                                )}


                                {latestExam.status && (

                                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">

                                        {latestExam.status}

                                    </span>

                                )}

                            </div>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    `/examination/${latestExam.id}`
                                )
                            }
                            className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center gap-2"
                        >

                            Open Examination

                            <FaArrowRight />

                        </button>

                    </div>

                </div>

            )}


            {/* =====================================================
                EMPTY STATE
            ===================================================== */}

            {!academicYearLoading &&
                !loading &&
                exams.length === 0 &&
                !error && (

                    <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">

                        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">

                            <FaBookOpen />

                        </div>


                        <h2 className="font-bold text-gray-900 mt-4">

                            No Examination Created

                        </h2>


                        <p className="text-sm text-gray-500 mt-2">

                            Start the examination workflow by creating your first examination.

                        </p>


                        <button
                            type="button"
                            onClick={openCreateExam}
                            className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-2"
                        >

                            <FaPlus />

                            Create Examination

                        </button>

                    </div>

                )}

        </div>

    );

}


export default ExaminationDashboard;