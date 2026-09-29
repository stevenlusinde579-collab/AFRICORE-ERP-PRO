import React, {
    useEffect,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import {
    FaArrowLeft,
    FaBook,
    FaSpinner,
    FaExclamationTriangle
} from "react-icons/fa";

import {
    supabase
} from "../../services/supabase";

import {
    useSchool
} from "../../context/SchoolContext";


function ClassTeacherSubjects() {

    const navigate = useNavigate();

    const {
        schoolId,
        activeAcademicYearId,
        activeAcademicYear
    } = useSchool();

    const [
        subjects,
        setSubjects
    ] = useState([]);

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        error,
        setError
    ] = useState("");


    useEffect(() => {

        loadSubjects();

    }, [
        schoolId,
        activeAcademicYearId
    ]);


    const loadSubjects = async () => {

        try {

            setLoading(true);
            setError("");

            if (
                !schoolId ||
                !activeAcademicYearId
            ) {
                setSubjects([]);
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
                    "Your profile is not assigned to the current school."
                );
            }


            if (!profile?.teacher_id) {
                throw new Error(
                    "Your teacher profile is not linked."
                );
            }


            const {
                data: assignments,
                error: assignmentError
            } =
                await supabase
                    .from("teacher_assignments")
                    .select(`
                        id,
                        teacher_id,
                        subject_id,
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


            const validAssignments =
                Array.isArray(assignments)
                    ? assignments
                    : [];


            if (!validAssignments.length) {
                setSubjects([]);
                return;
            }


            const classIds = [
                ...new Set(
                    validAssignments
                        .map(
                            item =>
                                Number(item.class_id)
                        )
                        .filter(Boolean)
                )
            ];


            const subjectIds = [
                ...new Set(
                    validAssignments
                        .map(
                            item =>
                                Number(item.subject_id)
                        )
                        .filter(Boolean)
                )
            ];


            if (
                !classIds.length ||
                !subjectIds.length
            ) {
                setSubjects([]);
                return;
            }


            const {
                data: classes,
                error: classesError
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
                    );

            if (classesError) {
                throw classesError;
            }


            const {
                data: subjectRows,
                error: subjectError
            } =
                await supabase
                    .from("subjects")
                    .select(`
                        id,
                        subject_name,
                        subject_code,
                        education_level,
                        is_active
                    `)
                    .in(
                        "id",
                        subjectIds
                    );

            if (subjectError) {
                throw subjectError;
            }


            const classMap =
                new Map(
                    (classes || [])
                        .map(item => [
                            Number(item.id),
                            item
                        ])
                );


            const subjectMap =
                new Map(
                    (subjectRows || [])
                        .map(item => [
                            Number(item.id),
                            item
                        ])
                );


            const result = [];

            const seen =
                new Set();


            validAssignments.forEach(
                assignment => {

                    const classRow =
                        classMap.get(
                            Number(
                                assignment.class_id
                            )
                        );

                    const subjectRow =
                        subjectMap.get(
                            Number(
                                assignment.subject_id
                            )
                        );


                    if (
                        !classRow ||
                        !subjectRow
                    ) {
                        return;
                    }


                    const key =
                        `${assignment.class_id}-${assignment.subject_id}`;


                    if (seen.has(key)) {
                        return;
                    }


                    seen.add(key);


                    result.push({
                        assignmentId:
                            assignment.id,

                        classId:
                            assignment.class_id,

                        className:
                            classRow.class_name,

                        classShortName:
                            classRow.short_name,

                        subjectId:
                            assignment.subject_id,

                        subjectName:
                            subjectRow.subject_name,

                        subjectCode:
                            subjectRow.subject_code
                    });

                }
            );


            result.sort(
                (a, b) =>
                    String(
                        a.className || ""
                    ).localeCompare(
                        String(
                            b.className || ""
                        )
                    ) ||
                    String(
                        a.subjectName || ""
                    ).localeCompare(
                        String(
                            b.subjectName || ""
                        )
                    )
            );


            setSubjects(result);

        } catch (err) {

            console.error(
                "CLASS TEACHER SUBJECTS ERROR:",
                err
            );

            setError(
                err?.message ||
                "Failed to load your assigned subjects."
            );

            setSubjects([]);

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            <div className="max-w-6xl mx-auto">

                {/* HEADER */}

                <div className="flex items-start gap-4 mb-6">

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/dashboard")
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-100"
                    >
                        <FaArrowLeft />
                    </button>

                    <div>

                        <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
                            Class Teacher
                        </p>

                        <h1 className="text-3xl font-extrabold text-slate-900">
                            My Subjects
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Subjects assigned to your class for the current academic year.
                        </p>

                        {activeAcademicYear && (
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                                Academic Year:{" "}
                                {activeAcademicYear.year_name}
                            </p>
                        )}

                    </div>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

                        <FaExclamationTriangle className="mt-1" />

                        <div>
                            <p className="font-semibold">
                                Unable to load subjects
                            </p>

                            <p className="text-sm mt-1">
                                {error}
                            </p>
                        </div>

                    </div>

                )}


                {/* LOADING */}

                {loading && (

                    <div className="flex min-h-[300px] items-center justify-center">

                        <div className="flex items-center gap-3 text-slate-600">

                            <FaSpinner className="animate-spin" />

                            Loading your assigned subjects...

                        </div>

                    </div>

                )}


                {/* EMPTY */}

                {!loading &&
                    !error &&
                    subjects.length === 0 && (

                        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">

                            <FaBook className="mx-auto text-4xl text-slate-300" />

                            <h2 className="mt-4 text-lg font-bold text-slate-800">
                                No Assigned Subjects
                            </h2>

                            <p className="mt-2 text-sm text-slate-500">
                                No subject assignment was found for your class in the current academic year.
                            </p>

                        </div>

                    )}


                {/* SUBJECTS */}

                {!loading &&
                    subjects.length > 0 && (

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

                            {subjects.map(
                                item => (

                                    <button
                                        key={`${item.classId}-${item.subjectId}`}
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                `/subjects/profile/${item.subjectId}`
                                            )
                                        }
                                        className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition"
                                    >

                                        <div className="flex items-start justify-between">

                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">

                                                <FaBook />

                                            </div>

                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                                {item.subjectCode || "Subject"}
                                            </span>

                                        </div>


                                        <h2 className="mt-5 text-lg font-bold text-slate-900">
                                            {item.subjectName}
                                        </h2>


                                        <p className="mt-2 text-sm text-slate-500">
                                            Class:{" "}
                                            <span className="font-semibold text-slate-700">
                                                {item.className}
                                            </span>
                                        </p>


                                        <p className="mt-1 text-xs text-slate-400">
                                            Open subject profile
                                        </p>

                                    </button>

                                )
                            )}

                        </div>

                    )}

            </div>

        </div>

    );

}


export default ClassTeacherSubjects;