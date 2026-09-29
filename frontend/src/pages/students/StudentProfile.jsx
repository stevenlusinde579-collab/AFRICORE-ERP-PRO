import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";


function StudentProfile() {


    const { id } = useParams();

    const navigate = useNavigate();


    const {
        schoolId,
        activeAcademicYear,
        activeAcademicYearId,
        academicYearLoading,
        academicYearError
    } = useSchool();


    const [student, setStudent] = useState(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");




    useEffect(() => {

        if (academicYearLoading) {
            return;
        }


        if (!schoolId) {

            setError("School information is not available.");

            setLoading(false);

            return;
        }


        if (!activeAcademicYearId) {

            setError("No active academic year is currently selected.");

            setLoading(false);

            return;
        }


        getStudent(
            schoolId,
            activeAcademicYearId
        );


    }, [
        id,
        schoolId,
        activeAcademicYearId,
        academicYearLoading
    ]);









    const getStudent = async (
        currentSchoolId,
        currentAcademicYearId
    ) => {


        setLoading(true);

        setError("");



        const {
            data,
            error: studentError
        } = await supabase

            .from("students")

            .select("*")

            .eq("id", id)

            .eq("school_id", currentSchoolId)

            .eq(
                "academic_year_id",
                currentAcademicYearId
            )

            .single();





        if (studentError) {

            console.log(
                "PROFILE ERROR:",
                studentError
            );

            setStudent(null);

            setError(
                studentError.code === "PGRST116"
                    ? "Student not found in the active academic year."
                    : "Failed to load student information."
            );

        } else {

            setStudent(data);

        }



        setLoading(false);


    };









    if (academicYearLoading) {

        return (

            <div className="p-6">

                Loading academic year...

            </div>

        );

    }









    if (academicYearError) {

        return (

            <div className="p-6">

                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">

                    {academicYearError}

                </div>

            </div>

        );

    }









    if (!activeAcademicYearId) {

        return (

            <div className="p-6">

                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4">

                    No active academic year is currently selected.

                </div>

            </div>

        );

    }









    if (loading) {

        return (

            <div className="p-6">

                Loading student information...

            </div>

        );

    }









    if (!student) {

        return (

            <div className="p-6">


                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">

                    {error || "Student not found"}

                </div>


            </div>

        );

    }









    return (

        <div className="p-6">





            <div className="flex justify-between items-center mb-6">



                <div>

                    <h1 className="text-3xl font-bold">

                        Student Profile

                    </h1>



                    <p className="text-gray-600">

                        AfriCore ERP PRO

                    </p>


                </div>







                <button

                    onClick={() => navigate("/students")}

                    className="bg-gray-600 text-white px-5 py-2 rounded"

                >

                    Back

                </button>



            </div>









            <div className="bg-white shadow rounded-xl p-6">





                <h2 className="text-2xl font-bold mb-4">

                    {student.first_name}

                    {" "}

                    {student.middle_name}

                    {" "}

                    {student.last_name}

                </h2>





                <div className="grid md:grid-cols-2 gap-4">





                    <p>

                        <strong>Admission Number:</strong>

                        {" "}

                        {student.admission_number}

                    </p>







                    <p>

                        <strong>Gender:</strong>

                        {" "}

                        {student.gender}

                    </p>






                    <p>

                        <strong>Date Of Birth:</strong>

                        {" "}

                        {student.date_of_birth || "-"}

                    </p>






                    <p>

                        <strong>Class:</strong>

                        {" "}

                        {student.class_name || "-"}

                    </p>







                    <p>

                        <strong>Academic Year:</strong>

                        {" "}

                        {activeAcademicYear?.year_name || "-"}

                        {activeAcademicYear?.term
                            ? ` - ${activeAcademicYear.term}`
                            : ""}

                    </p>







                    <p>

                        <strong>Status:</strong>

                        {" "}

                        {student.status || student.student_status || "-"}

                    </p>







                    <p>

                        <strong>Phone:</strong>

                        {" "}

                        {student.phone || "-"}

                    </p>






                </div>



            </div>









            <div className="bg-white shadow rounded-xl p-6 mt-6">



                <h2 className="text-xl font-bold mb-4">

                    Parent Information

                </h2>





                <p>

                    Parent Name:

                    {" "}

                    {student.parent_name || "-"}

                </p>





                <p>

                    Parent Phone:

                    {" "}

                    {student.parent_phone || "-"}

                </p>






                <p>

                    Parent Email:

                    {" "}

                    {student.parent_email || "-"}

                </p>






            </div>







        </div>

    );


}



export default StudentProfile;