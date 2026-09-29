import {
    useNavigate
} from "react-router-dom";

import {
    MdSchool,
    MdBook,
    MdClass,
    MdAssignment,
    MdAssessment,
    MdCalendarMonth
} from "react-icons/md";


function AcademicMasterDashboard() {

    const navigate = useNavigate();


    const modules = [

        {
            title: "Teachers",
            description: "Manage academic teaching staff.",
            path: "/teachers",
            icon: <MdSchool />,
            color: "text-green-600"
        },

        {
            title: "Subjects",
            description: "Manage academic subjects.",
            path: "/subjects",
            icon: <MdBook />,
            color: "text-blue-600"
        },

        {
            title: "Classes",
            description: "Manage classes and academic structures.",
            path: "/classes",
            icon: <MdClass />,
            color: "text-purple-600"
        },

        {
            title: "Examination",
            description: "Manage examinations and results.",
            path: "/examination",
            icon: <MdAssessment />,
            color: "text-orange-600"
        },

        {
            title: "Timetable",
            description: "Manage academic timetable.",
            path: "/timetable",
            icon: <MdCalendarMonth />,
            color: "text-indigo-600"
        },

        {
            title: "Academic Management",
            description: "Open the academic management module.",
            path: "/academics",
            icon: <MdAssignment />,
            color: "text-red-600"
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

                    Academic Master Dashboard

                </h1>


                <p className="
                    text-gray-600
                    mt-2
                ">

                    Academic performance, teaching and examination management.

                </p>

            </div>


            <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                lg:grid-cols-3
                gap-6
            ">

                {modules.map((module) => (

                    <button

                        key={module.title}

                        type="button"

                        onClick={() =>
                            navigate(module.path)
                        }

                        className="
                            bg-white
                            rounded-xl
                            shadow
                            border
                            p-6
                            text-left
                            hover:shadow-lg
                            hover:-translate-y-1
                            transition
                        "

                    >

                        <div className={`
                            text-4xl
                            ${module.color}
                        `}>

                            {module.icon}

                        </div>


                        <h2 className="
                            text-xl
                            font-bold
                            text-gray-800
                            mt-4
                        ">

                            {module.title}

                        </h2>


                        <p className="
                            text-gray-500
                            mt-2
                        ">

                            {module.description}

                        </p>

                    </button>

                ))}

            </div>

        </div>

    );

}


export default AcademicMasterDashboard;