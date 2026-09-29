import {
    useNavigate
} from "react-router-dom";

import {
    MdAssignment,
    MdAssessment,
    MdCalendarMonth,
    MdBook,
    MdPeople,
    MdChat
} from "react-icons/md";


function SubjectTeacherDashboard() {

    const navigate = useNavigate();


    const items = [

        // =================================================
        // MY TEACHING ASSIGNMENTS
        // =================================================

        {
            title: "My Teaching Assignments",
            description: "View your assigned subjects and classes.",
            path: "/teacher-assignment",
            icon: <MdAssignment />,
            color: "text-blue-600"
        },


        // =================================================
        // MY SUBJECTS
        // =================================================

        {
            title: "My Subjects",
            description: "Access your assigned subjects and academic content.",
            path: "/subjects",
            icon: <MdBook />,
            color: "text-green-600"
        },


        // =================================================
        // MY STUDENTS
        // =================================================

        {
            title: "My Students",
            description: "View students from classes assigned to you.",
            path: "/students",
            icon: <MdPeople />,
            color: "text-indigo-600"
        },


        // =================================================
        // COMMUNICATION
        // =================================================

        {
            title: "Communication",
            description: "Communicate with school management, teachers and other users.",
            path: "/communication",
            icon: <MdChat />,
            color: "text-cyan-600"
        },


        // =================================================
        // EXAMINATION
        // =================================================

        {
            title: "Examination",
            description: "Enter marks and work with examination results.",
            path: "/examination",
            icon: <MdAssessment />,
            color: "text-orange-600"
        },


        // =================================================
        // TIMETABLE
        // =================================================

        {
            title: "Timetable",
            description: "View your teaching timetable.",
            path: "/timetable",
            icon: <MdCalendarMonth />,
            color: "text-purple-600"
        }

    ];


    return (

        <div>

            {/* ============================================
                HEADER
            ============================================ */}

            <div className="mb-8">

                <h1 className="
                    text-3xl
                    font-bold
                    text-gray-800
                ">

                    Subject Teacher Dashboard

                </h1>


                <p className="
                    text-gray-600
                    mt-2
                ">

                    Your subjects, students, examinations,
                    timetable and communication workspace.

                </p>

            </div>


            {/* ============================================
                DASHBOARD CARDS
            ============================================ */}

            <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                lg:grid-cols-3
                gap-6
            ">

                {items.map((item) => (

                    <button

                        key={item.title}

                        type="button"

                        onClick={() =>
                            navigate(item.path)
                        }

                        className="
                            bg-white
                            border
                            border-gray-200
                            rounded-xl
                            shadow
                            p-6
                            text-left
                            hover:shadow-lg
                            hover:-translate-y-1
                            transition
                            duration-200
                            focus:outline-none
                            focus:ring-2
                            focus:ring-blue-500
                        "

                    >

                        {/* ICON */}

                        <div className={`
                            text-4xl
                            ${item.color}
                        `}>

                            {item.icon}

                        </div>


                        {/* TITLE */}

                        <h2 className="
                            text-lg
                            font-bold
                            text-gray-800
                            mt-4
                        ">

                            {item.title}

                        </h2>


                        {/* DESCRIPTION */}

                        <p className="
                            text-gray-500
                            mt-2
                            leading-relaxed
                        ">

                            {item.description}

                        </p>

                    </button>

                ))}

            </div>

        </div>

    );

}


export default SubjectTeacherDashboard;