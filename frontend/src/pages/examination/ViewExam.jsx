import { useEffect, useState } from "react";
import {
    useNavigate,
    useParams
} from "react-router-dom";
import axios from "axios";

import {
    FaArrowLeft,
    FaEdit,
    FaFileUpload,
    FaRobot,
    FaCheckCircle,
    FaPen,
    FaChartBar,
    FaBook,
    FaCalendarAlt,
    FaClock,
    FaClipboardList,
    FaChalkboardTeacher,
    FaSpinner,
    FaHourglassHalf,
    FaTimesCircle
} from "react-icons/fa";

import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";
import { supabase } from "../../services/supabase";


const API_URL = "https://africore-erp-pro.onrender.com/api/exams";

const SUBJECT_TEACHER_ROLE_ID = 5;


function ViewExam() {

    const navigate = useNavigate();

    const { examId } = useParams();


    // =====================================================
    // GLOBAL SCHOOL / ACADEMIC YEAR
    // =====================================================

    const {
        school,
        activeAcademicYearId,
        activeAcademicYearName,
        academicYearLoading
    } = useSchool();


    // =====================================================
    // CURRENT ROLE
    // =====================================================

    const {
        selectedRoleId,
        loadingRoles
    } = useRole();


    const numericRoleId =
        selectedRoleId === null ||
        selectedRoleId === undefined
            ? null
            : Number(selectedRoleId);


    const isSubjectTeacher =
        numericRoleId === SUBJECT_TEACHER_ROLE_ID;


    // =====================================================
    // STATE
    // =====================================================

    const [exam, setExam] =
        useState(null);


    const [loading, setLoading] =
        useState(true);


    const [error, setError] =
        useState("");


    // =====================================================
    // SUBJECT TEACHER APPROVAL STATUS
    //
    // IMPORTANT:
    // This is ONLY for displaying approval progress.
    //
    // It does NOT control action cards.
    // =====================================================

    const [
        subjectTeacherApproval,
        setSubjectTeacherApproval
    ] = useState(null);


    const [
        subjectTeacherApprovalOptions,
        setSubjectTeacherApprovalOptions
    ] = useState([]);


    const [
        selectedApprovalExamSubjectId,
        setSelectedApprovalExamSubjectId
    ] = useState("");


    const [
        approvalLoading,
        setApprovalLoading
    ] = useState(false);


    // =====================================================
    // APPROVAL VALUE CHECK
    //
    // IMPORTANT:
    // approved_by_academic / deputy / headmaster store
    // approver UUID/ID values in the database.
    //
    // Therefore we must NOT compare them with === true.
    // Any non-null/non-empty value means approved.
    // =====================================================

    const isApprovalRecorded = (value) => {

        return (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        );

    };


    // =====================================================
    // LOAD SUBJECT TEACHER APPROVAL STATUS
    //
    // Loads ALL assigned Subject + Class combinations
    // that exist in this examination.
    //
    // This allows the teacher to switch between subjects.
    // =====================================================

    const loadSubjectTeacherApproval =
        async () => {

            if (!isSubjectTeacher) {
                return;
            }


            try {

                setApprovalLoading(true);


                // -------------------------------------------------
                // CURRENT USER
                // -------------------------------------------------

                const {
                    data: {
                        user
                    },
                    error: authError
                } = await supabase.auth.getUser();


                if (authError) {
                    throw authError;
                }


                if (!user?.id) {

                    setSubjectTeacherApproval({
                        found: false,
                        reason:
                            "Current user could not be identified."
                    });

                    setSubjectTeacherApprovalOptions([]);

                    return;
                }


                // -------------------------------------------------
                // PROFILE
                // -------------------------------------------------

                const {
                    data: profile,
                    error: profileError
                } = await supabase
                    .from("profiles")
                    .select(
                        "id, teacher_id, school_id"
                    )
                    .eq(
                        "id",
                        user.id
                    )
                    .maybeSingle();


                if (profileError) {
                    throw profileError;
                }


                if (!profile) {

                    setSubjectTeacherApproval({
                        found: false,
                        reason:
                            "Your profile could not be found."
                    });

                    setSubjectTeacherApprovalOptions([]);

                    return;
                }


                // -------------------------------------------------
                // TEACHER ID
                // -------------------------------------------------

                if (
                    profile.teacher_id ===
                        null ||
                    profile.teacher_id ===
                        undefined
                ) {

                    setSubjectTeacherApproval({
                        found: false,
                        reason:
                            "Your teacher record is not linked to this profile."
                    });

                    setSubjectTeacherApprovalOptions([]);

                    return;
                }


                // -------------------------------------------------
                // TEACHER ASSIGNMENTS
                // -------------------------------------------------

                const {
                    data: assignments,
                    error: assignmentError
                } = await supabase
                    .from("teacher_assignments")
                    .select(
                        "id, teacher_id, school_id, subject_id, class_id"
                    )
                    .eq(
                        "teacher_id",
                        Number(
                            profile.teacher_id
                        )
                    )
                    .eq(
                        "school_id",
                        Number(
                            profile.school_id
                        ));


                if (assignmentError) {
                    throw assignmentError;
                }


                const safeAssignments =
                    assignments || [];


                if (!safeAssignments.length) {

                    setSubjectTeacherApproval({
                        found: false,
                        reason:
                            "No teacher assignment was found."
                    });

                    setSubjectTeacherApprovalOptions([]);

                    return;
                }


                // -------------------------------------------------
                // EXAM SUBJECTS
                // -------------------------------------------------

                const {
                    data: examSubjects,
                    error: examSubjectsError
                } = await supabase
                    .from("exam_subjects")
                    .select(
                        [
                            "id",
                            "exam_id",
                            "subject_id",
                            "class_id",
                            "approved_by_academic",
                            "approved_by_deputy",
                            "approved_by_headmaster"
                        ].join(", ")
                    )
                    .eq(
                        "exam_id",
                        Number(examId)
                    );


                if (examSubjectsError) {
                    throw examSubjectsError;
                }


                const safeExamSubjects =
                    examSubjects || [];


                // -------------------------------------------------
                // FIND ALL EXACT SUBJECT + CLASS MATCHES
                //
                // IMPORTANT:
                // Assignment must match BOTH:
                // subject_id AND class_id.
                // -------------------------------------------------

                const matchedExamSubjects =
                    safeExamSubjects.filter(
                        (examSubject) => {

                            return safeAssignments.some(
                                (assignment) => {

                                    return (
                                        String(
                                            assignment.subject_id
                                        ) ===
                                            String(
                                                examSubject.subject_id
                                            ) &&
                                        String(
                                            assignment.class_id
                                        ) ===
                                            String(
                                                examSubject.class_id
                                            )
                                    );

                                }
                            );

                        }
                    );


                if (!matchedExamSubjects.length) {

                    setSubjectTeacherApproval({
                        found: false,
                        reason:
                            "No assigned Subject + Class was found in this examination."
                    });

                    setSubjectTeacherApprovalOptions([]);

                    setSelectedApprovalExamSubjectId("");

                    return;
                }


                // -------------------------------------------------
                // LOAD SUBJECT + CLASS DETAILS
                // -------------------------------------------------

                const approvalOptions =
                    await Promise.all(

                        matchedExamSubjects.map(
                            async (examSubject) => {

                                let subjectName =
                                    "Subject";

                                let subjectCode =
                                    "";

                                let className =
                                    "Class";


                                // -------------------------------------
                                // SUBJECT
                                // -------------------------------------

                                const {
                                    data: subject,
                                    error: subjectError
                                } = await supabase
                                    .from("subjects")
                                    .select(
                                        "id, subject_name, subject_code"
                                    )
                                    .eq(
                                        "id",
                                        examSubject.subject_id
                                    )
                                    .maybeSingle();


                                if (subjectError) {
                                    throw subjectError;
                                }


                                if (subject) {

                                    subjectName =
                                        subject.subject_name ||
                                        subject.subject_code ||
                                        "Subject";

                                    subjectCode =
                                        subject.subject_code ||
                                        "";

                                }


                                // -------------------------------------
                                // CLASS
                                // -------------------------------------

                                const {
                                    data: classRow,
                                    error: classError
                                } = await supabase
                                    .from("classes")
                                    .select(
                                        "id, class_name, short_name"
                                    )
                                    .eq(
                                        "id",
                                        examSubject.class_id
                                    )
                                    .maybeSingle();


                                if (classError) {
                                    throw classError;
                                }


                                if (classRow) {

                                    className =
                                        classRow.class_name ||
                                        classRow.short_name ||
                                        "Class";

                                }


                                // -------------------------------------
                                // APPROVAL FLAGS
                                //
                                // FIXED:
                                // These database fields contain UUID/ID
                                // values, not boolean true/false.
                                // -------------------------------------

                                const academicApproved =
                                    isApprovalRecorded(
                                        examSubject.approved_by_academic
                                    );


                                const deputyApproved =
                                    isApprovalRecorded(
                                        examSubject.approved_by_deputy
                                    );


                                const headmasterApproved =
                                    isApprovalRecorded(
                                        examSubject.approved_by_headmaster
                                    );


                                const allApproved =
                                    academicApproved &&
                                    deputyApproved &&
                                    headmasterApproved;


                                // -------------------------------------
                                // OVERALL STATUS
                                // -------------------------------------

                                let overallStatus =
                                    "Pending";


                                if (
                                    String(
                                        exam?.status || ""
                                    ).toLowerCase() ===
                                    "rejected"
                                ) {

                                    overallStatus =
                                        "Rejected";

                                } else if (
                                    allApproved
                                ) {

                                    overallStatus =
                                        "Approved";

                                }


                                return {

                                    examSubjectId:
                                        examSubject.id,

                                    subjectId:
                                        examSubject.subject_id,

                                    classId:
                                        examSubject.class_id,

                                    subjectName,

                                    subjectCode,

                                    className,

                                    academicApproved,

                                    deputyApproved,

                                    headmasterApproved,

                                    overallStatus

                                };

                            }
                        )

                    );


                // -------------------------------------------------
                // SORT SUBJECTS
                //
                // Makes the dropdown easier to use.
                // -------------------------------------------------

                approvalOptions.sort(
                    (a, b) => {

                        const first =
                            `${a.subjectName} ${a.className}`;

                        const second =
                            `${b.subjectName} ${b.className}`;

                        return first.localeCompare(
                            second
                        );

                    }
                );


                setSubjectTeacherApprovalOptions(
                    approvalOptions
                );


                // -------------------------------------------------
                // PRESERVE CURRENT SELECTION
                //
                // If current selected subject still exists,
                // keep it.
                //
                // Otherwise select the first available subject.
                // -------------------------------------------------

                const currentStillExists =
                    approvalOptions.some(
                        (item) =>
                            String(
                                item.examSubjectId
                            ) ===
                            String(
                                selectedApprovalExamSubjectId
                            )
                    );


                const nextExamSubjectId =
                    currentStillExists
                        ? String(
                            selectedApprovalExamSubjectId
                        )
                        : String(
                            approvalOptions[0]
                                .examSubjectId
                        );


                setSelectedApprovalExamSubjectId(
                    nextExamSubjectId
                );


                // -------------------------------------------------
                // SET CURRENT APPROVAL DISPLAY
                // -------------------------------------------------

                const selectedOption =
                    approvalOptions.find(
                        (item) =>
                            String(
                                item.examSubjectId
                            ) ===
                            String(
                                nextExamSubjectId
                            )
                    ) ||
                    approvalOptions[0];


                setSubjectTeacherApproval({
                    found: true,

                    examSubjectId:
                        selectedOption.examSubjectId,

                    subjectId:
                        selectedOption.subjectId,

                    classId:
                        selectedOption.classId,

                    subjectName:
                        selectedOption.subjectName,

                    subjectCode:
                        selectedOption.subjectCode,

                    className:
                        selectedOption.className,

                    academicApproved:
                        selectedOption.academicApproved,

                    deputyApproved:
                        selectedOption.deputyApproved,

                    headmasterApproved:
                        selectedOption.headmasterApproved,

                    overallStatus:
                        selectedOption.overallStatus

                });


            } catch (err) {

                console.error(
                    "SUBJECT TEACHER APPROVAL STATUS ERROR:",
                    err
                );


                setSubjectTeacherApproval({
                    found: false,
                    reason:
                        err?.message ||
                        "Unable to load approval status."
                });


                setSubjectTeacherApprovalOptions([]);

            } finally {

                setApprovalLoading(false);

            }

        };


    // =====================================================
    // CHANGE APPROVAL SUBJECT
    // =====================================================

    const handleApprovalSubjectChange =
        (event) => {

            const nextId =
                event.target.value;


            setSelectedApprovalExamSubjectId(
                nextId
            );


            const selectedOption =
                subjectTeacherApprovalOptions.find(
                    (item) =>
                        String(
                            item.examSubjectId
                        ) ===
                        String(nextId)
                );


            if (!selectedOption) {
                return;
            }


            setSubjectTeacherApproval({

                found: true,

                examSubjectId:
                    selectedOption.examSubjectId,

                subjectId:
                    selectedOption.subjectId,

                classId:
                    selectedOption.classId,

                subjectName:
                    selectedOption.subjectName,

                subjectCode:
                    selectedOption.subjectCode,

                className:
                    selectedOption.className,

                academicApproved:
                    selectedOption.academicApproved,

                deputyApproved:
                    selectedOption.deputyApproved,

                headmasterApproved:
                    selectedOption.headmasterApproved,

                overallStatus:
                    selectedOption.overallStatus

            });

        };


    // =====================================================
    // LOAD EXAM
    // =====================================================

    const loadExam = async () => {

        try {

            setLoading(true);

            setError("");

            setExam(null);


            // -------------------------------------------------
            // SAFETY CHECK
            // -------------------------------------------------

            if (!school?.id) {

                setError(
                    "School information is not available."
                );

                return;

            }


            if (!activeAcademicYearId) {

                setError(
                    "No active academic year is currently selected."
                );

                return;

            }


            if (!examId) {

                setError(
                    "Examination ID is missing."
                );

                return;

            }


            // -------------------------------------------------
            // LOAD EXAM
            // -------------------------------------------------

            const response = await axios.get(
                `${API_URL}/${examId}`,
                {
                    params: {

                        school_id:
                            Number(school.id),

                        academic_year_id:
                            Number(activeAcademicYearId)

                    }
                }
            );


            if (
                response.data &&
                response.data.success &&
                response.data.exam
            ) {

                const loadedExam =
                    response.data.exam;


                // -------------------------------------------------
                // ACADEMIC YEAR SAFETY
                // -------------------------------------------------

                if (
                    loadedExam.academic_year_id !==
                        undefined &&
                    loadedExam.academic_year_id !==
                        null &&
                    String(
                        loadedExam.academic_year_id
                    ) !==
                    String(activeAcademicYearId)
                ) {

                    setError(
                        "This examination does not belong to the active academic year."
                    );

                    return;

                }


                // -------------------------------------------------
                // SCHOOL SAFETY
                //
                // If school_id is NULL on the examination,
                // allow it.
                // -------------------------------------------------

                if (
                    loadedExam.school_id !==
                        undefined &&
                    loadedExam.school_id !==
                        null &&
                    String(
                        loadedExam.school_id
                    ) !==
                    String(school.id)
                ) {

                    setError(
                        "This examination does not belong to the current school."
                    );

                    return;

                }


                setExam(
                    loadedExam
                );


            } else {

                setError(
                    response.data?.message ||
                    "Failed to load examination."
                );

            }


        } catch (err) {

            console.error(
                "VIEW EXAM ERROR:",
                err
            );


            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Failed to load examination data."
            );


        } finally {

            setLoading(false);

        }

    };


    // =====================================================
    // EFFECT - LOAD EXAM
    // =====================================================

    useEffect(() => {

        if (academicYearLoading) {
            return;
        }


        if (loadingRoles) {
            return;
        }


        if (
            !school?.id ||
            !activeAcademicYearId ||
            !examId
        ) {

            return;

        }


        loadExam();

    }, [
        examId,
        school?.id,
        activeAcademicYearId,
        academicYearLoading,
        loadingRoles
    ]);


    // =====================================================
    // EFFECT - LOAD SUBJECT TEACHER APPROVAL
    //
    // IMPORTANT:
    // This does NOT block action cards.
    // =====================================================

    useEffect(() => {

        if (!isSubjectTeacher) {
            return;
        }


        if (!examId) {
            return;
        }


        if (!exam) {
            return;
        }


        loadSubjectTeacherApproval();

    }, [
        isSubjectTeacher,
        examId,
        exam?.id,
        exam?.status
    ]);


    // =====================================================
    // LOADING
    // =====================================================

    if (
        academicYearLoading ||
        loadingRoles ||
        loading
    ) {

        return (

            <div className="p-6">

                <div className="
                    bg-white
                    rounded-xl
                    shadow-sm
                    border
                    p-10
                    text-center
                    text-gray-500
                ">

                    <FaSpinner className="
                        animate-spin
                        text-blue-600
                        text-2xl
                        mx-auto
                        mb-3
                    " />

                    Loading examination...

                </div>

            </div>

        );

    }


    // =====================================================
    // ERROR
    // =====================================================

    if (error) {

        return (

            <div className="p-6">

                <button
                    onClick={() =>
                        navigate(
                            "/examination"
                        )
                    }
                    className="
                        flex
                        items-center
                        gap-2
                        mb-5
                        text-gray-600
                        hover:text-blue-600
                    "
                >

                    <FaArrowLeft />

                    Back to Exams

                </button>


                <div className="
                    bg-red-50
                    border
                    border-red-200
                    text-red-700
                    p-5
                    rounded-xl
                ">

                    {error}

                </div>

            </div>

        );

    }


    if (!exam) {

        return null;

    }


    // =====================================================
    // STATUS COLORS
    // =====================================================

    const statusColor =
        exam.status === "Approved"

            ? "bg-green-100 text-green-700"

            : exam.status === "Completed"

                ? "bg-blue-100 text-blue-700"

                : "bg-yellow-100 text-yellow-700";


    const aiColor =
        exam.ai_status === "Completed"

            ? "bg-green-100 text-green-700"

            : "bg-gray-100 text-gray-600";


    // =====================================================
    // APPROVAL DISPLAY HELPERS
    // =====================================================

    const approvalOverallColor =
        subjectTeacherApproval?.overallStatus ===
        "Approved"

            ? "bg-emerald-100 text-emerald-700"

            : subjectTeacherApproval?.overallStatus ===
              "Rejected"

                ? "bg-red-100 text-red-700"

                : "bg-amber-100 text-amber-700";


    const approvalStepClass = (
        approved
    ) => {

        return approved

            ? "border-emerald-200 bg-emerald-50"

            : "border-amber-200 bg-amber-50";

    };


    // =====================================================
    // ACTION CARDS
    // =====================================================

    const actionCards = [];


    // =====================================================
    // UPLOAD PAPER
    // =====================================================

    actionCards.push({

        title: "Upload Paper",

        description:
            isSubjectTeacher
                ? "Upload the examination paper for your assigned subject and class."
                : "Upload examination paper for this examination.",

        icon: <FaFileUpload />,

        color:
            "bg-blue-50 text-blue-600 border-blue-100",

        hover:
            "hover:bg-blue-100",

        path:
            isSubjectTeacher
                ? `/examination/${exam.id}/subject-upload`
                : `/examination/${exam.id}/upload`

    });


    // =====================================================
    // AI ANALYSIS
    // =====================================================

    actionCards.push({

        title: "AI Analysis",

        description:
            isSubjectTeacher
                ? "View AI analysis for your assigned examination subject."
                : "Analyze the uploaded examination paper using AI.",

        icon: <FaRobot />,

        color:
            "bg-purple-50 text-purple-600 border-purple-100",

        hover:
            "hover:bg-purple-100",

        path:
            `/examination/${exam.id}/ai-analysis`

    });


    // =====================================================
    // APPROVAL FOR OTHER ROLES
    // =====================================================

    if (!isSubjectTeacher) {

        actionCards.push({

            title: "Approval",

            description:
                "Manage examination approval workflow.",

            icon: <FaCheckCircle />,

            color:
                "bg-green-50 text-green-600 border-green-100",

            hover:
                "hover:bg-green-100",

            path:
                `/examination/${exam.id}/approval`

        });

    }


    // =====================================================
    // ENTER MARKS
    // =====================================================

    actionCards.push({

        title: "Enter Marks",

        description:
            isSubjectTeacher
                ? "Enter marks for your assigned subject and class."
                : "Enter marks for subjects and classes assigned to this examination.",

        icon: <FaPen />,

        color:
            "bg-orange-50 text-orange-600 border-orange-100",

        hover:
            "hover:bg-orange-100",

        path:
            `/examination/${exam.id}/marks`

    });


    // =====================================================
    // RESULTS ANALYSIS
    // =====================================================

    actionCards.push({

        title: "Results Analysis",

        description:
            isSubjectTeacher
                ? "View results analysis for your assigned class and subject."
                : "Analyze examination results after marks entry.",

        icon: <FaChartBar />,

        color:
            "bg-indigo-50 text-indigo-600 border-indigo-100",

        hover:
            "hover:bg-indigo-100",

        path:
            `/examination/${exam.id}/results-analysis`

    });


    // =====================================================
    // SUBJECTS & CLASSES
    // =====================================================

    if (!isSubjectTeacher) {

        actionCards.push({

            title: "Subjects & Classes",

            description:
                "Manage subjects and classes assigned to this examination.",

            icon: <FaBook />,

            color:
                "bg-cyan-50 text-cyan-600 border-cyan-100",

            hover:
                "hover:bg-cyan-100",

            path:
                `/examination/${exam.id}/subjects`

        });

    }


    // =====================================================
    // UI
    // =====================================================

    return (

        <div className="p-6 space-y-6">


            {/* ======================================
                BACK BUTTON
            ====================================== */}

            <button
                onClick={() =>
                    navigate(
                        "/examination"
                    )
                }
                className="
                    flex
                    items-center
                    gap-2
                    text-gray-600
                    hover:text-blue-600
                    font-medium
                "
            >

                <FaArrowLeft />

                Back to Exams

            </button>



            {/* ======================================
                EXAM HEADER
            ====================================== */}

            <div className="
                bg-white
                border
                rounded-2xl
                shadow-sm
                p-6
            ">

                <div className="
                    flex
                    flex-col
                    lg:flex-row
                    lg:items-center
                    lg:justify-between
                    gap-5
                ">


                    <div>

                        <div className="
                            flex
                            items-center
                            gap-3
                            mb-2
                        ">

                            <FaClipboardList
                                className="
                                    text-blue-600
                                    text-2xl
                                "
                            />

                            <h1 className="
                                text-2xl
                                font-bold
                                text-gray-800
                            ">

                                {exam.exam_name}

                            </h1>

                        </div>


                        <p className="
                            text-gray-500
                        ">

                            Examination Management

                        </p>


                        {/* SUBJECT TEACHER LABEL */}

                        {isSubjectTeacher && (

                            <div className="
                                mt-3
                                inline-flex
                                items-center
                                gap-2
                                px-3
                                py-1
                                rounded-full
                                bg-indigo-50
                                text-indigo-700
                                text-xs
                                font-semibold
                            ">

                                <FaChalkboardTeacher />

                                Subject Teacher

                            </div>

                        )}


                        {/* ACTIVE ACADEMIC YEAR */}

                        {activeAcademicYearName && (

                            <div className="
                                mt-3
                                inline-flex
                                items-center
                                px-3
                                py-1
                                rounded-full
                                bg-blue-50
                                text-blue-700
                                text-xs
                                font-semibold
                            ">

                                Academic Year:

                                <span className="ml-1">

                                    {activeAcademicYearName}

                                </span>

                            </div>

                        )}

                    </div>



                    {/* STATUS */}

                    <div className="
                        flex
                        items-center
                        gap-3
                        flex-wrap
                    ">

                        <span className={`
                            px-4
                            py-2
                            rounded-full
                            text-sm
                            font-semibold
                            ${statusColor}
                        `}>

                            {exam.status || "Draft"}

                        </span>


                        <span className={`
                            px-4
                            py-2
                            rounded-full
                            text-sm
                            font-semibold
                            ${aiColor}
                        `}>

                            AI:
                            {" "}
                            {exam.ai_status || "Pending"}

                        </span>

                    </div>

                </div>



                {/* ======================================
                    EXAM INFORMATION
                ====================================== */}

                <div className="
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    lg:grid-cols-4
                    gap-4
                    mt-6
                ">


                    {/* EXAM TYPE */}

                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaClipboardList />

                            Exam Type

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.exam_type || "-"}

                        </p>

                    </div>



                    {/* TERM */}

                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaCalendarAlt />

                            Term

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.term || "-"}

                        </p>

                    </div>



                    {/* EXAMINATION PERIOD */}

                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaCalendarAlt />

                            Examination Period

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.start_date || "-"}

                            {" → "}

                            {exam.end_date || "-"}

                        </p>

                    </div>



                    {/* DURATION */}

                    <div className="
                        bg-gray-50
                        rounded-xl
                        p-4
                    ">

                        <div className="
                            flex
                            items-center
                            gap-2
                            text-gray-500
                            text-sm
                            mb-1
                        ">

                            <FaClock />

                            Duration

                        </div>

                        <p className="
                            font-semibold
                            text-gray-800
                        ">

                            {exam.duration_minutes || 0}

                            {" minutes"}

                        </p>

                    </div>


                </div>

            </div>



            {/* ======================================
                SUBJECT TEACHER WORKSPACE
            ====================================== */}

            {isSubjectTeacher && (

                <div className="
                    bg-indigo-50
                    border
                    border-indigo-100
                    rounded-2xl
                    p-5
                ">

                    <div className="
                        flex
                        items-start
                        gap-4
                    ">

                        <div className="
                            w-11
                            h-11
                            rounded-xl
                            bg-white
                            text-indigo-600
                            flex
                            items-center
                            justify-center
                            text-lg
                            shrink-0
                            shadow-sm
                        ">

                            <FaChalkboardTeacher />

                        </div>


                        <div>

                            <h2 className="
                                text-lg
                                font-bold
                                text-indigo-900
                            ">

                                Subject Teacher Examination Workspace

                            </h2>


                            <p className="
                                text-sm
                                text-indigo-700
                                mt-1
                                leading-6
                            ">

                                Choose the examination action below.
                                Your assigned subject and class will be
                                verified inside the selected action page.

                            </p>

                        </div>

                    </div>

                </div>

            )}



            {/* ======================================
                SUBJECT TEACHER APPROVAL SUMMARY
            ====================================== */}

            {isSubjectTeacher && (

                <div className="
                    bg-white
                    border
                    border-slate-200
                    rounded-2xl
                    shadow-sm
                    p-5
                ">

                    {/* ==================================
                        APPROVAL HEADER
                    ================================== */}

                    <div className="
                        flex
                        flex-col
                        lg:flex-row
                        lg:items-center
                        lg:justify-between
                        gap-4
                    ">

                        <div>

                            <div className="
                                flex
                                items-center
                                gap-2
                            ">

                                <FaCheckCircle
                                    className="
                                        text-emerald-600
                                    "
                                />

                                <h2 className="
                                    text-lg
                                    font-bold
                                    text-gray-800
                                ">

                                    Approval Status

                                </h2>

                            </div>


                            <p className="
                                text-sm
                                text-gray-500
                                mt-1
                            ">

                                Check the approval progress of each
                                subject and class assigned to you.

                            </p>

                        </div>


                        {/* ==================================
                            SUBJECT / CLASS SELECTOR
                        ================================== */}

                        {!approvalLoading &&
                            subjectTeacherApprovalOptions.length > 0 && (

                            <div className="
                                w-full
                                lg:w-auto
                                min-w-[280px]
                            ">

                                <label className="
                                    block
                                    text-xs
                                    font-bold
                                    uppercase
                                    tracking-wide
                                    text-gray-500
                                    mb-1.5
                                ">

                                    Subject / Class

                                </label>


                                <select
                                    value={
                                        selectedApprovalExamSubjectId
                                    }
                                    onChange={
                                        handleApprovalSubjectChange
                                    }
                                    className="
                                        w-full
                                        bg-white
                                        border
                                        border-slate-300
                                        rounded-xl
                                        px-4
                                        py-3
                                        text-sm
                                        font-semibold
                                        text-gray-800
                                        outline-none
                                        focus:ring-2
                                        focus:ring-blue-500
                                        focus:border-blue-500
                                    "
                                >

                                    {subjectTeacherApprovalOptions.map(
                                        (option) => (

                                            <option
                                                key={
                                                    option.examSubjectId
                                                }
                                                value={
                                                    option.examSubjectId
                                                }
                                            >

                                                {option.subjectName}

                                                {" — "}

                                                {option.className}

                                            </option>

                                        )
                                    )}

                                </select>

                            </div>

                        )}

                    </div>


                    {/* ==================================
                        CURRENT SUBJECT
                    ================================== */}

                    {!approvalLoading &&
                        subjectTeacherApproval?.found && (

                            <div className="
                                mt-5
                                flex
                                flex-col
                                sm:flex-row
                                sm:items-center
                                sm:justify-between
                                gap-3
                                bg-slate-50
                                border
                                border-slate-200
                                rounded-xl
                                p-4
                            ">

                                <div>

                                    <p className="
                                        text-xs
                                        font-bold
                                        uppercase
                                        tracking-wide
                                        text-gray-500
                                    ">

                                        Selected Examination Subject

                                    </p>


                                    <p className="
                                        mt-1
                                        text-base
                                        font-bold
                                        text-gray-800
                                    ">

                                        {subjectTeacherApproval.subjectName}

                                        {" — "}

                                        {subjectTeacherApproval.className}

                                    </p>


                                    {subjectTeacherApproval.subjectCode && (

                                        <p className="
                                            text-xs
                                            text-gray-500
                                            mt-1
                                        ">

                                            Subject Code:

                                            {" "}

                                            {subjectTeacherApproval.subjectCode}

                                        </p>

                                    )}

                                </div>


                                {/* OVERALL STATUS */}

                                <span className={`
                                    inline-flex
                                    items-center
                                    gap-2
                                    px-4
                                    py-2
                                    rounded-full
                                    text-sm
                                    font-bold
                                    ${approvalOverallColor}
                                `}>

                                    {subjectTeacherApproval.overallStatus ===
                                    "Approved"

                                        ? <FaCheckCircle />

                                        : subjectTeacherApproval.overallStatus ===
                                          "Rejected"

                                            ? <FaTimesCircle />

                                            : <FaHourglassHalf />
                                    }

                                    {subjectTeacherApproval.overallStatus}

                                </span>

                            </div>

                        )}


                    {/* ==================================
                        LOADING
                    ================================== */}

                    {approvalLoading && (

                        <div className="
                            mt-5
                            flex
                            items-center
                            gap-2
                            text-sm
                            text-gray-500
                        ">

                            <FaSpinner className="
                                animate-spin
                                text-blue-600
                            " />

                            Loading approval status...

                        </div>

                    )}


                    {/* ==================================
                        NOT FOUND
                    ================================== */}

                    {!approvalLoading &&
                        subjectTeacherApproval &&
                        !subjectTeacherApproval.found && (

                            <div className="
                                mt-5
                                rounded-xl
                                border
                                border-amber-200
                                bg-amber-50
                                p-4
                            ">

                                <div className="
                                    flex
                                    items-start
                                    gap-3
                                ">

                                    <FaHourglassHalf className="
                                        mt-0.5
                                        text-amber-600
                                    " />


                                    <div>

                                        <p className="
                                            text-sm
                                            font-semibold
                                            text-amber-900
                                        ">

                                            Approval subject status is not available yet.

                                        </p>


                                        <p className="
                                            text-sm
                                            text-amber-700
                                            mt-1
                                        ">

                                            {subjectTeacherApproval.reason ||
                                                "Your Subject + Class assignment will be verified on the action page."}

                                        </p>

                                    </div>

                                </div>

                            </div>

                        )}


                    {/* ==================================
                        APPROVAL STEPS
                    ================================== */}

                    {!approvalLoading &&
                        subjectTeacherApproval?.found && (

                            <div className="
                                mt-5
                                grid
                                grid-cols-1
                                md:grid-cols-3
                                gap-4
                            ">


                                {/* ==============================
                                    ACADEMIC MASTER
                                ============================== */}

                                <div className={`
                                    border
                                    rounded-xl
                                    p-4
                                    ${approvalStepClass(
                                        subjectTeacherApproval.academicApproved
                                    )}
                                `}>

                                    <div className="
                                        flex
                                        items-center
                                        justify-between
                                        gap-3
                                    ">

                                        <div>

                                            <p className="
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-gray-500
                                            ">

                                                Step 1

                                            </p>

                                            <p className="
                                                mt-1
                                                font-bold
                                                text-gray-800
                                            ">

                                                Academic Master

                                            </p>

                                        </div>


                                        {subjectTeacherApproval.academicApproved

                                            ? (
                                                <FaCheckCircle className="
                                                    text-emerald-600
                                                    text-xl
                                                " />
                                            )

                                            : (
                                                <FaHourglassHalf className="
                                                    text-amber-600
                                                    text-xl
                                                " />
                                            )
                                        }

                                    </div>


                                    <p className="
                                        mt-3
                                        text-xs
                                        font-semibold
                                    ">

                                        {subjectTeacherApproval.academicApproved
                                            ? "Approved"
                                            : "Pending"
                                        }

                                    </p>

                                </div>



                                {/* ==============================
                                    DEPUTY HEADMASTER
                                ============================== */}

                                <div className={`
                                    border
                                    rounded-xl
                                    p-4
                                    ${approvalStepClass(
                                        subjectTeacherApproval.deputyApproved
                                    )}
                                `}>

                                    <div className="
                                        flex
                                        items-center
                                        justify-between
                                        gap-3
                                    ">

                                        <div>

                                            <p className="
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-gray-500
                                            ">

                                                Step 2

                                            </p>


                                            <p className="
                                                mt-1
                                                font-bold
                                                text-gray-800
                                            ">

                                                Deputy Headmaster

                                            </p>

                                        </div>


                                        {subjectTeacherApproval.deputyApproved

                                            ? (
                                                <FaCheckCircle className="
                                                    text-emerald-600
                                                    text-xl
                                                " />
                                            )

                                            : (
                                                <FaHourglassHalf className="
                                                    text-amber-600
                                                    text-xl
                                                " />
                                            )
                                        }

                                    </div>


                                    <p className="
                                        mt-3
                                        text-xs
                                        font-semibold
                                    ">

                                        {subjectTeacherApproval.deputyApproved
                                            ? "Approved"
                                            : "Pending"
                                        }

                                    </p>

                                </div>



                                {/* ==============================
                                    HEADMASTER
                                ============================== */}

                                <div className={`
                                    border
                                    rounded-xl
                                    p-4
                                    ${approvalStepClass(
                                        subjectTeacherApproval.headmasterApproved
                                    )}
                                `}>

                                    <div className="
                                        flex
                                        items-center
                                        justify-between
                                        gap-3
                                    ">

                                        <div>

                                            <p className="
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-gray-500
                                            ">

                                                Step 3

                                            </p>


                                            <p className="
                                                mt-1
                                                font-bold
                                                text-gray-800
                                            ">

                                                Headmaster

                                            </p>

                                        </div>


                                        {subjectTeacherApproval.headmasterApproved

                                            ? (
                                                <FaCheckCircle className="
                                                    text-emerald-600
                                                    text-xl
                                                " />
                                            )

                                            : (
                                                <FaHourglassHalf className="
                                                    text-amber-600
                                                    text-xl
                                                " />
                                            )
                                        }

                                    </div>


                                    <p className="
                                        mt-3
                                        text-xs
                                        font-semibold
                                    ">

                                        {subjectTeacherApproval.headmasterApproved
                                            ? "Approved"
                                            : "Pending"
                                        }

                                    </p>

                                </div>

                            </div>

                        )}

                </div>

            )}



            {/* ======================================
                ACTIONS
            ====================================== */}

            <div>

                <div className="
                    flex
                    items-center
                    justify-between
                    mb-4
                    gap-4
                ">

                    <div>

                        <h2 className="
                            text-xl
                            font-bold
                            text-gray-800
                        ">

                            Examination Actions

                        </h2>


                        <p className="
                            text-sm
                            text-gray-500
                            mt-1
                        ">

                            {isSubjectTeacher
                                ? "Select an action for this examination. Your teacher assignment will be checked on the next page."
                                : "Select an action to manage this examination."
                            }

                        </p>

                    </div>


                    {/* EDIT EXAM */}

                    {!isSubjectTeacher && (

                        <button
                            onClick={() =>
                                navigate(
                                    `/examination/${exam.id}/edit`
                                )
                            }
                            className="
                                flex
                                items-center
                                gap-2
                                bg-gray-800
                                text-white
                                px-4
                                py-2
                                rounded-lg
                                hover:bg-gray-900
                            "
                        >

                            <FaEdit />

                            Edit Exam

                        </button>

                    )}

                </div>



                {/* ======================================
                    ACTION CARDS
                ====================================== */}

                <div className="
                    grid
                    grid-cols-1
                    md:grid-cols-2
                    xl:grid-cols-3
                    gap-5
                ">


                    {actionCards.map(
                        (card) => (

                            <button
                                key={card.title}
                                type="button"
                                onClick={() => {

                                    navigate(
                                        card.path
                                    );

                                }}
                                className="
                                    text-left
                                    bg-white
                                    border
                                    rounded-2xl
                                    p-6
                                    shadow-sm
                                    transition
                                    duration-200
                                    hover:shadow-md
                                    hover:-translate-y-0.5
                                    cursor-pointer
                                "
                            >

                                <div className="
                                    flex
                                    items-start
                                    justify-between
                                    gap-4
                                ">


                                    <div className={`
                                        w-12
                                        h-12
                                        rounded-xl
                                        flex
                                        items-center
                                        justify-center
                                        text-xl
                                        ${card.color}
                                    `}>

                                        {card.icon}

                                    </div>


                                    <span className="
                                        text-gray-300
                                        text-xl
                                    ">

                                        →

                                    </span>

                                </div>



                                <h3 className="
                                    text-lg
                                    font-bold
                                    text-gray-800
                                    mt-5
                                ">

                                    {card.title}

                                </h3>



                                <p className="
                                    text-sm
                                    text-gray-500
                                    mt-2
                                    leading-6
                                ">

                                    {card.description}

                                </p>


                                {isSubjectTeacher && (

                                    <div className="
                                        mt-4
                                        pt-3
                                        border-t
                                        text-xs
                                        text-indigo-600
                                    ">

                                        Your assigned subject/class will be
                                        verified on this page.

                                    </div>

                                )}

                            </button>

                        )
                    )}

                </div>

            </div>


        </div>

    );

}


export default ViewExam;