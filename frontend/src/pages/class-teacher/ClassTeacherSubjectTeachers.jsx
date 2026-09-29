import React, {
    useEffect,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import {
    FaArrowLeft,
    FaChalkboardTeacher,
    FaSpinner,
    FaExclamationTriangle,
    FaBook
} from "react-icons/fa";

import {
    supabase
} from "../../services/supabase";

import {
    useSchool
} from "../../context/SchoolContext";


function ClassTeacherSubjectTeachers() {

    const navigate = useNavigate();

    const {
        schoolId,
        activeAcademicYearId,
        activeAcademicYear
    } = useSchool();


    const [
        teachers,
        setTeachers
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

        loadTeachers();

    }, [
        schoolId,
        activeAcademicYearId
    ]);


    const loadTeachers = async () => {

        try {

            setLoading(true);
            setError("");


            if (
                !schoolId ||
                !activeAcademicYearId
            ) {
                setTeachers([]);
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


            if (!profile?.teacher_id) {
                throw new Error(
                    "Your teacher profile is not linked."
                );
            }


            const {
                data: myAssignments,
                error: myAssignmentError
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

            if (myAssignmentError) {
                throw myAssignmentError;
            }


            const assignments =
                Array.isArray(
                    myAssignments
                )
                    ? myAssignments
                    : [];


            const classIds = [
                ...new Set(
                    assignments
                        .map(
                            item =>
                                Number(item.class_id)
                        )
                        .filter(Boolean)
                )
            ];


            if (!classIds.length) {
                setTeachers([]);
                return;
            }


            const {
                data: classes,
                error: classError
            } =
                await supabase
                    .from("classes")
                    .select(`
                        id,
                        class_name,
                        short_name,
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

            if (classError) {
                throw classError;
            }


            const validClassIds = [
                ...(classes || [])
            ].map(
                item =>
                    Number(item.id)
            );


            if (!validClassIds.length) {
                setTeachers([]);
                return;
            }


            const {
                data: allAssignments,
                error: allAssignmentError
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
                    .in(
                        "class_id",
                        validClassIds
                    );

            if (allAssignmentError) {
                throw allAssignmentError;
            }


            const classAssignments =
                Array.isArray(
                    allAssignments
                )
                    ? allAssignments
                    : [];


            const teacherIds = [
                ...new Set(
                    classAssignments
                        .map(
                            item =>
                                Number(item.teacher_id)
                        )
                        .filter(Boolean)
                )
            ];


            const subjectIds = [
                ...new Set(
                    classAssignments
                        .map(
                            item =>
                                Number(item.subject_id)
                        )
                        .filter(Boolean)
                )
            ];


            if (!teacherIds.length) {
                setTeachers([]);
                return;
            }


            const {
                data: teacherRows,
                error: teacherError
            } =
                await supabase
                    .from("teachers")
                    .select(`
                        id,
                        school_id,
                        employee_number,
                        first_name,
                        middle_name,
                        last_name,
                        phone,
                        email,
                        status
                    `)
                    .in(
                        "id",
                        teacherIds
                    );

            if (teacherError) {
                throw teacherError;
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
                        subject_code
                    `)
                    .in(
                        "id",
                        subjectIds
                    );

            if (subjectError) {
                throw subjectError;
            }


            const teacherMap =
                new Map(
                    (teacherRows || [])
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


            const classMap =
                new Map(
                    (classes || [])
                        .map(item => [
                            Number(item.id),
                            item
                        ])
                );


            const result = [];

            const seen =
                new Set();


            classAssignments.forEach(
                assignment => {

                    const teacher =
                        teacherMap.get(
                            Number(
                                assignment.teacher_id
                            )
                        );

                    const subject =
                        subjectMap.get(
                            Number(
                                assignment.subject_id
                            )
                        );

                    const classRow =
                        classMap.get(
                            Number(
                                assignment.class_id
                            )
                        );


                    if (
                        !teacher ||
                        !classRow
                    ) {
                        return;
                    }


                    const key =
                        `${assignment.teacher_id}-${assignment.class_id}-${assignment.subject_id}`;


                    if (seen.has(key)) {
                        return;
                    }


                    seen.add(key);


                    const fullName = [
                        teacher.first_name,
                        teacher.middle_name,
                        teacher.last_name
                    ]
                        .filter(Boolean)
                        .join(" ");


                    result.push({

                        id:
                            assignment.id,

                        teacherId:
                            assignment.teacher_id,

                        teacherName:
                            fullName ||
                            `Teacher #${assignment.teacher_id}`,

                        employeeNumber:
                            teacher.employee_number,

                        phone:
                            teacher.phone,

                        email:
                            teacher.email,

                        className:
                            classRow.class_name,

                        classId:
                            classRow.id,

                        subjectName:
                            subject?.subject_name ||
                            "Assigned Subject",

                        subjectCode:
                            subject?.subject_code ||
                            ""

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
                        a.teacherName || ""
                    ).localeCompare(
                        String(
                            b.teacherName || ""
                        )
                    )
            );


            setTeachers(result);

        } catch (err) {

            console.error(
                "CLASS TEACHER SUBJECT TEACHERS ERROR:",
                err
            );

            setError(
                err?.message ||
                "Failed to load subject teachers."
            );

            setTeachers([]);

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            <div className="max-w-7xl mx-auto">

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

                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                            Class Teacher
                        </p>

                        <h1 className="text-3xl font-extrabold text-slate-900">
                            My Subject Teachers
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Teachers assigned to teach subjects in your class.
                        </p>

                        {activeAcademicYear && (
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                                Academic Year:{" "}
                                {activeAcademicYear.year_name}
                            </p>
                        )}

                    </div>

                </div>


                {error && (

                    <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

                        <FaExclamationTriangle className="mt-1" />

                        <div>

                            <p className="font-semibold">
                                Unable to load teachers
                            </p>

                            <p className="text-sm mt-1">
                                {error}
                            </p>

                        </div>

                    </div>

                )}


                {loading && (

                    <div className="flex min-h-[300px] items-center justify-center">

                        <div className="flex items-center gap-3 text-slate-600">

                            <FaSpinner className="animate-spin" />

                            Loading assigned subject teachers...

                        </div>

                    </div>

                )}


                {!loading &&
                    !error &&
                    teachers.length === 0 && (

                        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">

                            <FaChalkboardTeacher className="mx-auto text-5xl text-slate-300" />

                            <h2 className="mt-4 text-lg font-bold text-slate-800">
                                No Subject Teachers Found
                            </h2>

                            <p className="mt-2 text-sm text-slate-500">
                                No teacher assignment was found for your class.
                            </p>

                        </div>

                    )}


                {!loading &&
                    teachers.length > 0 && (

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                            <div className="overflow-x-auto">

                                <table className="w-full text-left">

                                    <thead className="bg-slate-900 text-white">

                                        <tr>

                                            <th className="px-5 py-4 text-xs uppercase tracking-wider">
                                                Teacher
                                            </th>

                                            <th className="px-5 py-4 text-xs uppercase tracking-wider">
                                                Class
                                            </th>

                                            <th className="px-5 py-4 text-xs uppercase tracking-wider">
                                                Subject
                                            </th>

                                            <th className="px-5 py-4 text-xs uppercase tracking-wider">
                                                Employee No.
                                            </th>

                                            <th className="px-5 py-4 text-xs uppercase tracking-wider">
                                                Contact
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {teachers.map(
                                            item => (

                                                <tr
                                                    key={item.id}
                                                    className="border-t border-slate-100 hover:bg-slate-50"
                                                >

                                                    <td className="px-5 py-4">

                                                        <div className="flex items-center gap-3">

                                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">

                                                                <FaChalkboardTeacher />

                                                            </div>

                                                            <div>

                                                                <p className="font-bold text-slate-800">
                                                                    {item.teacherName}
                                                                </p>

                                                                <p className="text-xs text-slate-400">
                                                                    Subject Teacher
                                                                </p>

                                                            </div>

                                                        </div>

                                                    </td>


                                                    <td className="px-5 py-4 font-semibold text-slate-700">

                                                        {item.className}

                                                    </td>


                                                    <td className="px-5 py-4">

                                                        <div className="flex items-center gap-2">

                                                            <FaBook className="text-cyan-600" />

                                                            <div>

                                                                <p className="font-semibold text-slate-700">
                                                                    {item.subjectName}
                                                                </p>

                                                                {item.subjectCode && (
                                                                    <p className="text-xs text-slate-400">
                                                                        {item.subjectCode}
                                                                    </p>
                                                                )}

                                                            </div>

                                                        </div>

                                                    </td>


                                                    <td className="px-5 py-4 text-sm text-slate-600">

                                                        {item.employeeNumber || "-"}

                                                    </td>


                                                    <td className="px-5 py-4 text-sm text-slate-600">

                                                        <div>
                                                            {item.phone || "-"}
                                                        </div>

                                                        {item.email && (
                                                            <div className="text-xs text-slate-400">
                                                                {item.email}
                                                            </div>
                                                        )}

                                                    </td>

                                                </tr>

                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    )}

            </div>

        </div>

    );

}


export default ClassTeacherSubjectTeachers;