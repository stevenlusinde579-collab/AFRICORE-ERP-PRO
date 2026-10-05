import { useNavigate } from "react-router-dom";

import {
    MdPeople,
    MdBook,
    MdHowToReg,
    MdChat,
    MdCalendarMonth
} from "react-icons/md";


function ClassTeacherDashboard() {

    const navigate = useNavigate();


    const items = [

        {
            title: "My Students",
            description:
                "View students in the student management module.",
            path: "/students",
            icon: <MdPeople />,
            color: "text-blue-600",
            bg: "bg-blue-50"
        },

        {
            title: "My Subjects",
            description:
                "View teachers, subjects and classes related to your teaching assignments.",
            path: "/class-teacher/subject-teachers",
            icon: <MdBook />,
            color: "text-green-600",
            bg: "bg-green-50"
        },

        {
            title: "My Attendance",
            description:
                "Record and monitor attendance for students in your assigned class.",
            path: "/class-teacher/attendance",
            icon: <MdHowToReg />,
            color: "text-orange-600",
            bg: "bg-orange-50"
        },

        {
            title: "Communication",
            description:
                "Communicate with students, parents and other school users.",
            path: "/communication",
            icon: <MdChat />,
            color: "text-purple-600",
            bg: "bg-purple-50"
        },

        {
            title: "Timetable",
            description:
                "View the timetable for your teaching activities.",
            path: "/timetable",
            icon: <MdCalendarMonth />,
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        }

    ];


    const handleOpen = (path) => {

        navigate(path);

    };


    return (

        <div className="p-6">

            {/* =====================================================
                HEADER
            ===================================================== */}

            <div className="mb-8">

                <h1 className="text-3xl font-bold text-gray-800">
                    Class Teacher Dashboard
                </h1>

                <p className="text-gray-600 mt-2">
                    Manage your assigned class, students,
                    attendance and communication.
                </p>

            </div>


            {/* =====================================================
                WORKSPACE HEADER
            ===================================================== */}

            <div className="mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">

                <div className="flex items-center gap-4">

                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">

                        <MdPeople className="text-3xl" />

                    </div>


                    <div>

                        <h2 className="text-xl font-bold">
                            Class Teacher Workspace
                        </h2>

                        <p className="text-blue-100 mt-1">
                            Access and manage information related
                            to your assigned class.
                        </p>

                    </div>

                </div>

            </div>


            {/* =====================================================
                CARDS
            ===================================================== */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                {items.map((item) => (

                    <button
                        key={item.title}
                        type="button"
                        onClick={() => handleOpen(item.path)}
                        className="
                            group
                            text-left
                            bg-white
                            rounded-2xl
                            border
                            border-gray-200
                            shadow-sm
                            hover:shadow-xl
                            hover:-translate-y-1
                            transition-all
                            duration-200
                            p-6
                            focus:outline-none
                            focus:ring-2
                            focus:ring-blue-500
                        "
                    >

                        {/* ICON */}

                        <div
                            className={`
                                w-14
                                h-14
                                rounded-xl
                                ${item.bg}
                                ${item.color}
                                flex
                                items-center
                                justify-center
                                text-3xl
                                mb-5
                                group-hover:scale-110
                                transition-transform
                                duration-200
                            `}
                        >

                            {item.icon}

                        </div>


                        {/* TITLE */}

                        <h3 className="text-lg font-bold text-gray-800">

                            {item.title}

                        </h3>


                        {/* DESCRIPTION */}

                        <p className="text-sm text-gray-500 mt-2 leading-6">

                            {item.description}

                        </p>


                        {/* ACTION */}

                        <div
                            className="
                                mt-5
                                text-sm
                                font-semibold
                                text-blue-600
                                group-hover:text-blue-700
                            "
                        >

                            Open →

                        </div>

                    </button>

                ))}

            </div>

        </div>

    );

}


export default ClassTeacherDashboard;