// frontend/src/pages/examination/ExaminationDashboard.jsx

import { useEffect, useState } from "react";
import axios from "axios";

import {
    FaFileAlt,
    FaPlus,
    FaChartBar,
    FaCheckCircle,
    FaClock,
    FaEye,
    FaEdit,
    FaUpload,
    FaRobot,
    FaClipboardCheck,
    FaPen,
    FaGraduationCap,
    FaChevronDown,
    FaChevronUp,
    FaCalendarAlt,
    FaTrophy,
    FaTimes
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";


// =====================================
// API
// =====================================

const API_URL = "http://localhost:5000/api/exams";


// =====================================
// EXAMINATION DASHBOARD
// =====================================

function ExaminationDashboard() {

    const navigate = useNavigate();


    // =====================================
    // STATES
    // =====================================

    const [exams, setExams] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [expandedExamId, setExpandedExamId] = useState(null);



    // =====================================
    // FETCH EXAMS
    // =====================================

    const fetchExams = async () => {

        try {

            setLoading(true);

            setError("");

            const response = await axios.get(API_URL);

            setExams(
                response.data?.exams || []
            );

        }

        catch (err) {

            console.error(
                "EXAM DASHBOARD ERROR:",
                err
            );

            setError(
                "Failed to load examination data"
            );

        }

        finally {

            setLoading(false);

        }

    };



    // =====================================
    // LOAD EXAMS
    // =====================================

    useEffect(() => {

        fetchExams();

    }, []);



    // =====================================
    // EXPAND / COLLAPSE
    // =====================================

    const toggleExam = (examId) => {

        setExpandedExamId(
            currentId =>
                currentId === examId
                    ? null
                    : examId
        );

    };



    // =====================================
    // STATISTICS
    // =====================================

    const totalExams =
        exams.length;


    const draftExams =
        exams.filter(
            exam =>
                exam.status === "Draft"
        ).length;


    const completedExams =
        exams.filter(
            exam =>
                exam.ai_status === "Completed"
        ).length;



    // =====================================
    // ACTION BUTTON
    // =====================================

    const ActionButton = ({
        icon,
        label,
        color,
        onClick
    }) => {

        return (

            <button
                type="button"
                onClick={(event) => {

                    event.stopPropagation();

                    onClick();

                }}
                className={`
                    flex
                    items-center
                    justify-center
                    gap-2
                    px-3
                    py-2.5
                    rounded-lg
                    text-sm
                    font-semibold
                    transition
                    duration-200
                    ${color}
                    hover:shadow-md
                    active:scale-95
                `}
            >

                {icon}

                <span>
                    {label}
                </span>

            </button>

        );

    };



    // =====================================
    // STATUS COLOR
    // =====================================

    const getStatusClass = (status) => {

        if (status === "Approved") {

            return "bg-green-100 text-green-700";

        }

        if (status === "Completed") {

            return "bg-blue-100 text-blue-700";

        }

        if (status === "Rejected") {

            return "bg-red-100 text-red-700";

        }

        return "bg-yellow-100 text-yellow-700";

    };



    // =====================================
    // AI STATUS COLOR
    // =====================================

    const getAIStatusClass = (status) => {

        if (status === "Completed") {

            return "text-green-600";

        }

        if (status === "Failed") {

            return "text-red-600";

        }

        return "text-orange-600";

    };



    // =====================================
    // PAGE
    // =====================================

    return (

        <div className="space-y-6">


            {/* =====================================
                HEADER
            ===================================== */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    shadow-sm
                    border
                    border-gray-100
                    p-6
                "
            >

                <div
                    className="
                        flex
                        flex-col
                        lg:flex-row
                        lg:items-center
                        lg:justify-between
                        gap-4
                    "
                >

                    <div>

                        <div
                            className="
                                flex
                                items-center
                                gap-3
                            "
                        >

                            <div
                                className="
                                    bg-blue-100
                                    text-blue-600
                                    p-3
                                    rounded-xl
                                "
                            >

                                <FaFileAlt />

                            </div>


                            <div>

                                <h1
                                    className="
                                        text-2xl
                                        font-bold
                                        text-gray-800
                                    "
                                >
                                    Examination Management
                                </h1>


                                <p
                                    className="
                                        text-gray-500
                                        mt-1
                                    "
                                >
                                    Manage examinations,
                                    papers, AI analysis,
                                    approval, marks and
                                    results.
                                </p>

                            </div>

                        </div>

                    </div>



                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/examination/create"
                            )
                        }
                        className="
                            bg-blue-600
                            hover:bg-blue-700
                            text-white
                            px-5
                            py-3
                            rounded-xl
                            flex
                            items-center
                            justify-center
                            gap-2
                            font-semibold
                            transition
                            shadow-sm
                        "
                    >

                        <FaPlus />

                        Create Exam

                    </button>

                </div>

            </div>



            {/* =====================================
                ERROR
            ===================================== */}

            {error && (

                <div
                    className="
                        bg-red-50
                        border
                        border-red-200
                        text-red-700
                        px-5
                        py-4
                        rounded-xl
                        flex
                        items-center
                        justify-between
                    "
                >

                    <span>
                        {error}
                    </span>


                    <button
                        type="button"
                        onClick={() =>
                            setError("")
                        }
                        className="
                            text-red-500
                            hover:text-red-700
                        "
                    >

                        <FaTimes />

                    </button>

                </div>

            )}



            {/* =====================================
                STATISTICS
            ===================================== */}

            <div
                className="
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    lg:grid-cols-4
                    gap-5
                "
            >


                {/* TOTAL */}

                <div
                    className="
                        bg-white
                        border
                        border-gray-100
                        shadow-sm
                        rounded-2xl
                        p-5
                    "
                >

                    <div
                        className="
                            flex
                            items-center
                            justify-between
                        "
                    >

                        <div>

                            <p
                                className="
                                    text-gray-500
                                    text-sm
                                "
                            >
                                Total Exams
                            </p>


                            <h2
                                className="
                                    text-3xl
                                    font-bold
                                    text-gray-800
                                    mt-2
                                "
                            >

                                {totalExams}

                            </h2>

                        </div>


                        <div
                            className="
                                bg-blue-100
                                text-blue-600
                                p-4
                                rounded-xl
                            "
                        >

                            <FaFileAlt />

                        </div>

                    </div>

                </div>



                {/* DRAFT */}

                <div
                    className="
                        bg-white
                        border
                        border-gray-100
                        shadow-sm
                        rounded-2xl
                        p-5
                    "
                >

                    <div
                        className="
                            flex
                            items-center
                            justify-between
                        "
                    >

                        <div>

                            <p
                                className="
                                    text-gray-500
                                    text-sm
                                "
                            >
                                Draft Exams
                            </p>


                            <h2
                                className="
                                    text-3xl
                                    font-bold
                                    text-gray-800
                                    mt-2
                                "
                            >

                                {draftExams}

                            </h2>

                        </div>


                        <div
                            className="
                                bg-yellow-100
                                text-yellow-600
                                p-4
                                rounded-xl
                            "
                        >

                            <FaClock />

                        </div>

                    </div>

                </div>



                {/* AI COMPLETED */}

                <div
                    className="
                        bg-white
                        border
                        border-gray-100
                        shadow-sm
                        rounded-2xl
                        p-5
                    "
                >

                    <div
                        className="
                            flex
                            items-center
                            justify-between
                        "
                    >

                        <div>

                            <p
                                className="
                                    text-gray-500
                                    text-sm
                                "
                            >
                                AI Completed
                            </p>


                            <h2
                                className="
                                    text-3xl
                                    font-bold
                                    text-gray-800
                                    mt-2
                                "
                            >

                                {completedExams}

                            </h2>

                        </div>


                        <div
                            className="
                                bg-green-100
                                text-green-600
                                p-4
                                rounded-xl
                            "
                        >

                            <FaCheckCircle />

                        </div>

                    </div>

                </div>



                {/* RESULTS */}

                <div
                    className="
                        bg-white
                        border
                        border-gray-100
                        shadow-sm
                        rounded-2xl
                        p-5
                    "
                >

                    <div
                        className="
                            flex
                            items-center
                            justify-between
                        "
                    >

                        <div>

                            <p
                                className="
                                    text-gray-500
                                    text-sm
                                "
                            >
                                Results Analysis
                            </p>


                            <h2
                                className="
                                    text-lg
                                    font-bold
                                    text-green-600
                                    mt-2
                                "
                            >

                                Ready

                            </h2>

                        </div>


                        <div
                            className="
                                bg-purple-100
                                text-purple-600
                                p-4
                                rounded-xl
                            "
                        >

                            <FaChartBar />

                        </div>

                    </div>

                </div>

            </div>



            {/* =====================================
                QUICK ACTIONS
            ===================================== */}

            <div
                className="
                    bg-white
                    border
                    border-gray-100
                    rounded-2xl
                    shadow-sm
                    p-6
                "
            >

                <h2
                    className="
                        text-lg
                        font-bold
                        text-gray-800
                        mb-4
                    "
                >
                    Quick Actions
                </h2>


                <div
                    className="
                        grid
                        grid-cols-1
                        sm:grid-cols-2
                        lg:grid-cols-4
                        gap-4
                    "
                >

                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/examination/list"
                            )
                        }
                        className="
                            bg-gray-100
                            hover:bg-gray-200
                            p-4
                            rounded-xl
                            flex
                            items-center
                            gap-3
                            text-gray-700
                            font-semibold
                        "
                    >

                        <FaFileAlt />

                        View Exams

                    </button>



                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/examination/create"
                            )
                        }
                        className="
                            bg-blue-100
                            hover:bg-blue-200
                            text-blue-700
                            p-4
                            rounded-xl
                            flex
                            items-center
                            gap-3
                            font-semibold
                        "
                    >

                        <FaPlus />

                        Create New

                    </button>



                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/examination/list"
                            )
                        }
                        className="
                            bg-green-100
                            hover:bg-green-200
                            text-green-700
                            p-4
                            rounded-xl
                            flex
                            items-center
                            gap-3
                            font-semibold
                        "
                    >

                        <FaRobot />

                        AI Analysis

                    </button>



                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/examination/list"
                            )
                        }
                        className="
                            bg-purple-100
                            hover:bg-purple-200
                            text-purple-700
                            p-4
                            rounded-xl
                            flex
                            items-center
                            gap-3
                            font-semibold
                        "
                    >

                        <FaClipboardCheck />

                        Approval

                    </button>

                </div>

            </div>



            {/* =====================================
                RECENT EXAMS
            ===================================== */}

            <div
                className="
                    bg-white
                    border
                    border-gray-100
                    rounded-2xl
                    shadow-sm
                    overflow-hidden
                "
            >

                <div
                    className="
                        px-6
                        py-5
                        border-b
                        border-gray-100
                    "
                >

                    <h2
                        className="
                            text-lg
                            font-bold
                            text-gray-800
                        "
                    >
                        Recent Examinations
                    </h2>


                    <p
                        className="
                            text-sm
                            text-gray-500
                            mt-1
                        "
                    >
                        Click an examination to view
                        its details and actions.
                    </p>

                </div>



                {/* =====================================
                    LOADING
                ===================================== */}

                {loading && (

                    <div
                        className="
                            p-10
                            text-center
                            text-gray-500
                        "
                    >

                        Loading examinations...

                    </div>

                )}



                {/* =====================================
                    EMPTY
                ===================================== */}

                {!loading &&
                    exams.length === 0 && (

                        <div
                            className="
                                p-10
                                text-center
                                text-gray-500
                            "
                        >

                            <FaFileAlt
                                className="
                                    mx-auto
                                    text-4xl
                                    text-gray-300
                                    mb-3
                                "
                            />

                            <p>
                                No examinations found.
                            </p>


                            <button
                                type="button"
                                onClick={() =>
                                    navigate(
                                        "/examination/create"
                                    )
                                }
                                className="
                                    mt-4
                                    bg-blue-600
                                    text-white
                                    px-4
                                    py-2
                                    rounded-lg
                                "
                            >

                                Create First Exam

                            </button>

                        </div>

                    )}



                {/* =====================================
                    EXAM LIST
                ===================================== */}

                {!loading &&
                    exams.length > 0 && (

                        <div
                            className="
                                divide-y
                                divide-gray-100
                            "
                        >

                            {exams.map((exam) => {

                                const isExpanded =
                                    expandedExamId ===
                                    exam.id;


                                return (

                                    <div
                                        key={exam.id}
                                        className="
                                            bg-white
                                        "
                                    >

                                        {/* =====================================
                                            COMPACT EXAM ROW
                                        ===================================== */}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleExam(
                                                    exam.id
                                                )
                                            }
                                            className="
                                                w-full
                                                text-left
                                                px-6
                                                py-5
                                                hover:bg-gray-50
                                                transition
                                                duration-200
                                            "
                                        >

                                            <div
                                                className="
                                                    flex
                                                    items-center
                                                    gap-4
                                                "
                                            >

                                                {/* ICON */}

                                                <div
                                                    className="
                                                        bg-blue-100
                                                        text-blue-600
                                                        p-3
                                                        rounded-xl
                                                        flex-shrink-0
                                                    "
                                                >

                                                    <FaFileAlt />

                                                </div>



                                                {/* NAME */}

                                                <div
                                                    className="
                                                        flex-1
                                                        min-w-0
                                                    "
                                                >

                                                    <div
                                                        className="
                                                            flex
                                                            flex-col
                                                            sm:flex-row
                                                            sm:items-center
                                                            gap-2
                                                        "
                                                    >

                                                        <h3
                                                            className="
                                                                font-bold
                                                                text-gray-800
                                                                truncate
                                                            "
                                                        >

                                                            {exam.exam_name ||
                                                                "Unnamed Examination"}

                                                        </h3>


                                                        <span
                                                            className={`
                                                                self-start
                                                                px-2.5
                                                                py-1
                                                                rounded-full
                                                                text-xs
                                                                font-semibold
                                                                ${getStatusClass(
                                                                    exam.status
                                                                )}
                                                            `}
                                                        >

                                                            {exam.status ||
                                                                "Draft"}

                                                        </span>

                                                    </div>



                                                    <p
                                                        className="
                                                            text-sm
                                                            text-gray-500
                                                            mt-1
                                                        "
                                                    >

                                                        {exam.exam_type ||
                                                            "N/A"}

                                                        {" • "}

                                                        {exam.term ||
                                                            "N/A"}

                                                        {" • "}

                                                        Exam ID: {exam.id}

                                                    </p>

                                                </div>



                                                {/* DATE */}

                                                <div
                                                    className="
                                                        hidden
                                                        md:flex
                                                        items-center
                                                        gap-2
                                                        text-sm
                                                        text-gray-500
                                                    "
                                                >

                                                    <FaCalendarAlt />

                                                    {exam.start_date ||
                                                        "-"}

                                                </div>



                                                {/* CHEVRON */}

                                                <div
                                                    className="
                                                        text-gray-400
                                                        flex-shrink-0
                                                    "
                                                >

                                                    {isExpanded
                                                        ? <FaChevronUp />
                                                        : <FaChevronDown />
                                                    }

                                                </div>

                                            </div>

                                        </button>



                                        {/* =====================================
                                            EXPANDED CONTENT
                                        ===================================== */}

                                        {isExpanded && (

                                            <div
                                                className="
                                                    px-6
                                                    pb-6
                                                    bg-gray-50
                                                    border-t
                                                    border-gray-100
                                                "
                                            >

                                                {/* DETAILS */}

                                                <div
                                                    className="
                                                        pt-5
                                                        grid
                                                        grid-cols-1
                                                        sm:grid-cols-2
                                                        lg:grid-cols-4
                                                        gap-3
                                                    "
                                                >

                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            Exam Type
                                                        </p>


                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-gray-800
                                                                mt-1
                                                            "
                                                        >

                                                            {exam.exam_type ||
                                                                "-"}

                                                        </p>

                                                    </div>



                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            Term
                                                        </p>


                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-gray-800
                                                                mt-1
                                                            "
                                                        >

                                                            {exam.term ||
                                                                "-"}

                                                        </p>

                                                    </div>



                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            Examination Period
                                                        </p>


                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-gray-800
                                                                mt-1
                                                            "
                                                        >

                                                            {exam.start_date ||
                                                                "-"}
                                                            {" → "}
                                                            {exam.end_date ||
                                                                "-"}

                                                        </p>

                                                    </div>



                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            Total Marks
                                                        </p>


                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-gray-800
                                                                mt-1
                                                            "
                                                        >

                                                            {exam.total_marks ||
                                                                0}

                                                        </p>

                                                    </div>



                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            Duration
                                                        </p>


                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-gray-800
                                                                mt-1
                                                            "
                                                        >

                                                            {exam.duration_minutes
                                                                ? `${exam.duration_minutes} minutes`
                                                                : "-"
                                                            }

                                                        </p>

                                                    </div>



                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            AI Analysis
                                                        </p>


                                                        <p
                                                            className={`
                                                                font-semibold
                                                                mt-1
                                                                ${getAIStatusClass(
                                                                    exam.ai_status
                                                                )}
                                                            `}
                                                        >

                                                            {exam.ai_status ||
                                                                "Pending"}

                                                        </p>

                                                    </div>



                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            Approval
                                                        </p>


                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-gray-800
                                                                mt-1
                                                            "
                                                        >

                                                            {exam.status ===
                                                                "Approved"
                                                                ? "Approved"
                                                                : "Pending"
                                                            }

                                                        </p>

                                                    </div>



                                                    <div
                                                        className="
                                                            bg-white
                                                            rounded-xl
                                                            p-4
                                                            border
                                                            border-gray-100
                                                        "
                                                    >

                                                        <p
                                                            className="
                                                                text-xs
                                                                text-gray-500
                                                            "
                                                        >
                                                            Created
                                                        </p>


                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-gray-800
                                                                mt-1
                                                            "
                                                        >

                                                            {exam.created_at
                                                                ? new Date(
                                                                    exam.created_at
                                                                ).toLocaleDateString()
                                                                : "-"
                                                            }

                                                        </p>

                                                    </div>

                                                </div>



                                                {/* =====================================
                                                    ACTIONS
                                                ===================================== */}

                                                <div
                                                    className="
                                                        mt-5
                                                        bg-white
                                                        rounded-xl
                                                        border
                                                        border-gray-100
                                                        p-4
                                                    "
                                                >

                                                    <div
                                                        className="
                                                            flex
                                                            items-center
                                                            justify-between
                                                            mb-3
                                                        "
                                                    >

                                                        <div>

                                                            <p
                                                                className="
                                                                    font-bold
                                                                    text-gray-800
                                                                "
                                                            >
                                                                Examination Actions
                                                            </p>


                                                            <p
                                                                className="
                                                                    text-xs
                                                                    text-gray-500
                                                                    mt-1
                                                                "
                                                            >
                                                                Select an action
                                                                to continue.
                                                            </p>

                                                        </div>


                                                        <button
                                                            type="button"
                                                            onClick={(event) => {

                                                                event.stopPropagation();

                                                                setExpandedExamId(
                                                                    null
                                                                );

                                                            }}
                                                            className="
                                                                text-gray-400
                                                                hover:text-gray-600
                                                                p-2
                                                            "
                                                        >

                                                            <FaTimes />

                                                        </button>

                                                    </div>



                                                    <div
                                                        className="
                                                            grid
                                                            grid-cols-2
                                                            sm:grid-cols-3
                                                            lg:grid-cols-4
                                                            gap-2
                                                        "
                                                    >

                                                        {/* VIEW */}

                                                        <ActionButton
                                                            icon={
                                                                <FaEye />
                                                            }
                                                            label="View"
                                                            color="
                                                                bg-blue-50
                                                                text-blue-700
                                                                hover:bg-blue-100
                                                            "
                                                            onClick={() =>
                                                                navigate(
                                                                    `/examination/${exam.id}`
                                                                )
                                                            }
                                                        />



                                                        {/* EDIT */}

                                                        <ActionButton
                                                            icon={
                                                                <FaEdit />
                                                            }
                                                            label="Edit"
                                                            color="
                                                                bg-gray-100
                                                                text-gray-700
                                                                hover:bg-gray-200
                                                            "
                                                            onClick={() =>
                                                                navigate(
                                                                    `/examination/${exam.id}/edit`
                                                                )
                                                            }
                                                        />



                                                        {/* UPLOAD */}

                                                        <ActionButton
                                                            icon={
                                                                <FaUpload />
                                                            }
                                                            label="Upload Paper"
                                                            color="
                                                                bg-indigo-50
                                                                text-indigo-700
                                                                hover:bg-indigo-100
                                                            "
                                                            onClick={() =>
                                                                navigate(
                                                                    `/examination/${exam.id}/upload`
                                                                )
                                                            }
                                                        />



                                                        {/* AI */}

                                                        <ActionButton
                                                            icon={
                                                                <FaRobot />
                                                            }
                                                            label="AI Analysis"
                                                            color="
                                                                bg-green-50
                                                                text-green-700
                                                                hover:bg-green-100
                                                            "
                                                            onClick={() =>
                                                                navigate(
                                                                    `/examination/${exam.id}/ai-analysis`
                                                                )
                                                            }
                                                        />



                                                        {/* APPROVAL */}

                                                        <ActionButton
                                                            icon={
                                                                <FaClipboardCheck />
                                                            }
                                                            label="Approval"
                                                            color="
                                                                bg-purple-50
                                                                text-purple-700
                                                                hover:bg-purple-100
                                                            "
                                                            onClick={() =>
                                                                navigate(
                                                                    `/examination/${exam.id}/approval`
                                                                )
                                                            }
                                                        />



                                                        {/* MARKS */}

                                                        <ActionButton
                                                            icon={
                                                                <FaPen />
                                                            }
                                                            label="Enter Marks"
                                                            color="
                                                                bg-orange-50
                                                                text-orange-700
                                                                hover:bg-orange-100
                                                            "
                                                            onClick={() =>
                                                                navigate(
                                                                    `/examination/${exam.id}/marks`
                                                                )
                                                            }
                                                        />



                                                        {/* RESULTS */}

                                                        <ActionButton
                                                            icon={
                                                                <FaGraduationCap />
                                                            }
                                                            label="Results"
                                                            color="
                                                                bg-teal-50
                                                                text-teal-700
                                                                hover:bg-teal-100
                                                            "
                                                            onClick={() =>
                                                                navigate(
                                                                    `/examination/${exam.id}/results-analysis`
                                                                )
                                                            }
                                                        />

                                                    </div>

                                                </div>

                                            </div>

                                        )}

                                    </div>

                                );

                            })}

                        </div>

                    )}

            </div>

        </div>

    );

}


export default ExaminationDashboard;