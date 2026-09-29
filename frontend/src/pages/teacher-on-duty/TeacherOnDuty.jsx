import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaCalendarAlt,
    FaUsers,
    FaCheckCircle,
    FaExclamationTriangle,
    FaFileAlt,
    FaClipboardCheck,
    FaUserShield,
    FaClock,
    FaMapMarkerAlt,
    FaClipboardList,
    FaUserClock,
    FaExchangeAlt,
    FaSyncAlt,
    FaChevronLeft,
    FaChevronRight,
    FaUserTie,
    FaPrint,
    FaSave,
    FaEye,
    FaTimes,
    FaArrowRight,
    FaInfoCircle,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import { supabase } from "../../services/supabase";


/* =========================================================
   SCHOOL TIMEZONE
========================================================= */

const SCHOOL_TIME_ZONE = "Africa/Dar_es_Salaam";


function TeacherOnDuty() {

    const navigate = useNavigate();


    /* =====================================================
       BASIC STATE
    ===================================================== */

    const [selectedDuty, setSelectedDuty] = useState(null);

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState("");

    const [user, setUser] = useState(null);

    const [profile, setProfile] = useState(null);

    const [teacher, setTeacher] = useState(null);

    const [academicYear, setAcademicYear] = useState(null);

    const [schoolSettings, setSchoolSettings] = useState(null);

    const [students, setStudents] = useState([]);

    const [classes, setClasses] = useState([]);

    const [attendance, setAttendance] = useState([]);

    const [timetable, setTimetable] = useState([]);

    const [dutySchedules, setDutySchedules] = useState([]);

    const [teacherDirectory, setTeacherDirectory] = useState([]);


    /* =====================================================
       CALENDAR
    ===================================================== */

    const [calendarMonth, setCalendarMonth] = useState(() => {

        const today = getSchoolTodayParts();

        return {
            year: today.year,
            month: today.month,
        };

    });


    const [selectedCalendarDate, setSelectedCalendarDate] =
        useState(() => getSchoolToday());


    /* =====================================================
       ATTENDANCE
    ===================================================== */

    const [attendanceDate, setAttendanceDate] =
        useState(() => getSchoolToday());

    const [attendanceDrafts, setAttendanceDrafts] =
        useState({});

    const [attendanceMessage, setAttendanceMessage] =
        useState("");

    const [attendanceSaving, setAttendanceSaving] =
        useState(false);


    /* =====================================================
       INCIDENTS
    ===================================================== */

    const [incidentForm, setIncidentForm] = useState({
        studentId: "",
        incidentType: "",
        description: "",
        actionTaken: "",
    });

    const [incidentMessage, setIncidentMessage] =
        useState("");

    const [incidents, setIncidents] =
        useState([]);

    const [selectedIncident, setSelectedIncident] =
        useState(null);


    /* =====================================================
       HANDOVER
    ===================================================== */

    const [handoverForm, setHandoverForm] = useState({
        summary: "",
        pendingIssues: "",
        instructions: "",
    });

    const [handoverMessage, setHandoverMessage] =
        useState("");

    const [savedHandover, setSavedHandover] =
        useState(null);


    /* =====================================================
       REPORT
    ===================================================== */

    const [reportForm, setReportForm] = useState({
        observations: "",
        attendanceSummary: "",
        incidentsSummary: "",
        actionsTaken: "",
        recommendations: "",
    });


    /* =====================================================
       DUTY CARDS
    ===================================================== */

    const dutyAreas = [
        {
            id: "schedule",
            title: "Duty Schedule",
            description: "View the complete teacher duty roster",
            icon: <FaCalendarAlt />,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-700",
            hover: "hover:bg-blue-50 hover:border-blue-300",
        },
        {
            id: "supervision",
            title: "Student Supervision",
            description: "Monitor students during duty",
            icon: <FaUsers />,
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-700",
            hover: "hover:bg-indigo-50 hover:border-indigo-300",
        },
        {
            id: "attendance",
            title: "Attendance & Latecomers",
            description: "Follow up attendance issues",
            icon: <FaCheckCircle />,
            iconBg: "bg-green-100",
            iconColor: "text-green-700",
            hover: "hover:bg-green-50 hover:border-green-300",
        },
        {
            id: "incidents",
            title: "Incidents & Discipline",
            description: "Record and follow up incidents",
            icon: <FaExclamationTriangle />,
            iconBg: "bg-orange-100",
            iconColor: "text-orange-700",
            hover: "hover:bg-orange-50 hover:border-orange-300",
        },
        {
            id: "report",
            title: "Duty Report",
            description: "Prepare and print daily duty report",
            icon: <FaFileAlt />,
            iconBg: "bg-purple-100",
            iconColor: "text-purple-700",
            hover: "hover:bg-purple-50 hover:border-purple-300",
        },
        {
            id: "handover",
            title: "Duty Handover",
            description: "Prepare handover for the next teacher",
            icon: <FaClipboardCheck />,
            iconBg: "bg-red-100",
            iconColor: "text-red-700",
            hover: "hover:bg-red-50 hover:border-red-300",
        },
    ];


    /* =====================================================
       DATE HELPERS
    ===================================================== */

    function getSchoolTodayParts() {

        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: SCHOOL_TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(new Date());


        const result = {};


        parts.forEach(item => {

            if (item.type !== "literal") {

                result[item.type] = item.value;

            }

        });


        return {
            year: Number(result.year),
            month: Number(result.month),
            day: Number(result.day),
        };

    }


    function getSchoolToday() {

        const today = getSchoolTodayParts();


        return [
            String(today.year),
            String(today.month).padStart(2, "0"),
            String(today.day).padStart(2, "0"),
        ].join("-");

    }


    const todayDate = useMemo(
        () => getSchoolToday(),
        []
    );


    const makeDateKey = (
        year,
        month,
        day
    ) => {

        return [
            String(year),
            String(month).padStart(2, "0"),
            String(day).padStart(2, "0"),
        ].join("-");

    };


    const getDateParts = value => {

        if (!value) return null;


        const cleanValue =
            String(value).slice(0, 10);


        const parts =
            cleanValue.split("-").map(Number);


        if (
            parts.length !== 3 ||
            parts.some(Number.isNaN)
        ) {

            return null;

        }


        return {
            year: parts[0],
            month: parts[1],
            day: parts[2],
        };

    };


    const formatDate = value => {

        if (!value) return "—";


        const parts =
            getDateParts(value);


        if (!parts) return value;


        const date =
            new Date(
                Date.UTC(
                    parts.year,
                    parts.month - 1,
                    parts.day,
                    12,
                    0,
                    0
                )
            );


        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
            }
        ).format(date);

    };


    const formatLongDate = value => {

        if (!value) return "—";


        const parts =
            getDateParts(value);


        if (!parts) return value;


        const date =
            new Date(
                Date.UTC(
                    parts.year,
                    parts.month - 1,
                    parts.day,
                    12,
                    0,
                    0
                )
            );


        return new Intl.DateTimeFormat(
            "en-GB",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
            }
        ).format(date);

    };


    const getRealDayName = value => {

        const parts =
            getDateParts(value);


        if (!parts) return "—";


        const date =
            new Date(
                Date.UTC(
                    parts.year,
                    parts.month - 1,
                    parts.day,
                    12,
                    0,
                    0
                )
            );


        return new Intl.DateTimeFormat(
            "en-US",
            {
                weekday: "long",
                timeZone: "UTC",
            }
        ).format(date);

    };


    const formatTime = value => {

        if (!value) return "—";

        return String(value).slice(0, 5);

    };


    /* =====================================================
       SCHOOL SETTINGS
    ===================================================== */

    const getSchoolValue = (
        key,
        fallback = ""
    ) => {

        if (!schoolSettings) {

            return fallback;

        }


        const value =
            schoolSettings[key];


        return (
            value === null ||
            value === undefined ||
            value === ""
        )
            ? fallback
            : value;

    };


    const schoolName =
        getSchoolValue(
            "school_name",
            "School"
        );


    const schoolRegistration =
        getSchoolValue(
            "registration_number",
            ""
        );


    const schoolAddress =
        getSchoolValue(
            "address",
            ""
        );


    const schoolPhone =
        getSchoolValue(
            "phone",
            ""
        );


    const schoolEmail =
        getSchoolValue(
            "email",
            ""
        );


    const schoolLogo =
        getSchoolValue(
            "logo",
            ""
        );


    const shouldShowSchoolField = field => {

        const setting =
            `show_${field}`;


        if (
            schoolSettings &&
            Object.prototype.hasOwnProperty.call(
                schoolSettings,
                setting
            )
        ) {

            return (
                schoolSettings[setting] !== false
            );

        }


        return true;

    };


    /* =====================================================
       TEACHER HELPERS
    ===================================================== */

    const buildTeacherName =
        teacherItem => {

            if (!teacherItem) return "";


            const fullName = [
                teacherItem.first_name,
                teacherItem.middle_name,
                teacherItem.last_name,
            ]
                .filter(Boolean)
                .join(" ")
                .trim();


            return (
                fullName ||
                teacherItem.full_name ||
                teacherItem.name ||
                teacherItem.teacher_name ||
                teacherItem.employee_name ||
                teacherItem.email ||
                ""
            );

        };


    const teacherName = useMemo(() => {

        const currentTeacher =
            teacherDirectory.find(
                item =>
                    Number(item.id) ===
                    Number(profile?.teacher_id)
            );


        return (
            buildTeacherName(
                currentTeacher
            ) ||
            buildTeacherName(
                teacher
            ) ||
            profile?.full_name ||
            "Assigned Teacher"
        );

    }, [
        teacherDirectory,
        teacher,
        profile,
    ]);


    const getTeacherName =
        teacherId => {

            const teacherItem =
                teacherDirectory.find(
                    item =>
                        Number(item.id) ===
                        Number(teacherId)
                );


            if (teacherItem) {

                return (
                    buildTeacherName(
                        teacherItem
                    ) ||
                    `Teacher #${teacherId}`
                );

            }


            if (
                Number(teacherId) ===
                Number(profile?.teacher_id)
            ) {

                return teacherName;

            }


            return `Teacher #${teacherId || "—"}`;

        };


    const isCurrentTeacherDuty =
        duty => {

            if (
                !duty ||
                profile?.teacher_id === null ||
                profile?.teacher_id === undefined
            ) {

                return false;

            }


            return (
                Number(duty.teacher_id) ===
                Number(profile.teacher_id)
            );

        };


    /* =====================================================
       STUDENT HELPERS
    ===================================================== */

    const getStudentName =
        studentId => {

            const student =
                students.find(
                    item =>
                        Number(item.id) ===
                        Number(studentId)
                );


            if (!student) {

                return "Unknown student";

            }


            return [
                student.first_name,
                student.middle_name,
                student.last_name,
            ]
                .filter(Boolean)
                .join(" ");

        };


    const getClassName =
        classId => {

            const classItem =
                classes.find(
                    item =>
                        Number(item.id) ===
                        Number(classId)
                );


            if (!classItem) {

                return "Class not found";

            }


            return (
                classItem.class_name ||
                classItem.short_name ||
                "Unnamed class"
            );

        };


    /* =====================================================
       LOAD DATA
    ===================================================== */

    const loadDutyData =
        async (
            showRefresh = false
        ) => {

            try {

                if (showRefresh) {

                    setRefreshing(true);

                }
                else {

                    setLoading(true);

                }


                setError("");


                const {
                    data: authData,
                    error: authError,
                } =
                    await supabase.auth.getUser();


                if (authError) {

                    throw new Error(
                        authError.message
                    );

                }


                const currentUser =
                    authData?.user;


                if (!currentUser) {

                    navigate(
                        "/login",
                        {
                            replace: true,
                        }
                    );

                    return;

                }


                setUser(currentUser);


                /* =========================================
                   PROFILE
                ========================================= */

                const {
                    data: profileData,
                    error: profileError,
                } =
                    await supabase
                        .from("profiles")
                        .select(`
                            id,
                            full_name,
                            phone,
                            school_id,
                            teacher_id,
                            employee_id,
                            role_id
                        `)
                        .eq(
                            "id",
                            currentUser.id
                        )
                        .maybeSingle();


                if (profileError) {

                    throw new Error(
                        profileError.message
                    );

                }


                if (!profileData) {

                    throw new Error(
                        "Your user profile was not found."
                    );

                }


                setProfile(
                    profileData
                );


                const schoolId =
                    profileData.school_id;


                /* =========================================
                   SCHOOL SETTINGS
                ========================================= */

                if (
                    schoolId !== null &&
                    schoolId !== undefined
                ) {

                    const {
                        data: schoolData,
                        error: schoolError,
                    } =
                        await supabase
                            .from("schools")
                            .select("*")
                            .eq(
                                "id",
                                schoolId
                            )
                            .maybeSingle();


                    if (schoolError) {

                        console.warn(
                            "School settings loading error:",
                            schoolError
                        );

                        setSchoolSettings(
                            null
                        );

                    }
                    else {

                        setSchoolSettings(
                            schoolData || null
                        );

                    }

                }


                /* =========================================
                   TEACHER PROFILE
                ========================================= */

                if (
                    profileData.teacher_id !== null &&
                    profileData.teacher_id !== undefined
                ) {

                    const {
                        data: teacherData,
                        error: teacherError,
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
                                status,
                                staff_type,
                                user_id
                            `)
                            .eq(
                                "id",
                                profileData.teacher_id
                            )
                            .maybeSingle();


                    if (teacherError) {

                        console.warn(
                            "Teacher loading error:",
                            teacherError
                        );

                    }
                    else {

                        setTeacher(
                            teacherData
                        );

                    }

                }
                else {

                    setTeacher(null);

                }


                /* =========================================
                   ACTIVE ACADEMIC YEAR
                ========================================= */

                const {
                    data: yearData,
                    error: yearError,
                } =
                    await supabase
                        .from("academic_years")
                        .select(`
                            id,
                            school_id,
                            year_name,
                            term,
                            start_date,
                            end_date,
                            is_active
                        `)
                        .eq(
                            "school_id",
                            schoolId
                        )
                        .eq(
                            "is_active",
                            true
                        )
                        .order(
                            "start_date",
                            {
                                ascending: false,
                            }
                        )
                        .limit(1)
                        .maybeSingle();


                if (yearError) {

                    console.warn(
                        "Academic year loading error:",
                        yearError
                    );

                }


                setAcademicYear(
                    yearData || null
                );


                const currentAcademicYearId =
                    yearData?.id;


                /* =========================================
                   CENTRAL DUTY SCHEDULE
                ========================================= */

                if (
                    schoolId !== null &&
                    schoolId !== undefined &&
                    currentAcademicYearId !== null &&
                    currentAcademicYearId !== undefined
                ) {

                    const {
                        data: dutyData,
                        error: dutyError,
                    } =
                        await supabase
                            .from("duty_schedules")
                            .select(`
                                id,
                                school_id,
                                academic_year_id,
                                duty_date,
                                day_name,
                                teacher_id,
                                duty_area,
                                start_time,
                                end_time,
                                location,
                                notes,
                                status
                            `)
                            .eq(
                                "school_id",
                                schoolId
                            )
                            .eq(
                                "academic_year_id",
                                currentAcademicYearId
                            )
                            .order(
                                "duty_date",
                                {
                                    ascending: true,
                                }
                            )
                            .order(
                                "start_time",
                                {
                                    ascending: true,
                                }
                            );


                    if (dutyError) {

                        console.warn(
                            "Duty schedule loading error:",
                            dutyError
                        );

                        setDutySchedules([]);

                    }
                    else {

                        const safeDutyData =
                            Array.isArray(
                                dutyData
                            )
                                ? dutyData
                                : [];


                        setDutySchedules(
                            safeDutyData
                        );


                        const teacherIds = [
                            ...new Set(
                                safeDutyData
                                    .map(
                                        item =>
                                            item.teacher_id
                                    )
                                    .filter(
                                        value =>
                                            value !== null &&
                                            value !== undefined
                                    )
                            ),
                        ];


                        if (
                            teacherIds.length > 0
                        ) {

                            const {
                                data: teacherRows,
                                error:
                                    teacherRowsError,
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
                                        status,
                                        staff_type,
                                        user_id
                                    `)
                                    .in(
                                        "id",
                                        teacherIds
                                    );


                            if (
                                teacherRowsError
                            ) {

                                console.warn(
                                    "Teacher directory loading error:",
                                    teacherRowsError
                                );

                                setTeacherDirectory(
                                    []
                                );

                            }
                            else {

                                setTeacherDirectory(
                                    Array.isArray(
                                        teacherRows
                                    )
                                        ? teacherRows
                                        : []
                                );

                            }

                        }
                        else {

                            setTeacherDirectory(
                                []
                            );

                        }

                    }

                }
                else {

                    setDutySchedules([]);

                    setTeacherDirectory([]);

                }


                /* =========================================
                   STUDENTS
                ========================================= */

                let studentQuery =
                    supabase
                        .from("students")
                        .select(`
                            id,
                            school_id,
                            admission_number,
                            admission_no,
                            first_name,
                            middle_name,
                            last_name,
                            gender,
                            current_class_id,
                            academic_year_id,
                            student_status,
                            status,
                            class_name,
                            stream
                        `)
                        .eq(
                            "school_id",
                            schoolId
                        );


                if (
                    currentAcademicYearId !== null &&
                    currentAcademicYearId !== undefined
                ) {

                    studentQuery =
                        studentQuery.eq(
                            "academic_year_id",
                            currentAcademicYearId
                        );

                }


                const {
                    data: studentData,
                    error: studentError,
                } =
                    await studentQuery
                        .order(
                            "first_name",
                            {
                                ascending: true,
                            }
                        );


                if (studentError) {

                    console.warn(
                        "Students loading error:",
                        studentError
                    );

                    setStudents([]);

                }
                else {

                    setStudents(
                        Array.isArray(
                            studentData
                        )
                            ? studentData
                            : []
                    );

                }


                /* =========================================
                   CLASSES
                ========================================= */

                let classQuery =
                    supabase
                        .from("classes")
                        .select(`
                            id,
                            school_id,
                            academic_level,
                            class_name,
                            short_name,
                            academic_year_id
                        `)
                        .eq(
                            "school_id",
                            schoolId
                        );


                if (
                    currentAcademicYearId !== null &&
                    currentAcademicYearId !== undefined
                ) {

                    classQuery =
                        classQuery.eq(
                            "academic_year_id",
                            currentAcademicYearId
                        );

                }


                const {
                    data: classData,
                    error: classError,
                } =
                    await classQuery
                        .order(
                            "class_name",
                            {
                                ascending: true,
                            }
                        );


                if (classError) {

                    console.warn(
                        "Classes loading error:",
                        classError
                    );

                    setClasses([]);

                }
                else {

                    setClasses(
                        Array.isArray(
                            classData
                        )
                            ? classData
                            : []
                    );

                }


                /* =========================================
                   ATTENDANCE
                ========================================= */

                let attendanceQuery =
                    supabase
                        .from("class_attendance")
                        .select(`
                            id,
                            school_id,
                            academic_year_id,
                            class_id,
                            student_id,
                            attendance_date,
                            status,
                            remarks,
                            recorded_by,
                            created_at,
                            updated_at
                        `)
                        .eq(
                            "school_id",
                            schoolId
                        );


                if (
                    currentAcademicYearId !== null &&
                    currentAcademicYearId !== undefined
                ) {

                    attendanceQuery =
                        attendanceQuery.eq(
                            "academic_year_id",
                            currentAcademicYearId
                        );

                }


                const {
                    data: attendanceData,
                    error: attendanceError,
                } =
                    await attendanceQuery
                        .order(
                            "attendance_date",
                            {
                                ascending: false,
                            }
                        )
                        .limit(1000);


                if (attendanceError) {

                    console.warn(
                        "Attendance loading error:",
                        attendanceError
                    );

                    setAttendance([]);

                }
                else {

                    setAttendance(
                        Array.isArray(
                            attendanceData
                        )
                            ? attendanceData
                            : []
                    );

                }


                /* =========================================
                   TIMETABLE
                ========================================= */

                let timetableQuery =
                    supabase
                        .from("class_timetables")
                        .select(`
                            id,
                            school_id,
                            class_id,
                            subject_id,
                            teacher_id,
                            period_id,
                            day_name,
                            academic_year_id,
                            start_time,
                            end_time,
                            session,
                            stream_id,
                            combination_name
                        `)
                        .eq(
                            "school_id",
                            schoolId
                        );


                if (
                    currentAcademicYearId !== null &&
                    currentAcademicYearId !== undefined
                ) {

                    timetableQuery =
                        timetableQuery.eq(
                            "academic_year_id",
                            currentAcademicYearId
                        );

                }


                if (
                    profileData.teacher_id !== null &&
                    profileData.teacher_id !== undefined
                ) {

                    timetableQuery =
                        timetableQuery.eq(
                            "teacher_id",
                            profileData.teacher_id
                        );

                }


                const {
                    data: timetableData,
                    error: timetableError,
                } =
                    await timetableQuery
                        .order(
                            "day_name",
                            {
                                ascending: true,
                            }
                        )
                        .order(
                            "start_time",
                            {
                                ascending: true,
                            }
                        );


                if (timetableError) {

                    console.warn(
                        "Timetable loading error:",
                        timetableError
                    );

                    setTimetable([]);

                }
                else {

                    setTimetable(
                        Array.isArray(
                            timetableData
                        )
                            ? timetableData
                            : []
                    );

                }

            }
            catch (loadError) {

                console.error(
                    "TeacherOnDuty load error:",
                    loadError
                );


                setError(
                    loadError?.message ||
                    "Unable to load Teacher on Duty information."
                );

            }
            finally {

                setLoading(false);

                setRefreshing(false);

            }

        };


    /* =====================================================
       INITIAL LOAD
    ===================================================== */

    useEffect(() => {

        loadDutyData();

    }, []);


    /* =====================================================
       REALTIME DUTY SCHEDULE
    ===================================================== */

    useEffect(() => {

        const schoolId =
            profile?.school_id;

        const academicYearId =
            academicYear?.id;


        if (
            !schoolId ||
            !academicYearId
        ) {

            return undefined;

        }


        const channel =
            supabase
                .channel(
                    `teacher-on-duty-${schoolId}-${academicYearId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "duty_schedules",
                        filter:
                            `school_id=eq.${schoolId}`,
                    },
                    () => {

                        loadDutyData(true);

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "academic_years",
                        filter:
                            `school_id=eq.${schoolId}`,
                    },
                    () => {

                        loadDutyData(true);

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "class_attendance",
                        filter:
                            `school_id=eq.${schoolId}`,
                    },
                    () => {

                        loadDutyData(true);

                    }
                )
                .subscribe();


        return () => {

            supabase.removeChannel(
                channel
            );

        };

    }, [
        profile?.school_id,
        academicYear?.id,
    ]);


    /* =====================================================
       DUTY STATUS
    ===================================================== */

    const getDutyStatus =
        duty => {

            const databaseStatus =
                String(
                    duty?.status || ""
                )
                    .trim()
                    .toLowerCase();


            if (
                databaseStatus ===
                "cancelled"
            ) {

                return {
                    label: "CANCELLED",
                    className:
                        "bg-red-100 text-red-700 border-red-200",
                };

            }


            if (
                databaseStatus ===
                "completed"
            ) {

                return {
                    label: "COMPLETED",
                    className:
                        "bg-green-100 text-green-700 border-green-200",
                };

            }


            const dutyDate =
                String(
                    duty?.duty_date || ""
                ).slice(0, 10);


            if (
                dutyDate ===
                todayDate
            ) {

                return {
                    label: "TODAY",
                    className:
                        "bg-blue-100 text-blue-700 border-blue-200",
                };

            }


            if (
                dutyDate <
                todayDate
            ) {

                return {
                    label: "PAST",
                    className:
                        "bg-slate-100 text-slate-600 border-slate-200",
                };

            }


            return {
                label: "UPCOMING",
                className:
                    "bg-indigo-100 text-indigo-700 border-indigo-200",
            };

        };


    /* =====================================================
       SORTED DUTY ROSTER
    ===================================================== */

    const sortedDutySchedules =
        useMemo(() => {

            return [
                ...dutySchedules,
            ].sort(
                (
                    first,
                    second
                ) => {

                    const firstDate =
                        String(
                            first?.duty_date || ""
                        ).slice(0, 10);


                    const secondDate =
                        String(
                            second?.duty_date || ""
                        ).slice(0, 10);


                    if (
                        firstDate <
                        secondDate
                    ) {

                        return -1;

                    }


                    if (
                        firstDate >
                        secondDate
                    ) {

                        return 1;

                    }


                    const firstTime =
                        String(
                            first?.start_time ||
                            "99:99:99"
                        );


                    const secondTime =
                        String(
                            second?.start_time ||
                            "99:99:99"
                        );


                    if (
                        firstTime <
                        secondTime
                    ) {

                        return -1;

                    }


                    if (
                        firstTime >
                        secondTime
                    ) {

                        return 1;

                    }


                    return (
                        Number(
                            first?.id || 0
                        ) -
                        Number(
                            second?.id || 0
                        )
                    );

                }
            );

        }, [
            dutySchedules,
        ]);


    /* =====================================================
       CURRENT TEACHER DUTY
    ===================================================== */

    const currentTeacherDutyIndex =
        useMemo(() => {

            const candidates =
                sortedDutySchedules
                    .map(
                        (
                            duty,
                            index
                        ) => ({
                            duty,
                            index,
                        })
                    )
                    .filter(
                        item => {

                            const dutyDate =
                                String(
                                    item.duty?.duty_date ||
                                    ""
                                ).slice(0, 10);


                            const status =
                                String(
                                    item.duty?.status ||
                                    ""
                                )
                                    .trim()
                                    .toLowerCase();


                            return (
                                isCurrentTeacherDuty(
                                    item.duty
                                ) &&
                                status !==
                                    "cancelled" &&
                                dutyDate >=
                                    todayDate
                            );

                        }
                    );


            if (
                candidates.length > 0
            ) {

                return candidates[0].index;

            }


            const allTeacherDuties =
                sortedDutySchedules
                    .map(
                        (
                            duty,
                            index
                        ) => ({
                            duty,
                            index,
                        })
                    )
                    .filter(
                        item =>
                            isCurrentTeacherDuty(
                                item.duty
                            )
                    );


            return (
                allTeacherDuties.length > 0
                    ? allTeacherDuties[0].index
                    : -1
            );

        }, [
            sortedDutySchedules,
            profile?.teacher_id,
            todayDate,
        ]);


    /* =====================================================
       NEXT TEACHER
    ===================================================== */

    const nextTeacherDuty =
        useMemo(() => {

            if (
                currentTeacherDutyIndex <
                0
            ) {

                return null;

            }


            for (
                let index =
                    currentTeacherDutyIndex + 1;
                index <
                    sortedDutySchedules.length;
                index++
            ) {

                const duty =
                    sortedDutySchedules[index];


                const status =
                    String(
                        duty?.status || ""
                    )
                        .trim()
                        .toLowerCase();


                if (
                    status ===
                    "cancelled"
                ) {

                    continue;

                }


                if (
                    Number(
                        duty?.teacher_id
                    ) ===
                    Number(
                        profile?.teacher_id
                    )
                ) {

                    continue;

                }


                return {
                    duty,
                    index,
                };

            }


            return null;

        }, [
            currentTeacherDutyIndex,
            sortedDutySchedules,
            profile?.teacher_id,
        ]);


    /* =====================================================
       ROSTER POSITION
    ===================================================== */

    const getRosterPosition =
        duty => {

            if (
                isCurrentTeacherDuty(
                    duty
                )
            ) {

                return {
                    label: "YOU",
                    className:
                        "bg-blue-100 text-blue-700 border-blue-200",
                };

            }


            if (
                nextTeacherDuty &&
                Number(
                    nextTeacherDuty.duty?.id
                ) ===
                    Number(
                        duty?.id
                    )
            ) {

                return {
                    label: "NEXT",
                    className:
                        "bg-green-100 text-green-700 border-green-200",
                };

            }


            const dutyDate =
                String(
                    duty?.duty_date || ""
                ).slice(0, 10);


            if (
                dutyDate <
                todayDate
            ) {

                return {
                    label: "PAST",
                    className:
                        "bg-slate-100 text-slate-500 border-slate-200",
                };

            }


            return {
                label: "LATER",
                className:
                    "bg-indigo-50 text-indigo-700 border-indigo-200",
            };

        };


    const nextTeacherName =
        useMemo(() => {

            if (!nextTeacherDuty) {

                return "No next duty found";

            }


            return getTeacherName(
                nextTeacherDuty.duty.teacher_id
            );

        }, [
            nextTeacherDuty,
            teacherDirectory,
            profile?.teacher_id,
            teacherName,
        ]);


    /* =====================================================
       DUTY CALENDAR
    ===================================================== */

    const dutyMap =
        useMemo(() => {

            const map =
                new Map();


            dutySchedules.forEach(
                duty => {

                    const date =
                        String(
                            duty.duty_date ||
                            ""
                        ).slice(0, 10);


                    if (!date) return;


                    if (
                        !map.has(date)
                    ) {

                        map.set(
                            date,
                            []
                        );

                    }


                    map.get(date).push(
                        duty
                    );

                }
            );


            return map;

        }, [
            dutySchedules,
        ]);


    const selectedDateDuties =
        useMemo(() => {

            if (
                !selectedCalendarDate
            ) {

                return [];

            }


            return [
                ...(dutyMap.get(
                    selectedCalendarDate
                ) || []),
            ].sort(
                (
                    first,
                    second
                ) =>
                    String(
                        first.start_time ||
                        "99:99:99"
                    ).localeCompare(
                        String(
                            second.start_time ||
                            "99:99:99"
                        )
                    )
            );

        }, [
            selectedCalendarDate,
            dutyMap,
        ]);


    const calendarDays =
        useMemo(() => {

            const year =
                calendarMonth.year;

            const month =
                calendarMonth.month;


            const firstDate =
                new Date(
                    Date.UTC(
                        year,
                        month - 1,
                        1
                    )
                );


            const lastDate =
                new Date(
                    Date.UTC(
                        year,
                        month,
                        0
                    )
                );


            const daysInMonth =
                lastDate.getUTCDate();


            let firstDayIndex =
                firstDate.getUTCDay();


            firstDayIndex =
                (
                    firstDayIndex +
                    6
                ) % 7;


            const cells = [];


            for (
                let index = 0;
                index < firstDayIndex;
                index++
            ) {

                cells.push(null);

            }


            for (
                let day = 1;
                day <= daysInMonth;
                day++
            ) {

                cells.push({
                    day,
                    date:
                        makeDateKey(
                            year,
                            month,
                            day
                        ),
                });

            }


            while (
                cells.length % 7 !==
                0
            ) {

                cells.push(null);

            }


            return cells;

        }, [
            calendarMonth,
        ]);


    const calendarMonthTitle =
        useMemo(() => {

            const date =
                new Date(
                    Date.UTC(
                        calendarMonth.year,
                        calendarMonth.month - 1,
                        1,
                        12
                    )
                );


            return new Intl.DateTimeFormat(
                "en-US",
                {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                }
            ).format(date);

        }, [
            calendarMonth,
        ]);


    const goToToday = () => {

        const today =
            getSchoolTodayParts();


        setCalendarMonth({
            year: today.year,
            month: today.month,
        });


        setSelectedCalendarDate(
            todayDate
        );

    };


    const goToPreviousMonth = () => {

        setCalendarMonth(
            current => {

                if (
                    current.month ===
                    1
                ) {

                    return {
                        year:
                            current.year - 1,
                        month: 12,
                    };

                }


                return {
                    year:
                        current.year,
                    month:
                        current.month - 1,
                };

            }
        );

    };


    const goToNextMonth = () => {

        setCalendarMonth(
            current => {

                if (
                    current.month ===
                    12
                ) {

                    return {
                        year:
                            current.year + 1,
                        month: 1,
                    };

                }


                return {
                    year:
                        current.year,
                    month:
                        current.month + 1,
                };

            }
        );

    };


    /* =====================================================
       ATTENDANCE CALCULATIONS
    ===================================================== */

    const todayAttendance =
        useMemo(() => {

            return attendance.filter(
                item =>
                    String(
                        item.attendance_date ||
                        ""
                    ).slice(0, 10) ===
                    todayDate
            );

        }, [
            attendance,
            todayDate,
        ]);


    const selectedAttendance =
        useMemo(() => {

            return attendance.filter(
                item =>
                    String(
                        item.attendance_date ||
                        ""
                    ).slice(0, 10) ===
                    attendanceDate
            );

        }, [
            attendance,
            attendanceDate,
        ]);


    const latecomers =
        useMemo(() => {

            return todayAttendance.filter(
                item => {

                    const status =
                        String(
                            item.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    return (
                        status === "late" ||
                        status === "latecomer"
                    );

                }
            );

        }, [
            todayAttendance,
        ]);


    const absentStudents =
        useMemo(() => {

            return todayAttendance.filter(
                item =>
                    String(
                        item.status ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "absent"
            );

        }, [
            todayAttendance,
        ]);


    const presentStudents =
        useMemo(() => {

            return todayAttendance.filter(
                item => {

                    const status =
                        String(
                            item.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    return (
                        status === "present" ||
                        status === "presented"
                    );

                }
            );

        }, [
            todayAttendance,
        ]);


    const excusedStudents =
        useMemo(() => {

            return todayAttendance.filter(
                item =>
                    String(
                        item.status ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "excused"
            );

        }, [
            todayAttendance,
        ]);


    /* =====================================================
       ATTENDANCE DRAFT INITIALIZATION
    ===================================================== */

    useEffect(() => {

        const nextDrafts = {};


        selectedAttendance.forEach(
            record => {

                nextDrafts[
                    record.student_id
                ] = {
                    status:
                        String(
                            record.status ||
                            ""
                        ).toLowerCase(),
                    remarks:
                        record.remarks ||
                        "",
                };

            }
        );


        setAttendanceDrafts(
            nextDrafts
        );

    }, [
        attendanceDate,
        attendance,
    ]);


    const handleAttendanceStatus =
        (
            studentId,
            status
        ) => {

            setAttendanceDrafts(
                current => ({
                    ...current,
                    [studentId]: {
                        ...(current[
                            studentId
                        ] || {}),
                        status,
                    },
                })
            );


            setAttendanceMessage("");

        };


    const handleAttendanceRemarks =
        (
            studentId,
            remarks
        ) => {

            setAttendanceDrafts(
                current => ({
                    ...current,
                    [studentId]: {
                        ...(current[
                            studentId
                        ] || {}),
                        remarks,
                    },
                })
            );

        };


    const saveAttendance =
        async () => {

            if (
                !profile?.school_id ||
                !academicYear?.id
            ) {

                setAttendanceMessage(
                    "School or active academic year was not found."
                );

                return;

            }


            const rows =
                students
                    .map(student => {

                        const draft =
                            attendanceDrafts[
                                student.id
                            ];


                        if (
                            !draft?.status
                        ) {

                            return null;

                        }


                        if (
                            ![
                                "present",
                                "absent",
                                "late",
                                "excused",
                            ].includes(
                                String(
                                    draft.status
                                ).toLowerCase()
                            )
                        ) {

                            return null;

                        }


                        if (
                            !student.current_class_id
                        ) {

                            return null;

                        }


                        return {
                            school_id:
                                profile.school_id,
                            academic_year_id:
                                academicYear.id,
                            class_id:
                                student.current_class_id,
                            student_id:
                                student.id,
                            attendance_date:
                                attendanceDate,
                            status:
                                String(
                                    draft.status
                                ).toLowerCase(),
                            remarks:
                                draft.remarks ||
                                null,
                            recorded_by:
                                user?.id ||
                                null,
                            updated_at:
                                new Date().toISOString(),
                        };

                    })
                    .filter(Boolean);


            if (
                rows.length === 0
            ) {

                setAttendanceMessage(
                    "Select at least one attendance status before saving."
                );

                return;

            }


            try {

                setAttendanceSaving(true);

                setAttendanceMessage("");


                const {
                    error: saveError,
                } =
                    await supabase
                        .from("class_attendance")
                        .upsert(
                            rows,
                            {
                                onConflict:
                                    "student_id,attendance_date",
                            }
                        );


                if (saveError) {

                    throw saveError;

                }


                setAttendanceMessage(
                    `${rows.length} attendance record(s) saved successfully for ${formatDate(attendanceDate)}.`
                );


                await loadDutyData(
                    true
                );

            }
            catch (saveError) {

                console.error(
                    "Attendance save error:",
                    saveError
                );


                setAttendanceMessage(
                    saveError?.message ||
                    "Unable to save attendance."
                );

            }
            finally {

                setAttendanceSaving(
                    false
                );

            }

        };


    /* =====================================================
       DUTY ACTIONS
    ===================================================== */

    const handleDutyClick =
        duty => {

            setSelectedDuty(
                duty
            );


            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });

        };


    const handleBackToDuties =
        () => {

            setSelectedDuty(
                null
            );


            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });

        };


    const handleCalendarDateClick =
        date => {

            setSelectedCalendarDate(
                date
            );

        };


    /* =====================================================
       INCIDENTS
    ===================================================== */

    const handleIncidentChange =
        (
            field,
            value
        ) => {

            setIncidentForm(
                current => ({
                    ...current,
                    [field]: value,
                })
            );


            setIncidentMessage("");

        };


    const handlePrepareIncident =
        event => {

            event.preventDefault();


            if (
                !incidentForm.description.trim()
            ) {

                setIncidentMessage(
                    "Please enter the incident description before preparing the record."
                );

                return;

            }


            const newIncident = {
                id:
                    `${Date.now()}-${Math.random()}`,
                date:
                    todayDate,
                day:
                    getRealDayName(
                        todayDate
                    ),
                time:
                    new Date().toLocaleTimeString(
                        "en-GB",
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                        }
                    ),
                studentId:
                    incidentForm.studentId,
                studentName:
                    incidentForm.studentId
                        ? getStudentName(
                            incidentForm.studentId
                        )
                        : "General / Unspecified",
                incidentType:
                    incidentForm.incidentType ||
                    "Other",
                description:
                    incidentForm.description,
                actionTaken:
                    incidentForm.actionTaken ||
                    "No action recorded",
                teacher:
                    teacherName,
                duty:
                    currentDutyLabel(),
                location:
                    currentDutyLocation(),
            };


            setIncidents(
                current => [
                    newIncident,
                    ...current,
                ]
            );


            setSelectedIncident(
                newIncident
            );


            setIncidentMessage(
                "Incident record prepared successfully. You can now print the record."
            );


            setIncidentForm({
                studentId: "",
                incidentType: "",
                description: "",
                actionTaken: "",
            });

        };


    /* =====================================================
       HANDOVER
    ===================================================== */

    const handleHandoverChange =
        (
            field,
            value
        ) => {

            setHandoverForm(
                current => ({
                    ...current,
                    [field]: value,
                })
            );


            setHandoverMessage("");

        };


    const currentDuty =
        useMemo(() => {

            return (
                currentTeacherDutyIndex >= 0
                    ? sortedDutySchedules[
                        currentTeacherDutyIndex
                    ]
                    : null
            );

        }, [
            currentTeacherDutyIndex,
            sortedDutySchedules,
        ]);


    function currentDutyLabel() {

        return (
            currentDuty?.duty_area ||
            "General School Supervision"
        );

    }


    function currentDutyLocation() {

        return (
            currentDuty?.location ||
            "School"
        );

    }


    const handlePrepareHandover =
        event => {

            event.preventDefault();


            if (
                !handoverForm.summary.trim()
            ) {

                setHandoverMessage(
                    "Please enter the handover summary."
                );

                return;

            }


            const handover = {

                date:
                    todayDate,

                day:
                    getRealDayName(
                        todayDate
                    ),

                currentTeacher:
                    teacherName,

                nextTeacher:
                    nextTeacherName,

                nextDutyDate:
                    nextTeacherDuty
                        ? nextTeacherDuty.duty.duty_date
                        : "",

                currentDuty:
                    currentDutyLabel(),

                startTime:
                    currentDuty?.start_time ||
                    "",

                endTime:
                    currentDuty?.end_time ||
                    "",

                location:
                    currentDutyLocation(),

                summary:
                    handoverForm.summary,

                pendingIssues:
                    handoverForm.pendingIssues,

                instructions:
                    handoverForm.instructions,

                preparedAt:
                    new Date().toISOString(),

            };


            setSavedHandover(
                handover
            );


            setHandoverMessage(
                "Duty handover prepared successfully. You can now print the official handover."
            );

        };


    /* =====================================================
       REPORT
    ===================================================== */

    const handleReportChange =
        (
            field,
            value
        ) => {

            setReportForm(
                current => ({
                    ...current,
                    [field]: value,
                })
            );

        };


    /* =====================================================
       PRINT
    ===================================================== */

    const printSection =
        section => {

            const className =
                `africore-print-${section}`;


            document.body.classList.add(
                "africore-printing"
            );


            document.body.classList.add(
                className
            );


            window.setTimeout(
                () => {

                    window.print();

                },
                50
            );


            window.setTimeout(
                () => {

                    document.body.classList.remove(
                        "africore-printing"
                    );

                    document.body.classList.remove(
                        className
                    );

                },
                1000
            );

        };


    const handlePrintReport =
        () => {

            printSection(
                "report"
            );

        };


    const handlePrintIncident =
        () => {

            if (
                !selectedIncident
            ) {

                return;

            }


            printSection(
                "incident"
            );

        };


    const handlePrintHandover =
        () => {

            if (
                !savedHandover
            ) {

                return;

            }


            printSection(
                "handover"
            );

        };


    /* =====================================================
       HEADER
    ===================================================== */

    const renderHeader =
        () => (

            <div className="mb-6">

                <button
                    type="button"
                    onClick={() =>
                        navigate(
                            "/dashboard"
                        )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 mb-5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition"
                >

                    <FaArrowLeft />

                    Back to Dashboard

                </button>


                <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">

                    <div className="flex items-center gap-4">

                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">

                            <FaUserShield className="text-2xl" />

                        </div>


                        <div>

                            <h1 className="text-2xl font-bold">
                                Teacher on Duty
                            </h1>

                            <p className="text-blue-100 text-sm">
                                Daily duty management and school supervision
                            </p>

                        </div>

                    </div>


                    <div className="mt-5 flex flex-wrap gap-3">

                        {profile?.full_name && (

                            <div className="px-3 py-2 bg-white/10 rounded-lg text-sm">

                                {profile.full_name}

                            </div>

                        )}


                        {teacherName && (

                            <div className="px-3 py-2 bg-white/10 rounded-lg text-sm flex items-center gap-2">

                                <FaUserTie />

                                {teacherName}

                            </div>

                        )}


                        {academicYear && (

                            <div className="px-3 py-2 bg-white/10 rounded-lg text-sm">

                                Academic Year:{" "}

                                {academicYear.year_name}

                                {academicYear.term
                                    ? ` • ${academicYear.term}`
                                    : ""}

                            </div>

                        )}


                        <div className="px-3 py-2 bg-white/10 rounded-lg text-sm">

                            Today:{" "}

                            {formatLongDate(
                                todayDate
                            )}

                        </div>

                    </div>

                </div>

            </div>

        );


    /* =====================================================
       DUTY MENU
    ===================================================== */

    const renderDutyMenu =
        () => (

            <>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

                        <div>

                            <h2 className="text-xl font-bold text-slate-800">
                                Duty Responsibilities
                            </h2>

                            <p className="text-sm text-slate-500 mt-1">
                                Manage and monitor your daily responsibilities while on duty.
                            </p>

                        </div>


                        <button
                            type="button"
                            disabled={refreshing}
                            onClick={() =>
                                loadDutyData(
                                    true
                                )
                            }
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                        >

                            <FaSyncAlt
                                className={
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            Refresh

                        </button>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                        {dutyAreas.map(
                            duty => (

                                <button
                                    key={
                                        duty.id
                                    }
                                    type="button"
                                    onClick={() =>
                                        handleDutyClick(
                                            duty
                                        )
                                    }
                                    className={`
                                        text-left p-5 rounded-xl border transition duration-200
                                        hover:-translate-y-1 hover:shadow-sm
                                        border-slate-200 bg-slate-50 ${duty.hover}
                                    `}
                                >

                                    <div className="flex items-center gap-4">

                                        <div
                                            className={`
                                                w-11 h-11 rounded-lg flex items-center justify-center
                                                ${duty.iconBg} ${duty.iconColor}
                                            `}
                                        >

                                            {duty.icon}

                                        </div>


                                        <div>

                                            <h3 className="font-semibold text-slate-800">
                                                {duty.title}
                                            </h3>

                                            <p className="text-xs text-slate-500 mt-1">
                                                {duty.description}
                                            </p>

                                        </div>

                                    </div>

                                </button>

                            )
                        )}

                    </div>

                </div>


                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">

                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaUsers className="text-indigo-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Students
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {students.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaUserClock className="text-orange-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Today's Latecomers
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {latecomers.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaExclamationTriangle className="text-red-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Today's Absences
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {absentStudents.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaCalendarAlt className="text-blue-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Duty Roster
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {dutySchedules.length}
                        </p>

                    </div>

                </div>


                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">

                        <div className="flex items-center gap-3">

                            <FaUserTie className="text-blue-700" />

                            <div>

                                <p className="text-xs text-blue-700 font-bold uppercase">
                                    Your Current Duty
                                </p>

                                <p className="font-bold text-blue-900 mt-1">

                                    {currentTeacherDutyIndex >=
                                    0
                                        ? formatDate(
                                            sortedDutySchedules[
                                                currentTeacherDutyIndex
                                            ]?.duty_date
                                        )
                                        : "No upcoming duty"}

                                </p>

                            </div>

                        </div>

                    </div>


                    <div className="bg-green-50 border border-green-100 rounded-xl p-5">

                        <div className="flex items-center gap-3">

                            <FaArrowRight className="text-green-700" />

                            <div>

                                <p className="text-xs text-green-700 font-bold uppercase">
                                    Next Teacher
                                </p>

                                <p className="font-bold text-green-900 mt-1">
                                    {nextTeacherName}
                                </p>

                            </div>

                        </div>

                    </div>


                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">

                        <div className="flex items-center gap-3">

                            <FaUsers className="text-indigo-700" />

                            <div>

                                <p className="text-xs text-indigo-700 font-bold uppercase">
                                    Teachers in Roster
                                </p>

                                <p className="font-bold text-indigo-900 mt-1">

                                    {
                                        new Set(
                                            dutySchedules.map(
                                                duty =>
                                                    Number(
                                                        duty.teacher_id
                                                    )
                                            )
                                        ).size
                                    }

                                </p>

                            </div>

                        </div>

                    </div>

                </div>


                <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-5">

                    <div className="flex gap-3">

                        <FaUserShield className="text-blue-700 mt-1" />

                        <div>

                            <h3 className="font-semibold text-blue-900">
                                Teacher on Duty
                            </h3>

                            <p className="text-sm text-blue-800 mt-1">

                                Duty information is synchronized directly from the official
                                Timetable → Duty Schedule. The roster displayed here is the
                                complete duty roster for the active academic year.

                            </p>

                        </div>

                    </div>

                </div>

            </>

        );


    /* =====================================================
       VIEW HEADER
    ===================================================== */

    const renderDutyViewHeader =
        () => (

            <div className="mb-6">

                <button
                    type="button"
                    onClick={
                        handleBackToDuties
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 mb-5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition"
                >

                    <FaArrowLeft />

                    Back to Duty Responsibilities

                </button>


                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                    <div className="flex items-center gap-4">

                        <div
                            className={`
                                w-14 h-14 rounded-xl flex items-center justify-center
                                text-xl ${selectedDuty.iconBg} ${selectedDuty.iconColor}
                            `}
                        >

                            {selectedDuty.icon}

                        </div>


                        <div>

                            <h2 className="text-2xl font-bold text-slate-800">
                                {selectedDuty.title}
                            </h2>

                            <p className="text-sm text-slate-500 mt-1">
                                {selectedDuty.description}
                            </p>

                        </div>

                    </div>

                </div>

            </div>

        );


    /* =====================================================
       DUTY CALENDAR
    ===================================================== */

    const renderDutyCalendar =
        () => (

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">

                    <div>

                        <h3 className="text-lg font-bold text-slate-800">
                            Real Duty Calendar
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">
                            Calendar follows the actual Tanzania school date.
                        </p>

                    </div>


                    <div className="flex flex-wrap items-center gap-2">

                        <button
                            type="button"
                            onClick={
                                goToPreviousMonth
                            }
                            className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
                        >

                            <FaChevronLeft />

                        </button>


                        <button
                            type="button"
                            onClick={
                                goToToday
                            }
                            className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                        >

                            Today

                        </button>


                        <button
                            type="button"
                            onClick={
                                goToNextMonth
                            }
                            className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
                        >

                            <FaChevronRight />

                        </button>

                    </div>

                </div>


                <div className="flex items-center justify-between mb-5">

                    <h4 className="text-xl font-bold text-slate-800">
                        {calendarMonthTitle}
                    </h4>

                    <div className="flex items-center gap-3 text-xs">

                        <span className="inline-flex items-center gap-1 text-slate-500">

                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />

                            Today

                        </span>


                        <span className="inline-flex items-center gap-1 text-slate-500">

                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />

                            Duty

                        </span>

                    </div>

                </div>


                <div className="grid grid-cols-7 border border-slate-200 rounded-xl overflow-hidden">

                    {[
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                        "Sun",
                    ].map(
                        day => (

                            <div
                                key={day}
                                className="bg-slate-50 border-b border-r border-slate-200 p-3 text-center text-xs font-bold text-slate-500"
                            >

                                {day}

                            </div>

                        )
                    )}


                    {calendarDays.map(
                        (
                            cell,
                            index
                        ) => {

                            if (!cell) {

                                return (
                                    <div
                                        key={`empty-${index}`}
                                        className="min-h-[105px] bg-slate-50 border-r border-b border-slate-200"
                                    />
                                );

                            }


                            const date =
                                cell.date;


                            const duties =
                                dutyMap.get(
                                    date
                                ) || [];


                            const isToday =
                                date ===
                                todayDate;


                            const isSelected =
                                date ===
                                selectedCalendarDate;


                            return (

                                <button
                                    key={date}
                                    type="button"
                                    onClick={() =>
                                        handleCalendarDateClick(
                                            date
                                        )
                                    }
                                    className={`
                                        min-h-[105px] p-2 text-left border-r border-b border-slate-200
                                        transition hover:bg-blue-50
                                        ${isSelected
                                            ? "bg-blue-50 ring-2 ring-inset ring-blue-500"
                                            : "bg-white"}
                                    `}
                                >

                                    <div className="flex items-center justify-between">

                                        <span
                                            className={`
                                                w-8 h-8 rounded-full inline-flex items-center justify-center
                                                text-sm font-bold
                                                ${isToday
                                                    ? "bg-blue-600 text-white"
                                                    : "text-slate-700"}
                                            `}
                                        >

                                            {cell.day}

                                        </span>


                                        {duties.length >
                                            0 && (

                                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />

                                        )}

                                    </div>


                                    <div className="mt-2 space-y-1">

                                        {duties
                                            .slice(
                                                0,
                                                2
                                            )
                                            .map(
                                                duty => (

                                                    <div
                                                        key={
                                                            duty.id
                                                        }
                                                        className={`
                                                            rounded-md px-2 py-1 text-[10px] font-semibold truncate
                                                            ${isToday
                                                                ? "bg-blue-100 text-blue-800"
                                                                : "bg-indigo-50 text-indigo-700"}
                                                        `}
                                                    >

                                                        {formatTime(
                                                            duty.start_time
                                                        )}{" "}

                                                        {getTeacherName(
                                                            duty.teacher_id
                                                        )}

                                                    </div>

                                                )
                                            )}


                                        {duties.length >
                                            2 && (

                                            <div className="text-[10px] font-semibold text-slate-500 px-1">

                                                +
                                                {duties.length -
                                                    2}{" "}
                                                more

                                            </div>

                                        )}

                                    </div>

                                </button>

                            );

                        }
                    )}

                </div>

            </div>

        );


    /* =====================================================
       SELECTED DATE DETAILS
    ===================================================== */

    const renderSelectedDateDetails =
        () => (

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">

                    <div>

                        <h3 className="text-xl font-bold text-slate-800">
                            {formatLongDate(
                                selectedCalendarDate
                            )}
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">

                            {getRealDayName(
                                selectedCalendarDate
                            )}{" "}
                            •{" "}

                            {selectedCalendarDate ===
                            todayDate
                                ? "Today"
                                : "Duty date"}

                        </p>

                    </div>


                    {selectedCalendarDate ===
                        todayDate && (

                        <span className="inline-flex items-center px-3 py-2 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            TODAY
                        </span>

                    )}

                </div>


                {selectedDateDuties.length ===
                    0 ? (

                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">

                        <FaCalendarAlt className="mx-auto text-slate-400 text-2xl mb-3" />

                        <p className="font-semibold text-slate-700">
                            No duty assigned for this date
                        </p>

                        <p className="text-sm text-slate-500 mt-1">
                            There is no central duty schedule assigned for this date.
                        </p>

                    </div>

                ) : (

                    <div className="space-y-4">

                        {selectedDateDuties.map(
                            duty => {

                                const status =
                                    getDutyStatus(
                                        duty
                                    );


                                const position =
                                    getRosterPosition(
                                        duty
                                    );


                                return (

                                    <div
                                        key={
                                            duty.id
                                        }
                                        className={`
                                            rounded-xl border p-5
                                            ${isCurrentTeacherDuty(
                                                duty
                                            )
                                                ? "border-blue-300 bg-blue-50/60"
                                                : "border-slate-200 bg-white"}
                                        `}
                                    >

                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

                                            <div>

                                                <div className="flex flex-wrap items-center gap-2">

                                                    <span
                                                        className={`
                                                            inline-flex px-3 py-1 rounded-full border text-xs font-bold
                                                            ${position.className}
                                                        `}
                                                    >

                                                        {position.label}

                                                    </span>


                                                    <span
                                                        className={`
                                                            inline-flex px-3 py-1 rounded-full border text-xs font-bold
                                                            ${status.className}
                                                        `}
                                                    >

                                                        {status.label}

                                                    </span>

                                                </div>


                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-4">
                                                    Duty Area
                                                </p>


                                                <h4 className="text-lg font-bold text-slate-800 mt-1">
                                                    {duty.duty_area ||
                                                        "General Duty"}
                                                </h4>

                                            </div>


                                            <div className="flex items-center gap-3">

                                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">

                                                    <FaUserTie />

                                                </div>


                                                <div>

                                                    <p className="text-xs text-slate-500">
                                                        Teacher
                                                    </p>

                                                    <p className="font-bold text-slate-800">
                                                        {getTeacherName(
                                                            duty.teacher_id
                                                        )}
                                                    </p>

                                                </div>

                                            </div>

                                        </div>


                                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">

                                                <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">

                                                    <FaClock />

                                                    TIME

                                                </div>

                                                <p className="font-bold text-slate-800 mt-1">

                                                    {formatTime(
                                                        duty.start_time
                                                    )}{" "}
                                                    -{" "}
                                                    {formatTime(
                                                        duty.end_time
                                                    )}

                                                </p>

                                            </div>


                                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">

                                                <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">

                                                    <FaMapMarkerAlt />

                                                    LOCATION

                                                </div>

                                                <p className="font-bold text-slate-800 mt-1">
                                                    {duty.location ||
                                                        "Not specified"}
                                                </p>

                                            </div>


                                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">

                                                <div className="flex items-center gap-2 text-indigo-600 text-xs font-semibold">

                                                    <FaCalendarAlt />

                                                    DATE

                                                </div>

                                                <p className="font-bold text-slate-800 mt-1">
                                                    {formatDate(
                                                        duty.duty_date
                                                    )}
                                                </p>

                                            </div>


                                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">

                                                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">

                                                    <FaUserTie />

                                                    POSITION

                                                </div>

                                                <p className="font-bold text-slate-800 mt-1">
                                                    {position.label}
                                                </p>

                                            </div>

                                        </div>


                                        {duty.notes && (

                                            <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4">

                                                <p className="text-xs font-bold text-yellow-800 uppercase">
                                                    Duty Notes
                                                </p>

                                                <p className="text-sm text-yellow-900 mt-1 whitespace-pre-wrap">
                                                    {duty.notes}
                                                </p>

                                            </div>

                                        )}

                                    </div>

                                );

                            }
                        )}

                    </div>

                )}

            </div>

        );


    /* =====================================================
       DUTY TABLE
    ===================================================== */

    const renderDutyTable =
        () => (

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">

                    <div className="flex items-center gap-3">

                        <div className="w-11 h-11 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">

                            <FaClipboardList />

                        </div>


                        <div>

                            <h3 className="text-lg font-bold text-slate-800">
                                Complete Teacher Duty Roster
                            </h3>

                            <p className="text-sm text-slate-500">
                                All teachers assigned in Timetable → Duty Schedule.
                            </p>

                        </div>

                    </div>


                    {nextTeacherDuty && (

                        <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-100">

                            <p className="text-[10px] font-bold uppercase text-green-700">
                                Next Teacher
                            </p>

                            <p className="font-bold text-green-900">
                                {nextTeacherName}
                            </p>

                        </div>

                    )}

                </div>


                {dutySchedules.length ===
                    0 ? (

                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">

                        <FaCalendarAlt className="mx-auto text-slate-400 text-2xl mb-3" />

                        <p className="font-semibold text-slate-700">
                            No duty schedule found
                        </p>

                        <p className="text-sm text-slate-500 mt-1">
                            No duty schedule has been created for the active academic year.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="min-w-full text-sm">

                            <thead>

                                <tr className="border-b border-slate-200 bg-slate-50">

                                    <th className="text-left py-3 px-3">
                                        Position
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Date
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Day
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Teacher
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Duty Area
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Time
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Location
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Status
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {sortedDutySchedules.map(
                                    duty => {

                                        const status =
                                            getDutyStatus(
                                                duty
                                            );


                                        const position =
                                            getRosterPosition(
                                                duty
                                            );


                                        const isYou =
                                            isCurrentTeacherDuty(
                                                duty
                                            );


                                        return (

                                            <tr
                                                key={
                                                    duty.id
                                                }
                                                className={`
                                                    border-b border-slate-100 hover:bg-slate-50
                                                    ${isYou
                                                        ? "bg-blue-50/70"
                                                        : ""}
                                                `}
                                            >

                                                <td className="py-4 px-3">

                                                    <span
                                                        className={`
                                                            inline-flex px-3 py-1 rounded-full border text-xs font-bold
                                                            ${position.className}
                                                        `}
                                                    >

                                                        {position.label}

                                                    </span>

                                                </td>


                                                <td className="py-4 px-3 font-semibold text-slate-700">

                                                    {formatDate(
                                                        duty.duty_date
                                                    )}


                                                    {String(
                                                        duty.duty_date ||
                                                        ""
                                                    ).slice(
                                                        0,
                                                        10
                                                    ) ===
                                                        todayDate && (

                                                        <span className="ml-2 inline-flex px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                                                            TODAY
                                                        </span>

                                                    )}

                                                </td>


                                                <td className="py-4 px-3 text-slate-600">

                                                    {getRealDayName(
                                                        duty.duty_date
                                                    )}

                                                </td>


                                                <td className="py-4 px-3">

                                                    <div className="flex items-center gap-2">

                                                        <div
                                                            className={`
                                                                w-8 h-8 rounded-full flex items-center justify-center
                                                                ${isYou
                                                                    ? "bg-blue-100 text-blue-700"
                                                                    : "bg-indigo-100 text-indigo-700"}
                                                            `}
                                                        >

                                                            <FaUserTie />

                                                        </div>


                                                        <div>

                                                            <span className="font-semibold text-slate-800">

                                                                {getTeacherName(
                                                                    duty.teacher_id
                                                                )}

                                                            </span>


                                                            {isYou && (

                                                                <div className="text-[10px] font-bold text-blue-700">
                                                                    CURRENT USER
                                                                </div>

                                                            )}

                                                        </div>

                                                    </div>

                                                </td>


                                                <td className="py-4 px-3">

                                                    <div className="font-semibold text-slate-800">
                                                        {duty.duty_area ||
                                                            "—"}
                                                    </div>


                                                    {duty.notes && (

                                                        <div className="text-xs text-slate-500 mt-1 max-w-xs">
                                                            {duty.notes}
                                                        </div>

                                                    )}

                                                </td>


                                                <td className="py-4 px-3">

                                                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-800 font-bold whitespace-nowrap">

                                                        <FaClock />

                                                        {formatTime(
                                                            duty.start_time
                                                        )}

                                                        <span>
                                                            -
                                                        </span>

                                                        {formatTime(
                                                            duty.end_time
                                                        )}

                                                    </div>

                                                </td>


                                                <td className="py-4 px-3">

                                                    <div className="flex items-center gap-2 text-slate-600">

                                                        <FaMapMarkerAlt className="text-red-500" />

                                                        <span>
                                                            {duty.location ||
                                                                "—"}
                                                        </span>

                                                    </div>

                                                </td>


                                                <td className="py-4 px-3">

                                                    <span
                                                        className={`
                                                            inline-flex px-3 py-1 rounded-full border text-xs font-semibold
                                                            ${status.className}
                                                        `}
                                                    >

                                                        {status.label}

                                                    </span>

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

        );


    /* =====================================================
       DUTY SUMMARY
    ===================================================== */

    const renderDutySummary =
        () => {

            const scheduled =
                dutySchedules.filter(
                    item =>
                        String(
                            item.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "scheduled"
                ).length;


            const completed =
                dutySchedules.filter(
                    item =>
                        String(
                            item.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "completed"
                ).length;


            const todayDuties =
                dutySchedules.filter(
                    item =>
                        String(
                            item.duty_date ||
                            ""
                        ).slice(
                            0,
                            10
                        ) ===
                        todayDate
                ).length;


            const cancelled =
                dutySchedules.filter(
                    item =>
                        String(
                            item.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "cancelled"
                ).length;


            return (

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">

                        <div className="flex items-center gap-2 text-blue-700">

                            <FaCalendarAlt />

                            <span className="text-xs font-semibold uppercase">
                                Today's Duties
                            </span>

                        </div>


                        <p className="text-2xl font-bold text-blue-900 mt-2">
                            {todayDuties}
                        </p>

                    </div>


                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">

                        <div className="flex items-center gap-2 text-indigo-700">

                            <FaCalendarAlt />

                            <span className="text-xs font-semibold uppercase">
                                Scheduled
                            </span>

                        </div>


                        <p className="text-2xl font-bold text-indigo-900 mt-2">
                            {scheduled}
                        </p>

                    </div>


                    <div className="rounded-xl bg-green-50 border border-green-100 p-4">

                        <div className="flex items-center gap-2 text-green-700">

                            <FaCheckCircle />

                            <span className="text-xs font-semibold uppercase">
                                Completed
                            </span>

                        </div>


                        <p className="text-2xl font-bold text-green-900 mt-2">
                            {completed}
                        </p>

                    </div>


                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

                        <div className="flex items-center gap-2 text-slate-600">

                            <FaClipboardList />

                            <span className="text-xs font-semibold uppercase">
                                Total / Cancelled
                            </span>

                        </div>


                        <p className="text-2xl font-bold text-slate-800 mt-2">

                            {dutySchedules.length}

                            <span className="text-sm text-red-600 ml-2">
                                / {cancelled}
                            </span>

                        </p>

                    </div>

                </div>

            );

        };


    /* =====================================================
       TEACHER TIMETABLE
    ===================================================== */

    const renderTeacherTimetable =
        () => (

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                <div className="flex items-center gap-3 mb-5">

                    <FaCalendarAlt className="text-indigo-600 text-xl" />

                    <div>

                        <h3 className="text-lg font-bold text-slate-800">
                            Teacher Timetable
                        </h3>

                        <p className="text-sm text-slate-500">
                            Teaching timetable information for the current academic year.
                        </p>

                    </div>

                </div>


                {timetable.length ===
                    0 ? (

                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">

                        <FaCalendarAlt className="mx-auto text-slate-400 text-2xl mb-3" />

                        <p className="font-semibold text-slate-700">
                            No timetable records found
                        </p>

                        <p className="text-sm text-slate-500 mt-1">
                            No timetable entries are currently assigned to your teacher profile.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="min-w-full text-sm">

                            <thead>

                                <tr className="border-b border-slate-200 bg-slate-50">

                                    <th className="text-left py-3 px-3">
                                        Day
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Time
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Class
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Subject
                                    </th>

                                    <th className="text-left py-3 px-3">
                                        Session
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {timetable.map(
                                    row => (

                                        <tr
                                            key={
                                                row.id
                                            }
                                            className="border-b border-slate-100 hover:bg-slate-50"
                                        >

                                            <td className="py-3 px-3 font-semibold text-slate-700">
                                                {row.day_name ||
                                                    "—"}
                                            </td>


                                            <td className="py-3 px-3 text-slate-600">

                                                {formatTime(
                                                    row.start_time
                                                )}

                                                {" - "}

                                                {formatTime(
                                                    row.end_time
                                                )}

                                            </td>


                                            <td className="py-3 px-3 text-slate-700">
                                                {getClassName(
                                                    row.class_id
                                                )}
                                            </td>


                                            <td className="py-3 px-3 text-slate-600">

                                                Subject ID{" "}

                                                {row.subject_id ??
                                                    "—"}

                                            </td>


                                            <td className="py-3 px-3 text-slate-600">
                                                {row.session ||
                                                    "—"}
                                            </td>

                                        </tr>

                                    )
                                )}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>

        );


    /* =====================================================
       DUTY SCHEDULE VIEW
    ===================================================== */

    const renderSchedule =
        () => (

            <div className="space-y-6">

                {renderDutyCalendar()}

                {renderSelectedDateDetails()}

                {renderDutySummary()}

                {renderDutyTable()}

                {renderTeacherTimetable()}

            </div>

        );


    /* =====================================================
       STUDENT SUPERVISION
    ===================================================== */

    const renderSupervision =
        () => (

            <div className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaUsers className="text-indigo-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Active Students
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {students.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaCheckCircle className="text-green-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Present Today
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {presentStudents.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaExclamationTriangle className="text-orange-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Students Absent
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {absentStudents.length}
                        </p>

                    </div>

                </div>


                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                    <div className="flex items-center gap-3 mb-5">

                        <FaUsers className="text-indigo-600 text-xl" />

                        <div>

                            <h3 className="text-lg font-bold text-slate-800">
                                Student Supervision
                            </h3>

                            <p className="text-sm text-slate-500">
                                Students registered under the current academic year.
                            </p>

                        </div>

                    </div>


                    {students.length ===
                        0 ? (

                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">

                            <p className="font-semibold text-slate-700">
                                No students found
                            </p>

                        </div>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="min-w-full text-sm">

                                <thead>

                                    <tr className="border-b border-slate-200 bg-slate-50">

                                        <th className="text-left py-3 px-3">
                                            #
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Student
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Admission No.
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Class
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Gender
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {students
                                        .slice(
                                            0,
                                            100
                                        )
                                        .map(
                                            (
                                                student,
                                                index
                                            ) => (

                                                <tr
                                                    key={
                                                        student.id
                                                    }
                                                    className="border-b border-slate-100 hover:bg-slate-50"
                                                >

                                                    <td className="py-3 px-3 text-slate-500">
                                                        {index + 1}
                                                    </td>


                                                    <td className="py-3 px-3 font-semibold text-slate-700">
                                                        {getStudentName(
                                                            student.id
                                                        )}
                                                    </td>


                                                    <td className="py-3 px-3 text-slate-600">
                                                        {student.admission_number ||
                                                            student.admission_no ||
                                                            "—"}
                                                    </td>


                                                    <td className="py-3 px-3 text-slate-600">
                                                        {getClassName(
                                                            student.current_class_id
                                                        )}
                                                    </td>


                                                    <td className="py-3 px-3 text-slate-600">
                                                        {student.gender ||
                                                            "—"}
                                                    </td>

                                                </tr>

                                            )
                                        )}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            </div>

        );


    /* =====================================================
       ATTENDANCE
    ===================================================== */

    const renderAttendance =
        () => (

            <div className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaClipboardList className="text-blue-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Today's Records
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {todayAttendance.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaCheckCircle className="text-green-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Present
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {presentStudents.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaUserClock className="text-orange-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Late
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {latecomers.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaExclamationTriangle className="text-red-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Absent
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {absentStudents.length}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-xl p-5">

                        <FaClipboardCheck className="text-purple-600 text-xl mb-3" />

                        <p className="text-xs text-slate-500">
                            Excuse
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-1">
                            {excusedStudents.length}
                        </p>

                    </div>

                </div>


                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">

                        <div>

                            <h3 className="text-lg font-bold text-slate-800">
                                Attendance Management
                            </h3>

                            <p className="text-sm text-slate-500">
                                Mark Present, Absent, Late or Excuse for the selected school date.
                            </p>

                        </div>


                        <div className="flex items-center gap-3">

                            <label className="text-sm font-semibold text-slate-700">
                                Date
                            </label>


                            <input
                                type="date"
                                value={
                                    attendanceDate
                                }
                                onChange={event => {

                                    setAttendanceDate(
                                        event.target.value
                                    );

                                    setAttendanceMessage("");

                                }}
                                className="rounded-lg border border-slate-300 px-3 py-2"
                            />

                        </div>

                    </div>


                    {attendanceMessage && (

                        <div className={`
                            mb-5 rounded-lg border p-4 text-sm
                            ${
                                attendanceMessage.toLowerCase().includes("success")
                                    ? "bg-green-50 border-green-200 text-green-900"
                                    : "bg-blue-50 border-blue-200 text-blue-900"
                            }
                        `}>

                            <div className="flex gap-2">

                                <FaInfoCircle className="mt-0.5" />

                                <span>
                                    {attendanceMessage}
                                </span>

                            </div>

                        </div>

                    )}


                    {students.length ===
                        0 ? (

                        <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">

                            <FaUsers className="mx-auto text-slate-400 text-2xl mb-3" />

                            <p className="font-semibold text-slate-700">
                                No students found
                            </p>

                        </div>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="min-w-full text-sm">

                                <thead>

                                    <tr className="border-b border-slate-200 bg-slate-50">

                                        <th className="text-left py-3 px-3">
                                            #
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Student
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Class
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Current Status
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Mark Attendance
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Remarks
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {students.map(
                                        (
                                            student,
                                            index
                                        ) => {

                                            const existing =
                                                selectedAttendance.find(
                                                    record =>
                                                        Number(
                                                            record.student_id
                                                        ) ===
                                                        Number(
                                                            student.id
                                                        )
                                                );


                                            const draft =
                                                attendanceDrafts[
                                                    student.id
                                                ] || {};


                                            return (

                                                <tr
                                                    key={
                                                        student.id
                                                    }
                                                    className="border-b border-slate-100 hover:bg-slate-50"
                                                >

                                                    <td className="py-3 px-3 text-slate-500">
                                                        {index + 1}
                                                    </td>


                                                    <td className="py-3 px-3 font-semibold text-slate-700">

                                                        {getStudentName(
                                                            student.id
                                                        )}

                                                        <div className="text-[10px] text-slate-400">
                                                            {student.admission_number ||
                                                                student.admission_no ||
                                                                ""}
                                                        </div>

                                                    </td>


                                                    <td className="py-3 px-3 text-slate-600">
                                                        {getClassName(
                                                            student.current_class_id
                                                        )}
                                                    </td>


                                                    <td className="py-3 px-3">

                                                        {existing ? (

                                                            <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">

                                                                {String(
                                                                    existing.status
                                                                )
                                                                    .toLowerCase() ===
                                                                "excused"
                                                                    ? "EXCUSE"
                                                                    : String(
                                                                        existing.status
                                                                    ).toUpperCase()}

                                                            </span>

                                                        ) : (

                                                            <span className="text-slate-400">
                                                                Not marked
                                                            </span>

                                                        )}

                                                    </td>


                                                    <td className="py-3 px-3">

                                                        <select
                                                            value={
                                                                draft.status ||
                                                                ""
                                                            }
                                                            onChange={event =>
                                                                handleAttendanceStatus(
                                                                    student.id,
                                                                    event.target.value
                                                                )
                                                            }
                                                            className="rounded-lg border border-slate-300 px-3 py-2 bg-white"
                                                        >

                                                            <option value="">
                                                                Select
                                                            </option>

                                                            <option value="present">
                                                                Present
                                                            </option>

                                                            <option value="absent">
                                                                Absent
                                                            </option>

                                                            <option value="late">
                                                                Late
                                                            </option>

                                                            <option value="excused">
                                                                Excuse
                                                            </option>

                                                        </select>

                                                    </td>


                                                    <td className="py-3 px-3">

                                                        <input
                                                            type="text"
                                                            value={
                                                                draft.remarks ||
                                                                ""
                                                            }
                                                            onChange={event =>
                                                                handleAttendanceRemarks(
                                                                    student.id,
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder="Optional"
                                                            className="w-full min-w-[180px] rounded-lg border border-slate-300 px-3 py-2"
                                                        />

                                                    </td>

                                                </tr>

                                            );

                                        }
                                    )}

                                </tbody>

                            </table>

                        </div>

                    )}


                    <div className="mt-5 flex flex-col sm:flex-row gap-3">

                        <button
                            type="button"
                            disabled={
                                attendanceSaving
                            }
                            onClick={
                                saveAttendance
                            }
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
                        >

                            <FaSave
                                className={
                                    attendanceSaving
                                        ? "animate-pulse"
                                        : ""
                                }
                            />

                            {attendanceSaving
                                ? "Saving..."
                                : "Save Attendance"}

                        </button>


                        <button
                            type="button"
                            disabled={
                                refreshing
                            }
                            onClick={() =>
                                loadDutyData(
                                    true
                                )
                            }
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        >

                            <FaSyncAlt
                                className={
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            Refresh

                        </button>

                    </div>

                </div>


                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                    <div className="flex items-center justify-between gap-4 mb-5">

                        <div>

                            <h3 className="text-lg font-bold text-slate-800">
                                Attendance Records
                            </h3>

                            <p className="text-sm text-slate-500">
                                {formatDate(
                                    attendanceDate
                                )}
                            </p>

                        </div>

                    </div>


                    {selectedAttendance.length ===
                        0 ? (

                        <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">

                            <FaClipboardList className="mx-auto text-slate-400 text-2xl mb-3" />

                            <p className="font-semibold text-slate-700">
                                No attendance records found
                            </p>

                            <p className="text-sm text-slate-500 mt-1">
                                Use the attendance table above to mark students.
                            </p>

                        </div>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="min-w-full text-sm">

                                <thead>

                                    <tr className="border-b border-slate-200 bg-slate-50">

                                        <th className="text-left py-3 px-3">
                                            Student
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Class
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Status
                                        </th>

                                        <th className="text-left py-3 px-3">
                                            Remarks
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {selectedAttendance.map(
                                        record => {

                                            const status =
                                                String(
                                                    record.status ||
                                                    ""
                                                )
                                                    .trim()
                                                    .toLowerCase();


                                            let badge =
                                                "bg-slate-100 text-slate-700";


                                            if (
                                                status ===
                                                    "present"
                                            ) {

                                                badge =
                                                    "bg-green-100 text-green-700";

                                            }
                                            else if (
                                                status ===
                                                    "late"
                                            ) {

                                                badge =
                                                    "bg-orange-100 text-orange-700";

                                            }
                                            else if (
                                                status ===
                                                    "absent"
                                            ) {

                                                badge =
                                                    "bg-red-100 text-red-700";

                                            }
                                            else if (
                                                status ===
                                                    "excused"
                                            ) {

                                                badge =
                                                    "bg-purple-100 text-purple-700";

                                            }


                                            return (

                                                <tr
                                                    key={
                                                        record.id
                                                    }
                                                    className="border-b border-slate-100"
                                                >

                                                    <td className="py-3 px-3 font-semibold text-slate-700">
                                                        {getStudentName(
                                                            record.student_id
                                                        )}
                                                    </td>


                                                    <td className="py-3 px-3 text-slate-600">
                                                        {getClassName(
                                                            record.class_id
                                                        )}
                                                    </td>


                                                    <td className="py-3 px-3">

                                                        <span
                                                            className={`
                                                                inline-flex px-3 py-1 rounded-full text-xs font-semibold
                                                                ${badge}
                                                            `}
                                                        >

                                                            {status ===
                                                            "excused"
                                                                ? "EXCUSE"
                                                                : String(
                                                                    record.status ||
                                                                    "—"
                                                                ).toUpperCase()}

                                                        </span>

                                                    </td>


                                                    <td className="py-3 px-3 text-slate-600">
                                                        {record.remarks ||
                                                            "—"}
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

        );


    /* =====================================================
       INCIDENTS
    ===================================================== */

    const renderIncidents =
        () => (

            <div className="space-y-6">

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                    <div className="flex items-center gap-3">

                        <FaExclamationTriangle className="text-orange-600 text-xl" />

                        <div>

                            <h3 className="text-lg font-bold text-slate-800">
                                Incidents & Discipline
                            </h3>

                            <p className="text-sm text-slate-500">
                                Prepare an incident record during the current duty session.
                            </p>

                        </div>

                    </div>


                    <form
                        onSubmit={
                            handlePrepareIncident
                        }
                        className="mt-6 space-y-5"
                    >

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Student
                                </label>


                                <select
                                    value={
                                        incidentForm.studentId
                                    }
                                    onChange={event =>
                                        handleIncidentChange(
                                            "studentId",
                                            event.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-3 bg-white"
                                >

                                    <option value="">
                                        Select student
                                    </option>


                                    {students.map(
                                        student => (

                                            <option
                                                key={
                                                    student.id
                                                }
                                                value={
                                                    student.id
                                                }
                                            >

                                                {getStudentName(
                                                    student.id
                                                )}

                                            </option>

                                        )
                                    )}

                                </select>

                            </div>


                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Incident Type
                                </label>


                                <select
                                    value={
                                        incidentForm.incidentType
                                    }
                                    onChange={event =>
                                        handleIncidentChange(
                                            "incidentType",
                                            event.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-3 bg-white"
                                >

                                    <option value="">
                                        Select incident type
                                    </option>

                                    <option value="Discipline">
                                        Discipline
                                    </option>

                                    <option value="Late Coming">
                                        Late Coming
                                    </option>

                                    <option value="Absence">
                                        Absence
                                    </option>

                                    <option value="Fight">
                                        Fight
                                    </option>

                                    <option value="Bullying">
                                        Bullying
                                    </option>

                                    <option value="Other">
                                        Other
                                    </option>

                                </select>

                            </div>

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Description
                            </label>


                            <textarea
                                value={
                                    incidentForm.description
                                }
                                onChange={event =>
                                    handleIncidentChange(
                                        "description",
                                        event.target.value
                                    )
                                }
                                rows={5}
                                placeholder="Describe what happened..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Action Taken
                            </label>


                            <textarea
                                value={
                                    incidentForm.actionTaken
                                }
                                onChange={event =>
                                    handleIncidentChange(
                                        "actionTaken",
                                        event.target.value
                                    )
                                }
                                rows={4}
                                placeholder="Describe the immediate action taken..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                            />

                        </div>


                        {incidentMessage && (

                            <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 text-sm text-orange-900">

                                <div className="flex gap-2">

                                    <FaInfoCircle className="mt-0.5" />

                                    <span>
                                        {incidentMessage}
                                    </span>

                                </div>

                            </div>

                        )}


                        <div className="flex flex-wrap gap-3">

                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700"
                            >

                                <FaSave />

                                Prepare Incident Record

                            </button>


                            {selectedIncident && (

                                <button
                                    type="button"
                                    onClick={
                                        handlePrintIncident
                                    }
                                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900"
                                >

                                    <FaPrint />

                                    Print Incident

                                </button>

                            )}

                        </div>

                    </form>

                </div>


                {incidents.length > 0 && (

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                        <div className="flex items-center justify-between mb-5">

                            <div>

                                <h3 className="text-lg font-bold text-slate-800">
                                    Prepared Incident Records
                                </h3>

                                <p className="text-sm text-slate-500">
                                    Records prepared during this browser session.
                                </p>

                            </div>

                        </div>


                        <div className="space-y-3">

                            {incidents.map(
                                incident => (

                                    <div
                                        key={
                                            incident.id
                                        }
                                        className={`
                                            border rounded-xl p-4
                                            ${
                                                selectedIncident?.id ===
                                                incident.id
                                                    ? "border-orange-300 bg-orange-50/50"
                                                    : "border-slate-200"
                                            }
                                        `}
                                    >

                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                                            <div>

                                                <p className="font-bold text-slate-800">

                                                    {incident.incidentType}

                                                </p>

                                                <p className="text-sm text-slate-600">

                                                    {incident.studentName}

                                                </p>

                                                <p className="text-xs text-slate-500 mt-1">

                                                    {formatDate(
                                                        incident.date
                                                    )}{" "}
                                                    •{" "}
                                                    {incident.time}

                                                </p>

                                            </div>


                                            <div className="flex gap-2">

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedIncident(
                                                            incident
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                                                >

                                                    <FaEye />

                                                    View

                                                </button>


                                                <button
                                                    type="button"
                                                    onClick={() => {

                                                        setSelectedIncident(
                                                            incident
                                                        );

                                                        setTimeout(
                                                            () =>
                                                                printSection(
                                                                    "incident"
                                                                ),
                                                            50
                                                        );

                                                    }}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
                                                >

                                                    <FaPrint />

                                                    Print

                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                )
                            )}

                        </div>

                    </div>

                )}


                {selectedIncident && (

                    <div className="bg-white border border-orange-200 rounded-2xl shadow-sm p-6">

                        <div className="flex items-center justify-between gap-3 mb-5">

                            <div>

                                <h3 className="text-lg font-bold text-slate-800">
                                    Incident Preview
                                </h3>

                                <p className="text-sm text-slate-500">
                                    Printable official incident record
                                </p>

                            </div>


                            <button
                                type="button"
                                onClick={() =>
                                    setSelectedIncident(
                                        null
                                    )
                                }
                                className="w-9 h-9 rounded-lg border border-slate-200 inline-flex items-center justify-center hover:bg-slate-50"
                            >

                                <FaTimes />

                            </button>

                        </div>


                        <div
                            id="incident-print"
                            className="border border-slate-200 rounded-xl p-6"
                        >

                            <div className="print-school-header">

                                {shouldShowSchoolField(
                                    "logo"
                                ) &&
                                    schoolLogo && (

                                        <img
                                            src={
                                                schoolLogo
                                            }
                                            alt={
                                                schoolName
                                            }
                                            className="h-20 mx-auto object-contain mb-3"
                                        />

                                    )}


                                {shouldShowSchoolField(
                                    "school_name"
                                ) && (

                                    <h2 className="text-xl font-bold text-center text-slate-900">
                                        {schoolName}
                                    </h2>

                                )}


                                {shouldShowSchoolField(
                                    "registration_number"
                                ) &&
                                    schoolRegistration && (

                                        <p className="text-center text-sm text-slate-600">
                                            Registration No:{" "}
                                            {schoolRegistration}
                                        </p>

                                    )}


                                {shouldShowSchoolField(
                                    "address"
                                ) &&
                                    schoolAddress && (

                                        <p className="text-center text-sm text-slate-600">
                                            {schoolAddress}
                                        </p>

                                    )}


                                <div className="text-center text-sm text-slate-600">

                                    {shouldShowSchoolField(
                                        "phone"
                                    ) &&
                                        schoolPhone && (
                                            <span>
                                                {schoolPhone}
                                            </span>
                                        )}

                                    {shouldShowSchoolField(
                                        "email"
                                    ) &&
                                        schoolEmail && (

                                            <span>
                                                {" "}
                                                •{" "}
                                                {schoolEmail}
                                            </span>

                                        )}

                                </div>

                            </div>


                            <div className="border-b border-slate-300 my-5" />


                            <h3 className="text-xl font-bold text-center text-slate-900">
                                INCIDENT & DISCIPLINE RECORD
                            </h3>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">
                                        Date
                                    </p>

                                    <p className="font-semibold mt-1">
                                        {formatLongDate(
                                            selectedIncident.date
                                        )}
                                    </p>
                                </div>


                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">
                                        Time
                                    </p>

                                    <p className="font-semibold mt-1">
                                        {selectedIncident.time}
                                    </p>
                                </div>


                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">
                                        Student
                                    </p>

                                    <p className="font-semibold mt-1">
                                        {selectedIncident.studentName}
                                    </p>
                                </div>


                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">
                                        Incident Type
                                    </p>

                                    <p className="font-semibold mt-1">
                                        {selectedIncident.incidentType}
                                    </p>
                                </div>


                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">
                                        Duty Teacher
                                    </p>

                                    <p className="font-semibold mt-1">
                                        {selectedIncident.teacher}
                                    </p>
                                </div>


                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">
                                        Location
                                    </p>

                                    <p className="font-semibold mt-1">
                                        {selectedIncident.location}
                                    </p>
                                </div>

                            </div>


                            <div className="mt-6">

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Description
                                </p>

                                <p className="mt-2 whitespace-pre-wrap text-slate-800">
                                    {selectedIncident.description}
                                </p>

                            </div>


                            <div className="mt-6">

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Action Taken
                                </p>

                                <p className="mt-2 whitespace-pre-wrap text-slate-800">
                                    {selectedIncident.actionTaken}
                                </p>

                            </div>


                            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">

                                <div className="border-t border-slate-400 pt-2">
                                    Teacher on Duty Signature
                                </div>

                                <div className="border-t border-slate-400 pt-2">
                                    School Management / Authorized Officer
                                </div>

                            </div>

                        </div>

                    </div>

                )}

            </div>

        );


    /* =====================================================
       DUTY REPORT
    ===================================================== */

    const renderReport =
        () => (

            <div className="space-y-6">

                <div
                    id="duty-report-print"
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
                >

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div className="flex items-center gap-3">

                            <FaFileAlt className="text-purple-600 text-xl" />

                            <div>

                                <h3 className="text-lg font-bold text-slate-800">
                                    Daily Duty Report
                                </h3>

                                <p className="text-sm text-slate-500">
                                    Prepare the report for the actual school date.
                                </p>

                            </div>

                        </div>


                        <button
                            type="button"
                            onClick={
                                handlePrintReport
                            }
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700"
                        >

                            <FaPrint />

                            Print Report

                        </button>

                    </div>


                    <div className="mt-6 print-school-header">

                        {shouldShowSchoolField(
                            "logo"
                        ) &&
                            schoolLogo && (

                                <img
                                    src={
                                        schoolLogo
                                    }
                                    alt={
                                        schoolName
                                    }
                                    className="hidden print:block h-20 mx-auto object-contain mb-3"
                                />

                            )}


                        {shouldShowSchoolField(
                            "school_name"
                        ) && (

                            <h2 className="hidden print:block text-xl font-bold text-center text-slate-900">
                                {schoolName}
                            </h2>

                        )}


                        {shouldShowSchoolField(
                            "registration_number"
                        ) &&
                            schoolRegistration && (

                                <p className="hidden print:block text-center text-sm text-slate-600">
                                    Registration No:{" "}
                                    {schoolRegistration}
                                </p>

                            )}


                        {shouldShowSchoolField(
                            "address"
                        ) &&
                            schoolAddress && (

                                <p className="hidden print:block text-center text-sm text-slate-600">
                                    {schoolAddress}
                                </p>

                            )}

                    </div>


                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">

                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

                            <p className="text-xs text-slate-500 uppercase font-bold">
                                Date
                            </p>

                            <p className="font-bold text-slate-800 mt-1">
                                {formatLongDate(
                                    todayDate
                                )}
                            </p>

                        </div>


                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

                            <p className="text-xs text-slate-500 uppercase font-bold">
                                Teacher on Duty
                            </p>

                            <p className="font-bold text-slate-800 mt-1">
                                {teacherName}
                            </p>

                        </div>


                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

                            <p className="text-xs text-slate-500 uppercase font-bold">
                                Duty Area
                            </p>

                            <p className="font-bold text-slate-800 mt-1">
                                {currentDutyLabel()}
                            </p>

                        </div>

                    </div>


                    <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">

                        <div className="rounded-xl bg-green-50 border border-green-100 p-4">

                            <p className="text-xs text-green-700 font-bold">
                                PRESENT
                            </p>

                            <p className="text-2xl font-bold text-green-900 mt-1">
                                {presentStudents.length}
                            </p>

                        </div>


                        <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">

                            <p className="text-xs text-orange-700 font-bold">
                                LATE
                            </p>

                            <p className="text-2xl font-bold text-orange-900 mt-1">
                                {latecomers.length}
                            </p>

                        </div>


                        <div className="rounded-xl bg-red-50 border border-red-100 p-4">

                            <p className="text-xs text-red-700 font-bold">
                                ABSENT
                            </p>

                            <p className="text-2xl font-bold text-red-900 mt-1">
                                {absentStudents.length}
                            </p>

                        </div>


                        <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">

                            <p className="text-xs text-purple-700 font-bold">
                                EXCUSE
                            </p>

                            <p className="text-2xl font-bold text-purple-900 mt-1">
                                {excusedStudents.length}
                            </p>

                        </div>


                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">

                            <p className="text-xs text-blue-700 font-bold">
                                TOTAL
                            </p>

                            <p className="text-2xl font-bold text-blue-900 mt-1">
                                {todayAttendance.length}
                            </p>

                        </div>

                    </div>


                    <div className="mt-6 space-y-5">

                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                General Observations
                            </label>


                            <textarea
                                value={
                                    reportForm.observations
                                }
                                onChange={event =>
                                    handleReportChange(
                                        "observations",
                                        event.target.value
                                    )
                                }
                                rows={4}
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Attendance Summary
                            </label>


                            <textarea
                                value={
                                    reportForm.attendanceSummary
                                }
                                onChange={event =>
                                    handleReportChange(
                                        "attendanceSummary",
                                        event.target.value
                                    )
                                }
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Incidents Summary
                            </label>


                            <textarea
                                value={
                                    reportForm.incidentsSummary
                                }
                                onChange={event =>
                                    handleReportChange(
                                        "incidentsSummary",
                                        event.target.value
                                    )
                                }
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Actions Taken
                            </label>


                            <textarea
                                value={
                                    reportForm.actionsTaken
                                }
                                onChange={event =>
                                    handleReportChange(
                                        "actionsTaken",
                                        event.target.value
                                    )
                                }
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Recommendations
                            </label>


                            <textarea
                                value={
                                    reportForm.recommendations
                                }
                                onChange={event =>
                                    handleReportChange(
                                        "recommendations",
                                        event.target.value
                                    )
                                }
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                            />

                        </div>

                    </div>

                </div>

            </div>

        );


    /* =====================================================
       HANDOVER
    ===================================================== */

    const renderHandover =
        () => (

            <div className="space-y-6">

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

                    <div className="flex items-center gap-3">

                        <FaExchangeAlt className="text-red-600 text-xl" />

                        <div>

                            <h3 className="text-lg font-bold text-slate-800">
                                Duty Handover
                            </h3>

                            <p className="text-sm text-slate-500">
                                Handover important information to the next teacher on duty.
                            </p>

                        </div>

                    </div>


                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">

                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">

                            <p className="text-xs text-blue-700 font-bold uppercase">
                                Current Teacher
                            </p>

                            <p className="font-bold text-blue-900 mt-1">
                                {teacherName}
                            </p>

                        </div>


                        <div className="rounded-xl bg-green-50 border border-green-100 p-4">

                            <p className="text-xs text-green-700 font-bold uppercase">
                                Next Teacher
                            </p>

                            <p className="font-bold text-green-900 mt-1">
                                {nextTeacherName}
                            </p>

                        </div>


                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

                            <p className="text-xs text-slate-500 font-bold uppercase">
                                Next Duty Date
                            </p>

                            <p className="font-bold text-slate-800 mt-1">

                                {nextTeacherDuty
                                    ? formatDate(
                                        nextTeacherDuty.duty.duty_date
                                    )
                                    : "—"}

                            </p>

                        </div>

                    </div>


                    {currentDuty && (

                        <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4">

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                                <div>

                                    <p className="text-xs text-slate-500">
                                        Current Duty
                                    </p>

                                    <p className="font-bold text-slate-800 mt-1">
                                        {currentDuty.duty_area ||
                                            "General Duty"}
                                    </p>

                                </div>


                                <div>

                                    <p className="text-xs text-slate-500">
                                        Time
                                    </p>

                                    <p className="font-bold text-slate-800 mt-1">

                                        {formatTime(
                                            currentDuty.start_time
                                        )}

                                        {" - "}

                                        {formatTime(
                                            currentDuty.end_time
                                        )}

                                    </p>

                                </div>


                                <div>

                                    <p className="text-xs text-slate-500">
                                        Location
                                    </p>

                                    <p className="font-bold text-slate-800 mt-1">
                                        {currentDuty.location ||
                                            "—"}
                                    </p>

                                </div>


                                <div>

                                    <p className="text-xs text-slate-500">
                                        Date
                                    </p>

                                    <p className="font-bold text-slate-800 mt-1">
                                        {formatDate(
                                            currentDuty.duty_date
                                        )}
                                    </p>

                                </div>

                            </div>

                        </div>

                    )}


                    <form
                        onSubmit={
                            handlePrepareHandover
                        }
                        className="mt-6 space-y-5"
                    >

                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Handover Summary
                            </label>


                            <textarea
                                value={
                                    handoverForm.summary
                                }
                                onChange={event =>
                                    handleHandoverChange(
                                        "summary",
                                        event.target.value
                                    )
                                }
                                rows={4}
                                placeholder="Write the main information the next teacher needs to know..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Pending Issues
                            </label>


                            <textarea
                                value={
                                    handoverForm.pendingIssues
                                }
                                onChange={event =>
                                    handleHandoverChange(
                                        "pendingIssues",
                                        event.target.value
                                    )
                                }
                                rows={4}
                                placeholder="List matters that still require follow-up..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Instructions to Next Teacher
                            </label>


                            <textarea
                                value={
                                    handoverForm.instructions
                                }
                                onChange={event =>
                                    handleHandoverChange(
                                        "instructions",
                                        event.target.value
                                    )
                                }
                                rows={4}
                                placeholder="Write instructions for the next teacher..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                            />

                        </div>


                        {handoverMessage && (

                            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-900">

                                <div className="flex gap-2">

                                    <FaInfoCircle className="mt-0.5" />

                                    <span>
                                        {handoverMessage}
                                    </span>

                                </div>

                            </div>

                        )}


                        <div className="flex flex-wrap gap-3">

                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
                            >

                                <FaSave />

                                Prepare Handover

                            </button>


                            {savedHandover && (

                                <button
                                    type="button"
                                    onClick={
                                        handlePrintHandover
                                    }
                                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900"
                                >

                                    <FaPrint />

                                    Print Handover

                                </button>

                            )}

                        </div>

                    </form>

                </div>


                {savedHandover && (

                    <div
                        id="handover-print"
                        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
                    >

                        <div className="print-school-header text-center">

                            {shouldShowSchoolField(
                                "logo"
                            ) &&
                                schoolLogo && (

                                    <img
                                        src={
                                            schoolLogo
                                        }
                                        alt={
                                            schoolName
                                        }
                                        className="h-20 mx-auto object-contain mb-3"
                                    />

                                )}


                            {shouldShowSchoolField(
                                "school_name"
                            ) && (

                                <h2 className="text-xl font-bold text-slate-900">
                                    {schoolName}
                                </h2>

                            )}


                            {shouldShowSchoolField(
                                "registration_number"
                            ) &&
                                schoolRegistration && (

                                    <p className="text-sm text-slate-600">
                                        Registration No:{" "}
                                        {schoolRegistration}
                                    </p>

                                )}


                            {shouldShowSchoolField(
                                "address"
                            ) &&
                                schoolAddress && (

                                    <p className="text-sm text-slate-600">
                                        {schoolAddress}
                                    </p>

                                )}


                            <p className="text-sm text-slate-600">

                                {shouldShowSchoolField(
                                    "phone"
                                ) &&
                                    schoolPhone && (
                                        <span>
                                            {schoolPhone}
                                        </span>
                                    )}

                                {shouldShowSchoolField(
                                    "email"
                                ) &&
                                    schoolEmail && (

                                        <span>
                                            {" "}
                                            •{" "}
                                            {schoolEmail}
                                        </span>

                                    )}

                            </p>

                        </div>


                        <div className="border-b border-slate-300 my-5" />


                        <h3 className="text-xl font-bold text-center text-slate-900">
                            TEACHER ON DUTY HANDOVER
                        </h3>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">

                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Handover Date
                                </p>

                                <p className="font-semibold mt-1">
                                    {formatLongDate(
                                        savedHandover.date
                                    )}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Day
                                </p>

                                <p className="font-semibold mt-1">
                                    {savedHandover.day}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Current Teacher
                                </p>

                                <p className="font-semibold mt-1">
                                    {savedHandover.currentTeacher}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Next Teacher
                                </p>

                                <p className="font-semibold mt-1">
                                    {savedHandover.nextTeacher}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Duty Area
                                </p>

                                <p className="font-semibold mt-1">
                                    {savedHandover.currentDuty}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Duty Time
                                </p>

                                <p className="font-semibold mt-1">

                                    {formatTime(
                                        savedHandover.startTime
                                    )}

                                    {" - "}

                                    {formatTime(
                                        savedHandover.endTime
                                    )}

                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Location
                                </p>

                                <p className="font-semibold mt-1">
                                    {savedHandover.location}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-slate-500 uppercase font-bold">
                                    Next Duty Date
                                </p>

                                <p className="font-semibold mt-1">

                                    {savedHandover.nextDutyDate
                                        ? formatLongDate(
                                            savedHandover.nextDutyDate
                                        )
                                        : "—"}

                                </p>

                            </div>

                        </div>


                        <div className="mt-7">

                            <p className="text-xs text-slate-500 uppercase font-bold">
                                Handover Summary
                            </p>

                            <div className="mt-2 border border-slate-200 rounded-lg p-4 whitespace-pre-wrap">
                                {savedHandover.summary}
                            </div>

                        </div>


                        <div className="mt-5">

                            <p className="text-xs text-slate-500 uppercase font-bold">
                                Pending Issues
                            </p>

                            <div className="mt-2 border border-slate-200 rounded-lg p-4 whitespace-pre-wrap min-h-[90px]">
                                {savedHandover.pendingIssues ||
                                    "None recorded."}
                            </div>

                        </div>


                        <div className="mt-5">

                            <p className="text-xs text-slate-500 uppercase font-bold">
                                Instructions to Next Teacher
                            </p>

                            <div className="mt-2 border border-slate-200 rounded-lg p-4 whitespace-pre-wrap min-h-[90px]">
                                {savedHandover.instructions ||
                                    "No additional instructions recorded."}
                            </div>

                        </div>


                        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-12">

                            <div className="border-t border-slate-400 pt-2">

                                Current Teacher Signature

                            </div>


                            <div className="border-t border-slate-400 pt-2">

                                Next Teacher Signature

                            </div>

                        </div>

                    </div>

                )}


                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">

                    <div className="flex gap-3">

                        <FaInfoCircle className="text-blue-700 mt-1" />


                        <div>

                            <h4 className="font-semibold text-blue-900">
                                Handover sequence
                            </h4>


                            <p className="text-sm text-blue-800 mt-1">

                                The next teacher shown above is calculated
                                directly from the chronological Duty Schedule
                                roster. If the timetable changes, the next
                                teacher will also change after the roster
                                refreshes.

                            </p>

                        </div>

                    </div>

                </div>

            </div>

        );


    /* =====================================================
       SELECTED DUTY CONTENT
    ===================================================== */

    const renderSelectedDuty =
        () => {

            if (!selectedDuty) {

                return null;

            }


            switch (
                selectedDuty.id
            ) {

                case "schedule":

                    return renderSchedule();


                case "supervision":

                    return renderSupervision();


                case "attendance":

                    return renderAttendance();


                case "incidents":

                    return renderIncidents();


                case "report":

                    return renderReport();


                case "handover":

                    return renderHandover();


                default:

                    return null;

            }

        };


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        return (

            <div className="min-h-screen bg-slate-50 p-6">

                <div className="max-w-6xl mx-auto">

                    {renderHeader()}


                    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">

                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />

                        <p className="mt-4 text-slate-600 font-medium">
                            Loading Teacher on Duty information...
                        </p>

                    </div>

                </div>

            </div>

        );

    }


    /* =====================================================
       ERROR
    ===================================================== */

    if (error) {

        return (

            <div className="min-h-screen bg-slate-50 p-6">

                <div className="max-w-6xl mx-auto">

                    {renderHeader()}


                    <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-8 text-center">

                        <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl">
                            !
                        </div>


                        <h2 className="text-xl font-bold text-slate-800 mt-4">
                            Unable to Load Duty Information
                        </h2>


                        <p className="text-slate-600 mt-2">
                            {error}
                        </p>


                        <button
                            type="button"
                            onClick={() =>
                                loadDutyData(
                                    true
                                )
                            }
                            className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                        >

                            <FaSyncAlt />

                            Try Again

                        </button>

                    </div>

                </div>

            </div>

        );

    }


    /* =====================================================
       MAIN
    ===================================================== */

    return (

        <div className="min-h-screen bg-slate-50 p-6">

            <div className="max-w-7xl mx-auto">

                {!selectedDuty && (

                    <>

                        {renderHeader()}

                        {renderDutyMenu()}

                    </>

                )}


                {selectedDuty && (

                    <>

                        {renderDutyViewHeader()}

                        {renderSelectedDuty()}

                    </>

                )}

            </div>


            {/* =================================================
                PRINT STYLES
            ================================================= */}

            <style>
                {`

                    @media print {

                        body {
                            background: white !important;
                        }


                        body.africore-printing * {
                            visibility: hidden !important;
                        }


                        body.africore-printing
                        #duty-report-print,
                        body.africore-printing
                        #duty-report-print * {

                            visibility: visible !important;

                        }


                        body.africore-printing
                        #incident-print,
                        body.africore-printing
                        #incident-print * {

                            visibility: visible !important;

                        }


                        body.africore-printing
                        #handover-print,
                        body.africore-printing
                        #handover-print * {

                            visibility: visible !important;

                        }


                        body.africore-printing
                        .africore-print-report
                        {

                            display: block !important;

                        }


                        body.africore-printing
                        #duty-report-print {

                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            border: none !important;
                            box-shadow: none !important;
                            padding: 20px !important;

                        }


                        body.africore-printing
                        #incident-print {

                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            border: none !important;
                            box-shadow: none !important;
                            padding: 20px !important;

                        }


                        body.africore-printing
                        #handover-print {

                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            border: none !important;
                            box-shadow: none !important;
                            padding: 20px !important;

                        }


                        body.africore-printing
                        .print-school-header {

                            display: block !important;

                        }


                        body.africore-printing
                        textarea,
                        body.africore-printing
                        input,
                        body.africore-printing
                        select,
                        body.africore-printing
                        button {

                            border-color: transparent !important;

                        }


                        @page {

                            size: A4;
                            margin: 12mm;

                        }

                    }

                `}
            </style>

        </div>

    );

}


export default TeacherOnDuty;