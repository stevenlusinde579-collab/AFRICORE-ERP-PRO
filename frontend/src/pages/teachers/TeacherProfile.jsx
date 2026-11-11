import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../services/supabase";

const API_URL = import.meta.env.VITE_API_URL || "https://africore-erp-pro.onrender.com/api";

function TeacherProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [teacher, setTeacher] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    const getTeacher = useCallback(async () => {
        setLoading(true);
        const { data, error: queryError } = await supabase
            .from("teachers").select("*").eq("id", id).single();
        if (queryError) {
            console.error("Teacher Error:", queryError);
            setError(queryError.message || "Imeshindikana kupakia taarifa za Staff.");
        } else {
            setTeacher(data);
            setError("");
        }
        setLoading(false);
    }, [id]);

    useEffect(() => { getTeacher(); }, [getTeacher]);

    const resendCredentials = async () => {
        if (!teacher?.id) return;
        if (!window.confirm("Password ya sasa itabadilishwa. Password mpya itatumwa kwa SMS kwenye namba iliyosajiliwa. Username (email) itabaki ileile. Endelea?")) return;
        setResending(true);
        setNotice("");
        setError("");
        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Session imeisha. Ingia tena.");
            const response = await axios.post(`${API_URL}/teachers/${teacher.id}/resend-credentials`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotice(response?.data?.message || "Credentials zimetumwa.");
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError?.message || "Imeshindikana kutuma credentials.");
        } finally {
            setResending(false);
        }
    };

    if (loading) return <div className="p-6">Loading staff information...</div>;
    if (!teacher) return <div className="p-6">{error || "Staff not found"}</div>;

    const fullName = [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(" ");

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-bold">Staff Profile</h1>
                <button onClick={() => navigate(`/teachers/edit/${id}`)} className="rounded bg-blue-600 px-4 py-2 text-white">Edit Staff</button>
            </div>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
            {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div>}

            <section className="rounded-lg bg-white p-6 shadow">
                <div className="flex flex-wrap items-center gap-6">
                    {teacher.photo_url && <img src={teacher.photo_url} alt="Staff" className="h-32 w-32 rounded-full object-cover" />}
                    <div>
                        <h2 className="text-xl font-bold">{fullName}</h2>
                        <p>Employee Number: <strong>{teacher.employee_number || "-"}</strong></p>
                        <p>Status: <strong>{teacher.status || "-"}</strong></p>
                        <p>Staff Type: <strong>{teacher.staff_type || "-"}</strong></p>
                    </div>
                </div>
            </section>

            <div className="grid gap-5 md:grid-cols-2">
                <section className="rounded bg-white p-5 shadow">
                    <h3 className="mb-3 text-lg font-bold">Personal Information</h3>
                    <p>Gender: {teacher.gender || "-"}</p>
                    <p>Phone: {teacher.phone || "-"}</p>
                    <p>Email / Login Username: {teacher.email || "-"}</p>
                </section>
                <section className="rounded bg-white p-5 shadow">
                    <h3 className="mb-3 text-lg font-bold">Employment Information</h3>
                    <p>Employment Date: {teacher.employment_date || "-"}</p>
                    <p>Qualification: {teacher.qualification || "-"}</p>
                    <p>Specialization: {teacher.specialization || "-"}</p>
                </section>
            </div>

            <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Login Credentials</h3>
                <p className="mt-1 text-sm text-slate-600">Tuma tena username na password mpya kwa SMS ikiwa mtumishi hakupokea ujumbe wa mwanzo.</p>
                <div className="mt-3 space-y-1 text-sm">
                    <p>Username: <strong>{teacher.email || "Email haijawekwa"}</strong></p>
                    <p>SMS destination: <strong>{teacher.phone || "Namba haijawekwa"}</strong></p>
                </div>
                <button type="button" onClick={resendCredentials} disabled={resending || !teacher.email || !teacher.phone || String(teacher.status || "Active").toLowerCase() !== "active"} className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                    {resending ? "Inatuma..." : "Resend Credentials"}
                </button>
                {(!teacher.email || !teacher.phone) && <p className="mt-2 text-xs text-amber-700">Weka email na namba ya simu kwenye taarifa za Staff kabla ya kutuma credentials.</p>}
            </section>

            <section className="rounded bg-white p-5 shadow">
                <h3 className="mb-3 text-lg font-bold">System Information</h3>
                <p>Staff ID: {teacher.id}</p>
                <p>School ID: {teacher.school_id}</p>
                <p>Created At: {teacher.created_at}</p>
            </section>
        </div>
    );
}
export default TeacherProfile;
