import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";

function ClassProfile() {
    const { id } = useParams();
    const navigate = useNavigate();

    // =====================================================
    // GLOBAL SCHOOL + ACADEMIC YEAR
    // =====================================================

    const {
        schoolId,
        activeAcademicYear,
        activeAcademicYearId,
        academicYearLoading,
        academicYearError,
    } = useSchool();

    // =====================================================
    // ROLE
    // =====================================================

    const {
        selectedRoleId,
        selectedProfileRoleId,
        selectedRoleName,
    } = useRole();

    const isSubjectTeacher =
        Number(selectedRoleId) === 5 ||
        String(selectedRoleName || "")
            .trim()
            .toLowerCase() === "subject teacher";

    // =====================================================
    // STATE
    // =====================================================

    const [classData, setClassData] = useState(null);

    const [students, setStudents] = useState([]);

    const [teacherSubjects, setTeacherSubjects] =
        useState([]);

    const [loading, setLoading] = useState(true);

    const [studentsLoading, setStudentsLoading] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    // =====================================================
    // GET CLASS
    // =====================================================

    const getClass = async () => {
        if (!schoolId || !activeAcademicYearId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            // =================================================
            // GET CLASS
            // =================================================

            const {
                data,
                error,
            } = await supabase
                .from("classes")
                .select("*")
                .eq("id", id)
                .eq("school_id", schoolId)
                .eq(
                    "academic_year_id",
                    activeAcademicYearId
                )
                .single();

            console.log(
                "CLASS PROFILE:",
                data
            );

            console.log(
                "CLASS PROFILE ERROR:",
                error
            );

            if (error || !data) {
                console.error(
                    "CLASS PROFILE ERROR:",
                    error
                );

                setClassData(null);

                setErrorMessage(
                    error?.message ||
                        "Class not found."
                );

                return;
            }

            // =================================================
            // SUBJECT TEACHER ACCESS CHECK
            // =================================================

            if (isSubjectTeacher) {

                // ---------------------------------------------
                // GET AUTH USER
                // ---------------------------------------------

                const {
                    data: authData,
                    error: authError,
                } = await supabase.auth.getUser();

                if (
                    authError ||
                    !authData?.user
                ) {
                    setClassData(null);

                    setErrorMessage(
                        "Unable to identify the current teacher."
                    );

                    return;
                }

                const userId =
                    authData.user.id;

                // ---------------------------------------------
                // GET PROFILE
                // ---------------------------------------------

                const {
                    data: profile,
                    error: profileError,
                } = await supabase
                    .from("profiles")
                    .select(
                        "id, full_name, school_id, role_id, teacher_id"
                    )
                    .eq("id", userId)
                    .maybeSingle();

                if (
                    profileError ||
                    !profile
                ) {
                    console.error(
                        "TEACHER PROFILE ERROR:",
                        profileError
                    );

                    setClassData(null);

                    setErrorMessage(
                        "Teacher profile could not be found."
                    );

                    return;
                }

                // ---------------------------------------------
                // TEACHER ID
                // ---------------------------------------------

                const teacherId =
                    profile.teacher_id;

                if (!teacherId) {
                    setClassData(null);

                    setErrorMessage(
                        "Your teacher account is not linked to a teacher record."
                    );

                    return;
                }

                // ---------------------------------------------
                // CHECK EXACT ASSIGNMENT
                // ---------------------------------------------

                const {
                    data: assignments,
                    error: assignmentError,
                } = await supabase
                    .from("teacher_assignments")
                    .select(
                        "id, teacher_id, subject_id, class_id, school_id"
                    )
                    .eq(
                        "teacher_id",
                        teacherId
                    )
                    .eq(
                        "school_id",
                        schoolId
                    )
                    .eq(
                        "class_id",
                        Number(id)
                    );

                console.log(
                    "CLASS TEACHER ASSIGNMENTS:",
                    assignments
                );

                if (assignmentError) {
                    console.error(
                        "CLASS ASSIGNMENT ERROR:",
                        assignmentError
                    );

                    setClassData(null);

                    setErrorMessage(
                        "Unable to verify your subject assignment for this class."
                    );

                    return;
                }

                // ---------------------------------------------
                // NO ASSIGNMENT
                // ---------------------------------------------

                if (
                    !assignments ||
                    assignments.length === 0
                ) {
                    setClassData(null);

                    setErrorMessage(
                        "You are not assigned to any subject in this class."
                    );

                    return;
                }

                // ---------------------------------------------
                // SUBJECT IDS
                // ---------------------------------------------

                const subjectIds = [
                    ...new Set(
                        assignments
                            .map(
                                (assignment) =>
                                    Number(
                                        assignment.subject_id
                                    )
                            )
                            .filter(
                                (subjectId) =>
                                    Number.isFinite(
                                        subjectId
                                    )
                            )
                    ),
                ];

                // ---------------------------------------------
                // LOAD SUBJECT INFORMATION
                // ---------------------------------------------

                if (
                    subjectIds.length > 0
                ) {
                    const {
                        data: subjects,
                        error: subjectError,
                    } = await supabase
                        .from("subjects")
                        .select(
                            "id, subject_name, subject_code"
                        )
                        .in(
                            "id",
                            subjectIds
                        );

                    if (subjectError) {
                        console.error(
                            "SUBJECT ERROR:",
                            subjectError
                        );
                    }

                    setTeacherSubjects(
                        subjects || []
                    );
                } else {
                    setTeacherSubjects([]);
                }
            }

            setClassData(data);

        } catch (error) {
            console.error(
                "GET CLASS EXCEPTION:",
                error
            );

            setClassData(null);

            setErrorMessage(
                error?.message ||
                    "Failed to load class."
            );
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // GET STUDENTS
    // =====================================================

    const getStudents = async () => {
        if (
            !schoolId ||
            !activeAcademicYearId ||
            !id
        ) {
            setStudents([]);
            return;
        }

        setStudentsLoading(true);

        try {
            // =================================================
            // SUBJECT TEACHER
            // =================================================

            if (isSubjectTeacher) {

                // ---------------------------------------------
                // GET AUTH USER
                // ---------------------------------------------

                const {
                    data: authData,
                    error: authError,
                } = await supabase.auth.getUser();

                if (
                    authError ||
                    !authData?.user
                ) {
                    setStudents([]);
                    return;
                }

                // ---------------------------------------------
                // GET PROFILE
                // ---------------------------------------------

                const {
                    data: profile,
                    error: profileError,
                } = await supabase
                    .from("profiles")
                    .select(
                        "id, teacher_id, school_id"
                    )
                    .eq(
                        "id",
                        authData.user.id
                    )
                    .maybeSingle();

                if (
                    profileError ||
                    !profile
                ) {
                    console.error(
                        "STUDENT TEACHER PROFILE ERROR:",
                        profileError
                    );

                    setStudents([]);
                    return;
                }

                const teacherId =
                    profile.teacher_id;

                if (!teacherId) {
                    setStudents([]);
                    return;
                }

                // ---------------------------------------------
                // VERIFY CLASS ASSIGNMENT
                // ---------------------------------------------

                const {
                    data: assignments,
                    error: assignmentError,
                } = await supabase
                    .from("teacher_assignments")
                    .select(
                        "id, subject_id, class_id"
                    )
                    .eq(
                        "teacher_id",
                        teacherId
                    )
                    .eq(
                        "school_id",
                        schoolId
                    )
                    .eq(
                        "class_id",
                        Number(id)
                    );

                if (
                    assignmentError ||
                    !assignments ||
                    assignments.length === 0
                ) {
                    setStudents([]);
                    return;
                }

                // ---------------------------------------------
                // GET STUDENTS IN ASSIGNED CLASS
                // ---------------------------------------------
                //
                // A Subject Teacher sees students belonging
                // to the class where the teacher has a subject
                // assignment.
                //
                // ---------------------------------------------

                const {
                    data,
                    error,
                } = await supabase
                    .from("students")
                    .select(
                        `
                        id,
                        admission_number,
                        admission_no,
                        first_name,
                        middle_name,
                        last_name,
                        gender,
                        student_status,
                        status,
                        current_class_id,
                        academic_year_id,
                        photo,
                        photo_url
                        `
                    )
                    .eq(
                        "school_id",
                        schoolId
                    )
                    .eq(
                        "academic_year_id",
                        activeAcademicYearId
                    )
                    .eq(
                        "current_class_id",
                        Number(id)
                    )
                    .order(
                        "first_name",
                        {
                            ascending: true,
                        }
                    );

                console.log(
                    "SUBJECT TEACHER STUDENTS:",
                    data
                );

                console.log(
                    "STUDENT ERROR:",
                    error
                );

                if (error) {
                    console.error(
                        "FETCH STUDENTS ERROR:",
                        error
                    );

                    setStudents([]);
                } else {
                    setStudents(data || []);
                }

                return;
            }

            // =================================================
            // NORMAL ROLES
            // =================================================

            const {
                data,
                error,
            } = await supabase
                .from("students")
                .select(
                    `
                    id,
                    admission_number,
                    admission_no,
                    first_name,
                    middle_name,
                    last_name,
                    gender,
                    student_status,
                    status,
                    current_class_id,
                    academic_year_id,
                    photo,
                    photo_url
                    `
                )
                .eq(
                    "school_id",
                    schoolId
                )
                .eq(
                    "academic_year_id",
                    activeAcademicYearId
                )
                .eq(
                    "current_class_id",
                    Number(id)
                )
                .order(
                    "first_name",
                    {
                        ascending: true,
                    }
                );

            console.log(
                "CLASS STUDENTS:",
                data
            );

            console.log(
                "CLASS STUDENTS ERROR:",
                error
            );

            if (error) {
                console.error(
                    "FETCH CLASS STUDENTS ERROR:",
                    error
                );

                setStudents([]);
            } else {
                setStudents(data || []);
            }

        } catch (error) {
            console.error(
                "GET STUDENTS EXCEPTION:",
                error
            );

            setStudents([]);
        } finally {
            setStudentsLoading(false);
        }
    };

    // =====================================================
    // LOAD CLASS
    // =====================================================

    useEffect(() => {
        if (
            schoolId &&
            activeAcademicYearId &&
            !academicYearLoading
        ) {
            getClass();
        }
    }, [
        id,
        schoolId,
        activeAcademicYearId,
        academicYearLoading,
        selectedRoleId,
        selectedProfileRoleId,
        selectedRoleName,
    ]);

    // =====================================================
    // LOAD STUDENTS AFTER CLASS ACCESS IS VERIFIED
    // =====================================================

    useEffect(() => {
        if (
            classData &&
            schoolId &&
            activeAcademicYearId &&
            !academicYearLoading
        ) {
            getStudents();
        }
    }, [
        classData,
        schoolId,
        activeAcademicYearId,
        academicYearLoading,
        selectedRoleId,
        selectedProfileRoleId,
        selectedRoleName,
    ]);

    // =====================================================
    // ACADEMIC YEAR LOADING
    // =====================================================

    if (academicYearLoading) {
        return (
            <div className="p-6">

                <div className="bg-white shadow rounded-xl p-6">
                    Loading academic year...
                </div>

            </div>
        );
    }

    // =====================================================
    // NO ACTIVE ACADEMIC YEAR
    // =====================================================

    if (!activeAcademicYearId) {
        return (
            <div className="p-6">

                <h1 className="text-3xl font-bold text-gray-800">
                    Class Profile
                </h1>

                <p className="text-gray-600 mt-2">
                    AfriCore ERP PRO
                </p>

                <div className="mt-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6">

                    <h2 className="font-semibold">
                        No Active Academic Year
                    </h2>

                    <p className="text-sm mt-2">
                        {academicYearError ||
                            "Please activate an academic year in Settings first."}
                    </p>

                    <button
                        onClick={() =>
                            navigate("/classes")
                        }
                        className="mt-4 bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded"
                    >
                        Back
                    </button>

                </div>

            </div>
        );
    }

    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {
        return (
            <div className="p-6">

                <div className="bg-white shadow rounded-xl p-6">
                    Loading class information...
                </div>

            </div>
        );
    }

    // =====================================================
    // CLASS NOT FOUND / NO ACCESS
    // =====================================================

    if (!classData) {
        return (
            <div className="p-6">

                <div className="bg-white shadow rounded-xl p-6">

                    <h2 className="text-xl font-semibold text-gray-800">
                        {isSubjectTeacher
                            ? "Class Access Restricted"
                            : "Class not found"}
                    </h2>

                    <p className="text-gray-500 mt-2">
                        {errorMessage ||
                            "This class does not belong to the current school or active academic year."}
                    </p>

                    <button
                        onClick={() =>
                            navigate("/classes")
                        }
                        className="mt-5 bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded"
                    >
                        Back to Classes
                    </button>

                </div>

            </div>
        );
    }

    // =====================================================
    // CLASS PROFILE
    // =====================================================

    return (
        <div className="p-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex justify-between items-center mb-6">

                <div>

                    <h1 className="text-3xl font-bold text-gray-800">
                        {isSubjectTeacher
                            ? "My Class"
                            : "Class Profile"}
                    </h1>

                    <p className="text-gray-600">
                        AfriCore ERP PRO
                    </p>

                </div>

                <button
                    onClick={() =>
                        navigate("/classes")
                    }
                    className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded"
                >
                    Back
                </button>

            </div>

            {/* =================================================
                ACTIVE ACADEMIC YEAR
                ================================================= */}

            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">

                <p className="text-sm text-blue-700">
                    Academic Year
                </p>

                <p className="font-semibold text-blue-900 mt-1">

                    {activeAcademicYear?.year_name || "-"}

                    {activeAcademicYear?.term
                        ? ` (${activeAcademicYear.term})`
                        : ""}

                </p>

            </div>

            {/* =================================================
                CLASS INFORMATION
                ================================================= */}

            <div className="bg-white shadow rounded-xl p-6">

                <h2 className="text-2xl font-bold mb-6">
                    {classData.class_name}
                </h2>

                <div className="grid md:grid-cols-2 gap-5">

                    {/* CLASS NAME */}

                    <p>
                        <strong>
                            Class Name:
                        </strong>{" "}
                        {classData.class_name || "-"}
                    </p>

                    {/* ACADEMIC LEVEL */}

                    <p>
                        <strong>
                            Academic Level:
                        </strong>{" "}
                        {classData.academic_level || "-"}
                    </p>

                    {/* SHORT NAME */}

                    <p>
                        <strong>
                            Short Name:
                        </strong>{" "}
                        {classData.short_name || "-"}
                    </p>

                    {/* ACADEMIC YEAR */}

                    <p>
                        <strong>
                            Academic Year:
                        </strong>{" "}
                        {activeAcademicYear?.year_name ||
                            "-"}
                    </p>

                    {/* TERM */}

                    <p>
                        <strong>
                            Term:
                        </strong>{" "}
                        {activeAcademicYear?.term ||
                            "-"}
                    </p>

                    {/* CLASS ID */}

                    <p>
                        <strong>
                            Class ID:
                        </strong>{" "}
                        {classData.id}
                    </p>

                    {/* CREATED AT */}

                    {!isSubjectTeacher && (
                        <p>
                            <strong>
                                Created At:
                            </strong>{" "}
                            {classData.created_at
                                ? new Date(
                                    classData.created_at
                                ).toLocaleString()
                                : "-"}
                        </p>
                    )}

                </div>

                {/* =================================================
                    SUBJECT TEACHER SUBJECTS
                    ================================================= */}

                {isSubjectTeacher && (
                    <div className="mt-7">

                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            My Subject{teacherSubjects.length !== 1 ? "s" : ""}
                        </h3>

                        {teacherSubjects.length === 0 ? (

                            <div className="bg-gray-50 border rounded-lg p-4 text-gray-500">
                                No subject assignment found.
                            </div>

                        ) : (

                            <div className="flex flex-wrap gap-3">

                                {teacherSubjects.map(
                                    (subject) => (

                                        <div
                                            key={subject.id}
                                            className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3"
                                        >

                                            <div className="font-semibold text-blue-900">
                                                {subject.subject_name ||
                                                    "-"}
                                            </div>

                                            {subject.subject_code && (
                                                <div className="text-sm text-blue-600 mt-1">
                                                    {subject.subject_code}
                                                </div>
                                            )}

                                        </div>

                                    )
                                )}

                            </div>

                        )}

                    </div>
                )}

            </div>

            {/* =================================================
                STUDENTS
                ================================================= */}

            <div className="mt-6 bg-white shadow rounded-xl overflow-hidden">

                <div className="px-6 py-5 border-b bg-gray-50">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">

                        <div>

                            <h2 className="text-xl font-semibold text-gray-800">
                                {isSubjectTeacher
                                    ? "Students in My Subject Class"
                                    : "Students in Class"}
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                {isSubjectTeacher
                                    ? "Students belonging to the class where you are assigned to teach."
                                    : "Students registered in this class."}
                            </p>

                        </div>

                        <div className="text-sm text-gray-500">
                            {students.length} student
                            {students.length !== 1
                                ? "s"
                                : ""}
                        </div>

                    </div>

                </div>

                {studentsLoading ? (

                    <div className="p-6 text-center text-gray-500">
                        Loading students...
                    </div>

                ) : students.length === 0 ? (

                    <div className="p-8 text-center text-gray-500">
                        No students found in this class for the active academic year.
                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full">

                            <thead className="bg-slate-900 text-white">

                                <tr>

                                    <th className="p-4 text-left">
                                        #
                                    </th>

                                    <th className="p-4 text-left">
                                        Admission No.
                                    </th>

                                    <th className="p-4 text-left">
                                        Student Name
                                    </th>

                                    <th className="p-4 text-left">
                                        Gender
                                    </th>

                                    <th className="p-4 text-left">
                                        Status
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                {students.map(
                                    (student, index) => (

                                        <tr
                                            key={student.id}
                                            className="border-b hover:bg-gray-50"
                                        >

                                            <td className="p-4 text-gray-600">
                                                {index + 1}
                                            </td>

                                            <td className="p-4 font-medium text-gray-800">
                                                {student.admission_number ||
                                                    student.admission_no ||
                                                    "-"}
                                            </td>

                                            <td className="p-4 font-medium text-gray-800">

                                                {[
                                                    student.first_name,
                                                    student.middle_name,
                                                    student.last_name,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ") ||
                                                    "-"}

                                            </td>

                                            <td className="p-4 text-gray-600">
                                                {student.gender ||
                                                    "-"}
                                            </td>

                                            <td className="p-4">

                                                <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">
                                                    {student.student_status ||
                                                        student.status ||
                                                        "Active"}
                                                </span>

                                            </td>

                                        </tr>

                                    )
                                )}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>

            {/* =================================================
                EDIT CLASS
                ================================================= */}

            {!isSubjectTeacher && (
                <div className="mt-6">

                    <button
                        onClick={() =>
                            navigate(
                                `/classes/edit/${classData.id}`
                            )
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded"
                    >
                        Edit Class
                    </button>

                </div>
            )}

        </div>
    );
}

export default ClassProfile;