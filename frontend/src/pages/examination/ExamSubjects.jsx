import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

function ExamSubjects() {
    const { examId } = useParams();
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [classes, setClasses] = useState([]);
    const [examSubjects, setExamSubjects] = useState([]);

    const [exam, setExam] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [loadingClasses, setLoadingClasses] = useState(false);

    const [form, setForm] = useState({
        subject_id: "",
        class_id: "",
        full_marks: 100,
        pass_marks: 40,
    });

    useEffect(() => {
        loadData();
    }, [examId]);

    // ============================================================
    // LOAD EVERYTHING
    // ============================================================

    const loadData = async () => {
        try {
            setLoading(true);

            // ----------------------------------------------------
            // GET EXAM
            // ----------------------------------------------------

            const {
                data: examData,
                error: examError,
            } = await supabase
                .from("exams")
                .select("*")
                .eq("id", Number(examId))
                .single();

            if (examError) {
                console.log("EXAM ERROR:", examError);
            }

            setExam(examData || null);

            // ----------------------------------------------------
            // GET SUBJECTS
            // ----------------------------------------------------

            const {
                data: sub,
                error: subError,
            } = await supabase
                .from("subjects")
                .select("id, subject_name")
                .order("subject_name");

            if (subError) {
                console.log("SUBJECT ERROR:", subError);
            }

            setSubjects(sub || []);

            // ----------------------------------------------------
            // GET CLASSES
            //
            // Initially empty.
            // They will be loaded according to selected subject.
            // ----------------------------------------------------

            setClasses([]);

            // ----------------------------------------------------
            // GET EXISTING EXAM SUBJECTS
            // ----------------------------------------------------

            const {
                data: existing,
                error: existingError,
            } = await supabase
                .from("exam_subjects")
                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    full_marks,
                    pass_marks,
                    subjects(
                        subject_name
                    ),
                    classes(
                        class_name
                    )
                `)
                .eq("exam_id", Number(examId))
                .order("id", { ascending: false });

            if (existingError) {
                console.log(
                    "EXAM SUBJECT ERROR:",
                    existingError
                );
            }

            setExamSubjects(existing || []);
        } catch (error) {
            console.log("LOAD EXAM SUBJECTS ERROR:", error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // LOAD CLASSES FOR SELECTED SUBJECT
    //
    // IMPORTANT:
    // A class can only be selected if that subject has been
    // assigned to a teacher for that class.
    // ============================================================

    const loadClassesForSubject = async (subjectId) => {
        if (!subjectId) {
            setClasses([]);
            return;
        }

        try {
            setLoadingClasses(true);

            // ----------------------------------------------------
            // GET TEACHER ASSIGNMENTS FOR THIS SUBJECT
            //
            // We intentionally do not filter teacher_id here.
            // Any teacher assigned to this subject/class makes
            // that subject/class pair valid for an examination.
            // ----------------------------------------------------

            let assignmentQuery = supabase
                .from("teacher_assignments")
                .select(`
                    subject_id,
                    class_id,
                    school_id
                `)
                .eq("subject_id", Number(subjectId));

            // ----------------------------------------------------
            // FILTER BY EXAM SCHOOL WHEN SCHOOL ID EXISTS
            // ----------------------------------------------------

            if (exam?.school_id) {
                assignmentQuery = assignmentQuery.eq(
                    "school_id",
                    exam.school_id
                );
            }

            const {
                data: assignments,
                error: assignmentError,
            } = await assignmentQuery;

            if (assignmentError) {
                console.log(
                    "TEACHER ASSIGNMENT ERROR:",
                    assignmentError
                );

                setClasses([]);
                return;
            }

            // ----------------------------------------------------
            // GET UNIQUE CLASS IDS
            // ----------------------------------------------------

            const classIds = [
                ...new Set(
                    (assignments || [])
                        .map((item) => Number(item.class_id))
                        .filter(Boolean)
                ),
            ];

            if (classIds.length === 0) {
                setClasses([]);
                return;
            }

            // ----------------------------------------------------
            // GET ACTUAL CLASS DETAILS
            // ----------------------------------------------------

            let classQuery = supabase
                .from("classes")
                .select("id, class_name")
                .in("id", classIds)
                .order("class_name");

            const {
                data: classData,
                error: classError,
            } = await classQuery;

            if (classError) {
                console.log(
                    "CLASS ERROR:",
                    classError
                );

                setClasses([]);
                return;
            }

            setClasses(classData || []);

            // ----------------------------------------------------
            // IF CURRENTLY SELECTED CLASS IS NO LONGER VALID,
            // CLEAR IT.
            // ----------------------------------------------------

            if (
                form.class_id &&
                !classIds.includes(Number(form.class_id))
            ) {
                setForm((previous) => ({
                    ...previous,
                    class_id: "",
                }));
            }
        } catch (error) {
            console.log(
                "LOAD SUBJECT CLASSES ERROR:",
                error
            );

            setClasses([]);
        } finally {
            setLoadingClasses(false);
        }
    };

    // ============================================================
    // HANDLE FORM CHANGE
    // ============================================================

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));

        // --------------------------------------------------------
        // SUBJECT CHANGED
        // --------------------------------------------------------

        if (name === "subject_id") {
            setForm((previous) => ({
                ...previous,
                subject_id: value,
                class_id: "",
            }));

            loadClassesForSubject(value);
        }
    };

    // ============================================================
    // ADD SUBJECT
    // ============================================================

    const addSubject = async (e) => {
        e.preventDefault();

        if (!examId) {
            alert("Examination ID is missing.");
            return;
        }

        if (!form.subject_id) {
            alert("Please select a subject.");
            return;
        }

        if (!form.class_id) {
            alert("Please select a class.");
            return;
        }

        const fullMarks = Number(form.full_marks);
        const passMarks = Number(form.pass_marks);

        if (!Number.isFinite(fullMarks) || fullMarks <= 0) {
            alert("Full marks must be greater than 0.");
            return;
        }

        if (!Number.isFinite(passMarks) || passMarks < 0) {
            alert("Pass marks cannot be negative.");
            return;
        }

        if (passMarks > fullMarks) {
            alert("Pass marks cannot be greater than full marks.");
            return;
        }

        setSaving(true);

        try {
            // ----------------------------------------------------
            // SAFETY CHECK:
            // VERIFY THAT THE SELECTED SUBJECT + CLASS PAIR
            // REALLY EXISTS IN TEACHER ASSIGNMENTS.
            // ----------------------------------------------------

            let assignmentQuery = supabase
                .from("teacher_assignments")
                .select(`
                    id,
                    teacher_id,
                    subject_id,
                    class_id,
                    school_id
                `)
                .eq(
                    "subject_id",
                    Number(form.subject_id)
                )
                .eq(
                    "class_id",
                    Number(form.class_id)
                );

            if (exam?.school_id) {
                assignmentQuery = assignmentQuery.eq(
                    "school_id",
                    exam.school_id
                );
            }

            const {
                data: assignments,
                error: assignmentError,
            } = await assignmentQuery;

            if (assignmentError) {
                console.log(
                    "ASSIGNMENT VALIDATION ERROR:",
                    assignmentError
                );

                alert(
                    "Unable to verify teacher assignment. Please try again."
                );

                return;
            }

            if (!assignments || assignments.length === 0) {
                alert(
                    "This subject is not assigned to any teacher for the selected class. Please select the correct class."
                );

                return;
            }

            // ----------------------------------------------------
            // CHECK DUPLICATE
            //
            // Same examination + same subject + same class
            // should not be inserted twice.
            // ----------------------------------------------------

            const {
                data: duplicate,
                error: duplicateError,
            } = await supabase
                .from("exam_subjects")
                .select("id")
                .eq("exam_id", Number(examId))
                .eq(
                    "subject_id",
                    Number(form.subject_id)
                )
                .eq(
                    "class_id",
                    Number(form.class_id)
                )
                .limit(1);

            if (duplicateError) {
                console.log(
                    "DUPLICATE CHECK ERROR:",
                    duplicateError
                );

                alert(
                    "Unable to check existing examination subject."
                );

                return;
            }

            if (duplicate && duplicate.length > 0) {
                alert(
                    "This subject is already added to this examination for the selected class."
                );

                return;
            }

            // ----------------------------------------------------
            // INSERT
            // ----------------------------------------------------

            const payload = {
                exam_id: Number(examId),
                subject_id: Number(form.subject_id),
                class_id: Number(form.class_id),
                full_marks: fullMarks,
                pass_marks: passMarks,
            };

            console.log(
                "ADDING EXAM SUBJECT:",
                payload
            );

            const {
                error: insertError,
            } = await supabase
                .from("exam_subjects")
                .insert([payload]);

            if (insertError) {
                console.log(
                    "INSERT EXAM SUBJECT ERROR:",
                    insertError
                );

                alert(insertError.message);
                return;
            }

            alert("Subject added successfully.");

            // ----------------------------------------------------
            // RESET FORM
            // ----------------------------------------------------

            setForm({
                subject_id: "",
                class_id: "",
                full_marks: 100,
                pass_marks: 40,
            });

            setClasses([]);

            // ----------------------------------------------------
            // RELOAD EXISTING EXAM SUBJECTS
            // ----------------------------------------------------

            await loadData();
        } catch (error) {
            console.log(
                "ADD EXAM SUBJECT ERROR:",
                error
            );

            alert(
                error?.message ||
                "Failed to add examination subject."
            );
        } finally {
            setSaving(false);
        }
    };

    // ============================================================
    // LOADING
    // ============================================================

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow">
                Loading Exam Subjects...
            </div>
        );
    }

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="space-y-6">

            {/* ====================================================
                HEADER
            ==================================================== */}

            <div className="bg-white p-6 rounded-xl shadow">

                <div className="flex justify-between items-center">

                    <div>

                        <h1 className="text-2xl font-bold">
                            Exam Subjects
                        </h1>

                        <p className="text-gray-500">
                            Manage subjects attached to this examination
                        </p>

                        {exam?.exam_name && (
                            <p className="text-sm text-blue-600 mt-1 font-medium">
                                {exam.exam_name}
                            </p>
                        )}

                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/examination/list")
                        }
                        className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                    >
                        Back
                    </button>

                </div>

            </div>


            {/* ====================================================
                ADD SUBJECT
            ==================================================== */}

            <div className="bg-white p-6 rounded-xl shadow">

                <h2 className="font-bold text-lg mb-4">
                    Add Subject To Exam
                </h2>

                <div className="mb-5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm">

                    <div className="font-semibold mb-1">
                        Teacher Assignment Protection
                    </div>

                    <div>
                        After selecting a subject, only classes where
                        that subject has been assigned to a teacher
                        will appear.
                    </div>

                    <div className="mt-1">
                        This keeps the examination subject connected
                        to the correct Subject Teacher.
                    </div>

                </div>


                <form
                    onSubmit={addSubject}
                    className="grid md:grid-cols-5 gap-4"
                >

                    {/* =================================================
                        SUBJECT
                    ================================================= */}

                    <select
                        name="subject_id"
                        value={form.subject_id}
                        onChange={handleChange}
                        className="border p-2 rounded"
                        required
                    >

                        <option value="">
                            Select Subject
                        </option>

                        {subjects.map((s) => (

                            <option
                                key={s.id}
                                value={s.id}
                            >
                                {s.subject_name}
                            </option>

                        ))}

                    </select>


                    {/* =================================================
                        CLASS
                    ================================================= */}

                    <select
                        name="class_id"
                        value={form.class_id}
                        onChange={handleChange}
                        className="border p-2 rounded"
                        required
                        disabled={
                            !form.subject_id ||
                            loadingClasses
                        }
                    >

                        <option value="">
                            {!form.subject_id
                                ? "Select Subject First"
                                : loadingClasses
                                    ? "Loading Classes..."
                                    : classes.length === 0
                                        ? "No Assigned Class"
                                        : "Select Class"}
                        </option>

                        {classes.map((c) => (

                            <option
                                key={c.id}
                                value={c.id}
                            >
                                {c.class_name}
                            </option>

                        ))}

                    </select>


                    {/* =================================================
                        FULL MARKS
                    ================================================= */}

                    <input
                        type="number"
                        name="full_marks"
                        value={form.full_marks}
                        onChange={handleChange}
                        className="border p-2 rounded"
                        min="1"
                        required
                        placeholder="Full Marks"
                    />


                    {/* =================================================
                        PASS MARKS
                    ================================================= */}

                    <input
                        type="number"
                        name="pass_marks"
                        value={form.pass_marks}
                        onChange={handleChange}
                        className="border p-2 rounded"
                        min="0"
                        required
                        placeholder="Pass Marks"
                    />


                    {/* =================================================
                        SAVE
                    ================================================= */}

                    <button
                        type="submit"
                        disabled={
                            saving ||
                            !form.subject_id ||
                            !form.class_id
                        }
                        className={`text-white rounded px-4 ${
                            saving ||
                            !form.subject_id ||
                            !form.class_id
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700"
                        }`}
                    >
                        {saving
                            ? "Adding..."
                            : "Add Subject"}
                    </button>

                </form>


                {/* ====================================================
                    NO ASSIGNMENT MESSAGE
                ==================================================== */}

                {form.subject_id &&
                    !loadingClasses &&
                    classes.length === 0 && (

                        <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">

                            <div className="font-semibold">
                                No teacher assignment found
                            </div>

                            <div className="mt-1">
                                The selected subject has not been
                                assigned to a teacher for any class
                                in this examination school.
                            </div>

                            <div className="mt-1">
                                Assign the subject to a teacher first
                                under the teacher assignment section,
                                then return here.
                            </div>

                        </div>

                    )}

            </div>


            {/* ====================================================
                EXISTING SUBJECTS
            ==================================================== */}

            <div className="bg-white rounded-xl shadow overflow-x-auto">

                <table className="w-full">

                    <thead className="bg-gray-100">

                        <tr>

                            <th className="p-3 text-left">
                                Subject
                            </th>

                            <th className="p-3 text-left">
                                Class
                            </th>

                            <th className="p-3 text-center">
                                Full Marks
                            </th>

                            <th className="p-3 text-center">
                                Pass Marks
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        {examSubjects.map((item) => (

                            <tr
                                key={item.id}
                                className="border-t"
                            >

                                <td className="p-3">

                                    {item.subjects?.subject_name ||
                                        "Unknown Subject"}

                                </td>


                                <td className="p-3">

                                    {item.classes?.class_name ||
                                        "Unknown Class"}

                                </td>


                                <td className="p-3 text-center">

                                    {item.full_marks}

                                </td>


                                <td className="p-3 text-center">

                                    {item.pass_marks}

                                </td>

                            </tr>

                        ))}


                        {examSubjects.length === 0 && (

                            <tr>

                                <td
                                    colSpan="4"
                                    className="p-6 text-center text-gray-500"
                                >
                                    No subjects added yet
                                </td>

                            </tr>

                        )}

                    </tbody>

                </table>

            </div>

        </div>
    );
}

export default ExamSubjects;