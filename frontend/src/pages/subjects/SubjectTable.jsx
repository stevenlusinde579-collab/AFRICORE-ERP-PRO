import {
    useEffect,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import {
    supabase
} from "../../services/supabase";

import {
    useRole
} from "../../context/RoleContext";


function SubjectTable({ filters }) {


    const navigate = useNavigate();


    const {
        selectedRoleId
    } = useRole();


    const [subjects, setSubjects] = useState([]);

    const [loading, setLoading] = useState(true);




    // =========================================================
    // FETCH SUBJECTS
    // =========================================================

    const fetchSubjects = async () => {


        setLoading(true);


        try {


            // -------------------------------------------------
            // GET CURRENT AUTH USER
            // -------------------------------------------------

            const {
                data: {
                    user
                },
                error: userError
            } = await supabase.auth.getUser();


            if (userError) {

                console.log(
                    "AUTH USER ERROR:",
                    userError
                );

            }


            if (!user) {

                setSubjects([]);

                return;

            }




            // -------------------------------------------------
            // CURRENT SELECTED ROLE
            // -------------------------------------------------
            //
            // IMPORTANT:
            // RoleContext is the source of truth.
            //
            // Role 5 = Subject Teacher
            //
            // Do NOT inspect all profile_roles here to decide
            // whether the user is a Subject Teacher.
            //
            // This prevents a multi-role user from remaining
            // restricted after switching to another role.
            // -------------------------------------------------

            const currentRoleId =
                Number(selectedRoleId);




            console.log(
                "SUBJECT TABLE CURRENT ROLE:",
                currentRoleId
            );




            // =================================================
            // SUBJECT TEACHER
            // =================================================

            if (
                currentRoleId === 5
            ) {


                // -------------------------------------------------
                // GET PROFILE
                // -------------------------------------------------

                const {
                    data: profile,
                    error: profileError
                } = await supabase

                    .from("profiles")

                    .select(`
                        id,
                        role_id,
                        school_id,
                        teacher_id
                    `)

                    .eq(
                        "id",
                        user.id
                    )

                    .maybeSingle();


                if (profileError) {

                    console.log(
                        "PROFILE ERROR:",
                        profileError
                    );

                    setSubjects([]);

                    return;

                }




                console.log(
                    "SUBJECT TEACHER PROFILE:",
                    profile
                );




                const teacherId =
                    profile?.teacher_id;


                const schoolId =
                    profile?.school_id;




                // -------------------------------------------------
                // TEACHER ID / SCHOOL ID REQUIRED
                // -------------------------------------------------

                if (
                    teacherId === null ||
                    teacherId === undefined ||
                    schoolId === null ||
                    schoolId === undefined
                ) {

                    console.log(
                        "SUBJECT TEACHER HAS NO teacher_id OR school_id"
                    );

                    setSubjects([]);

                    return;

                }




                // -------------------------------------------------
                // GET ONLY THIS TEACHER'S ASSIGNMENTS
                // -------------------------------------------------

                const {
                    data: assignments,
                    error: assignmentsError
                } = await supabase

                    .from("teacher_assignments")

                    .select(`
                        id,
                        teacher_id,
                        school_id,
                        subject_id,
                        class_id
                    `)

                    .eq(
                        "teacher_id",
                        teacherId
                    )

                    .eq(
                        "school_id",
                        schoolId
                    );


                if (assignmentsError) {

                    console.log(
                        "TEACHER ASSIGNMENTS ERROR:",
                        assignmentsError
                    );

                    setSubjects([]);

                    return;

                }




                console.log(
                    "MY ASSIGNMENTS:",
                    assignments
                );




                // -------------------------------------------------
                // GET UNIQUE ASSIGNED SUBJECT IDS
                // -------------------------------------------------

                const subjectIds = [
                    ...new Set(

                        (assignments || [])

                            .map(
                                assignment =>
                                    Number(
                                        assignment.subject_id
                                    )
                            )

                            .filter(
                                id =>
                                    Number.isFinite(id)
                            )

                    )
                ];




                console.log(
                    "MY SUBJECT IDS:",
                    subjectIds
                );




                // -------------------------------------------------
                // NO ASSIGNMENTS
                // -------------------------------------------------

                if (
                    subjectIds.length === 0
                ) {

                    setSubjects([]);

                    return;

                }




                // -------------------------------------------------
                // LOAD ONLY ASSIGNED SUBJECTS
                // -------------------------------------------------

                const {
                    data: mySubjects,
                    error: subjectsError
                } = await supabase

                    .from("subjects")

                    .select("*")

                    .in(
                        "id",
                        subjectIds
                    )

                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );


                if (subjectsError) {

                    console.log(
                        "MY SUBJECTS ERROR:",
                        subjectsError
                    );

                    setSubjects([]);

                    return;

                }




                console.log(
                    "SUBJECT TEACHER SUBJECTS:",
                    mySubjects
                );


                setSubjects(
                    mySubjects || []
                );


                return;

            }




            // =================================================
            // ALL OTHER SELECTED ROLES
            // =================================================
            //
            // If user changes:
            //
            // Subject Teacher -> Academic Master
            // Subject Teacher -> Headmaster
            // Subject Teacher -> Super Admin
            //
            // this normal subjects query is used.
            // =================================================

            const {
                data,
                error
            } = await supabase

                .from("subjects")

                .select("*")

                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


            console.log(
                "NORMAL SUBJECTS:",
                data
            );


            console.log(
                "NORMAL SUBJECTS ERROR:",
                error
            );


            if (error) {

                console.log(
                    error.message
                );

                setSubjects([]);

            } else {

                setSubjects(
                    data || []
                );

            }


        } catch (error) {


            console.log(
                "FETCH SUBJECTS ERROR:",
                error
            );


            setSubjects([]);


        } finally {


            setLoading(false);


        }

    };




    // =========================================================
    // IMPORTANT
    // Re-fetch whenever the selected role changes.
    // =========================================================

    useEffect(() => {


        fetchSubjects();


    }, [
        selectedRoleId
    ]);




    // =========================================================
    // DELETE SUBJECT
    // =========================================================

    const deleteSubject = async (id) => {


        const confirmDelete =
            window.confirm(
                "Are you sure you want to delete this subject?"
            );


        if (!confirmDelete) {

            return;

        }




        const {
            error
        } = await supabase

            .from("subjects")

            .delete()

            .eq(
                "id",
                id
            );




        if (error) {

            alert(
                error.message
            );

            return;

        }




        fetchSubjects();


    };




    // =========================================================
    // SEARCH
    // =========================================================

    const filteredSubjects =
        subjects.filter(
            (item) => {


                const search =
                    filters?.search
                        ?.toLowerCase() || "";


                const name =
                    (
                        item.subject_name || ""
                    ).toLowerCase();


                return name.includes(
                    search
                );

            }
        );




    // =========================================================
    // LOADING
    // =========================================================

    if (loading) {


        return (

            <div className="bg-white p-6 rounded shadow">

                Loading subjects...

            </div>

        );

    }




    // =========================================================
    // TABLE
    // =========================================================

    return (

        <div className="bg-white rounded-xl shadow overflow-x-auto">


            <table className="w-full">


                <thead className="bg-slate-900 text-white">


                    <tr>


                        <th className="p-4 text-left">

                            Subject Name

                        </th>


                        <th className="p-4 text-left">

                            Code

                        </th>


                        <th className="p-4 text-left">

                            Status

                        </th>


                        <th className="p-4 text-center">

                            Actions

                        </th>


                    </tr>


                </thead>




                <tbody>


                    {


                        filteredSubjects.length === 0 ?


                            (

                                <tr>

                                    <td

                                        colSpan="4"

                                        className="p-6 text-center text-gray-500"

                                    >

                                        No subjects found

                                    </td>

                                </tr>

                            )


                            :


                            filteredSubjects.map(
                                (item) => (


                                    <tr

                                        key={item.id}

                                        className="border-b"

                                    >


                                        <td className="p-4">

                                            {
                                                item.subject_name || "-"
                                            }

                                        </td>




                                        <td className="p-4">

                                            {
                                                item.subject_code || "-"
                                            }

                                        </td>




                                        <td className="p-4">


                                            <span

                                                className={`px-3 py-1 rounded-full text-sm

                                                ${
                                                    item.status === "Active"

                                                        ?

                                                        "bg-green-100 text-green-700"

                                                        :

                                                        "bg-red-100 text-red-700"
                                                }

                                                `}

                                            >

                                                {
                                                    item.status || "Active"
                                                }

                                            </span>


                                        </td>




                                        <td className="p-4 text-center">


                                            <button

                                                onClick={() =>
                                                    navigate(
                                                        `/subjects/profile/${item.id}`
                                                    )
                                                }

                                                className="bg-green-600 text-white px-3 py-2 rounded mr-2"

                                            >

                                                View

                                            </button>




                                            <button

                                                onClick={() =>
                                                    navigate(
                                                        `/subjects/edit/${item.id}`
                                                    )
                                                }

                                                className="bg-blue-600 text-white px-3 py-2 rounded mr-2"

                                            >

                                                Edit

                                            </button>




                                            <button

                                                onClick={() =>
                                                    deleteSubject(
                                                        item.id
                                                    )
                                                }

                                                className="bg-red-600 text-white px-3 py-2 rounded"

                                            >

                                                Delete

                                            </button>


                                        </td>


                                    </tr>

                                )
                            )


                    }


                </tbody>


            </table>


        </div>

    );

}


export default SubjectTable;