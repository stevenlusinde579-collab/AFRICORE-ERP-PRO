import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

function AddTimetable() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requestedLevel = searchParams.get("level") || "";
    const { schoolId, activeAcademicYearId, loading: schoolLoading } = useSchool();

    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState(requestedLevel);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [form, setForm] = useState({
        day_name: "Monday",
        class_id: "",
        subject_id: "",
        teacher_id: "",
        period_id: "",
        start_time: "",
        end_time: "",
        session: "Morning",
    });

    const selectedClass = useMemo(
        () => classes.find((item) => Number(item.id) === Number(form.class_id)),
        [classes, form.class_id]
    );

    const levelSubjects = useMemo(
        () => subjects.filter((subject) => subject.education_level === selectedLevel),
        [subjects, selectedLevel]
    );

    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            if (schoolLoading || !schoolId) return;

            const [
                { data: classData, error: classError },
                { data: subjectData, error: subjectError },
                { data: teacherData, error: teacherError },
            ] = await Promise.all([
                supabase.from("classes")
                    .select("id, class_name, academic_level")
                    .eq("school_id", Number(schoolId))
                    .eq("is_active", true)
                    .order("class_name"),
                supabase.from("subjects")
                    .select("id, subject_name, education_level, is_active")
                    .eq("is_active", true)
                    .order("subject_name"),
                supabase.from("teachers")
                    .select("id, first_name, last_name")
                    .eq("school_id", Number(schoolId))
                    .order("first_name"),
            ]);

            if (classError || subjectError || teacherError) {
                if (!cancelled) {
                    setMessage(
                        classError?.message ||
                        subjectError?.message ||
                        teacherError?.message ||
                        "Unable to load timetable setup."
                    );
                }
                return;
            }

            if (cancelled) return;

            const levels = [...new Set((classData || [])
                .map((item) => String(item.academic_level || "").trim())
                .filter(Boolean))];

            const level = levels.includes(requestedLevel)
                ? requestedLevel
                : (levels[0] || "");

            setSelectedLevel(level);
            setClasses((classData || []).filter((item) => item.academic_level === level));
            setSubjects(subjectData || []);
            setTeachers(teacherData || []);
        };

        loadData();
        return () => { cancelled = true; };
    }, [schoolId, schoolLoading, requestedLevel]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((previous) => ({
            ...previous,
            [name]: value,
            ...(name === "class_id" ? { subject_id: "" } : {}),
        }));
    };

    const saveTimetable = async (event) => {
        event.preventDefault();
        setMessage("");

        if (!schoolId || Number(schoolId) <= 0) {
            setMessage("School information is unavailable. Please refresh and try again.");
            return;
        }
        if (!activeAcademicYearId) {
            setMessage("No active academic year found. Please activate an academic year first.");
            return;
        }
        if (!selectedClass || selectedClass.academic_level !== selectedLevel) {
            setMessage("Select a class belonging to the selected education level.");
            return;
        }
        if (!levelSubjects.some((subject) => Number(subject.id) === Number(form.subject_id))) {
            setMessage("Select a subject belonging to the selected education level.");
            return;
        }

        setLoading(true);

        const { data: existing, error: checkError } = await supabase
            .from("class_timetables")
            .select("id, subject_id")
            .eq("school_id", Number(schoolId))
            .eq("class_id", Number(form.class_id))
            .eq("period_id", Number(form.period_id))
            .eq("day_name", form.day_name)
            .or(`academic_year_id.is.null,academic_year_id.eq.${Number(activeAcademicYearId)}`);

        if (checkError) {
            setMessage(checkError.message);
            setLoading(false);
            return;
        }

        if ((existing || []).some((item) => Number(item.subject_id) === Number(form.subject_id))) {
            setMessage("This subject already exists in this class period.");
            setLoading(false);
            return;
        }

        const { data: teacherBusy, error: teacherCheckError } = await supabase
            .from("class_timetables")
            .select("id, period_id, start_time, end_time")
            .eq("school_id", Number(schoolId))
            .eq("teacher_id", Number(form.teacher_id))
            .eq("day_name", form.day_name)
            .or(`academic_year_id.is.null,academic_year_id.eq.${Number(activeAcademicYearId)}`);

        if (teacherCheckError) {
            setMessage(teacherCheckError.message);
            setLoading(false);
            return;
        }

        const toMinutes = (value) => {
            if (!value) return null;
            const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
            return (hours * 60) + minutes;
        };
        const newStart = toMinutes(form.start_time);
        const newEnd = toMinutes(form.end_time);
        const hasTeacherConflict = (teacherBusy || []).some((item) => {
            const busyStart = toMinutes(item.start_time);
            const busyEnd = toMinutes(item.end_time);
            if (newStart !== null && newEnd !== null && busyStart !== null && busyEnd !== null) {
                return newStart < busyEnd && newEnd > busyStart;
            }
            return Number(item.period_id) === Number(form.period_id);
        });

        if (hasTeacherConflict) {
            setMessage("This teacher is already assigned to another class during an overlapping time.");
            setLoading(false);
            return;
        }

        const { error } = await supabase.from("class_timetables").insert([{
            school_id: Number(schoolId),
            academic_year_id: Number(activeAcademicYearId),
            class_id: Number(form.class_id),
            subject_id: Number(form.subject_id),
            teacher_id: Number(form.teacher_id),
            period_id: Number(form.period_id),
            day_name: form.day_name,
            start_time: form.start_time,
            end_time: form.end_time,
            session: form.session,
        }]);

        if (error) {
            setMessage(error.message);
            setLoading(false);
            return;
        }

        setMessage("Timetable saved successfully.");
        setForm({
            day_name: "Monday",
            class_id: "",
            subject_id: "",
            teacher_id: "",
            period_id: "",
            start_time: "",
            end_time: "",
            session: "Morning",
        });
        setLoading(false);
    };

    if (schoolLoading) {
        return <div className="p-6">Loading school information...</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold">Add Timetable</h1>
            <p className="text-gray-600 mt-2 mb-4">
                Create timetable entries for one education level at a time.
            </p>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
                <span className="font-semibold">Education Level:</span> {selectedLevel || "Not available"}
            </div>

            <form onSubmit={saveTimetable} className="bg-white shadow rounded-xl p-6">
                <div className="grid md:grid-cols-2 gap-5">
                    <select name="day_name" value={form.day_name} onChange={handleChange} className="border p-3 rounded-lg">
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                            <option key={day} value={day}>{day}</option>
                        ))}
                    </select>

                    <select name="class_id" value={form.class_id} onChange={handleChange} required className="border p-3 rounded-lg">
                        <option value="">Select Class</option>
                        {classes.map((item) => (
                            <option key={item.id} value={item.id}>{item.class_name}</option>
                        ))}
                    </select>

                    <select name="subject_id" value={form.subject_id} onChange={handleChange} required className="border p-3 rounded-lg">
                        <option value="">Select Subject</option>
                        {levelSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{subject.subject_name}</option>
                        ))}
                    </select>

                    <select name="teacher_id" value={form.teacher_id} onChange={handleChange} required className="border p-3 rounded-lg">
                        <option value="">Select Teacher</option>
                        {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                                {teacher.first_name} {teacher.last_name}
                            </option>
                        ))}
                    </select>

                    <input type="number" min="1" name="period_id" placeholder="Period Number" value={form.period_id} onChange={handleChange} required className="border p-3 rounded-lg" />

                    <select name="session" value={form.session} onChange={handleChange} className="border p-3 rounded-lg">
                        <option value="Morning">Morning</option>
                        <option value="Evening">Evening</option>
                    </select>

                    <label className="block">
                        <span className="block mb-1">Start Time</span>
                        <input type="time" name="start_time" value={form.start_time} onChange={handleChange} required className="border p-3 rounded-lg w-full" />
                    </label>

                    <label className="block">
                        <span className="block mb-1">End Time</span>
                        <input type="time" name="end_time" value={form.end_time} onChange={handleChange} required className="border p-3 rounded-lg w-full" />
                    </label>
                </div>

                {message && <div className="mt-5 bg-gray-100 p-3 rounded">{message}</div>}

                <div className="flex gap-4 mt-6">
                    <button type="submit" disabled={loading || !selectedLevel} className="bg-blue-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg">
                        {loading ? "Saving..." : "Save Timetable"}
                    </button>
                    <button type="button" onClick={() => navigate("/timetable")} className="bg-gray-500 text-white px-6 py-3 rounded-lg">
                        Back
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AddTimetable;
