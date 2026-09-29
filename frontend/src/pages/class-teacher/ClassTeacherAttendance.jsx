import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import {
    FaArrowLeft,
    FaCheckCircle,
    FaSave,
    FaSpinner,
    FaUsers,
    FaExclamationTriangle
} from "react-icons/fa";

import {
    supabase
} from "../../services/supabase";

import {
    useSchool
} from "../../context/SchoolContext";


const STATUS_OPTIONS = [
    {
        value: "present",
        label: "Present"
    },
    {
        value: "absent",
        label: "Absent"
    },
    {
        value: "late",
        label: "Late"
    },
    {
        value: "excused",
        label: "Excused"
    }
];


function ClassTeacherAttendance() {

    const navigate = useNavigate();

    const {
        schoolId,
        activeAcademicYearId,
        activeAcademicYear
    } = useSchool();


    const [
        classes,
        setClasses
    ] = useState([]);

    const [
        selectedClassId,
        setSelectedClassId
    ] = useState("");


    const [
        students,
        setStudents
    ] = useState([]);


    const [
        attendance,
        setAttendance
    ] = useState({});


    const [
        attendanceDate,
        setAttendanceDate
    ] = useState(
        new Date()
            .toISOString()
            .slice(0, 10)
    );


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        studentsLoading,
        setStudentsLoading
    ] = useState(false);


    const [
        saving,
        setSaving
    ] = useState(false);


    const [
        error,
        setError
    ] = useState("");


    const [
        success,
        setSuccess
    ] = useState("");


    const [
        currentUserId,
        setCurrentUserId
    ] = useState(null);


    const [
        teacherId,
        setTeacherId
    ] = useState(null);


    useEffect(() => {

        loadAssignedClasses();

    }, [
        schoolId,
        activeAcademicYearId
    ]);


    useEffect(() => {

        if (
            selectedClassId &&
            attendanceDate
        ) {

            loadStudentsAndAttendance();

        }

    }, [
        selectedClassId,
        attendanceDate,
        activeAcademicYearId
    ]);


    const loadAssignedClasses = async () => {

        try {

            setLoading(true);
            setError("");
            setSuccess("");


            if (
                !schoolId ||
                !activeAcademicYearId
            ) {
                setClasses([]);
                return;
            }


            const {
                data: userData,
                error: userError
            } =
                await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }


            const user =
                userData?.user;

            if (!user) {
                throw new Error(
                    "User session not found."
                );
            }


            setCurrentUserId(user.id);


            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        teacher_id,
                        school_id
                    `)
                    .eq(
                        "id",
                        user.id
                    )
                    .single();


            if (profileError) {
                throw profileError;
            }


            if (
                Number(profile?.school_id) !==
                Number(schoolId)
            ) {
                throw new Error(
                    "Your profile is not assigned to this school."
                );
            }


            if (!profile?.teacher_id) {
                throw new Error(
                    "Your profile is not linked to a teacher."
                );
            }


            setTeacherId(
                Number(profile.teacher_id)
            );


            const {
                data: assignments,
                error: assignmentError
            } =
                await supabase
                    .from("teacher_assignments")
                    .select(`
                        id,
                        teacher_id,
                        class_id,
                        school_id
                    `)
                    .eq(
                        "school_id",
                        Number(schoolId)
                    )
                    .eq(
                        "teacher_id",
                        Number(profile.teacher_id)
                    );


            if (assignmentError) {
                throw assignmentError;
            }


            const classIds = [
                ...new Set(
                    (assignments || [])
                        .map(
                            item =>
                                Number(item.class_id)
                        )
                        .filter(Boolean)
                )
            ];


            if (!classIds.length) {
                setClasses([]);
                setSelectedClassId("");
                return;
            }


            const {
                data: classRows,
                error: classError
            } =
                await supabase
                    .from("classes")
                    .select(`
                        id,
                        class_name,
                        short_name,
                        academic_level,
                        academic_year_id
                    `)
                    .eq(
                        "school_id",
                        Number(schoolId)
                    )
                    .eq(
                        "academic_year_id",
                        Number(activeAcademicYearId)
                    )
                    .in(
                        "id",
                        classIds
                    )
                    .order(
                        "class_name",
                        {
                            ascending: true
                        }
                    );


            if (classError) {
                throw classError;
            }


            const rows =
                Array.isArray(classRows)
                    ? classRows
                    : [];


            setClasses(rows);


            if (rows.length) {

                const firstId =
                    String(rows[0].id);

                setSelectedClassId(
                    previous =>
                        rows.some(
                            item =>
                                String(item.id) ===
                                String(previous)
                        )
                            ? previous
                            : firstId
                );

            } else {

                setSelectedClassId("");

            }

        } catch (err) {

            console.error(
                "ATTENDANCE CLASS LOAD ERROR:",
                err
            );

            setError(
                err?.message ||
                "Failed to load your assigned class."
            );

            setClasses([]);

        } finally {

            setLoading(false);

        }

    };


    const loadStudentsAndAttendance =
        async () => {

            try {

                setStudentsLoading(true);
                setError("");
                setSuccess("");


                const classId =
                    Number(
                        selectedClassId
                    );


                if (
                    !classId ||
                    !schoolId ||
                    !activeAcademicYearId
                ) {
                    return;
                }


                const allowedClass =
                    classes.some(
                        item =>
                            Number(item.id) ===
                            classId
                    );


                if (!allowedClass) {

                    throw new Error(
                        "You are not allowed to record attendance for this class."
                    );

                }


                const {
                    data: studentRows,
                    error: studentError
                } =
                    await supabase
                        .from("students")
                        .select(`
                            id,
                            admission_number,
                            first_name,
                            middle_name,
                            last_name,
                            gender,
                            current_class_id,
                            academic_year_id,
                            student_status
                        `)
                        .eq(
                            "school_id",
                            Number(schoolId)
                        )
                        .eq(
                            "academic_year_id",
                            Number(activeAcademicYearId)
                        )
                        .eq(
                            "current_class_id",
                            classId
                        )
                        .order(
                            "first_name",
                            {
                                ascending: true
                            }
                        );


                if (studentError) {
                    throw studentError;
                }


                const studentList =
                    Array.isArray(
                        studentRows
                    )
                        ? studentRows
                        : [];


                setStudents(
                    studentList
                );


                const {
                    data: attendanceRows,
                    error: attendanceError
                } =
                    await supabase
                        .from("class_attendance")
                        .select(`
                            id,
                            student_id,
                            attendance_date,
                            status,
                            remarks
                        `)
                        .eq(
                            "school_id",
                            Number(schoolId)
                        )
                        .eq(
                            "academic_year_id",
                            Number(activeAcademicYearId)
                        )
                        .eq(
                            "class_id",
                            classId
                        )
                        .eq(
                            "attendance_date",
                            attendanceDate
                        );


                if (attendanceError) {
                    throw attendanceError;
                }


                const state = {};


                studentList.forEach(
                    student => {

                        state[
                            String(student.id)
                        ] = "present";

                    }
                );


                (
                    attendanceRows || []
                ).forEach(
                    row => {

                        state[
                            String(row.student_id)
                        ] =
                            row.status ||
                            "present";

                    }
                );


                setAttendance(state);

            } catch (err) {

                console.error(
                    "ATTENDANCE LOAD ERROR:",
                    err
                );

                setError(
                    err?.message ||
                    "Failed to load attendance."
                );

                setStudents([]);

            } finally {

                setStudentsLoading(false);

            }

        };


    const updateStatus = (
        studentId,
        status
    ) => {

        setAttendance(
            previous => ({
                ...previous,
                [String(studentId)]:
                    status
            })
        );

        setSuccess("");

    };


    const markAll = status => {

        const next = {};

        students.forEach(
            student => {

                next[
                    String(student.id)
                ] = status;

            }
        );

        setAttendance(next);
        setSuccess("");

    };


    const saveAttendance = async () => {

        try {

            setSaving(true);
            setError("");
            setSuccess("");


            if (
                !schoolId ||
                !activeAcademicYearId ||
                !selectedClassId ||
                !attendanceDate
            ) {
                throw new Error(
                    "School, academic year, class and attendance date are required."
                );
            }


            if (!students.length) {

                throw new Error(
                    "There are no students in this class."
                );

            }


            const classId =
                Number(
                    selectedClassId
                );


            const allowedClass =
                classes.some(
                    item =>
                        Number(item.id) ===
                        classId
                );


            if (!allowedClass) {

                throw new Error(
                    "This class is not assigned to you."
                );

            }


            const rows =
                students.map(
                    student => ({

                        school_id:
                            Number(
                                schoolId
                            ),

                        academic_year_id:
                            Number(
                                activeAcademicYearId
                            ),

                        class_id:
                            classId,

                        student_id:
                            Number(
                                student.id
                            ),

                        attendance_date:
                            attendanceDate,

                        status:
                            attendance[
                                String(
                                    student.id
                                )
                            ] ||
                            "present",

                        recorded_by:
                            currentUserId

                    })
                );


            const {
                error: saveError
            } =
                await supabase
                    .from("class_attendance")
                    .upsert(
                        rows,
                        {
                            onConflict:
                                "student_id,attendance_date"
                        }
                    );


            if (saveError) {
                throw saveError;
            }


            setSuccess(
                `Attendance saved successfully for ${students.length} student(s).`
            );

        } catch (err) {

            console.error(
                "ATTENDANCE SAVE ERROR:",
                err
            );

            setError(
                err?.message ||
                "Failed to save attendance."
            );

        } finally {

            setSaving(false);

        }

    };


    const summary =
        useMemo(
            () => {

                const result = {
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0
                };


                students.forEach(
                    student => {

                        const status =
                            attendance[
                                String(
                                    student.id
                                )
                            ] ||
                            "present";


                        if (
                            result[
                                status
                            ] !== undefined
                        ) {

                            result[
                                status
                            ]++;

                        }

                    }
                );


                return result;

            },
            [
                students,
                attendance
            ]
        );


    const getStudentName =
        student =>
            [
                student.first_name,
                student.middle_name,
                student.last_name
            ]
                .filter(Boolean)
                .join(" ");


    if (loading) {

        return (

            <div className="min-h-screen bg-slate-50 flex items-center justify-center">

                <div className="flex items-center gap-3 text-slate-600">

                    <FaSpinner className="animate-spin" />

                    Loading attendance...

                </div>

            </div>

        );

    }


    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            <div className="max-w-7xl mx-auto">

                {/* HEADER */}

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">

                    <div className="flex items-start gap-4">

                        <button
                            type="button"
                            onClick={() =>
                                navigate("/dashboard")
                            }
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-100"
                        >
                            <FaArrowLeft />
                        </button>

                        <div>

                            <p className="text-xs font-bold uppercase tracking-widest text-purple-600">
                                Class Teacher
                            </p>

                            <h1 className="text-3xl font-extrabold text-slate-900">
                                Class Attendance
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                Record attendance only for students in your assigned class.
                            </p>

                        </div>

                    </div>

                </div>


                {/* ACADEMIC YEAR */}

                {activeAcademicYear && (

                    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">

                        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                            Current Academic Year
                        </p>

                        <p className="mt-1 font-bold text-blue-900">
                            {activeAcademicYear.year_name}
                        </p>

                    </div>

                )}


                {/* ERROR */}

                {error && (

                    <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

                        <FaExclamationTriangle className="mt-1" />

                        <div>

                            <p className="font-semibold">
                                Attendance Error
                            </p>

                            <p className="text-sm mt-1">
                                {error}
                            </p>

                        </div>

                    </div>

                )}


                {/* SUCCESS */}

                {success && (

                    <div className="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">

                        <FaCheckCircle className="mt-1" />

                        <p className="font-semibold">
                            {success}
                        </p>

                    </div>

                )}


                {/* CONTROLS */}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Assigned Class
                            </label>

                            <select
                                value={selectedClassId}
                                onChange={event =>
                                    setSelectedClassId(
                                        event.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-purple-500"
                            >

                                <option value="">
                                    Select Class
                                </option>

                                {classes.map(
                                    item => (

                                        <option
                                            key={item.id}
                                            value={item.id}
                                        >
                                            {item.class_name}
                                        </option>

                                    )
                                )}

                            </select>

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Attendance Date
                            </label>

                            <input
                                type="date"
                                value={attendanceDate}
                                onChange={event =>
                                    setAttendanceDate(
                                        event.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-purple-500"
                            />

                        </div>


                        <div className="flex items-end">

                            <button
                                type="button"
                                onClick={saveAttendance}
                                disabled={
                                    saving ||
                                    studentsLoading ||
                                    !students.length
                                }
                                className="w-full rounded-xl bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                                {saving ? (

                                    <span className="flex items-center justify-center gap-2">

                                        <FaSpinner className="animate-spin" />

                                        Saving...

                                    </span>

                                ) : (

                                    <span className="flex items-center justify-center gap-2">

                                        <FaSave />

                                        Save Attendance

                                    </span>

                                )}

                            </button>

                        </div>

                    </div>

                </div>


                {/* SUMMARY */}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">

                        <p className="text-xs font-bold uppercase text-emerald-600">
                            Present
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-emerald-800">
                            {summary.present}
                        </p>

                    </div>


                    <div className="rounded-xl bg-red-50 border border-red-200 p-4">

                        <p className="text-xs font-bold uppercase text-red-600">
                            Absent
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-red-800">
                            {summary.absent}
                        </p>

                    </div>


                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">

                        <p className="text-xs font-bold uppercase text-amber-600">
                            Late
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-amber-800">
                            {summary.late}
                        </p>

                    </div>


                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">

                        <p className="text-xs font-bold uppercase text-blue-600">
                            Excused
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-blue-800">
                            {summary.excused}
                        </p>

                    </div>

                </div>


                {/* BULK ACTIONS */}

                {students.length > 0 && (

                    <div className="mb-4 flex flex-wrap gap-2">

                        <button
                            type="button"
                            onClick={() =>
                                markAll("present")
                            }
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                            Mark All Present
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                markAll("absent")
                            }
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                            Mark All Absent
                        </button>

                    </div>

                )}


                {/* STUDENTS */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                    <div className="border-b border-slate-200 px-5 py-4">

                        <div className="flex items-center gap-3">

                            <FaUsers className="text-purple-600" />

                            <div>

                                <h2 className="font-bold text-slate-900">
                                    Class Students
                                </h2>

                                <p className="text-xs text-slate-500">
                                    {students.length} student(s)
                                </p>

                            </div>

                        </div>

                    </div>


                    {studentsLoading ? (

                        <div className="flex min-h-[250px] items-center justify-center">

                            <div className="flex items-center gap-3 text-slate-600">

                                <FaSpinner className="animate-spin" />

                                Loading students...

                            </div>

                        </div>

                    ) : students.length === 0 ? (

                        <div className="p-10 text-center text-slate-500">

                            No students found in this assigned class.

                        </div>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="w-full">

                                <thead className="bg-slate-900 text-white">

                                    <tr>

                                        <th className="px-5 py-4 text-left text-xs uppercase tracking-wider">
                                            #
                                        </th>

                                        <th className="px-5 py-4 text-left text-xs uppercase tracking-wider">
                                            Student
                                        </th>

                                        <th className="px-5 py-4 text-left text-xs uppercase tracking-wider">
                                            Admission No.
                                        </th>

                                        <th className="px-5 py-4 text-left text-xs uppercase tracking-wider">
                                            Attendance
                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {students.map(
                                        (
                                            student,
                                            index
                                        ) => {

                                            const currentStatus =
                                                attendance[
                                                    String(
                                                        student.id
                                                    )
                                                ] ||
                                                "present";


                                            return (

                                                <tr
                                                    key={student.id}
                                                    className="border-t border-slate-100"
                                                >

                                                    <td className="px-5 py-4 text-sm text-slate-500">
                                                        {index + 1}
                                                    </td>


                                                    <td className="px-5 py-4">

                                                        <p className="font-semibold text-slate-800">
                                                            {getStudentName(student)}
                                                        </p>

                                                        {student.gender && (
                                                            <p className="text-xs text-slate-400">
                                                                {student.gender}
                                                            </p>
                                                        )}

                                                    </td>


                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {student.admission_number || "-"}
                                                    </td>


                                                    <td className="px-5 py-4">

                                                        <div className="flex flex-wrap gap-2">

                                                            {STATUS_OPTIONS.map(
                                                                option => (

                                                                    <button
                                                                        key={option.value}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateStatus(
                                                                                student.id,
                                                                                option.value
                                                                            )
                                                                        }
                                                                        className={
                                                                            currentStatus ===
                                                                            option.value
                                                                                ? "rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white"
                                                                                : "rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                                                                        }
                                                                    >
                                                                        {option.label}
                                                                    </button>

                                                                )
                                                            )}

                                                        </div>

                                                    </td>

                                                </tr>

                                            );

                                        }
                                    )}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            </div>

        </div>

    );

}


export default ClassTeacherAttendance;