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


function TeacherDashboard() {

    const navigate = useNavigate();


    const items = [

        {
            title: "My Teaching Assignments",
            description: "View your assigned subjects and classes.",
            path: "/teacher-assignment",
            icon: <MdAssignment />,
            color: "text-blue-600"
        },

        {
            title: "My Subjects",
            description: "Access subjects and academic content.",
            path: "/subjects",
            icon: <MdBook />,
            color: "text-green-600"
        },

        {
            title: "My Students",
            description: "View students from your assigned classes.",
            path: "/students",
            icon: <MdPeople />,
            color: "text-indigo-600"
        },

        {
            title: "Communication",
            description: "Communicate with teachers, school management and other users.",
            path: "/communication",
            icon: <MdChat />,
            color: "text-cyan-600"
        },

        {
            title: "Examination",
            description: "Enter marks and work with examination results.",
            path: "/examination",
            icon: <MdAssessment />,
            color: "text-orange-600"
        },

        {
            title: "Timetable",
            description: "View teaching timetable.",
            path: "/timetable",
            icon: <MdCalendarMonth />,
            color: "text-purple-600"
        }

    ];


    return (

        <div>

            <div className="mb-8">

                <h1 className="
                    text-3xl
                    font-bold
                    text-gray-800
                ">

                    Teacher Dashboard

                </h1>


                <p className="
                    text-gray-600
                    mt-2
                ">

                    Your teaching, timetable and academic workspace.

                </p>

            </div>


            <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                lg:grid-cols-3
                gap-6
            ">

                {items.map(item => (

                    <button

                        key={item.title}

                        type="button"

                        onClick={() =>
                            navigate(item.path)
                        }

                        className="
                            bg-white
                            border
                            rounded-xl
                            shadow
                            p-6
                            text-left
                            hover:shadow-lg
                            transition
                            duration-200
                        "

                    >

                        <div className={`
                            text-4xl
                            ${item.color}
                        `}>

                            {item.icon}

                        </div>


                        <h2 className="
                            text-lg
                            font-bold
                            text-gray-800
                            mt-4
                        ">

                            {item.title}

                        </h2>


                        <p className="
                            text-gray-500
                            mt-2
                        ">

                            {item.description}

                        </p>

                    </button>

                ))}

            </div>

        </div>

    );

}


export default TeacherDashboard;