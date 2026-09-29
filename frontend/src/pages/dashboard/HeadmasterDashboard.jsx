import {
    useEffect,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import {
    MdPeople,
    MdSchool,
    MdClass,
    MdAssignment,
    MdAssessment,
    MdCampaign
} from "react-icons/md";

import { supabase } from "../../services/supabase";


function HeadmasterDashboard() {

    const navigate = useNavigate();


    const [stats, setStats] = useState({
        students: 0,
        teachers: 0,
        classes: 0
    });


    const [loading, setLoading] = useState(true);


    useEffect(() => {

        let mounted = true;


        const loadDashboard = async () => {

            try {

                setLoading(true);


                const [
                    studentsResult,
                    teachersResult,
                    classesResult
                ] = await Promise.all([

                    supabase
                        .from("students")
                        .select("*", {
                            count: "exact",
                            head: true
                        }),

                    supabase
                        .from("teachers")
                        .select("*", {
                            count: "exact",
                            head: true
                        }),

                    supabase
                        .from("classes")
                        .select("*", {
                            count: "exact",
                            head: true
                        })

                ]);


                if (!mounted) {
                    return;
                }


                setStats({

                    students:
                        studentsResult.count || 0,

                    teachers:
                        teachersResult.count || 0,

                    classes:
                        classesResult.count || 0

                });

            }
            catch (error) {

                console.error(
                    "Headmaster Dashboard Error:",
                    error
                );

            }
            finally {

                if (mounted) {

                    setLoading(false);

                }

            }

        };


        loadDashboard();


        return () => {

            mounted = false;

        };

    }, []);


    const cards = [

        {
            title: "Total Students",
            value: stats.students,
            icon: <MdPeople />,
            color: "bg-blue-600"
        },

        {
            title: "Teachers",
            value: stats.teachers,
            icon: <MdSchool />,
            color: "bg-green-600"
        },

        {
            title: "Classes",
            value: stats.classes,
            icon: <MdClass />,
            color: "bg-purple-600"
        },

        {
            title: "Examination",
            value: "Manage",
            icon: <MdAssessment />,
            color: "bg-orange-600"
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

                    Headmaster Dashboard

                </h1>


                <p className="
                    text-gray-600
                    mt-2
                ">

                    School leadership overview and management.

                </p>

            </div>


            {loading ? (

                <div className="
                    bg-white
                    rounded-xl
                    shadow
                    p-8
                    text-center
                ">

                    Loading school overview...

                </div>

            ) : (

                <div className="
                    grid
                    grid-cols-1
                    md:grid-cols-2
                    lg:grid-cols-4
                    gap-6
                ">

                    {cards.map((card, index) => (

                        <div
                            key={index}
                            className="
                                bg-white
                                rounded-xl
                                shadow
                                p-6
                                flex
                                items-center
                                justify-between
                            "
                        >

                            <div>

                                <p className="text-gray-500">

                                    {card.title}

                                </p>


                                <h2 className="
                                    text-3xl
                                    font-bold
                                    mt-2
                                ">

                                    {card.value}

                                </h2>

                            </div>


                            <div className={`
                                ${card.color}
                                text-white
                                text-3xl
                                p-4
                                rounded-full
                            `}>

                                {card.icon}

                            </div>

                        </div>

                    ))}

                </div>

            )}


            <div className="
                grid
                grid-cols-1
                md:grid-cols-3
                gap-6
                mt-8
            ">


                <button
                    type="button"
                    onClick={() =>
                        navigate("/teachers")
                    }
                    className="
                        bg-white
                        hover:bg-gray-50
                        border
                        rounded-xl
                        shadow
                        p-6
                        text-left
                    "
                >

                    <MdSchool className="
                        text-3xl
                        text-green-600
                    " />

                    <h2 className="
                        font-bold
                        text-lg
                        mt-3
                    ">

                        Teachers

                    </h2>

                    <p className="
                        text-gray-500
                        text-sm
                        mt-1
                    ">

                        Review and manage teaching staff.

                    </p>

                </button>


                <button
                    type="button"
                    onClick={() =>
                        navigate("/examination")
                    }
                    className="
                        bg-white
                        hover:bg-gray-50
                        border
                        rounded-xl
                        shadow
                        p-6
                        text-left
                    "
                >

                    <MdAssessment className="
                        text-3xl
                        text-orange-600
                    " />

                    <h2 className="
                        font-bold
                        text-lg
                        mt-3
                    ">

                        Examination

                    </h2>

                    <p className="
                        text-gray-500
                        text-sm
                        mt-1
                    ">

                        Monitor examinations and results.

                    </p>

                </button>


                <button
                    type="button"
                    onClick={() =>
                        navigate("/communication")
                    }
                    className="
                        bg-white
                        hover:bg-gray-50
                        border
                        rounded-xl
                        shadow
                        p-6
                        text-left
                    "
                >

                    <MdCampaign className="
                        text-3xl
                        text-blue-600
                    " />

                    <h2 className="
                        font-bold
                        text-lg
                        mt-3
                    ">

                        Communication

                    </h2>

                    <p className="
                        text-gray-500
                        text-sm
                        mt-1
                    ">

                        School communication and announcements.

                    </p>

                </button>


            </div>

        </div>

    );

}


export default HeadmasterDashboard;