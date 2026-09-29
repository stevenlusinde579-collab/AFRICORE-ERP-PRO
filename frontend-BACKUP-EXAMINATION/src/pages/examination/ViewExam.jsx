import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import {
    FaArrowLeft,
    FaEdit,
    FaFileUpload,
    FaRobot,
    FaCheckCircle,
    FaPen,
    FaChartBar,
    FaBook,
    FaCalendarAlt,
    FaClock,
    FaClipboardList
} from "react-icons/fa";


const API_URL = "http://localhost:5000/api/exams";


function ViewExam() {

    const navigate = useNavigate();

    const { examId } = useParams();


    const [exam, setExam] = useState(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");



    // ==========================================
    // LOAD EXAM
    // ==========================================

    const loadExam = async () => {

        try {

            setLoading(true);

            setError("");


            const response = await axios.get(
                `${API_URL}/${examId}`
            );


            if (
                response.data &&
                response.data.success
            ) {

                setExam(
                    response.data.exam
                );

            } else {

                setError(
                    "Failed to load examination"
                );

            }


        } catch (err) {

            console.error(
                "VIEW EXAM ERROR:",
                err
            );


            setError(
                "Failed to load examination data"
            );


        } finally {

            setLoading(false);

        }

    };



    useEffect(() => {

        if (examId) {

            loadExam();

        }

    }, [examId]);



    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <div className="p-6">

                <div className="
                    bg-white
                    rounded-xl
                    shadow-sm
                    border
                    p-10
                    text-center
                    text-gray-500
                ">

                    Loading examination...

                </div>

            </div>

        );

    }



    // ==========================================
    // ERROR
    // ==========================================

    if (error) {

        return (

            <div className="p-6">

                <button
                    onClick={() =>
                        navigate("/examination/list")
                    }
                    className="
                        flex
                        items-center
                        gap-2
                        mb-5
                        text-gray-600
                        hover:text-blue-600
                    "
                >

                    <FaArrowLeft />

                    Back to Exams

                </button>


                <div className="
                    bg-red-50
                    border
                    border-red-200
                    text-red-700
                    p-5
                    rounded-xl
                ">

                    {error}

                </div>

            </div>

        );

    }



    if (!exam) {

        return null;

    }



    // ==========================================
    // STATUS COLORS
    // ==========================================

    const statusColor =
        exam.status === "Approved"

            ? "bg-green-100 text-green-700"

            : exam.status === "Completed"

                ? "bg-blue-100 text-blue-700"

                : "bg-yellow-100 text-yellow-700";



    const aiColor =
        exam.ai_status === "Completed"

            ? "bg-green-100 text-green-700"

            : "bg-gray-100 text-gray-600";



    // ==========================================
    // ACTION CARDS
    // ==========================================

    const actionCards = [

        {
            title: "Upload Paper",

            description:
                "Upload examination paper for this examination.",

            icon: <FaFileUpload />,

            color:
                "bg-blue-50 text-blue-600 border-blue-100",

            hover:
                "hover:bg-blue-100",

            path:
                `/examination/${exam.id}/upload`
        },


        {
            title: "AI Analysis",

            description:
                "Analyze the uploaded examination paper using AI.",

            icon: <FaRobot />,

            color:
                "bg-purple-50 text-purple-600 border-purple-100",

            hover:
                "hover:bg-purple-100",

            path:
                `/examination/${exam.id}/ai-analysis`
        },


        {
            title: "Approval",

            description:
                "Manage examination approval workflow.",

            icon: <FaCheckCircle />,

            color:
                "bg-green-50 text-green-600 border-green-100",

            hover:
                "hover:bg-green-100",

            path:
                `/examination/${exam.id}/approval`
        },


        {
            title: "Enter Marks",

            description:
                "Enter marks for subjects and classes assigned to this examination.",

            icon: <FaPen />,

            color:
                "bg-orange-50 text-orange-600 border-orange-100",

            hover:
                "hover:bg-orange-100",

            path:
                `/examination/${exam.id}/marks`
        },


        {
            title: "Results Analysis",

            description:
                "Analyze examination results after marks entry.",

            icon: <FaChartBar />,

            color:
                "bg-indigo-50 text-indigo-600 border-indigo-100",

            hover:
                "hover:bg-indigo-100",

            path:
                `/examination/${exam.id}/results-analysis`
        },


        {
            title: "Subjects & Classes",

            description:
                "Manage subjects and classes assigned to this examination.",

            icon: <FaBook />,

            color:
                "bg-cyan-50 text-cyan-600 border-cyan-100",

            hover:
                "hover:bg-cyan-100",

            path:
                `/examination/${exam.id}/subjects`
        }

    ];



    // ==========================================
    // UI
    // ==========================================

    return (

        <div className="p-6 space-y-6">


            {/* ======================================
                BACK BUTTON
            ====================================== */}

            <button
                onClick={() =>
                    navigate("/examination/list")
                }
                className="
                    flex
                    items-center
                    gap-2
                    text-gray-600
                    hover:text-blue-600
                    font-medium
                "
            >

                <FaArrowLeft />

                Back to Exams

            </button>



            {/* ======================================
                EXAM HEADER
            ====================================== */}

            <div className="
                bg-white
                border
                rounded-2xl
                shadow-sm
                p-6
            ">

                <div className="
                    flex
                    flex-col
                    lg:flex-row
                    lg:items-center
                    lg:justify-between
                    gap-5
                ">


                    <div>

                        <div className="
                            flex
                            items-center
                            gap-3
                            mb-2
                        ">

                            <FaClipboardList
                                className="
                                    text-blue-600
                                    text-2xl
                                "
                            />

                            <h1 className="
                                text-2xl
                                font-bold
                                text-gray-800
                            ">

                                {exam.exam_name}

                            </h1>

                        </div>


                        <p className="
                            text-gray-500
                        ">

                            Examination Management

                        </p>

                    </div>



                    {/* STATUS */}

                    <div className="
                        flex
                        items-center
                        gap-3
                    ">

                        <span className={`
                            px-4
                            py-2
                            rounded-full
                            text-sm
                            font-semibold
                            ${statusColor}
                        `}>

                            {exam.status || "Draft"}

                        </span>


                        <span className={`
                            px-4
                            py-2
                            rounded-full
                            text-sm
                            font-semibold
                            ${aiColor}
                        `}>

                            AI:
                            {" "}
                            {exam.ai_status || "Pending"}

                        </span>

                    </div>

                </div>



                {/* ======================================
                    EXAM INFORMATION
                ====================================== */}

                <div className="
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    lg:grid-cols-4
                    gap-4
                    mt-6
                ">


                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaClipboardList />

                            Exam Type

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.exam_type || "-"}

                        </p>

                    </div>



                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaCalendarAlt />

                            Term

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.term || "-"}

                        </p>

                    </div>



                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaCalendarAlt />

                            Examination Period

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.start_date || "-"}

                            {" → "}

                            {exam.end_date || "-"}

                        </p>

                    </div>



                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaClock />

                            Duration

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.duration_minutes || 0}

                            {" minutes"}

                        </p>

                    </div>


                </div>

            </div>



            {/* ======================================
                ACTIONS
            ====================================== */}

            <div>

                <div className="
                    flex
                    items-center
                    justify-between
                    mb-4
                ">

                    <div>

                        <h2 className="
                            text-xl
                            font-bold
                            text-gray-800
                        ">

                            Examination Actions

                        </h2>

                        <p className="
                            text-sm
                            text-gray-500
                            mt-1
                        ">

                            Select an action to manage this examination.

                        </p>

                    </div>


                    <button
                        onClick={() =>
                            navigate(
                                `/examination/${exam.id}/edit`
                            )
                        }
                        className="
                            flex
                            items-center
                            gap-2
                            bg-gray-800
                            text-white
                            px-4
                            py-2
                            rounded-lg
                            hover:bg-gray-900
                        "
                    >

                        <FaEdit />

                        Edit Exam

                    </button>

                </div>



                {/* ======================================
                    ACTION CARDS
                ====================================== */}

                <div className="
                    grid
                    grid-cols-1
                    md:grid-cols-2
                    xl:grid-cols-3
                    gap-5
                ">


                    {actionCards.map(
                        (card) => (

                            <button
                                key={card.title}
                                onClick={() =>
                                    navigate(card.path)
                                }
                                className={`
                                    text-left
                                    bg-white
                                    border
                                    rounded-2xl
                                    p-6
                                    shadow-sm
                                    transition
                                    duration-200
                                    ${card.hover}
                                `}
                            >

                                <div className="
                                    flex
                                    items-start
                                    justify-between
                                    gap-4
                                ">


                                    <div className={`
                                        w-12
                                        h-12
                                        rounded-xl
                                        flex
                                        items-center
                                        justify-center
                                        text-xl
                                        ${card.color}
                                    `}>

                                        {card.icon}

                                    </div>


                                    <span className="
                                        text-gray-300
                                        text-xl
                                    ">

                                        →

                                    </span>

                                </div>



                                <h3 className="
                                    text-lg
                                    font-bold
                                    text-gray-800
                                    mt-5
                                ">

                                    {card.title}

                                </h3>



                                <p className="
                                    text-sm
                                    text-gray-500
                                    mt-2
                                    leading-6
                                ">

                                    {card.description}

                                </p>

                            </button>

                        )
                    )}

                </div>

            </div>


        </div>

    );

}


export default ViewExam;