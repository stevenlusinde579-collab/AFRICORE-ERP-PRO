import {
    useNavigate
} from "react-router-dom";

import {
    MdPeople,
    MdSchool,
    MdMessage,
    MdNotifications
} from "react-icons/md";


function SecretaryDashboard() {

    const navigate = useNavigate();


    const items = [

        {
            title: "Students",
            description: "Manage student records and administration.",
            path: "/students",
            icon: <MdPeople />,
            color: "text-blue-600"
        },

        {
            title: "Teachers",
            description: "View teacher and staff records.",
            path: "/teachers",
            icon: <MdSchool />,
            color: "text-green-600"
        },

        {
            title: "Communication",
            description: "Manage school communication.",
            path: "/communication",
            icon: <MdMessage />,
            color: "text-purple-600"
        },

        {
            title: "Notifications",
            description: "View and manage school notifications.",
            path: "/communication/notifications",
            icon: <MdNotifications />,
            color: "text-orange-600"
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

                    Secretary Dashboard

                </h1>


                <p className="
                    text-gray-600
                    mt-2
                ">

                    School administration and communication workspace.

                </p>

            </div>


            <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                lg:grid-cols-4
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
                            mt-4
                        ">

                            {item.title}

                        </h2>


                        <p className="
                            text-sm
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


export default SecretaryDashboard;