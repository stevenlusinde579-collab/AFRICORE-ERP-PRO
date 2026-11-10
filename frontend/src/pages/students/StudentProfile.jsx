import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import api from "../../services/api";
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
    const [portalHistory, setPortalHistory] = useState([]);
    const [portalLoading, setPortalLoading] = useState(false);
    const [portalMessage, setPortalMessage] = useState("");




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









    const loadParentPortalHistory = async (studentId = student?.id) => {
        if (!studentId) return;
        try {
            const response = await api.get(`/parent-portal/credential-history/${studentId}`);
            setPortalHistory(response.data?.history || []);
        } catch (historyError) {
            console.error("PARENT PORTAL HISTORY ERROR:", historyError);
        }
    };

    const resendParentPortalCredentials = async () => {
        if (!student?.id || portalLoading) return;
        setPortalLoading(true);
        setPortalMessage("");
        try {
            const response = await api.post(`/parent-portal/resend/${student.id}`);
            const sms = response.data?.sms;
            setPortalMessage(sms?.success ? "Parent Portal SMS imetumwa kupitia NewHope." : `Akaunti ipo lakini SMS haijatumwa: ${sms?.error || response.data?.message || "Jaribu tena."}`);
            await loadParentPortalHistory(student.id);
        } catch (sendError) {
            setPortalMessage(sendError.response?.data?.message || "Imeshindikana kutuma Parent Portal SMS.");
        } finally {
            setPortalLoading(false);
        }
    };

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
            loadParentPortalHistory(data.id);

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
                    type="button"
                    onClick={() => navigate("/parent-portal-management")}
                    className="mr-2 rounded bg-blue-700 px-5 py-2 text-white"
                >
                    Parent Portal Management
                </button>

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







            <div className="bg-white shadow rounded-xl p-6 mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold">Parent Portal Credentials</h2>
                        <p className="mt-1 text-sm text-gray-600">Tuma tena taarifa za kuingia kwa mzazi/mlezi kupitia NewHope SMS.</p>
                    </div>
                    <button type="button" onClick={resendParentPortalCredentials} disabled={portalLoading} className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">
                        {portalLoading ? "Inatuma..." : "Resend Parent Portal SMS"}
                    </button>
                </div>
                {portalMessage && <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{portalMessage}</p>}
                <div className="mt-5">
                    <h3 className="mb-2 font-semibold">SMS History</h3>
                    {portalHistory.length ? portalHistory.map((item) => (
                        <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm">
                            <span>{item.recipient_phone || "Namba haipo"} · {new Date(item.created_at).toLocaleString()}</span>
                            <span className={item.status === "failed" ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{item.status}</span>
                            {item.error_message && <span className="w-full text-xs text-red-600">{item.error_message}</span>}
                        </div>
                    )) : <p className="text-sm text-gray-500">Hakuna historia ya SMS ya Parent Portal bado.</p>}
                </div>
            </div>

        </div>

    );


}



export default StudentProfile;