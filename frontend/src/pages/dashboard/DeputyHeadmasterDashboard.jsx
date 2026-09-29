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
    MdCalendarMonth,
    MdAssessment
} from "react-icons/md";

import { supabase } from "../../services/supabase";


function DeputyHeadmasterDashboard() {

    const navigate = useNavigate();

    const [stats, setStats] = useState({
        students: 0,
        teachers: 0,
        classes: 0
    });

    const [loading, setLoading] = useState(true);


    useEffect(() => {

        let mounted = true;


        const loadData = async () => {

            try {

                const [
                    students,
                    teachers,
                    classes
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


                if (mounted) {

                    setStats({

                        students:
                            students.count || 0,

                        teachers:
                            teachers.count || 0,

                        classes:
                            classes.count || 0

                    });

                }

            }
            catch (error) {

                console.error(
                    "Deputy Headmaster Dashboard Error:",
                    error
                );

            }
            finally {

                if (mounted) {

                    setLoading(false);

                }

            }

        };


        loadData();


        return () => {

            mounted = false;

        };

    }, []);


    return (

        <div>

            <div className="mb-8">

                <h1 className="
                    text-3xl
                    font-bold
                    text-gray-800
                ">

                    Deputy Headmaster Dashboard

                </h1>


                <p className="
                    text-gray-600
                    mt-2
                ">

                    Monitor daily school operations and academic activities.

                </p>

            </div>


            <div className="
                grid
                grid-cols-1
                md:grid-cols-3
                gap-6
            ">

                <div className="
                    bg-white
                    rounded-xl
                    shadow
                    p-6
                ">

                    <MdPeople className="
                        text-3xl
                        text-blue-600
                    " />

                    <p className="
                        text-gray-500
                        mt-3
                    ">

                        Students

                    </p>

                    <h2 className="
                        text-3xl
                        font-bold
                        mt-1
                    ">

                        {loading ? "..." : stats.students}

                    </h2>

                </div>


                <div className="
                    bg-white
                    rounded-xl
                    shadow
                    p-6
                ">

                    <MdSchool className="
                        text-3xl
                        text-green-600
                    " />

                    <p className="
                        text-gray-500
                        mt-3
                    ">

                        Teachers

                    </p>

                    <h2 className="
                        text-3xl
                        font-bold
                        mt-1
                    ">

                        {loading ? "..." : stats.teachers}

                    </h2>

                </div>


                <div className="
                    bg-white
                    rounded-xl
                    shadow
                    p-6
                ">

                    <MdClass className="
                        text-3xl
                        text-purple-600
                    " />

                    <p className="
                        text-gray-500
                        mt-3
                    ">

                        Classes

                    </p>

                    <h2 className="
                        text-3xl
                        font-bold
                        mt-1
                    ">

                        {loading ? "..." : stats.classes}

                    </h2>

                </div>

            </div>


            <div className="
                grid
                grid-cols-1
                md:grid-cols-3
                gap-6
                mt-8
            ">

                <button
                    onClick={() =>
                        navigate("/timetable")
                    }
                    className="
                        bg-white
                        border
                        rounded-xl
                        shadow
                        p-6
                        text-left
                        hover:bg-gray-50
                    "
                >

                    <MdCalendarMonth className="
                        text-3xl
                        text-blue-600
                    " />

                    <h2 className="
                        font-bold
                        mt-3
                    ">

                        Timetable

                    </h2>

                    <p className="
                        text-sm
                        text-gray-500
                        mt-1
                    ">

                        Monitor school timetable.

                    </p>

                </button>


                <button
                    onClick={() =>
                        navigate("/examination")
                    }
                    className="
                        bg-white
                        border
                        rounded-xl
                        shadow
                        p-6
                        text-left
                        hover:bg-gray-50
                    "
                >

                    <MdAssessment className="
                        text-3xl
                        text-orange-600
                    " />

                    <h2 className="
                        font-bold
                        mt-3
                    ">

                        Examination

                    </h2>

                    <p className="
                        text-sm
                        text-gray-500
                        mt-1
                    ">

                        Monitor examination activities.

                    </p>

                </button>


                <button
                    onClick={() =>
                        navigate("/students")
                    }
                    className="
                        bg-white
                        border
                        rounded-xl
                        shadow
                        p-6
                        text-left
                        hover:bg-gray-50
                    "
                >

                    <MdPeople className="
                        text-3xl
                        text-green-600
                    " />

                    <h2 className="
                        font-bold
                        mt-3
                    ">

                        Students

                    </h2>

                    <p className="
                        text-sm
                        text-gray-500
                        mt-1
                    ">

                        Review student records.

                    </p>

                </button>

            </div>

        </div>

    );

}


export default DeputyHeadmasterDashboard;