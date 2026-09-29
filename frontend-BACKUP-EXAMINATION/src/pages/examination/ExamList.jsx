import { useEffect, useState } from "react";

import axios from "axios";

import {
    FaEye,
    FaEdit,
    FaTrash,
    FaPlus,
    FaUpload,
    FaPen,
    FaRobot,
    FaCheckCircle,
    FaChartBar,
    FaChevronDown,
    FaChevronUp
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";


const API_URL = "http://localhost:5000/api/exams";


function ExamList() {

    const navigate = useNavigate();


    const [exams, setExams] = useState([]);

    const [teacherAssignments, setTeacherAssignments] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [expandedExam, setExpandedExam] = useState(null);



    // =====================================================
    // DEVELOPMENT TEACHER ID
    // =====================================================
    //
    // Kwa sasa tunatumia teacher_id ya test.
    //
    // Baadaye tutatoa teacher_id kutoka authentication.
    //
    // Badilisha 20 kuwa teacher ID unayotaka ku-test.
    // =====================================================

    const teacherId = 20;



    // =====================================================
    // LOAD EXAMS
    // =====================================================

    const loadExams = async () => {

        try {

            setLoading(true);

            setError("");


            // ---------------------------------------------
            // LOAD ALL EXAMS
            // ---------------------------------------------

            const examResponse = await axios.get(
                API_URL
            );


            setExams(
                examResponse.data.exams || []
            );



            // ---------------------------------------------
            // LOAD TEACHER ASSIGNMENTS
            // ---------------------------------------------

            const assignmentResponse =
                await axios.get(
                    `${API_URL}/teacher/my-exams?teacher_id=${teacherId}`
                );


            setTeacherAssignments(
                assignmentResponse.data.assignments || []
            );


        } catch (err) {

            console.log(
                "EXAM LIST ERROR:",
                err
            );


            console.log(
                "EXAM LIST RESPONSE:",
                err.response?.data
            );


            setError(
                err.response?.data?.message ||
                "Failed to load examination data"
            );


        } finally {

            setLoading(false);

        }

    };



    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {

        loadExams();

    }, []);



    // =====================================================
    // DELETE EXAM
    // =====================================================

    const deleteExam = async (id) => {

        const confirmDelete =
            window.confirm(
                "Are you sure you want to delete this exam?"
            );


        if (!confirmDelete) {
            return;
        }



        try {

            await axios.delete(
                `${API_URL}/${id}`
            );


            await loadExams();


        } catch (err) {

            console.log(
                "DELETE ERROR:",
                err
            );


            alert(
                err.response?.data?.message ||
                "Failed to delete exam"
            );

        }

    };



    // =====================================================
    // GET ASSIGNMENTS FOR EXAM
    // =====================================================

    const getExamAssignments = (examId) => {

        return teacherAssignments.filter(
            assignment =>
                Number(assignment.exam_id) ===
                Number(examId)
        );

    };



    // =====================================================
    // TOGGLE EXAM
    // =====================================================

    const toggleExam = (examId) => {

        if (
            Number(expandedExam) ===
            Number(examId)
        ) {

            setExpandedExam(null);

        } else {

            setExpandedExam(examId);

        }

    };



    // =====================================================
    // ENTER MARKS
    // =====================================================

    const openMarksEntry = (
        assignment
    ) => {

        if (!assignment?.exam_subject_id) {

            alert(
                "Exam subject information is missing."
            );

            return;

        }


        navigate(
            `/examination/${assignment.exam_id}/marks?examSubjectId=${assignment.exam_subject_id}`
        );

    };



    // =====================================================
    // AI ANALYSIS
    // =====================================================

    const openAIAnalysis = (examId) => {

        navigate(
            `/examination/${examId}/ai-analysis`
        );

    };



    // =====================================================
    // UPLOAD PAPER
    // =====================================================

    const openUpload = (examId) => {

        navigate(
            `/examination/${examId}/upload`
        );

    };



    // =====================================================
    // APPROVAL
    // =====================================================

    const openApproval = (examId) => {

        navigate(
            `/examination/${examId}/approval`
        );

    };



    // =====================================================
    // RESULTS ANALYSIS
    // =====================================================

    const openResults = (assignment) => {

        navigate(
            `/examination/${assignment.exam_id}/results-analysis?examSubjectId=${assignment.exam_subject_id}`
        );

    };



    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (

            <div className="p-6">

                <div className="
                    bg-white
                    rounded-xl
                    shadow-sm
                    p-10
                    text-center
                    text-gray-500
                ">

                    Loading examinations...

                </div>

            </div>

        );

    }



    // =====================================================
    // RENDER
    // =====================================================

    return (

        <div className="p-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="
                flex
                flex-col
                md:flex-row
                md:items-center
                md:justify-between
                gap-4
                mb-6
            ">

                <div>

                    <h1 className="
                        text-2xl
                        font-bold
                        text-gray-800
                    ">

                        Examination List

                    </h1>


                    <p className="
                        text-gray-500
                        mt-1
                    ">

                        Manage school examinations,
                        papers, marks and results

                    </p>

                </div>



                <button

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
                        rounded-lg
                        flex
                        items-center
                        justify-center
                        gap-2
                        transition
                    "

                >

                    <FaPlus />

                    Add Exam

                </button>

            </div>



            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

                <div className="
                    bg-red-50
                    border
                    border-red-200
                    text-red-700
                    p-4
                    rounded-lg
                    mb-6
                ">

                    {error}

                </div>

            )}



            {/* =================================================
                EXAMINATION LIST
            ================================================= */}

            <div className="
                bg-white
                rounded-xl
                shadow-sm
                border
                overflow-hidden
            ">

                {/* TABLE HEADER */}

                <div className="
                    hidden
                    md:grid
                    grid-cols-12
                    gap-4
                    bg-gray-50
                    border-b
                    px-5
                    py-4
                    text-sm
                    font-semibold
                    text-gray-600
                ">

                    <div className="col-span-1">
                        #
                    </div>

                    <div className="col-span-3">
                        Examination
                    </div>

                    <div className="col-span-2">
                        Type / Term
                    </div>

                    <div className="col-span-2">
                        Status
                    </div>

                    <div className="col-span-2">
                        AI Status
                    </div>

                    <div className="col-span-2">
                        Actions
                    </div>

                </div>



                {/* =================================================
                    EXAMS
                ================================================= */}

                {exams.length === 0 ? (

                    <div className="
                        p-10
                        text-center
                        text-gray-500
                    ">

                        No examinations found.

                    </div>

                ) : (

                    exams.map(
                        (exam, index) => {

                            const assignments =
                                getExamAssignments(
                                    exam.id
                                );


                            const isExpanded =
                                Number(expandedExam) ===
                                Number(exam.id);



                            return (

                                <div
                                    key={exam.id}
                                    className="
                                        border-b
                                        last:border-b-0
                                    "
                                >

                                    {/* =================================================
                                        MAIN EXAM ROW
                                    ================================================= */}

                                    <div
                                        className="
                                            px-5
                                            py-4
                                            hover:bg-gray-50
                                            transition
                                        "
                                    >

                                        <div className="
                                            grid
                                            grid-cols-1
                                            md:grid-cols-12
                                            gap-4
                                            items-center
                                        ">

                                            {/* NUMBER */}

                                            <div className="
                                                hidden
                                                md:block
                                                md:col-span-1
                                                text-gray-500
                                            ">

                                                {index + 1}

                                            </div>



                                            {/* EXAM NAME */}

                                            <div className="
                                                md:col-span-3
                                            ">

                                                <div className="
                                                    font-semibold
                                                    text-gray-800
                                                ">

                                                    {exam.exam_name}

                                                </div>


                                                <div className="
                                                    text-xs
                                                    text-gray-500
                                                    mt-1
                                                ">

                                                    ID: {exam.id}

                                                </div>

                                            </div>



                                            {/* TYPE / TERM */}

                                            <div className="
                                                md:col-span-2
                                            ">

                                                <div className="
                                                    text-sm
                                                    text-gray-700
                                                ">

                                                    {exam.exam_type}

                                                </div>


                                                <div className="
                                                    text-xs
                                                    text-gray-500
                                                    mt-1
                                                ">

                                                    {exam.term}

                                                </div>

                                            </div>



                                            {/* STATUS */}

                                            <div className="
                                                md:col-span-2
                                            ">

                                                <span className="
                                                    inline-flex
                                                    px-3
                                                    py-1
                                                    rounded-full
                                                    text-xs
                                                    font-medium
                                                    bg-yellow-100
                                                    text-yellow-700
                                                ">

                                                    {exam.status}

                                                </span>

                                            </div>



                                            {/* AI STATUS */}

                                            <div className="
                                                md:col-span-2
                                            ">

                                                <span
                                                    className={`
                                                        inline-flex
                                                        px-3
                                                        py-1
                                                        rounded-full
                                                        text-xs
                                                        font-medium
                                                        ${
                                                            exam.ai_status ===
                                                            "Completed"

                                                                ? "bg-green-100 text-green-700"

                                                                : "bg-gray-100 text-gray-600"
                                                        }
                                                    `}
                                                >

                                                    {exam.ai_status || "Pending"}

                                                </span>

                                            </div>



                                            {/* ACTIONS */}

                                            <div className="
                                                md:col-span-2
                                                flex
                                                flex-wrap
                                                gap-2
                                            ">

                                                {/* EXPAND */}

                                                <button

                                                    onClick={() =>
                                                        toggleExam(
                                                            exam.id
                                                        )
                                                    }

                                                    className="
                                                        bg-indigo-100
                                                        text-indigo-700
                                                        hover:bg-indigo-200
                                                        p-2
                                                        rounded
                                                    "

                                                    title="Open Exam Actions"

                                                >

                                                    {isExpanded
                                                        ? <FaChevronUp />
                                                        : <FaChevronDown />
                                                    }

                                                </button>



                                                {/* VIEW */}

                                                <button

                                                    onClick={() =>
                                                        navigate(
                                                            `/examination/${exam.id}`
                                                        )
                                                    }

                                                    className="
                                                        bg-green-100
                                                        text-green-700
                                                        hover:bg-green-200
                                                        p-2
                                                        rounded
                                                    "

                                                    title="View"

                                                >

                                                    <FaEye />

                                                </button>



                                                {/* EDIT */}

                                                <button

                                                    onClick={() =>
                                                        navigate(
                                                            `/examination/${exam.id}/edit`
                                                        )
                                                    }

                                                    className="
                                                        bg-blue-100
                                                        text-blue-700
                                                        hover:bg-blue-200
                                                        p-2
                                                        rounded
                                                    "

                                                    title="Edit"

                                                >

                                                    <FaEdit />

                                                </button>



                                                {/* DELETE */}

                                                <button

                                                    onClick={() =>
                                                        deleteExam(
                                                            exam.id
                                                        )
                                                    }

                                                    className="
                                                        bg-red-100
                                                        text-red-700
                                                        hover:bg-red-200
                                                        p-2
                                                        rounded
                                                    "

                                                    title="Delete"

                                                >

                                                    <FaTrash />

                                                </button>

                                            </div>

                                        </div>

                                    </div>



                                    {/* =================================================
                                        EXPANDED EXAM CARD
                                    ================================================= */}

                                    {isExpanded && (

                                        <div className="
                                            bg-gray-50
                                            border-t
                                            px-5
                                            py-5
                                        ">

                                            {/* EXAM INFO */}

                                            <div className="
                                                grid
                                                grid-cols-1
                                                md:grid-cols-4
                                                gap-4
                                                mb-5
                                            ">

                                                <div className="
                                                    bg-white
                                                    rounded-lg
                                                    border
                                                    p-4
                                                ">

                                                    <div className="
                                                        text-xs
                                                        text-gray-500
                                                    ">

                                                        Start Date

                                                    </div>

                                                    <div className="
                                                        font-semibold
                                                        mt-1
                                                    ">

                                                        {exam.start_date ||
                                                            "-"}

                                                    </div>

                                                </div>



                                                <div className="
                                                    bg-white
                                                    rounded-lg
                                                    border
                                                    p-4
                                                ">

                                                    <div className="
                                                        text-xs
                                                        text-gray-500
                                                    ">

                                                        End Date

                                                    </div>

                                                    <div className="
                                                        font-semibold
                                                        mt-1
                                                    ">

                                                        {exam.end_date ||
                                                            "-"}

                                                    </div>

                                                </div>



                                                <div className="
                                                    bg-white
                                                    rounded-lg
                                                    border
                                                    p-4
                                                ">

                                                    <div className="
                                                        text-xs
                                                        text-gray-500
                                                    ">

                                                        Total Marks

                                                    </div>

                                                    <div className="
                                                        font-semibold
                                                        mt-1
                                                    ">

                                                        {exam.total_marks ||
                                                            0}

                                                    </div>

                                                </div>



                                                <div className="
                                                    bg-white
                                                    rounded-lg
                                                    border
                                                    p-4
                                                ">

                                                    <div className="
                                                        text-xs
                                                        text-gray-500
                                                    ">

                                                        Duration

                                                    </div>

                                                    <div className="
                                                        font-semibold
                                                        mt-1
                                                    ">

                                                        {
                                                            exam.duration_minutes ||
                                                            0
                                                        }

                                                        {" "}minutes

                                                    </div>

                                                </div>

                                            </div>



                                            {/* =================================================
                                                AUTHORIZED ASSIGNMENTS
                                            ================================================= */}

                                            <div className="mb-5">

                                                <h3 className="
                                                    font-semibold
                                                    text-gray-800
                                                    mb-3
                                                ">

                                                    Classes & Subjects

                                                </h3>



                                                {assignments.length === 0 ? (

                                                    <div className="
                                                        bg-white
                                                        border
                                                        border-yellow-200
                                                        rounded-lg
                                                        p-4
                                                        text-sm
                                                        text-yellow-700
                                                    ">

                                                        You have no assigned
                                                        class/subject for this
                                                        examination.

                                                    </div>

                                                ) : (

                                                    <div className="
                                                        space-y-3
                                                    ">

                                                        {assignments.map(
                                                            assignment => (

                                                                <div

                                                                    key={
                                                                        assignment.exam_subject_id
                                                                    }

                                                                    className="
                                                                        bg-white
                                                                        border
                                                                        rounded-lg
                                                                        p-4
                                                                    "
                                                                >

                                                                    <div className="
                                                                        flex
                                                                        flex-col
                                                                        lg:flex-row
                                                                        lg:items-center
                                                                        lg:justify-between
                                                                        gap-4
                                                                    ">

                                                                        {/* SUBJECT / CLASS */}

                                                                        <div>

                                                                            <div className="
                                                                                font-semibold
                                                                                text-gray-800
                                                                            ">

                                                                                {
                                                                                    assignment.subject_name
                                                                                }

                                                                            </div>


                                                                            <div className="
                                                                                text-sm
                                                                                text-gray-500
                                                                                mt-1
                                                                            ">

                                                                                Class:

                                                                                {" "}

                                                                                {
                                                                                    assignment.class_name
                                                                                }

                                                                            </div>


                                                                            <div className="
                                                                                text-xs
                                                                                text-gray-400
                                                                                mt-1
                                                                            ">

                                                                                Full Marks:

                                                                                {" "}

                                                                                {
                                                                                    assignment.full_marks
                                                                                }

                                                                                {" | "}

                                                                                Pass Marks:

                                                                                {" "}

                                                                                {
                                                                                    assignment.pass_marks
                                                                                }

                                                                            </div>

                                                                        </div>



                                                                        {/* ACTION BUTTONS */}

                                                                        <div className="
                                                                            flex
                                                                            flex-wrap
                                                                            gap-2
                                                                        ">

                                                                            {/* ENTER MARKS */}

                                                                            <button

                                                                                onClick={() =>
                                                                                    openMarksEntry(
                                                                                        assignment
                                                                                    )
                                                                                }

                                                                                className="
                                                                                    bg-blue-600
                                                                                    hover:bg-blue-700
                                                                                    text-white
                                                                                    px-3
                                                                                    py-2
                                                                                    rounded-lg
                                                                                    text-sm
                                                                                    flex
                                                                                    items-center
                                                                                    gap-2
                                                                                "
                                                                            >

                                                                                <FaPen />

                                                                                Enter Marks

                                                                            </button>



                                                                            {/* AI ANALYSIS */}

                                                                            <button

                                                                                onClick={() =>
                                                                                    openAIAnalysis(
                                                                                        assignment.exam_id
                                                                                    )
                                                                                }

                                                                                className="
                                                                                    bg-purple-100
                                                                                    hover:bg-purple-200
                                                                                    text-purple-700
                                                                                    px-3
                                                                                    py-2
                                                                                    rounded-lg
                                                                                    text-sm
                                                                                    flex
                                                                                    items-center
                                                                                    gap-2
                                                                                "
                                                                            >

                                                                                <FaRobot />

                                                                                AI Analysis

                                                                            </button>



                                                                            {/* UPLOAD */}

                                                                            <button

                                                                                onClick={() =>
                                                                                    openUpload(
                                                                                        assignment.exam_id
                                                                                    )
                                                                                }

                                                                                className="
                                                                                    bg-orange-100
                                                                                    hover:bg-orange-200
                                                                                    text-orange-700
                                                                                    px-3
                                                                                    py-2
                                                                                    rounded-lg
                                                                                    text-sm
                                                                                    flex
                                                                                    items-center
                                                                                    gap-2
                                                                                "
                                                                            >

                                                                                <FaUpload />

                                                                                Upload

                                                                            </button>



                                                                            {/* APPROVAL */}

                                                                            <button

                                                                                onClick={() =>
                                                                                    openApproval(
                                                                                        assignment.exam_id
                                                                                    )
                                                                                }

                                                                                className="
                                                                                    bg-green-100
                                                                                    hover:bg-green-200
                                                                                    text-green-700
                                                                                    px-3
                                                                                    py-2
                                                                                    rounded-lg
                                                                                    text-sm
                                                                                    flex
                                                                                    items-center
                                                                                    gap-2
                                                                                "
                                                                            >

                                                                                <FaCheckCircle />

                                                                                Approval

                                                                            </button>



                                                                            {/* RESULTS */}

                                                                            <button

                                                                                onClick={() =>
                                                                                    openResults(
                                                                                        assignment
                                                                                    )
                                                                                }

                                                                                className="
                                                                                    bg-indigo-100
                                                                                    hover:bg-indigo-200
                                                                                    text-indigo-700
                                                                                    px-3
                                                                                    py-2
                                                                                    rounded-lg
                                                                                    text-sm
                                                                                    flex
                                                                                    items-center
                                                                                    gap-2
                                                                                "
                                                                            >

                                                                                <FaChartBar />

                                                                                Results

                                                                            </button>

                                                                        </div>

                                                                    </div>

                                                                </div>

                                                            )
                                                        )}

                                                    </div>

                                                )}

                                            </div>

                                        </div>

                                    )}

                                </div>

                            );

                        }
                    )

                )}

            </div>

        </div>

    );

}


export default ExamList;