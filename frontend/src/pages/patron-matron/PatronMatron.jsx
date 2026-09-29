import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    FaBed,
    FaUsers,
    FaUserTie,
    FaFemale,
    FaClipboardCheck,
    FaExclamationTriangle,
    FaSignOutAlt,
    FaChartBar,
    FaPlus,
    FaEdit,
    FaTrash,
    FaEye,
    FaSearch,
    FaTimes,
    FaSave,
    FaSpinner,
    FaExchangeAlt,
    FaUserPlus,
    FaBuilding,
    FaCheckCircle,
    FaDoorOpen,
    FaCalendarAlt,
    FaHistory,
    FaArrowLeft,
    FaSyncAlt
} from "react-icons/fa";

import { supabase } from "../../services/supabase";


// =====================================================
// CONSTANTS
// =====================================================

const PATRON_ROLE_ID = 15;
const MATRON_ROLE_ID = 14;

const MANAGEMENT_ROLE_IDS = [
    1,
    2,
    3,
    14,
    15
];

const GENDER_OPTIONS = [
    {
        value: "male",
        label: "Boys"
    },
    {
        value: "female",
        label: "Girls"
    }
];

const ATTENDANCE_STATUS = [
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

const ATTENDANCE_SESSIONS = [
    {
        value: "morning",
        label: "Morning"
    },
    {
        value: "evening",
        label: "Evening"
    },
    {
        value: "night",
        label: "Night"
    }
];

const INCIDENT_TYPES = [
    "Discipline",
    "Health",
    "Injury",
    "Conflict",
    "Property Damage",
    "Missing Item",
    "Bullying",
    "Absence",
    "Other"
];

const INCIDENT_SEVERITIES = [
    "low",
    "medium",
    "high",
    "critical"
];

const INCIDENT_STATUSES = [
    "open",
    "under_review",
    "resolved"
];

const OUTPASS_STATUSES = [
    "pending",
    "approved",
    "rejected",
    "returned",
    "overdue"
];


// =====================================================
// EMPTY FORMS
// =====================================================

const emptyDormitoryForm = {
    id: "",
    name: "",
    gender: "male",
    capacity: "",
    academic_year_id: "",
    patron_profile_id: "",
    matron_profile_id: "",
    status: "active"
};


const emptyAllocationForm = {
    allocation_id: "",
    student_id: "",
    student_name: "",
    admission_number: "",
    dormitory_id: "",
    academic_year_id: "",
    bed_id: ""
};


const emptyIncidentForm = {
    id: "",
    dormitory_id: "",
    student_id: "",
    academic_year_id: "",
    incident_date: "",
    incident_type: "Discipline",
    severity: "low",
    title: "",
    description: "",
    action_taken: "",
    status: "open"
};


const emptyOutpassForm = {
    id: "",
    dormitory_id: "",
    student_id: "",
    academic_year_id: "",
    request_date: "",
    leave_from: "",
    expected_return: "",
    destination: "",
    reason: "",
    guardian_name: "",
    guardian_phone: "",
    status: "pending",
    notes: ""
};


// =====================================================
// HELPERS
// =====================================================

function getStudentName(student) {

    if (!student) {
        return "";
    }

    const parts = [
        student.first_name,
        student.middle_name,
        student.last_name
    ].filter(Boolean);

    return (
        parts.join(" ").trim() ||
        student.full_name ||
        student.name ||
        "-"
    );
}


function normalizeText(value) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}


function getGenderLabel(gender) {

    if (
        normalizeText(gender) ===
        "female"
    ) {
        return "Girls";
    }

    if (
        normalizeText(gender) ===
        "male"
    ) {
        return "Boys";
    }

    return gender || "-";
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(
            `${String(value).slice(0, 10)}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function getToday() {

    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getWeekStart(value) {

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return getToday();
    }

    const day =
        date.getDay();

    const difference =
        day === 0
            ? -6
            : 1 - day;

    date.setDate(
        date.getDate() +
        difference
    );

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const dateDay =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${dateDay}`;
}


function addDays(
    value,
    amount
) {

    const date =
        new Date(
            `${value}T00:00:00`
        );

    date.setDate(
        date.getDate() +
        amount
    );

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getAttendanceStatusLabel(
    status
) {

    const found =
        ATTENDANCE_STATUS.find(
            item =>
                item.value ===
                status
        );

    return (
        found?.label ||
        status ||
        "-"
    );
}


function getOutpassStatusClass(
    status
) {

    const classes = {
        pending:
            "bg-yellow-100 text-yellow-700",

        approved:
            "bg-green-100 text-green-700",

        rejected:
            "bg-red-100 text-red-700",

        returned:
            "bg-blue-100 text-blue-700",

        overdue:
            "bg-orange-100 text-orange-700"
    };

    return (
        classes[status] ||
        "bg-slate-100 text-slate-600"
    );
}


// =====================================================
// MAIN COMPONENT
// =====================================================

export default function PatronMatron() {

    // -------------------------------------------------
    // USER
    // -------------------------------------------------

    const [
        currentUser,
        setCurrentUser
    ] = useState(null);

    const [
        profile,
        setProfile
    ] = useState(null);

    const [
        userRoles,
        setUserRoles
    ] = useState([]);

    const [
        loading,
        setLoading
    ] = useState(true);

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


    // -------------------------------------------------
    // DATA
    // -------------------------------------------------

    const [
        academicYears,
        setAcademicYears
    ] = useState([]);

    const [
        dormitories,
        setDormitories
    ] = useState([]);

    const [
        students,
        setStudents
    ] = useState([]);

    const [
        allocations,
        setAllocations
    ] = useState([]);

    const [
        beds,
        setBeds
    ] = useState([]);

    const [
        patrons,
        setPatrons
    ] = useState([]);

    const [
        matrons,
        setMatrons
    ] = useState([]);

    const [
        attendance,
        setAttendance
    ] = useState([]);

    const [
        incidents,
        setIncidents
    ] = useState([]);

    const [
        outpasses,
        setOutpasses
    ] = useState([]);


    // -------------------------------------------------
    // NAVIGATION
    // -------------------------------------------------

    const [
        activeSection,
        setActiveSection
    ] = useState(
        "dormitories"
    );

    const [
        search,
        setSearch
    ] = useState("");


    // -------------------------------------------------
    // DORMITORY MODAL
    // -------------------------------------------------

    const [
        showDormitoryModal,
        setShowDormitoryModal
    ] = useState(false);

    const [
        editingDormitory,
        setEditingDormitory
    ] = useState(false);

    const [
        dormitoryForm,
        setDormitoryForm
    ] = useState(
        emptyDormitoryForm
    );


    // -------------------------------------------------
    // ALLOCATION MODAL
    // -------------------------------------------------

    const [
        showAllocationModal,
        setShowAllocationModal
    ] = useState(false);

    const [
        editingAllocation,
        setEditingAllocation
    ] = useState(false);

    const [
        allocationForm,
        setAllocationForm
    ] = useState(
        emptyAllocationForm
    );


    // -------------------------------------------------
    // VIEW MODAL
    // -------------------------------------------------

    const [
        showViewModal,
        setShowViewModal
    ] = useState(false);

    const [
        selectedDormitory,
        setSelectedDormitory
    ] = useState(null);


    // -------------------------------------------------
    // STUDENT MODAL
    // -------------------------------------------------

    const [
        showStudentModal,
        setShowStudentModal
    ] = useState(false);

    const [
        selectedStudent,
        setSelectedStudent
    ] = useState(null);


    // -------------------------------------------------
    // ATTENDANCE
    // -------------------------------------------------

    const [
        attendanceDate,
        setAttendanceDate
    ] = useState(
        getToday()
    );

    const [
        attendanceSession,
        setAttendanceSession
    ] = useState(
        "morning"
    );

    const [
        attendanceDormitoryId,
        setAttendanceDormitoryId
    ] = useState("");

    const [
        attendanceDraft,
        setAttendanceDraft
    ] = useState({});

    const [
        weeklyStart,
        setWeeklyStart
    ] = useState(
        getWeekStart(
            getToday()
        )
    );

    const [
        weeklyDraft,
        setWeeklyDraft
    ] = useState({});


    // -------------------------------------------------
    // INCIDENTS
    // -------------------------------------------------

    const [
        showIncidentModal,
        setShowIncidentModal
    ] = useState(false);

    const [
        editingIncident,
        setEditingIncident
    ] = useState(false);

    const [
        incidentForm,
        setIncidentForm
    ] = useState(
        emptyIncidentForm
    );


    // -------------------------------------------------
    // OUTPASS
    // -------------------------------------------------

    const [
        showOutpassModal,
        setShowOutpassModal
    ] = useState(false);

    const [
        editingOutpass,
        setEditingOutpass
    ] = useState(false);

    const [
        outpassForm,
        setOutpassForm
    ] = useState(
        emptyOutpassForm
    );


    // -------------------------------------------------
    // SCHOOL
    // -------------------------------------------------

    const schoolId =
        profile?.school_id ||
        null;


    // -------------------------------------------------
    // ROLE
    // -------------------------------------------------

    const roleIds =
        useMemo(
            () => {

                const ids =
                    new Set();

                if (
                    profile?.role_id
                ) {
                    ids.add(
                        Number(
                            profile.role_id
                        )
                    );
                }

                userRoles.forEach(
                    role => {

                        if (
                            role?.role_id
                        ) {
                            ids.add(
                                Number(
                                    role.role_id
                                )
                            );
                        }

                    }
                );

                return Array.from(
                    ids
                );

            },
            [
                profile,
                userRoles
            ]
        );


    const isSuperAdmin =
        roleIds.includes(1);

    const isHeadmaster =
        roleIds.includes(2);

    const isDeputy =
        roleIds.includes(3);

    const isPatron =
        roleIds.includes(
            PATRON_ROLE_ID
        );

    const isMatron =
        roleIds.includes(
            MATRON_ROLE_ID
        );

    const isManagement =
        roleIds.some(
            roleId =>
                MANAGEMENT_ROLE_IDS.includes(
                    roleId
                )
        );


    // -------------------------------------------------
    // ACTIVE ACADEMIC YEAR
    // -------------------------------------------------

    const activeAcademicYear =
        useMemo(
            () => {

                if (
                    academicYears.length ===
                    0
                ) {
                    return null;
                }

                return (
                    academicYears.find(
                        year =>
                            year.is_active ===
                            true
                    ) ||
                    academicYears[0]
                );

            },
            [
                academicYears
            ]
        );


    // =================================================
    // INITIALIZE
    // =================================================

    useEffect(
        () => {

            initialize();

        },
        []
    );


    async function initialize() {

        try {

            setLoading(true);
            setError("");

            const {
                data: authData,
                error: authError
            } =
                await supabase.auth.getUser();

            if (
                authError
            ) {
                throw authError;
            }

            const user =
                authData?.user;

            if (!user) {
                throw new Error(
                    "No authenticated user found."
                );
            }

            setCurrentUser(
                user
            );


            const {
                data: profileData,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "id, full_name, phone, role_id, school_id"
                    )
                    .eq(
                        "id",
                        user.id
                    )
                    .maybeSingle();

            if (
                profileError
            ) {
                throw profileError;
            }

            setProfile(
                profileData
            );


            const {
                data: rolesData,
                error: rolesError
            } =
                await supabase
                    .from("profile_roles")
                    .select(
                        "profile_id, role_id, school_id, is_primary, is_active"
                    )
                    .eq(
                        "profile_id",
                        user.id
                    )
                    .eq(
                        "is_active",
                        true
                    );

            if (
                rolesError
            ) {
                throw rolesError;
            }

            setUserRoles(
                rolesData || []
            );


            const activeSchoolId =
                profileData?.school_id ||
                null;


            await Promise.all([
                loadAcademicYears(
                    activeSchoolId
                ),
                loadPatrons(
                    activeSchoolId
                ),
                loadMatrons(
                    activeSchoolId
                ),
                loadDormitories(
                    activeSchoolId
                ),
                loadBeds(
                    activeSchoolId
                ),
                loadStudents(
                    activeSchoolId
                ),
                loadAllocations(
                    activeSchoolId
                ),
                loadAttendance(
                    activeSchoolId
                ),
                loadIncidents(
                    activeSchoolId
                ),
                loadOutpasses(
                    activeSchoolId
                )
            ]);

        } catch (
            loadError
        ) {

            console.error(
                "BOARDING INITIALIZE ERROR:",
                loadError
            );

            setError(
                loadError?.message ||
                "Failed to load boarding management."
            );

        } finally {

            setLoading(false);

        }

    }


    // =================================================
    // LOAD ACADEMIC YEARS
    // =================================================

    async function loadAcademicYears(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setAcademicYears([]);
            return;
        }

        const {
            data,
            error: queryError
        } =
            await supabase
                .from("academic_years")
                .select(
                    "id, school_id, year_name, term, start_date, end_date, is_active"
                )
                .or(
                    `school_id.eq.${activeSchoolId},school_id.is.null`
                )
                .order(
                    "start_date",
                    {
                        ascending: false
                    }
                );

        if (
            queryError
        ) {
            throw queryError;
        }

        setAcademicYears(
            data || []
        );

    }


    // =================================================
    // LOAD PATRONS
    // =================================================

    async function loadPatrons(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setPatrons([]);
            return;
        }

        const {
            data: roleRows,
            error: roleError
        } =
            await supabase
                .from("profile_roles")
                .select(
                    "profile_id, role_id, school_id, is_active"
                )
                .eq(
                    "role_id",
                    PATRON_ROLE_ID
                )
                .eq(
                    "is_active",
                    true
                )
                .eq(
                    "school_id",
                    activeSchoolId
                );

        if (
            roleError
        ) {
            throw roleError;
        }

        const ids =
            [
                ...new Set(
                    (roleRows || [])
                        .map(
                            row =>
                                row.profile_id
                        )
                        .filter(Boolean)
                )
            ];

        if (
            ids.length ===
            0
        ) {
            setPatrons([]);
            return;
        }

        const {
            data: profilesData,
            error: profilesError
        } =
            await supabase
                .from("profiles")
                .select(
                    "id, full_name, phone, school_id"
                )
                .in(
                    "id",
                    ids
                );

        if (
            profilesError
        ) {
            throw profilesError;
        }

        setPatrons(
            profilesData || []
        );

    }


    // =================================================
    // LOAD MATRONS
    // =================================================

    async function loadMatrons(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setMatrons([]);
            return;
        }

        const {
            data: roleRows,
            error: roleError
        } =
            await supabase
                .from("profile_roles")
                .select(
                    "profile_id, role_id, school_id, is_active"
                )
                .eq(
                    "role_id",
                    MATRON_ROLE_ID
                )
                .eq(
                    "is_active",
                    true
                )
                .eq(
                    "school_id",
                    activeSchoolId
                );

        if (
            roleError
        ) {
            throw roleError;
        }

        const ids =
            [
                ...new Set(
                    (roleRows || [])
                        .map(
                            row =>
                                row.profile_id
                        )
                        .filter(Boolean)
                )
            ];

        if (
            ids.length ===
            0
        ) {
            setMatrons([]);
            return;
        }

        const {
            data: profilesData,
            error: profilesError
        } =
            await supabase
                .from("profiles")
                .select(
                    "id, full_name, phone, school_id"
                )
                .in(
                    "id",
                    ids
                );

        if (
            profilesError
        ) {
            throw profilesError;
        }

        setMatrons(
            profilesData || []
        );

    }


    // =================================================
    // LOAD DORMITORIES
    // =================================================

    async function loadDormitories(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setDormitories([]);
            return;
        }

        const {
            data,
            error: queryError
        } =
            await supabase
                .from("dormitories")
                .select(
                    "id, school_id, academic_year_id, name, gender, capacity, status, leader_student_id, created_by, created_at, patron_profile_id, matron_profile_id"
                )
                .eq(
                    "school_id",
                    activeSchoolId
                )
                .order(
                    "name",
                    {
                        ascending: true
                    }
                );

        if (
            queryError
        ) {
            throw queryError;
        }

        setDormitories(
            data || []
        );

    }


    // =================================================
    // LOAD BEDS
    // =================================================

    async function loadBeds(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setBeds([]);
            return;
        }

        const {
            data: dormRows,
            error: dormError
        } =
            await supabase
                .from("dormitories")
                .select("id")
                .eq(
                    "school_id",
                    activeSchoolId
                );

        if (
            dormError
        ) {
            throw dormError;
        }

        const dormIds =
            (dormRows || [])
                .map(
                    dorm =>
                        dorm.id
                );

        if (
            dormIds.length ===
            0
        ) {
            setBeds([]);
            return;
        }

        const {
            data,
            error: bedError
        } =
            await supabase
                .from("dormitory_beds")
                .select(
                    "id, dormitory_id, bed_number, status, condition, notes, created_at"
                )
                .in(
                    "dormitory_id",
                    dormIds
                )
                .order(
                    "bed_number",
                    {
                        ascending: true
                    }
                );

        if (
            bedError
        ) {
            throw bedError;
        }

        setBeds(
            data || []
        );

    }


    // =================================================
    // LOAD STUDENTS
    // =================================================

    async function loadStudents(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setStudents([]);
            return;
        }

        const {
            data,
            error: studentError
        } =
            await supabase
                .from("students")
                .select(
                    "id, school_id, admission_number, first_name, middle_name, last_name, gender, date_of_birth, current_class_id, academic_year_id, admission_date, student_status, photo, address, phone, email, class_name, stream, parent_name, parent_phone, parent_email, status, photo_url"
                )
                .eq(
                    "school_id",
                    activeSchoolId
                )
                .order(
                    "first_name",
                    {
                        ascending: true
                    }
                );

        if (
            studentError
        ) {
            throw studentError;
        }

        setStudents(
            data || []
        );

    }


    // =================================================
    // LOAD ALLOCATIONS
    // =================================================

    async function loadAllocations(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setAllocations([]);
            return;
        }

        const {
            data,
            error: allocationError
        } =
            await supabase
                .from("dormitory_students")
                .select(
                    "id, dormitory_id, student_id, school_id, academic_year_id, assigned_at, assigned_by, bed_id"
                )
                .eq(
                    "school_id",
                    activeSchoolId
                )
                .order(
                    "assigned_at",
                    {
                        ascending: false
                    }
                );

        if (
            allocationError
        ) {
            throw allocationError;
        }

        setAllocations(
            data || []
        );

    }


    // =================================================
    // LOAD ATTENDANCE
    // =================================================

    async function loadAttendance(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setAttendance([]);
            return;
        }

        const {
            data,
            error: attendanceError
        } =
            await supabase
                .from("dormitory_student_attendance")
                .select(
                    "id, school_id, dormitory_id, student_id, academic_year_id, attendance_date, session, status, notes, recorded_by, created_at"
                )
                .eq(
                    "school_id",
                    activeSchoolId
                )
                .order(
                    "attendance_date",
                    {
                        ascending: false
                    }
                );

        if (
            attendanceError
        ) {
            throw attendanceError;
        }

        setAttendance(
            data || []
        );

    }


    // =================================================
    // LOAD INCIDENTS
    // =================================================

    async function loadIncidents(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setIncidents([]);
            return;
        }

        const {
            data,
            error: incidentError
        } =
            await supabase
                .from("dormitory_incidents")
                .select(
                    "id, school_id, dormitory_id, student_id, academic_year_id, incident_date, incident_type, severity, title, description, action_taken, status, reported_by, resolved_by, resolved_at, created_at"
                )
                .eq(
                    "school_id",
                    activeSchoolId
                )
                .order(
                    "incident_date",
                    {
                        ascending: false
                    }
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (
            incidentError
        ) {
            throw incidentError;
        }

        setIncidents(
            data || []
        );

    }


    // =================================================
    // LOAD OUTPASS
    // =================================================

    async function loadOutpasses(
        activeSchoolId
    ) {

        if (
            !activeSchoolId
        ) {
            setOutpasses([]);
            return;
        }

        const {
            data,
            error: outpassError
        } =
            await supabase
                .from("dormitory_outpasses")
                .select(
                    "id, school_id, dormitory_id, student_id, academic_year_id, request_date, leave_from, expected_return, destination, reason, guardian_name, guardian_phone, status, approved_by, approved_at, return_recorded_at, notes, created_at"
                )
                .eq(
                    "school_id",
                    activeSchoolId
                )
                .order(
                    "request_date",
                    {
                        ascending: false
                    }
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (
            outpassError
        ) {
            throw outpassError;
        }

        setOutpasses(
            data || []
        );

    }


    // =================================================
    // REFRESH
    // =================================================

    async function refreshDataOnly() {

        if (
            !schoolId
        ) {
            return;
        }

        await Promise.all([
            loadDormitories(
                schoolId
            ),
            loadBeds(
                schoolId
            ),
            loadStudents(
                schoolId
            ),
            loadAllocations(
                schoolId
            ),
            loadAttendance(
                schoolId
            ),
            loadIncidents(
                schoolId
            ),
            loadOutpasses(
                schoolId
            ),
            loadPatrons(
                schoolId
            ),
            loadMatrons(
                schoolId
            )
        ]);

    }


    async function refreshAll() {

        try {

            setLoading(true);
            setError("");
            setSuccess("");

            await refreshDataOnly();

            setSuccess(
                "Boarding data refreshed successfully."
            );

        } catch (
            refreshError
        ) {

            console.error(
                refreshError
            );

            setError(
                refreshError?.message ||
                "Failed to refresh boarding data."
            );

        } finally {

            setLoading(false);

        }

    }


    // =================================================
    // DECORATED ALLOCATIONS
    // =================================================

    const decoratedAllocations =
        useMemo(
            () => {

                return allocations.map(
                    allocation => {

                        const student =
                            students.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        allocation.student_id
                                    )
                            );

                        const dormitory =
                            dormitories.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        allocation.dormitory_id
                                    )
                            );

                        const bed =
                            beds.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        allocation.bed_id
                                    )
                            );

                        return {
                            ...allocation,
                            student,
                            dormitory,
                            bed,
                            student_name:
                                getStudentName(
                                    student
                                ),
                            admission_number:
                                student?.admission_number ||
                                student?.admission_no ||
                                ""
                        };

                    }
                );

            },
            [
                allocations,
                students,
                dormitories,
                beds
            ]
        );


    // =================================================
    // FILTERED ALLOCATIONS
    // =================================================

    const filteredAllocations =
        useMemo(
            () => {

                const term =
                    normalizeText(
                        search
                    );

                if (!term) {
                    return decoratedAllocations;
                }

                return decoratedAllocations.filter(
                    allocation => {

                        const haystack =
                            [
                                allocation.student_name,
                                allocation.admission_number,
                                allocation.dormitory?.name,
                                allocation.bed?.bed_number
                            ]
                                .map(
                                    normalizeText
                                )
                                .join(" ");

                        return haystack.includes(
                            term
                        );

                    }
                );

            },
            [
                decoratedAllocations,
                search
            ]
        );


    // =================================================
    // STATS
    // =================================================

    const totalBeds =
        beds.length;

    const occupiedBeds =
        beds.filter(
            bed =>
                bed.status ===
                "occupied"
        ).length;

    const availableBeds =
        beds.filter(
            bed =>
                bed.status ===
                "available"
        ).length;

    const boardingStudents =
        allocations.length;

    const totalCapacity =
        dormitories.reduce(
            (
                total,
                dormitory
            ) =>
                total +
                Number(
                    dormitory.capacity ||
                    0
                ),
            0
        );


    // =================================================
    // DORM HELPERS
    // =================================================

    function getDormBeds(
        dormitoryId
    ) {

        return beds.filter(
            bed =>
                String(
                    bed.dormitory_id
                ) ===
                String(
                    dormitoryId
                )
        );

    }


    function getDormStudentCount(
        dormitoryId
    ) {

        return allocations.filter(
            allocation =>
                String(
                    allocation.dormitory_id
                ) ===
                String(
                    dormitoryId
                )
        ).length;

    }


    function getDormOccupiedBeds(
        dormitoryId
    ) {

        return getDormBeds(
            dormitoryId
        ).filter(
            bed =>
                bed.status ===
                "occupied"
        ).length;

    }


    function getDormAvailableBeds(
        dormitoryId
    ) {

        return getDormBeds(
            dormitoryId
        ).filter(
            bed =>
                bed.status ===
                "available"
        ).length;

    }


    function getPatronName(
        profileId
    ) {

        const person =
            patrons.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        profileId
                    )
            );

        return (
            person?.full_name ||
            "-"
        );

    }


    function getMatronName(
        profileId
    ) {

        const person =
            matrons.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        profileId
                    )
            );

        return (
            person?.full_name ||
            "-"
        );

    }


    function getStudentsInDorm(
        dormitoryId
    ) {

        return decoratedAllocations.filter(
            allocation =>
                String(
                    allocation.dormitory_id
                ) ===
                String(
                    dormitoryId
                )
        );

    }


    // =================================================
    // ROLE-AWARE DORMITORIES
    // =================================================

    const visibleDormitories =
        useMemo(
            () => {

                if (
                    isSuperAdmin ||
                    isHeadmaster ||
                    isDeputy
                ) {
                    return dormitories;
                }

                if (
                    isPatron &&
                    !isMatron
                ) {

                    return dormitories.filter(
                        dormitory =>
                            String(
                                dormitory.patron_profile_id
                            ) ===
                            String(
                                currentUser?.id
                            )
                    );

                }

                if (
                    isMatron &&
                    !isPatron
                ) {

                    return dormitories.filter(
                        dormitory =>
                            String(
                                dormitory.matron_profile_id
                            ) ===
                            String(
                                currentUser?.id
                            )
                    );

                }

                return dormitories;

            },
            [
                dormitories,
                isSuperAdmin,
                isHeadmaster,
                isDeputy,
                isPatron,
                isMatron,
                currentUser
            ]
        );


    const visibleDormitoryIds =
        useMemo(
            () =>
                new Set(
                    visibleDormitories.map(
                        dormitory =>
                            String(
                                dormitory.id
                            )
                    )
                ),
            [
                visibleDormitories
            ]
        );


    const visibleAllocations =
        useMemo(
            () => {

                if (
                    isSuperAdmin ||
                    isHeadmaster ||
                    isDeputy
                ) {
                    return decoratedAllocations;
                }

                return decoratedAllocations.filter(
                    allocation =>
                        visibleDormitoryIds.has(
                            String(
                                allocation.dormitory_id
                            )
                        )
                );

            },
            [
                decoratedAllocations,
                visibleDormitoryIds,
                isSuperAdmin,
                isHeadmaster,
                isDeputy
            ]
        );


    // =================================================
    // DORMITORY MODAL
    // =================================================

    function openAddDormitory() {

        setEditingDormitory(
            false
        );

        setDormitoryForm({
            ...emptyDormitoryForm,
            academic_year_id:
                activeAcademicYear?.id ||
                ""
        });

        setError("");
        setSuccess("");

        setShowDormitoryModal(
            true
        );

    }


    function openEditDormitory(
        dormitory
    ) {

        setEditingDormitory(
            true
        );

        setDormitoryForm({
            id:
                dormitory.id,
            name:
                dormitory.name ||
                "",
            gender:
                dormitory.gender ||
                "male",
            capacity:
                dormitory.capacity ??
                "",
            academic_year_id:
                dormitory.academic_year_id ||
                "",
            patron_profile_id:
                dormitory.patron_profile_id ||
                "",
            matron_profile_id:
                dormitory.matron_profile_id ||
                "",
            status:
                dormitory.status ||
                "active"
        });

        setError("");
        setSuccess("");

        setShowDormitoryModal(
            true
        );

    }


    async function saveDormitory(
        event
    ) {

        event.preventDefault();

        try {

            setSaving(true);
            setError("");
            setSuccess("");

            if (
                !schoolId
            ) {
                throw new Error(
                    "School was not found."
                );
            }

            const name =
                String(
                    dormitoryForm.name ||
                    ""
                ).trim();

            const capacity =
                Number(
                    dormitoryForm.capacity
                );

            if (!name) {
                throw new Error(
                    "Dormitory name is required."
                );
            }

            if (
                Number.isNaN(
                    capacity
                ) ||
                capacity < 0
            ) {
                throw new Error(
                    "Capacity must be zero or greater."
                );
            }


            const payload = {
                school_id:
                    schoolId,
                academic_year_id:
                    dormitoryForm.academic_year_id
                        ? Number(
                            dormitoryForm.academic_year_id
                        )
                        : null,
                name,
                gender:
                    dormitoryForm.gender,
                capacity,
                patron_profile_id:
                    dormitoryForm.patron_profile_id ||
                    null,
                matron_profile_id:
                    dormitoryForm.matron_profile_id ||
                    null,
                status:
                    dormitoryForm.status ||
                    "active"
            };


            if (
                editingDormitory
            ) {

                const {
                    error: updateError
                } =
                    await supabase
                        .from("dormitories")
                        .update(
                            payload
                        )
                        .eq(
                            "id",
                            dormitoryForm.id
                        )
                        .eq(
                            "school_id",
                            schoolId
                        );

                if (
                    updateError
                ) {
                    throw updateError;
                }

                setSuccess(
                    "Dormitory updated successfully."
                );

            } else {

                const {
                    data: createdDormitory,
                    error: insertError
                } =
                    await supabase
                        .from("dormitories")
                        .insert(
                            {
                                ...payload,
                                created_by:
                                    currentUser?.id ||
                                    null
                            }
                        )
                        .select(
                            "id, capacity"
                        )
                        .single();

                if (
                    insertError
                ) {
                    throw insertError;
                }


                // -------------------------------------
                // CREATE BEDS
                // -------------------------------------

                if (
                    createdDormitory &&
                    Number(
                        createdDormitory.capacity
                    ) > 0
                ) {

                    const newBeds =
                        Array.from(
                            {
                                length:
                                    Number(
                                        createdDormitory.capacity
                                    )
                            },
                            (
                                _,
                                index
                            ) => ({
                                dormitory_id:
                                    createdDormitory.id,
                                bed_number:
                                    `BED-${String(
                                        index + 1
                                    ).padStart(
                                        3,
                                        "0"
                                    )}`,
                                status:
                                    "available",
                                condition:
                                    "good"
                            })
                        );


                    if (
                        newBeds.length
                    ) {

                        const {
                            error: bedError
                        } =
                            await supabase
                                .from(
                                    "dormitory_beds"
                                )
                                .insert(
                                    newBeds
                                );

                        if (
                            bedError
                        ) {
                            console.error(
                                "BED CREATION ERROR:",
                                bedError
                            );
                        }

                    }

                }

                setSuccess(
                    "Dormitory created successfully."
                );

            }


            setShowDormitoryModal(
                false
            );

            await refreshDataOnly();

        } catch (
            saveError
        ) {

            console.error(
                "SAVE DORMITORY ERROR:",
                saveError
            );

            setError(
                saveError?.message ||
                "Failed to save dormitory."
            );

        } finally {

            setSaving(false);

        }

    }


    async function deleteDormitory(
        dormitory
    ) {

        if (
            getDormStudentCount(
                dormitory.id
            ) > 0
        ) {

            setError(
                "This dormitory cannot be deleted while students are allocated to it."
            );

            return;

        }


        const confirmed =
            window.confirm(
                `Delete ${dormitory.name}?`
            );

        if (!confirmed) {
            return;
        }


        try {

            setSaving(true);
            setError("");
            setSuccess("");


            const {
                error: deleteError
            } =
                await supabase
                    .from("dormitories")
                    .delete()
                    .eq(
                        "id",
                        dormitory.id
                    )
                    .eq(
                        "school_id",
                        schoolId
                    );

            if (
                deleteError
            ) {
                throw deleteError;
            }

            setSuccess(
                "Dormitory deleted successfully."
            );

            await refreshDataOnly();

        } catch (
            deleteError
        ) {

            console.error(
                deleteError
            );

            setError(
                deleteError?.message ||
                "Failed to delete dormitory."
            );

        } finally {

            setSaving(false);

        }

    }


    // =================================================
    // VIEW DORMITORY
    // =================================================

    function openDormitoryView(
        dormitory
    ) {

        setSelectedDormitory(
            dormitory
        );

        setShowViewModal(
            true
        );

    }


    // =================================================
    // STUDENT VIEW
    // =================================================

    function openStudentView(
        student
    ) {

        setSelectedStudent(
            student
        );

        setShowStudentModal(
            true
        );

    }


    // =================================================
    // ALLOCATION
    // =================================================

    function openAddStudent(
        dormitory = null
    ) {

        setEditingAllocation(
            false
        );

        setAllocationForm({
            ...emptyAllocationForm,
            dormitory_id:
                dormitory?.id ||
                "",
            academic_year_id:
                dormitory?.academic_year_id ||
                activeAcademicYear?.id ||
                ""
        });

        setError("");
        setSuccess("");

        setShowAllocationModal(
            true
        );

    }


    function openEditAllocation(
        allocation
    ) {

        setEditingAllocation(
            true
        );

        setAllocationForm({
            allocation_id:
                allocation.id,
            student_id:
                allocation.student_id,
            student_name:
                allocation.student_name,
            admission_number:
                allocation.admission_number,
            dormitory_id:
                allocation.dormitory_id,
            academic_year_id:
                allocation.academic_year_id,
            bed_id:
                allocation.bed_id ||
                ""
        });

        setError("");
        setSuccess("");

        setShowAllocationModal(
            true
        );

    }


    const availableBedsForForm =
        useMemo(
            () => {

                const dormId =
                    allocationForm.dormitory_id;

                if (!dormId) {
                    return [];
                }

                return beds.filter(
                    bed => {

                        if (
                            String(
                                bed.dormitory_id
                            ) !==
                            String(
                                dormId
                            )
                        ) {
                            return false;
                        }

                        if (
                            String(
                                bed.id
                            ) ===
                            String(
                                allocationForm.bed_id
                            )
                        ) {
                            return true;
                        }

                        return (
                            bed.status ===
                            "available"
                        );

                    }
                );

            },
            [
                beds,
                allocationForm.dormitory_id,
                allocationForm.bed_id
            ]
        );


    async function saveAllocation(
        event
    ) {

        event.preventDefault();

        try {

            setSaving(true);
            setError("");
            setSuccess("");


            if (
                !schoolId
            ) {
                throw new Error(
                    "School was not found."
                );
            }

            if (
                !allocationForm.student_id
            ) {
                throw new Error(
                    "Please select a student."
                );
            }

            if (
                !allocationForm.dormitory_id
            ) {
                throw new Error(
                    "Please select a dormitory."
                );
            }

            if (
                !allocationForm.academic_year_id
            ) {
                throw new Error(
                    "Please select an academic year."
                );
            }

            if (
                !allocationForm.bed_id
            ) {
                throw new Error(
                    "Please select a bed."
                );
            }


            const selectedBed =
                beds.find(
                    bed =>
                        String(
                            bed.id
                        ) ===
                        String(
                            allocationForm.bed_id
                        )
                );


            if (
                !selectedBed
            ) {
                throw new Error(
                    "Selected bed was not found."
                );
            }


            const currentAllocation =
                editingAllocation
                    ? allocations.find(
                        allocation =>
                            String(
                                allocation.id
                            ) ===
                            String(
                                allocationForm.allocation_id
                            )
                    )
                    : null;


            const currentBedId =
                currentAllocation?.bed_id ||
                null;


            if (
                selectedBed.status ===
                "occupied" &&
                String(
                    selectedBed.id
                ) !==
                String(
                    currentBedId
                )
            ) {

                throw new Error(
                    "The selected bed is already occupied."
                );

            }


            // -----------------------------------------
            // DUPLICATE STUDENT / ACADEMIC YEAR
            // -----------------------------------------

            const duplicate =
                allocations.find(
                    allocation =>
                        String(
                            allocation.student_id
                        ) ===
                        String(
                            allocationForm.student_id
                        ) &&
                        String(
                            allocation.academic_year_id
                        ) ===
                        String(
                            allocationForm.academic_year_id
                        ) &&
                        (
                            !editingAllocation ||
                            String(
                                allocation.id
                            ) !==
                            String(
                                allocationForm.allocation_id
                            )
                        )
                );


            if (
                duplicate
            ) {
                throw new Error(
                    "This student is already allocated to a dormitory for the selected academic year."
                );
            }


            const payload = {
                dormitory_id:
                    Number(
                        allocationForm.dormitory_id
                    ),
                student_id:
                    Number(
                        allocationForm.student_id
                    ),
                school_id:
                    schoolId,
                academic_year_id:
                    Number(
                        allocationForm.academic_year_id
                    ),
                bed_id:
                    Number(
                        allocationForm.bed_id
                    )
            };


            if (
                editingAllocation
            ) {

                const {
                    error: updateError
                } =
                    await supabase
                        .from(
                            "dormitory_students"
                        )
                        .update(
                            {
                                dormitory_id:
                                    payload.dormitory_id,
                                academic_year_id:
                                    payload.academic_year_id,
                                bed_id:
                                    payload.bed_id
                            }
                        )
                        .eq(
                            "id",
                            allocationForm.allocation_id
                        )
                        .eq(
                            "school_id",
                            schoolId
                        );

                if (
                    updateError
                ) {
                    throw updateError;
                }


                // Old bed -> available
                if (
                    currentBedId &&
                    String(
                        currentBedId
                    ) !==
                    String(
                        payload.bed_id
                    )
                ) {

                    await supabase
                        .from(
                            "dormitory_beds"
                        )
                        .update({
                            status:
                                "available"
                        })
                        .eq(
                            "id",
                            currentBedId
                        );

                }


                // New bed -> occupied
                await supabase
                    .from(
                        "dormitory_beds"
                    )
                    .update({
                        status:
                            "occupied"
                    })
                    .eq(
                        "id",
                        payload.bed_id
                    );


                setSuccess(
                    "Student boarding allocation updated successfully."
                );

            } else {

                const {
                    error: insertError
                } =
                    await supabase
                        .from(
                            "dormitory_students"
                        )
                        .insert(
                            {
                                ...payload,
                                assigned_at:
                                    new Date().toISOString(),
                                assigned_by:
                                    currentUser?.id ||
                                    null
                            }
                        );

                if (
                    insertError
                ) {
                    throw insertError;
                }


                await supabase
                    .from(
                        "dormitory_beds"
                    )
                    .update({
                        status:
                            "occupied"
                    })
                    .eq(
                        "id",
                        payload.bed_id
                    );


                setSuccess(
                    "Student assigned to dormitory successfully."
                );

            }


            setShowAllocationModal(
                false
            );

            await refreshDataOnly();

        } catch (
            allocationError
        ) {

            console.error(
                "SAVE ALLOCATION ERROR:",
                allocationError
            );

            setError(
                allocationError?.message ||
                "Failed to save student allocation."
            );

        } finally {

            setSaving(false);

        }

    }


    async function removeAllocation(
        allocation
    ) {

        const confirmed =
            window.confirm(
                `Remove ${allocation.student_name} from ${allocation.dormitory?.name || "the dormitory"}?`
            );

        if (!confirmed) {
            return;
        }


        try {

            setSaving(true);
            setError("");
            setSuccess("");


            const {
                error: deleteError
            } =
                await supabase
                    .from(
                        "dormitory_students"
                    )
                    .delete()
                    .eq(
                        "id",
                        allocation.id
                    )
                    .eq(
                        "school_id",
                        schoolId
                    );

            if (
                deleteError
            ) {
                throw deleteError;
            }


            if (
                allocation.bed_id
            ) {

                await supabase
                    .from(
                        "dormitory_beds"
                    )
                    .update({
                        status:
                            "available"
                    })
                    .eq(
                        "id",
                        allocation.bed_id
                    );

            }


            setSuccess(
                "Student removed from dormitory successfully."
            );

            await refreshDataOnly();

        } catch (
            removeError
        ) {

            console.error(
                removeError
            );

            setError(
                removeError?.message ||
                "Failed to remove student allocation."
            );

        } finally {

            setSaving(false);

        }

    }


    // =================================================
    // DAILY ATTENDANCE
    // =================================================

    async function loadDailyAttendance() {

        if (
            !schoolId ||
            !attendanceDormitoryId ||
            !attendanceDate ||
            !attendanceSession
        ) {

            setAttendanceDraft({});
            return;

        }


        try {

            const {
                data,
                error: attendanceError
            } =
                await supabase
                    .from(
                        "dormitory_student_attendance"
                    )
                    .select(
                        "id, school_id, dormitory_id, student_id, academic_year_id, attendance_date, session, status, notes, recorded_by, created_at"
                    )
                    .eq(
                        "school_id",
                        schoolId
                    )
                    .eq(
                        "dormitory_id",
                        Number(
                            attendanceDormitoryId
                        )
                    )
                    .eq(
                        "attendance_date",
                        attendanceDate
                    )
                    .eq(
                        "session",
                        attendanceSession
                    );

            if (
                attendanceError
            ) {
                throw attendanceError;
            }


            const draft = {};


            (data || []).forEach(
                row => {

                    draft[
                        String(
                            row.student_id
                        )
                    ] = {
                        status:
                            row.status ||
                            "present",
                        notes:
                            row.notes ||
                            ""
                    };

                }
            );


            const dormStudents =
                getAttendanceStudents();


            dormStudents.forEach(
                allocation => {

                    const key =
                        String(
                            allocation.student_id
                        );

                    if (
                        !draft[key]
                    ) {

                        draft[key] = {
                            status:
                                "present",
                            notes:
                                ""
                        };

                    }

                }
            );


            setAttendanceDraft(
                draft
            );

        } catch (
            attendanceError
        ) {

            console.error(
                "DAILY ATTENDANCE ERROR:",
                attendanceError
            );

            setError(
                attendanceError?.message ||
                "Failed to load daily attendance."
            );

        }

    }


    useEffect(
        () => {

            if (
                activeSection ===
                "attendance"
            ) {
                loadDailyAttendance();
            }

        },
        [
            activeSection,
            attendanceDormitoryId,
            attendanceDate,
            attendanceSession,
            allocations,
            attendance
        ]
    );


    function getAttendanceStudents() {

        if (
            !attendanceDormitoryId
        ) {
            return [];
        }

        return visibleAllocations.filter(
            allocation =>
                String(
                    allocation.dormitory_id
                ) ===
                String(
                    attendanceDormitoryId
                )
        );

    }


    function changeAttendanceStatus(
        studentId,
        status
    ) {

        const key =
            String(
                studentId
            );

        setAttendanceDraft(
            previous => ({
                ...previous,
                [key]: {
                    ...(previous[key] || {}),
                    status
                }
            })
        );

    }


    function changeAttendanceNotes(
        studentId,
        notes
    ) {

        const key =
            String(
                studentId
            );

        setAttendanceDraft(
            previous => ({
                ...previous,
                [key]: {
                    ...(previous[key] || {}),
                    notes
                }
            })
        );

    }


    async function saveRollCall() {

        const rows =
            getAttendanceStudents();

        if (
            rows.length ===
            0
        ) {

            setError(
                "There are no students allocated to this dormitory."
            );

            return;

        }


        try {

            setSaving(true);
            setError("");
            setSuccess("");


            for (
                const allocation
                of rows
            ) {

                const key =
                    String(
                        allocation.student_id
                    );

                const draft =
                    attendanceDraft[key] ||
                    {
                        status:
                            "present",
                        notes:
                            ""
                    };


                const existing =
                    attendance.find(
                        row =>
                            String(
                                row.student_id
                            ) ===
                            String(
                                allocation.student_id
                            ) &&
                            String(
                                row.dormitory_id
                            ) ===
                            String(
                                allocation.dormitory_id
                            ) &&
                            String(
                                row.attendance_date
                            ).slice(0, 10) ===
                            String(
                                attendanceDate
                            ) &&
                            row.session ===
                            attendanceSession
                    );


                const payload = {
                    school_id:
                        schoolId,
                    dormitory_id:
                        Number(
                            allocation.dormitory_id
                        ),
                    student_id:
                        Number(
                            allocation.student_id
                        ),
                    academic_year_id:
                        Number(
                            allocation.academic_year_id
                        ),
                    attendance_date:
                        attendanceDate,
                    session:
                        attendanceSession,
                    status:
                        draft.status ||
                        "present",
                    notes:
                        draft.notes ||
                        "",
                    recorded_by:
                        currentUser?.id ||
                        null
                };


                if (
                    existing
                ) {

                    const {
                        error: updateError
                    } =
                        await supabase
                            .from(
                                "dormitory_student_attendance"
                            )
                            .update(
                                payload
                            )
                            .eq(
                                "id",
                                existing.id
                            );

                    if (
                        updateError
                    ) {
                        throw updateError;
                    }

                } else {

                    const {
                        error: insertError
                    } =
                        await supabase
                            .from(
                                "dormitory_student_attendance"
                            )
                            .insert(
                                payload
                            );

                    if (
                        insertError
                    ) {
                        throw insertError;
                    }

                }

            }


            setSuccess(
                `Roll Call for ${formatDate(attendanceDate)} (${attendanceSession}) saved successfully.`
            );

            await loadAttendance(
                schoolId
            );

            await loadDailyAttendance();

        } catch (
            attendanceSaveError
        ) {

            console.error(
                "SAVE ROLL CALL ERROR:",
                attendanceSaveError
            );

            setError(
                attendanceSaveError?.message ||
                "Failed to save roll call."
            );

        } finally {

            setSaving(false);

        }

    }


    const rollCallSummary =
        useMemo(
            () => {

                const rows =
                    getAttendanceStudents();

                const summary = {
                    total:
                        rows.length,
                    present:
                        0,
                    absent:
                        0,
                    late:
                        0,
                    excused:
                        0
                };


                rows.forEach(
                    allocation => {

                        const draft =
                            attendanceDraft[
                                String(
                                    allocation.student_id
                                )
                            ];

                        const status =
                            draft?.status ||
                            "present";

                        if (
                            Object.prototype.hasOwnProperty.call(
                                summary,
                                status
                            )
                        ) {
                            summary[
                                status
                            ] += 1;
                        }

                    }
                );


                return summary;

            },
            [
                attendanceDraft,
                allocations,
                attendanceDormitoryId,
                visibleAllocations
            ]
        );


    // =================================================
    // WEEKLY ATTENDANCE
    // =================================================

    const weekDates =
        useMemo(
            () =>
                Array.from(
                    {
                        length: 7
                    },
                    (
                        _,
                        index
                    ) =>
                        addDays(
                            weeklyStart,
                            index
                        )
                ),
            [
                weeklyStart
            ]
        );


    function getWeeklyStudentAttendance(
        studentId,
        date,
        session = "morning"
    ) {

        return attendance.find(
            row =>
                String(
                    row.student_id
                ) ===
                String(
                    studentId
                ) &&
                String(
                    row.attendance_date
                ).slice(0, 10) ===
                String(
                    date
                ) &&
                row.session ===
                session
        );

    }


    function getWeeklyTotals(
        studentId
    ) {

        const totals = {
            present:
                0,
            absent:
                0,
            late:
                0,
            excused:
                0
        };


        weekDates.forEach(
            date => {

                const row =
                    getWeeklyStudentAttendance(
                        studentId,
                        date,
                        "morning"
                    );

                if (
                    row?.status &&
                    Object.prototype.hasOwnProperty.call(
                        totals,
                        row.status
                    )
                ) {
                    totals[
                        row.status
                    ] += 1;
                }

            }
        );


        return totals;

    }


    function getWeeklyDraftStatus(
        studentId,
        date
    ) {

        const key =
            `${studentId}_${date}`;

        return (
            weeklyDraft[key] ||
            getWeeklyStudentAttendance(
                studentId,
                date,
                "morning"
            )?.status ||
            ""
        );

    }


    function changeWeeklyStatus(
        studentId,
        date,
        status
    ) {

        const key =
            `${studentId}_${date}`;

        setWeeklyDraft(
            previous => ({
                ...previous,
                [key]:
                    status
            })
        );

    }


    async function saveWeeklyAttendance() {

        const rows =
            getAttendanceStudents();

        if (
            rows.length ===
            0
        ) {

            setError(
                "Select a dormitory with allocated students first."
            );

            return;

        }


        try {

            setSaving(true);
            setError("");
            setSuccess("");


            for (
                const allocation
                of rows
            ) {

                for (
                    const date
                    of weekDates
                ) {

                    const status =
                        getWeeklyDraftStatus(
                            allocation.student_id,
                            date
                        ) ||
                        "present";


                    const existing =
                        attendance.find(
                            row =>
                                String(
                                    row.student_id
                                ) ===
                                String(
                                    allocation.student_id
                                ) &&
                                String(
                                    row.attendance_date
                                ).slice(0, 10) ===
                                String(
                                    date
                                ) &&
                                row.session ===
                                "morning"
                        );


                    const payload = {
                        school_id:
                            schoolId,
                        dormitory_id:
                            Number(
                                allocation.dormitory_id
                            ),
                        student_id:
                            Number(
                                allocation.student_id
                            ),
                        academic_year_id:
                            Number(
                                allocation.academic_year_id
                            ),
                        attendance_date:
                            date,
                        session:
                            "morning",
                        status,
                        notes:
                            "",
                        recorded_by:
                            currentUser?.id ||
                            null
                    };


                    if (
                        existing
                    ) {

                        const {
                            error: updateError
                        } =
                            await supabase
                                .from(
                                    "dormitory_student_attendance"
                                )
                                .update(
                                    payload
                                )
                                .eq(
                                    "id",
                                    existing.id
                                );

                        if (
                            updateError
                        ) {
                            throw updateError;
                        }

                    } else {

                        const {
                            error: insertError
                        } =
                            await supabase
                                .from(
                                    "dormitory_student_attendance"
                                )
                                .insert(
                                    payload
                                );

                        if (
                            insertError
                        ) {
                            throw insertError;
                        }

                    }

                }

            }


            setSuccess(
                "Monday to Sunday attendance records saved successfully."
            );

            setWeeklyDraft({});

            await loadAttendance(
                schoolId
            );

        } catch (
            weeklyError
        ) {

            console.error(
                "SAVE WEEK ERROR:",
                weeklyError
            );

            setError(
                weeklyError?.message ||
                "Failed to save weekly attendance."
            );

        } finally {

            setSaving(false);

        }

    }


    // =================================================
    // INCIDENTS
    // =================================================

    function openAddIncident(
        dormitoryId = ""
    ) {

        setEditingIncident(
            false
        );

        setIncidentForm({
            ...emptyIncidentForm,
            dormitory_id:
                dormitoryId,
            academic_year_id:
                activeAcademicYear?.id ||
                "",
            incident_date:
                getToday()
        });

        setError("");
        setSuccess("");

        setShowIncidentModal(
            true
        );

    }


    function openEditIncident(
        incident
    ) {

        setEditingIncident(
            true
        );

        setIncidentForm({
            id:
                incident.id,
            dormitory_id:
                incident.dormitory_id ||
                "",
            student_id:
                incident.student_id ||
                "",
            academic_year_id:
                incident.academic_year_id ||
                "",
            incident_date:
                String(
                    incident.incident_date ||
                    ""
                ).slice(0, 10),
            incident_type:
                incident.incident_type ||
                "Other",
            severity:
                incident.severity ||
                "low",
            title:
                incident.title ||
                "",
            description:
                incident.description ||
                "",
            action_taken:
                incident.action_taken ||
                "",
            status:
                incident.status ||
                "open"
        });

        setError("");
        setSuccess("");

        setShowIncidentModal(
            true
        );

    }


    async function saveIncident(
        event
    ) {

        event.preventDefault();

        try {

            setSaving(true);
            setError("");
            setSuccess("");


            if (
                !schoolId
            ) {
                throw new Error(
                    "School was not found."
                );
            }

            if (
                !incidentForm.dormitory_id
            ) {
                throw new Error(
                    "Please select a dormitory."
                );
            }

            if (
                !incidentForm.academic_year_id
            ) {
                throw new Error(
                    "Please select an academic year."
                );
            }

            if (
                !incidentForm.incident_date
            ) {
                throw new Error(
                    "Incident date is required."
                );
            }

            if (
                !String(
                    incidentForm.title ||
                    ""
                ).trim()
            ) {
                throw new Error(
                    "Incident title is required."
                );
            }


            const payload = {
                school_id:
                    schoolId,
                dormitory_id:
                    Number(
                        incidentForm.dormitory_id
                    ),
                student_id:
                    incidentForm.student_id
                        ? Number(
                            incidentForm.student_id
                        )
                        : null,
                academic_year_id:
                    Number(
                        incidentForm.academic_year_id
                    ),
                incident_date:
                    incidentForm.incident_date,
                incident_type:
                    incidentForm.incident_type,
                severity:
                    incidentForm.severity,
                title:
                    String(
                        incidentForm.title
                    ).trim(),
                description:
                    incidentForm.description ||
                    null,
                action_taken:
                    incidentForm.action_taken ||
                    null,
                status:
                    incidentForm.status ||
                    "open"
            };


            if (
                editingIncident
            ) {

                if (
                    payload.status ===
                    "resolved"
                ) {

                    payload.resolved_by =
                        currentUser?.id ||
                        null;

                    payload.resolved_at =
                        new Date().toISOString();

                } else {

                    payload.resolved_by =
                        null;

                    payload.resolved_at =
                        null;

                }


                const {
                    error: updateError
                } =
                    await supabase
                        .from(
                            "dormitory_incidents"
                        )
                        .update(
                            payload
                        )
                        .eq(
                            "id",
                            incidentForm.id
                        )
                        .eq(
                            "school_id",
                            schoolId
                        );

                if (
                    updateError
                ) {
                    throw updateError;
                }

                setSuccess(
                    "Dormitory incident updated successfully."
                );

            } else {

                const {
                    error: insertError
                } =
                    await supabase
                        .from(
                            "dormitory_incidents"
                        )
                        .insert(
                            {
                                ...payload,
                                reported_by:
                                    currentUser?.id ||
                                    null
                            }
                        );

                if (
                    insertError
                ) {
                    throw insertError;
                }

                setSuccess(
                    "Dormitory incident recorded successfully."
                );

            }


            setShowIncidentModal(
                false
            );

            await loadIncidents(
                schoolId
            );

        } catch (
            incidentError
        ) {

            console.error(
                "SAVE INCIDENT ERROR:",
                incidentError
            );

            setError(
                incidentError?.message ||
                "Failed to save incident."
            );

        } finally {

            setSaving(false);

        }

    }


    async function deleteIncident(
        incident
    ) {

        const confirmed =
            window.confirm(
                `Delete incident "${incident.title}"?`
            );

        if (!confirmed) {
            return;
        }


        try {

            setSaving(true);
            setError("");
            setSuccess("");


            const {
                error: deleteError
            } =
                await supabase
                    .from(
                        "dormitory_incidents"
                    )
                    .delete()
                    .eq(
                        "id",
                        incident.id
                    )
                    .eq(
                        "school_id",
                        schoolId
                    );

            if (
                deleteError
            ) {
                throw deleteError;
            }


            setSuccess(
                "Incident deleted successfully."
            );

            await loadIncidents(
                schoolId
            );

        } catch (
            incidentDeleteError
        ) {

            console.error(
                incidentDeleteError
            );

            setError(
                incidentDeleteError?.message ||
                "Failed to delete incident."
            );

        } finally {

            setSaving(false);

        }

    }


    function getIncidentStudent(
        studentId
    ) {

        if (!studentId) {
            return null;
        }

        return students.find(
            student =>
                String(
                    student.id
                ) ===
                String(
                    studentId
                )
        ) || null;

    }


    function getIncidentDormitory(
        dormitoryId
    ) {

        return dormitories.find(
            dormitory =>
                String(
                    dormitory.id
                ) ===
                String(
                    dormitoryId
                )
        ) || null;

    }


    // =================================================
    // OUTPASS
    // =================================================

    function openAddOutpass(
        dormitoryId = ""
    ) {

        setEditingOutpass(
            false
        );

        setOutpassForm({
            ...emptyOutpassForm,
            dormitory_id:
                dormitoryId,
            academic_year_id:
                activeAcademicYear?.id ||
                "",
            request_date:
                getToday(),
            status:
                "pending"
        });

        setError("");
        setSuccess("");

        setShowOutpassModal(
            true
        );

    }


    function openEditOutpass(
        outpass
    ) {

        setEditingOutpass(
            true
        );

        setOutpassForm({
            id:
                outpass.id,
            dormitory_id:
                outpass.dormitory_id ||
                "",
            student_id:
                outpass.student_id ||
                "",
            academic_year_id:
                outpass.academic_year_id ||
                "",
            request_date:
                String(
                    outpass.request_date ||
                    ""
                ).slice(0, 10),
            leave_from:
                String(
                    outpass.leave_from ||
                    ""
                ).slice(0, 16),
            expected_return:
                String(
                    outpass.expected_return ||
                    ""
                ).slice(0, 16),
            destination:
                outpass.destination ||
                "",
            reason:
                outpass.reason ||
                "",
            guardian_name:
                outpass.guardian_name ||
                "",
            guardian_phone:
                outpass.guardian_phone ||
                "",
            status:
                outpass.status ||
                "pending",
            notes:
                outpass.notes ||
                ""
        });

        setError("");
        setSuccess("");

        setShowOutpassModal(
            true
        );

    }


    async function saveOutpass(
        event
    ) {

        event.preventDefault();

        try {

            setSaving(true);
            setError("");
            setSuccess("");


            if (
                !schoolId
            ) {
                throw new Error(
                    "School was not found."
                );
            }

            if (
                !outpassForm.dormitory_id
            ) {
                throw new Error(
                    "Please select a dormitory."
                );
            }

            if (
                !outpassForm.student_id
            ) {
                throw new Error(
                    "Please select a student."
                );
            }

            if (
                !outpassForm.academic_year_id
            ) {
                throw new Error(
                    "Please select an academic year."
                );
            }

            if (
                !outpassForm.request_date
            ) {
                throw new Error(
                    "Request date is required."
                );
            }

            if (
                !outpassForm.leave_from
            ) {
                throw new Error(
                    "Leave time is required."
                );
            }

            if (
                !outpassForm.expected_return
            ) {
                throw new Error(
                    "Expected return time is required."
                );
            }

            if (
                !String(
                    outpassForm.destination ||
                    ""
                ).trim()
            ) {
                throw new Error(
                    "Destination is required."
                );
            }

            if (
                !String(
                    outpassForm.reason ||
                    ""
                ).trim()
            ) {
                throw new Error(
                    "Reason is required."
                );
            }


            const payload = {
                school_id:
                    schoolId,
                dormitory_id:
                    Number(
                        outpassForm.dormitory_id
                    ),
                student_id:
                    Number(
                        outpassForm.student_id
                    ),
                academic_year_id:
                    Number(
                        outpassForm.academic_year_id
                    ),
                request_date:
                    outpassForm.request_date,
                leave_from:
                    new Date(
                        outpassForm.leave_from
                    ).toISOString(),
                expected_return:
                    new Date(
                        outpassForm.expected_return
                    ).toISOString(),
                destination:
                    String(
                        outpassForm.destination
                    ).trim(),
                reason:
                    String(
                        outpassForm.reason
                    ).trim(),
                guardian_name:
                    outpassForm.guardian_name ||
                    null,
                guardian_phone:
                    outpassForm.guardian_phone ||
                    null,
                status:
                    outpassForm.status ||
                    "pending",
                notes:
                    outpassForm.notes ||
                    null
            };


            if (
                editingOutpass
            ) {

                const {
                    error: updateError
                } =
                    await supabase
                        .from(
                            "dormitory_outpasses"
                        )
                        .update(
                            payload
                        )
                        .eq(
                            "id",
                            outpassForm.id
                        )
                        .eq(
                            "school_id",
                            schoolId
                        );

                if (
                    updateError
                ) {
                    throw updateError;
                }

                setSuccess(
                    "Out-pass updated successfully."
                );

            } else {

                const {
                    error: insertError
                } =
                    await supabase
                        .from(
                            "dormitory_outpasses"
                        )
                        .insert(
                            payload
                        );

                if (
                    insertError
                ) {
                    throw insertError;
                }

                setSuccess(
                    "Out-pass request recorded successfully."
                );

            }


            setShowOutpassModal(
                false
            );

            await loadOutpasses(
                schoolId
            );

        } catch (
            outpassError
        ) {

            console.error(
                "SAVE OUTPASS ERROR:",
                outpassError
            );

            setError(
                outpassError?.message ||
                "Failed to save out-pass."
            );

        } finally {

            setSaving(false);

        }

    }


    async function updateOutpassStatus(
        outpass,
        status
    ) {

        try {

            setSaving(true);
            setError("");
            setSuccess("");


            const payload = {
                status
            };


            if (
                status ===
                "approved"
            ) {

                payload.approved_by =
                    currentUser?.id ||
                    null;

                payload.approved_at =
                    new Date().toISOString();

            }


            if (
                status ===
                "returned"
            ) {

                payload.return_recorded_at =
                    new Date().toISOString();

            }


            const {
                error: updateError
            } =
                await supabase
                    .from(
                        "dormitory_outpasses"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        outpass.id
                    )
                    .eq(
                        "school_id",
                        schoolId
                    );

            if (
                updateError
            ) {
                throw updateError;
            }


            setSuccess(
                `Out-pass marked as ${status}.`
            );

            await loadOutpasses(
                schoolId
            );

        } catch (
            statusError
        ) {

            console.error(
                statusError
            );

            setError(
                statusError?.message ||
                "Failed to update out-pass status."
            );

        } finally {

            setSaving(false);

        }

    }


    async function deleteOutpass(
        outpass
    ) {

        const confirmed =
            window.confirm(
                "Delete this out-pass?"
            );

        if (!confirmed) {
            return;
        }


        try {

            setSaving(true);
            setError("");
            setSuccess("");


            const {
                error: deleteError
            } =
                await supabase
                    .from(
                        "dormitory_outpasses"
                    )
                    .delete()
                    .eq(
                        "id",
                        outpass.id
                    )
                    .eq(
                        "school_id",
                        schoolId
                    );

            if (
                deleteError
            ) {
                throw deleteError;
            }


            setSuccess(
                "Out-pass deleted successfully."
            );

            await loadOutpasses(
                schoolId
            );

        } catch (
            deleteError
        ) {

            console.error(
                deleteError
            );

            setError(
                deleteError?.message ||
                "Failed to delete out-pass."
            );

        } finally {

            setSaving(false);

        }

    }


    function getOutpassStudent(
        studentId
    ) {

        return students.find(
            student =>
                String(
                    student.id
                ) ===
                String(
                    studentId
                )
        ) || null;

    }


    function getOutpassDormitory(
        dormitoryId
    ) {

        return dormitories.find(
            dormitory =>
                String(
                    dormitory.id
                ) ===
                String(
                    dormitoryId
                )
        ) || null;

    }


    const visibleOutpasses =
        useMemo(
            () => {

                if (
                    isSuperAdmin ||
                    isHeadmaster ||
                    isDeputy
                ) {
                    return outpasses;
                }

                return outpasses.filter(
                    outpass =>
                        visibleDormitoryIds.has(
                            String(
                                outpass.dormitory_id
                            )
                        )
                );

            },
            [
                outpasses,
                visibleDormitoryIds,
                isSuperAdmin,
                isHeadmaster,
                isDeputy
            ]
        );


    // =================================================
    // LOADING
    // =================================================

    if (
        loading
    ) {

        return (

            <div className="min-h-[70vh] flex items-center justify-center">

                <div className="text-center">

                    <FaSpinner
                        className="animate-spin text-4xl text-blue-600 mx-auto"
                    />

                    <p className="mt-4 font-black text-slate-600">

                        Loading Boarding Management...

                    </p>

                </div>

            </div>

        );

    }


    // =================================================
    // UI
    // =================================================

    return (

        <div className="space-y-6 pb-10">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">

                <div>

                    <h1 className="text-3xl font-black text-slate-800">

                        Patron & Matron Management

                    </h1>

                    <p className="text-slate-500 mt-1">

                        Boarding, dormitory, students, beds,
                        roll call and welfare management

                    </p>

                    {(
                        isPatron ||
                        isMatron
                    ) && !(
                        isHeadmaster ||
                        isDeputy ||
                        isSuperAdmin
                    ) && (

                        <div className="mt-2 inline-flex px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">

                            My Assigned Dormitories

                        </div>

                    )}

                </div>


                <div className="flex flex-wrap gap-2">

                    <button
                        type="button"
                        onClick={
                            refreshAll
                        }
                        disabled={
                            loading ||
                            saving
                        }
                        className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50"
                    >

                        <FaSyncAlt />

                        Refresh

                    </button>


                    {(
                        isSuperAdmin ||
                        isHeadmaster ||
                        isDeputy ||
                        isPatron ||
                        isMatron
                    ) && (

                        <button
                            type="button"
                            onClick={
                                openAddDormitory
                            }
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2"
                        >

                            <FaPlus />

                            Add Dormitory

                        </button>

                    )}

                </div>

            </div>


            {/* =================================================
                ALERTS
            ================================================= */}

            {error && (

                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-bold">

                    {error}

                </div>

            )}


            {success && (

                <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 font-bold">

                    {success}

                </div>

            )}


            {/* =================================================
                STATS
            ================================================= */}

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">

                <StatCard
                    icon={
                        <FaBuilding />
                    }
                    title="Dormitories"
                    value={
                        visibleDormitories.length
                    }
                />

                <StatCard
                    icon={
                        <FaUsers />
                    }
                    title="Boarding Students"
                    value={
                        visibleAllocations.length
                    }
                />

                <StatCard
                    icon={
                        <FaBed />
                    }
                    title="Total Beds"
                    value={
                        totalBeds
                    }
                />

                <StatCard
                    icon={
                        <FaCheckCircle />
                    }
                    title="Available"
                    value={
                        availableBeds
                    }
                />

                <StatCard
                    icon={
                        <FaBed />
                    }
                    title="Occupied"
                    value={
                        occupiedBeds
                    }
                />

                <StatCard
                    icon={
                        <FaUsers />
                    }
                    title="Capacity"
                    value={
                        totalCapacity
                    }
                />

            </div>


            {/* =================================================
                NAVIGATION
            ================================================= */}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">

                <div className="flex flex-wrap gap-2">

                    <SectionButton
                        active={
                            activeSection ===
                            "dormitories"
                        }
                        onClick={() =>
                            setActiveSection(
                                "dormitories"
                            )
                        }
                        icon={
                            <FaBuilding />
                        }
                        label="Dormitories"
                    />

                    <SectionButton
                        active={
                            activeSection ===
                            "students"
                        }
                        onClick={() =>
                            setActiveSection(
                                "students"
                            )
                        }
                        icon={
                            <FaUsers />
                        }
                        label="Students"
                    />

                    <SectionButton
                        active={
                            activeSection ===
                            "attendance"
                        }
                        onClick={() =>
                            setActiveSection(
                                "attendance"
                            )
                        }
                        icon={
                            <FaClipboardCheck />
                        }
                        label="Roll Call"
                    />

                    <SectionButton
                        active={
                            activeSection ===
                            "incidents"
                        }
                        onClick={() =>
                            setActiveSection(
                                "incidents"
                            )
                        }
                        icon={
                            <FaExclamationTriangle />
                        }
                        label="Dormitory Incidents"
                    />

                    <SectionButton
                        active={
                            activeSection ===
                            "patrons"
                        }
                        onClick={() =>
                            setActiveSection(
                                "patrons"
                            )
                        }
                        icon={
                            <FaUserTie />
                        }
                        label="Patrons"
                    />

                    <SectionButton
                        active={
                            activeSection ===
                            "matrons"
                        }
                        onClick={() =>
                            setActiveSection(
                                "matrons"
                            )
                        }
                        icon={
                            <FaFemale />
                        }
                        label="Matrons"
                    />

                    <SectionButton
                        active={
                            activeSection ===
                            "outpass"
                        }
                        onClick={() =>
                            setActiveSection(
                                "outpass"
                            )
                        }
                        icon={
                            <FaSignOutAlt />
                        }
                        label="Leave & Out Pass"
                    />

                </div>

            </div>


            {/* =================================================
                SEARCH
            ================================================= */}

            {(
                activeSection ===
                "students" ||
                activeSection ===
                "dormitories" ||
                activeSection ===
                "incidents" ||
                activeSection ===
                "outpass"
            ) && (

                <div className="relative">

                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                        value={
                            search
                        }
                        onChange={event =>
                            setSearch(
                                event.target.value
                            )
                        }
                        placeholder="Search student, admission number, dormitory or bed..."
                        className="form-input pl-11 w-full"
                    />

                </div>

            )}


            {/* =================================================
                DORMITORIES
            ================================================= */}

            {activeSection ===
                "dormitories" && (

                <div className="space-y-5">

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <div className="p-5 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                            <div>

                                <h2 className="text-xl font-black">

                                    Dormitory Management

                                </h2>

                                <p className="text-sm text-slate-500">

                                    Manage boarding houses,
                                    capacity, beds, Patron and Matron.

                                </p>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    openAddDormitory
                                }
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2"
                            >

                                <FaPlus />

                                Add Dormitory

                            </button>

                        </div>


                        {visibleDormitories.length ===
                        0 ? (

                            <EmptyState
                                icon={
                                    <FaBuilding />
                                }
                                title="No dormitories found"
                                text="Create a dormitory to start boarding management."
                                action={
                                    <button
                                        type="button"
                                        onClick={
                                            openAddDormitory
                                        }
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black"
                                    >

                                        Add Dormitory

                                    </button>
                                }
                            />

                        ) : (

                            <div className="overflow-x-auto">

                                <table className="min-w-full">

                                    <thead className="bg-slate-50">

                                        <tr>

                                            <Th>
                                                Dormitory
                                            </Th>

                                            <Th>
                                                Gender
                                            </Th>

                                            <Th>
                                                Students
                                            </Th>

                                            <Th>
                                                Beds
                                            </Th>

                                            <Th>
                                                Patron
                                            </Th>

                                            <Th>
                                                Matron
                                            </Th>

                                            <Th>
                                                Status
                                            </Th>

                                            <Th right>
                                                Actions
                                            </Th>

                                        </tr>

                                    </thead>


                                    <tbody className="divide-y">

                                        {visibleDormitories
                                            .filter(
                                                dormitory => {

                                                    const term =
                                                        normalizeText(
                                                            search
                                                        );

                                                    if (
                                                        !term
                                                    ) {
                                                        return true;
                                                    }

                                                    return [
                                                        dormitory.name,
                                                        getGenderLabel(
                                                            dormitory.gender
                                                        ),
                                                        getPatronName(
                                                            dormitory.patron_profile_id
                                                        ),
                                                        getMatronName(
                                                            dormitory.matron_profile_id
                                                        )
                                                    ]
                                                        .map(
                                                            normalizeText
                                                        )
                                                        .join(" ")
                                                        .includes(
                                                            term
                                                        );

                                                }
                                            )
                                            .map(
                                                dormitory => {

                                                    const studentCount =
                                                        getDormStudentCount(
                                                            dormitory.id
                                                        );

                                                    const bedCount =
                                                        getDormBeds(
                                                            dormitory.id
                                                        ).length;

                                                    const freeBeds =
                                                        getDormAvailableBeds(
                                                            dormitory.id
                                                        );

                                                    const usedBeds =
                                                        getDormOccupiedBeds(
                                                            dormitory.id
                                                        );


                                                    return (

                                                        <tr
                                                            key={
                                                                dormitory.id
                                                            }
                                                            className="hover:bg-slate-50"
                                                        >

                                                            <td className="px-5 py-4">

                                                                <div className="font-black text-slate-800">

                                                                    {
                                                                        dormitory.name
                                                                    }

                                                                </div>

                                                                <div className="text-xs text-slate-500">

                                                                    Capacity:
                                                                    {" "}
                                                                    {
                                                                        dormitory.capacity
                                                                    }

                                                                </div>

                                                            </td>


                                                            <td className="px-5 py-4">

                                                                <Badge>

                                                                    {
                                                                        getGenderLabel(
                                                                            dormitory.gender
                                                                        )
                                                                    }

                                                                </Badge>

                                                            </td>


                                                            <td className="px-5 py-4 font-black">

                                                                {
                                                                    studentCount
                                                                }

                                                                {" / "}

                                                                {
                                                                    dormitory.capacity
                                                                }

                                                            </td>


                                                            <td className="px-5 py-4">

                                                                <div className="font-black">

                                                                    {
                                                                        bedCount
                                                                    }

                                                                    {" "}
                                                                    beds

                                                                </div>

                                                                <div className="text-xs text-slate-500">

                                                                    {
                                                                        usedBeds
                                                                    }
                                                                    {" used • "}
                                                                    {
                                                                        freeBeds
                                                                    }
                                                                    {" free"}

                                                                </div>

                                                            </td>


                                                            <td className="px-5 py-4 font-bold">

                                                                {
                                                                    getPatronName(
                                                                        dormitory.patron_profile_id
                                                                    )
                                                                }

                                                            </td>


                                                            <td className="px-5 py-4 font-bold">

                                                                {
                                                                    getMatronName(
                                                                        dormitory.matron_profile_id
                                                                    )
                                                                }

                                                            </td>


                                                            <td className="px-5 py-4">

                                                                <Badge
                                                                    green={
                                                                        dormitory.status ===
                                                                        "active"
                                                                    }
                                                                >

                                                                    {
                                                                        dormitory.status
                                                                    }

                                                                </Badge>

                                                            </td>


                                                            <td className="px-5 py-4">

                                                                <div className="flex justify-end gap-2">

                                                                    <IconButton
                                                                        title="View Dormitory"
                                                                        onClick={() =>
                                                                            openDormitoryView(
                                                                                dormitory
                                                                            )
                                                                        }
                                                                    >

                                                                        <FaEye />

                                                                    </IconButton>


                                                                    <IconButton
                                                                        title="Assign Student"
                                                                        blue
                                                                        onClick={() =>
                                                                            openAddStudent(
                                                                                dormitory
                                                                            )
                                                                        }
                                                                    >

                                                                        <FaUserPlus />

                                                                    </IconButton>


                                                                    <IconButton
                                                                        title="Edit Dormitory"
                                                                        blue
                                                                        onClick={() =>
                                                                            openEditDormitory(
                                                                                dormitory
                                                                            )
                                                                        }
                                                                    >

                                                                        <FaEdit />

                                                                    </IconButton>


                                                                    <IconButton
                                                                        title="Delete Dormitory"
                                                                        danger
                                                                        onClick={() =>
                                                                            deleteDormitory(
                                                                                dormitory
                                                                            )
                                                                        }
                                                                    >

                                                                        <FaTrash />

                                                                    </IconButton>

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


                    {/* BED SUMMARY */}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                        {visibleDormitories.map(
                            dormitory => (

                                <div
                                    key={
                                        dormitory.id
                                    }
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
                                >

                                    <div className="flex items-center justify-between">

                                        <div>

                                            <h3 className="font-black">

                                                {
                                                    dormitory.name
                                                }

                                            </h3>

                                            <p className="text-xs text-slate-500">

                                                {
                                                    getGenderLabel(
                                                        dormitory.gender
                                                    )
                                                }

                                            </p>

                                        </div>

                                        <FaBed className="text-blue-600 text-xl" />

                                    </div>


                                    <div className="grid grid-cols-3 gap-2 mt-4">

                                        <MiniStat
                                            label="Beds"
                                            value={
                                                getDormBeds(
                                                    dormitory.id
                                                ).length
                                            }
                                        />

                                        <MiniStat
                                            label="Used"
                                            value={
                                                getDormOccupiedBeds(
                                                    dormitory.id
                                                )
                                            }
                                        />

                                        <MiniStat
                                            label="Free"
                                            value={
                                                getDormAvailableBeds(
                                                    dormitory.id
                                                )
                                            }
                                        />

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                </div>

            )}


            {/* =================================================
                STUDENTS
            ================================================= */}

            {activeSection ===
                "students" && (

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    <div className="p-5 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                        <div>

                            <h2 className="text-xl font-black">

                                Boarding Students

                            </h2>

                            <p className="text-sm text-slate-500">

                                Assign, transfer, edit bed and manage
                                students from the school database.

                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                openAddStudent()
                            }
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2"
                        >

                            <FaUserPlus />

                            Assign Student

                        </button>

                    </div>


                    {filteredAllocations.length ===
                    0 ? (

                        <EmptyState
                            icon={
                                <FaUsers />
                            }
                            title="No boarding students"
                            text="No student has been allocated to a dormitory yet."
                            action={
                                <button
                                    type="button"
                                    onClick={() =>
                                        openAddStudent()
                                    }
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black"
                                >

                                    Assign Student

                                </button>
                            }
                        />

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="min-w-full">

                                <thead className="bg-slate-50">

                                    <tr>

                                        <Th>
                                            Student
                                        </Th>

                                        <Th>
                                            Admission
                                        </Th>

                                        <Th>
                                            Gender
                                        </Th>

                                        <Th>
                                            Dormitory
                                        </Th>

                                        <Th>
                                            Bed
                                        </Th>

                                        <Th right>
                                            Actions
                                        </Th>

                                    </tr>

                                </thead>


                                <tbody className="divide-y">

                                    {filteredAllocations
                                        .map(
                                            allocation => (

                                                <tr
                                                    key={
                                                        allocation.id
                                                    }
                                                    className="hover:bg-slate-50"
                                                >

                                                    <td className="px-5 py-4">

                                                        <div className="font-black">

                                                            {
                                                                allocation.student_name
                                                            }

                                                        </div>

                                                        <div className="text-xs text-slate-500">

                                                            {
                                                                allocation.student?.class_name ||
                                                                "-"
                                                            }

                                                        </div>

                                                    </td>


                                                    <td className="px-5 py-4">

                                                        {
                                                            allocation.admission_number ||
                                                            "-"
                                                        }

                                                    </td>


                                                    <td className="px-5 py-4">

                                                        {
                                                            getGenderLabel(
                                                                allocation.student?.gender
                                                            )
                                                        }

                                                    </td>


                                                    <td className="px-5 py-4 font-bold">

                                                        {
                                                            allocation.dormitory?.name ||
                                                            "-"
                                                        }

                                                    </td>


                                                    <td className="px-5 py-4 font-black">

                                                        {
                                                            allocation.bed?.bed_number ||
                                                            "-"
                                                        }

                                                    </td>


                                                    <td className="px-5 py-4">

                                                        <div className="flex justify-end gap-2">

                                                            <IconButton
                                                                title="View Student"
                                                                onClick={() =>
                                                                    openStudentView(
                                                                        allocation.student
                                                                    )
                                                                }
                                                            >

                                                                <FaEye />

                                                            </IconButton>


                                                            <IconButton
                                                                title="Edit Dormitory / Bed"
                                                                blue
                                                                onClick={() =>
                                                                    openEditAllocation(
                                                                        allocation
                                                                    )
                                                                }
                                                            >

                                                                <FaEdit />

                                                            </IconButton>


                                                            <IconButton
                                                                title="Remove Allocation"
                                                                danger
                                                                onClick={() =>
                                                                    removeAllocation(
                                                                        allocation
                                                                    )
                                                                }
                                                            >

                                                                <FaTrash />

                                                            </IconButton>

                                                        </div>

                                                    </td>

                                                </tr>

                                            )
                                        )}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            )}


            {/* =================================================
                ROLL CALL
            ================================================= */}

            {activeSection ===
                "attendance" && (

                <div className="space-y-5">

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <div className="p-5 border-b">

                            <div>

                                <h2 className="text-xl font-black">

                                    Boarding Roll Call

                                </h2>

                                <p className="text-sm text-slate-500">

                                    Record daily student attendance
                                    and keep a complete weekly history.

                                </p>

                            </div>

                        </div>


                        <div className="p-5">

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                <FormField
                                    label="Dormitory"
                                    required
                                >

                                    <select
                                        value={
                                            attendanceDormitoryId
                                        }
                                        onChange={event =>
                                            setAttendanceDormitoryId(
                                                event.target.value
                                            )
                                        }
                                        className="form-input"
                                    >

                                        <option value="">
                                            Select Dormitory
                                        </option>

                                        {visibleDormitories
                                            .filter(
                                                dormitory =>
                                                    dormitory.status ===
                                                    "active"
                                            )
                                            .map(
                                                dormitory => (

                                                    <option
                                                        key={
                                                            dormitory.id
                                                        }
                                                        value={
                                                            dormitory.id
                                                        }
                                                    >

                                                        {
                                                            dormitory.name
                                                        }

                                                        {" — "}

                                                        {
                                                            getDormStudentCount(
                                                                dormitory.id
                                                            )
                                                        }
                                                        {" students"}

                                                    </option>

                                                )
                                            )}

                                    </select>

                                </FormField>


                                <FormField
                                    label="Date"
                                    required
                                >

                                    <input
                                        type="date"
                                        value={
                                            attendanceDate
                                        }
                                        onChange={event =>
                                            setAttendanceDate(
                                                event.target.value
                                            )
                                        }
                                        className="form-input"
                                    />

                                </FormField>


                                <FormField
                                    label="Session"
                                    required
                                >

                                    <select
                                        value={
                                            attendanceSession
                                        }
                                        onChange={event =>
                                            setAttendanceSession(
                                                event.target.value
                                            )
                                        }
                                        className="form-input"
                                    >

                                        {ATTENDANCE_SESSIONS.map(
                                            session => (

                                                <option
                                                    key={
                                                        session.value
                                                    }
                                                    value={
                                                        session.value
                                                    }
                                                >

                                                    {
                                                        session.label
                                                    }

                                                </option>

                                            )
                                        )}

                                    </select>

                                </FormField>

                            </div>

                        </div>

                    </div>


                    {attendanceDormitoryId && (

                        <>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

                                <MiniStat
                                    label="Total"
                                    value={
                                        rollCallSummary.total
                                    }
                                />

                                <MiniStat
                                    label="Present"
                                    value={
                                        rollCallSummary.present
                                    }
                                />

                                <MiniStat
                                    label="Absent"
                                    value={
                                        rollCallSummary.absent
                                    }
                                />

                                <MiniStat
                                    label="Late"
                                    value={
                                        rollCallSummary.late
                                    }
                                />

                                <MiniStat
                                    label="Excused"
                                    value={
                                        rollCallSummary.excused
                                    }
                                />

                            </div>


                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                <div className="p-5 border-b flex justify-between">

                                    <div>

                                        <h3 className="font-black text-lg">

                                            Daily Roll Call

                                        </h3>

                                        <p className="text-sm text-slate-500">

                                            {
                                                formatDate(
                                                    attendanceDate
                                                )
                                            }
                                            {" — "}
                                            {
                                                attendanceSession
                                            }

                                        </p>

                                    </div>


                                    <button
                                        type="button"
                                        onClick={
                                            saveRollCall
                                        }
                                        disabled={
                                            saving
                                        }
                                        className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2 disabled:opacity-50"
                                    >

                                        {saving ? (
                                            <FaSpinner className="animate-spin" />
                                        ) : (
                                            <FaSave />
                                        )}

                                        Save Roll Call

                                    </button>

                                </div>


                                <div className="overflow-x-auto">

                                    <table className="min-w-full">

                                        <thead className="bg-slate-50">

                                            <tr>

                                                <Th>
                                                    Student
                                                </Th>

                                                <Th>
                                                    Admission
                                                </Th>

                                                <Th>
                                                    Bed
                                                </Th>

                                                <Th>
                                                    Attendance
                                                </Th>

                                                <Th>
                                                    Notes
                                                </Th>

                                            </tr>

                                        </thead>


                                        <tbody className="divide-y divide-slate-100">

                                            {getAttendanceStudents().map(
                                                allocation => {

                                                    const key =
                                                        String(
                                                            allocation.student_id
                                                        );

                                                    const draft =
                                                        attendanceDraft[
                                                            key
                                                        ] || {

                                                            status:
                                                                "present",

                                                            notes:
                                                                ""

                                                        };

                                                    return (

                                                        <tr
                                                            key={
                                                                allocation.student_id
                                                            }
                                                        >

                                                            <td className="px-5 py-4 font-black">

                                                                {
                                                                    allocation.student_name
                                                                }

                                                            </td>

                                                            <td className="px-5 py-4">

                                                                {
                                                                    allocation.admission_number
                                                                }

                                                            </td>

                                                            <td className="px-5 py-4 font-black">

                                                                {
                                                                    allocation.bed?.bed_number ||
                                                                    "-"
                                                                }

                                                            </td>

                                                            <td className="px-5 py-4">

                                                                <select
                                                                    value={
                                                                        draft.status
                                                                    }
                                                                    onChange={event =>
                                                                        changeAttendanceStatus(
                                                                            allocation.student_id,
                                                                            event.target.value
                                                                        )
                                                                    }
                                                                    className="form-input min-w-[150px]"
                                                                >

                                                                    {ATTENDANCE_STATUS.map(
                                                                        status => (

                                                                            <option
                                                                                key={
                                                                                    status.value
                                                                                }
                                                                                value={
                                                                                    status.value
                                                                                }
                                                                            >

                                                                                {
                                                                                    status.label
                                                                                }

                                                                            </option>

                                                                        )
                                                                    )}

                                                                </select>

                                                            </td>

                                                            <td className="px-5 py-4">

                                                                <input
                                                                    value={
                                                                        draft.notes ||
                                                                        ""
                                                                    }
                                                                    onChange={event =>
                                                                        changeAttendanceNotes(
                                                                            allocation.student_id,
                                                                            event.target.value
                                                                        )
                                                                    }
                                                                    placeholder="Optional note..."
                                                                    className="form-input min-w-[220px]"
                                                                />

                                                            </td>

                                                        </tr>

                                                    );

                                                }
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            </div>


                            {/* WEEKLY */}

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                <div className="p-5 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                                    <div>

                                        <h3 className="text-lg font-black">

                                            Weekly Attendance

                                        </h3>

                                        <p className="text-sm text-slate-500">

                                            Monday to Sunday attendance
                                            records. Select a status and
                                            save the entire week.

                                        </p>

                                    </div>


                                    <div className="flex flex-wrap gap-2">

                                        <input
                                            type="date"
                                            value={
                                                weeklyStart
                                            }
                                            onChange={event =>
                                                setWeeklyStart(
                                                    getWeekStart(
                                                        event.target.value
                                                    )
                                                )
                                            }
                                            className="form-input"
                                        />

                                        <button
                                            type="button"
                                            onClick={
                                                saveWeeklyAttendance
                                            }
                                            disabled={
                                                saving
                                            }
                                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2 disabled:opacity-50"
                                        >

                                            {saving ? (
                                                <FaSpinner className="animate-spin" />
                                            ) : (
                                                <FaSave />
                                            )}

                                            Save Week

                                        </button>

                                    </div>

                                </div>


                                <div className="overflow-x-auto">

                                    <table className="min-w-full">

                                        <thead className="bg-slate-50">

                                            <tr>

                                                <Th>
                                                    Student
                                                </Th>

                                                {weekDates.map(
                                                    date => (

                                                        <th
                                                            key={
                                                                date
                                                            }
                                                            className="px-3 py-4 text-center text-xs font-black text-slate-500"
                                                        >

                                                            {
                                                                new Date(
                                                                    `${date}T00:00:00`
                                                                ).toLocaleDateString(
                                                                    "en-US",
                                                                    {
                                                                        weekday:
                                                                            "short"
                                                                    }
                                                                )
                                                            }

                                                            <div>

                                                                {
                                                                    date.slice(
                                                                        8
                                                                    )
                                                                }

                                                            </div>

                                                        </th>

                                                    )
                                                )}

                                                <Th>
                                                    P
                                                </Th>

                                                <Th>
                                                    A
                                                </Th>

                                                <Th>
                                                    L
                                                </Th>

                                                <Th>
                                                    E
                                                </Th>

                                            </tr>

                                        </thead>


                                        <tbody className="divide-y">

                                            {getAttendanceStudents().map(
                                                allocation => {

                                                    const totals =
                                                        getWeeklyTotals(
                                                            allocation.student_id
                                                        );

                                                    return (

                                                        <tr
                                                            key={
                                                                allocation.student_id
                                                            }
                                                        >

                                                            <td className="px-5 py-4 font-black whitespace-nowrap">

                                                                {
                                                                    allocation.student_name
                                                                }

                                                            </td>


                                                            {weekDates.map(
                                                                date => {

                                                                    const status =
                                                                        getWeeklyDraftStatus(
                                                                            allocation.student_id,
                                                                            date
                                                                        );

                                                                    return (

                                                                        <td
                                                                            key={
                                                                                date
                                                                            }
                                                                            className="px-2 py-3 text-center"
                                                                        >

                                                                            <select
                                                                                value={
                                                                                    status
                                                                                }
                                                                                onChange={event =>
                                                                                    changeWeeklyStatus(
                                                                                        allocation.student_id,
                                                                                        date,
                                                                                        event.target.value
                                                                                    )
                                                                                }
                                                                                className="w-20 text-xs border border-slate-200 rounded-lg px-1 py-2"
                                                                            >

                                                                                <option value="">
                                                                                    —
                                                                                </option>

                                                                                {ATTENDANCE_STATUS.map(
                                                                                    item => (

                                                                                        <option
                                                                                            key={
                                                                                                item.value
                                                                                            }
                                                                                            value={
                                                                                                item.value
                                                                                            }
                                                                                        >

                                                                                            {
                                                                                                item.label
                                                                                            }

                                                                                        </option>

                                                                                    )
                                                                                )}

                                                                            </select>

                                                                        </td>

                                                                    );

                                                                }
                                                            )}


                                                            <td className="px-3 py-4 text-center font-black text-green-600">

                                                                {
                                                                    totals.present
                                                                }

                                                            </td>

                                                            <td className="px-3 py-4 text-center font-black text-red-600">

                                                                {
                                                                    totals.absent
                                                                }

                                                            </td>

                                                            <td className="px-3 py-4 text-center font-black text-orange-600">

                                                                {
                                                                    totals.late
                                                                }

                                                            </td>

                                                            <td className="px-3 py-4 text-center font-black text-blue-600">

                                                                {
                                                                    totals.excused
                                                                }

                                                            </td>

                                                        </tr>

                                                    );

                                                }
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            </div>

                        </>

                    )}

                </div>

            )}


            {/* =================================================
                INCIDENTS
            ================================================= */}

            {activeSection ===
                "incidents" && (

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    <div className="p-5 border-b flex justify-between">

                        <div>

                            <h2 className="text-xl font-black">

                                Dormitory Incidents

                            </h2>

                            <p className="text-sm text-slate-500">

                                Record and manage student boarding
                                incidents.

                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                openAddIncident()
                            }
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2"
                        >

                            <FaPlus />

                            Record Incident

                        </button>

                    </div>


                    {incidents.length ===
                    0 ? (

                        <EmptyState
                            icon={
                                <FaExclamationTriangle />
                            }
                            title="No incidents recorded"
                            text="There are no dormitory incidents in the system yet."
                            action={
                                <button
                                    type="button"
                                    onClick={() =>
                                        openAddIncident()
                                    }
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black"
                                >

                                    Record Incident

                                </button>
                            }
                        />

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="min-w-full">

                                <thead className="bg-slate-50">

                                    <tr>

                                        <Th>
                                            Date
                                        </Th>

                                        <Th>
                                            Student
                                        </Th>

                                        <Th>
                                            Dormitory
                                        </Th>

                                        <Th>
                                            Incident
                                        </Th>

                                        <Th>
                                            Severity
                                        </Th>

                                        <Th>
                                            Status
                                        </Th>

                                        <Th right>
                                            Actions
                                        </Th>

                                    </tr>

                                </thead>


                                <tbody className="divide-y">

                                    {incidents
                                        .filter(
                                            incident => {

                                                const term =
                                                    normalizeText(
                                                        search
                                                    );

                                                if (
                                                    !term
                                                ) {
                                                    return true;
                                                }

                                                const student =
                                                    getIncidentStudent(
                                                        incident.student_id
                                                    );

                                                const dormitory =
                                                    getIncidentDormitory(
                                                        incident.dormitory_id
                                                    );

                                                return [
                                                    incident.title,
                                                    incident.incident_type,
                                                    incident.severity,
                                                    incident.status,
                                                    getStudentName(
                                                        student
                                                    ),
                                                    dormitory?.name
                                                ]
                                                    .map(
                                                        normalizeText
                                                    )
                                                    .join(" ")
                                                    .includes(
                                                        term
                                                    );

                                            }
                                        )
                                        .map(
                                            incident => {

                                                const student =
                                                    getIncidentStudent(
                                                        incident.student_id
                                                    );

                                                const dormitory =
                                                    getIncidentDormitory(
                                                        incident.dormitory_id
                                                    );

                                                return (

                                                    <tr
                                                        key={
                                                            incident.id
                                                        }
                                                        className="hover:bg-slate-50"
                                                    >

                                                        <td className="px-5 py-4">

                                                            {
                                                                formatDate(
                                                                    incident.incident_date
                                                                )
                                                            }

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <div className="font-black">

                                                                {
                                                                    student
                                                                        ? getStudentName(
                                                                            student
                                                                        )
                                                                        : "Dormitory / General"
                                                                }

                                                            </div>

                                                            {student && (

                                                                <div className="text-xs text-slate-500">

                                                                    {
                                                                        student.admission_number ||
                                                                        student.admission_no ||
                                                                        "-"
                                                                    }

                                                                </div>

                                                            )}

                                                        </td>


                                                        <td className="px-5 py-4 font-bold">

                                                            {
                                                                dormitory?.name ||
                                                                "-"
                                                            }

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <div className="font-black">

                                                                {
                                                                    incident.title
                                                                }

                                                            </div>

                                                            <div className="text-xs text-slate-500">

                                                                {
                                                                    incident.incident_type
                                                                }

                                                            </div>

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <SeverityBadge
                                                                severity={
                                                                    incident.severity
                                                                }
                                                            />

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <Badge>

                                                                {
                                                                    incident.status
                                                                }

                                                            </Badge>

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <div className="flex justify-end gap-2">

                                                                <IconButton
                                                                    title="Edit Incident"
                                                                    blue
                                                                    onClick={() =>
                                                                        openEditIncident(
                                                                            incident
                                                                        )
                                                                    }
                                                                >

                                                                    <FaEdit />

                                                                </IconButton>


                                                                <IconButton
                                                                    title="Delete Incident"
                                                                    danger
                                                                    onClick={() =>
                                                                        deleteIncident(
                                                                            incident
                                                                        )
                                                                    }
                                                                >

                                                                    <FaTrash />

                                                                </IconButton>

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

            )}


            {/* =================================================
                PATRONS
            ================================================= */}

            {activeSection ===
                "patrons" && (

                <PersonList
                    title="Available Patrons"
                    subtitle="Active staff members with Patron role."
                    people={patrons}
                    icon={
                        <FaUserTie />
                    }
                />

            )}


            {/* =================================================
                MATRONS
            ================================================= */}

            {activeSection ===
                "matrons" && (

                <PersonList
                    title="Available Matrons"
                    subtitle="Active staff members with Matron role."
                    people={matrons}
                    icon={
                        <FaFemale />
                    }
                />

            )}


            {/* =================================================
                OUTPASS
            ================================================= */}

            {activeSection ===
                "outpass" && (

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    <div className="p-5 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                        <div>

                            <h2 className="text-xl font-black">

                                Leave & Out Pass

                            </h2>

                            <p className="text-sm text-slate-500">

                                Record, approve, reject and track
                                student IN/OUT boarding passes.

                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                openAddOutpass()
                            }
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2"
                        >

                            <FaPlus />

                            New Out Pass

                        </button>

                    </div>


                    {visibleOutpasses.length ===
                    0 ? (

                        <EmptyState
                            icon={
                                <FaSignOutAlt />
                            }
                            title="No out-pass records"
                            text="No boarding leave or out-pass request has been recorded."
                            action={
                                <button
                                    type="button"
                                    onClick={() =>
                                        openAddOutpass()
                                    }
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black"
                                >

                                    New Out Pass

                                </button>
                            }
                        />

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="min-w-full">

                                <thead className="bg-slate-50">

                                    <tr>

                                        <Th>
                                            Date
                                        </Th>

                                        <Th>
                                            Student
                                        </Th>

                                        <Th>
                                            Dormitory
                                        </Th>

                                        <Th>
                                            Destination
                                        </Th>

                                        <Th>
                                            Leave
                                        </Th>

                                        <Th>
                                            Return
                                        </Th>

                                        <Th>
                                            Status
                                        </Th>

                                        <Th right>
                                            Actions
                                        </Th>

                                    </tr>

                                </thead>


                                <tbody className="divide-y">

                                    {visibleOutpasses
                                        .filter(
                                            outpass => {

                                                const term =
                                                    normalizeText(
                                                        search
                                                    );

                                                if (
                                                    !term
                                                ) {
                                                    return true;
                                                }

                                                const student =
                                                    getOutpassStudent(
                                                        outpass.student_id
                                                    );

                                                const dormitory =
                                                    getOutpassDormitory(
                                                        outpass.dormitory_id
                                                    );

                                                return [
                                                    getStudentName(
                                                        student
                                                    ),
                                                    outpass.destination,
                                                    outpass.reason,
                                                    outpass.guardian_name,
                                                    dormitory?.name,
                                                    outpass.status
                                                ]
                                                    .map(
                                                        normalizeText
                                                    )
                                                    .join(" ")
                                                    .includes(
                                                        term
                                                    );

                                            }
                                        )
                                        .map(
                                            outpass => {

                                                const student =
                                                    getOutpassStudent(
                                                        outpass.student_id
                                                    );

                                                const dormitory =
                                                    getOutpassDormitory(
                                                        outpass.dormitory_id
                                                    );

                                                return (

                                                    <tr
                                                        key={
                                                            outpass.id
                                                        }
                                                        className="hover:bg-slate-50"
                                                    >

                                                        <td className="px-5 py-4">

                                                            {
                                                                formatDate(
                                                                    outpass.request_date
                                                                )
                                                            }

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <div className="font-black">

                                                                {
                                                                    getStudentName(
                                                                        student
                                                                    )
                                                                }

                                                            </div>

                                                            <div className="text-xs text-slate-500">

                                                                {
                                                                    student?.admission_number ||
                                                                    student?.admission_no ||
                                                                    "-"
                                                                }

                                                            </div>

                                                        </td>


                                                        <td className="px-5 py-4 font-bold">

                                                            {
                                                                dormitory?.name ||
                                                                "-"
                                                            }

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <div className="font-black">

                                                                {
                                                                    outpass.destination
                                                                }

                                                            </div>

                                                            <div className="text-xs text-slate-500">

                                                                {
                                                                    outpass.reason
                                                                }

                                                            </div>

                                                        </td>


                                                        <td className="px-5 py-4 text-sm">

                                                            {
                                                                outpass.leave_from
                                                                    ? new Date(
                                                                        outpass.leave_from
                                                                    ).toLocaleString(
                                                                        "en-GB",
                                                                        {
                                                                            dateStyle:
                                                                                "short",
                                                                            timeStyle:
                                                                                "short"
                                                                        }
                                                                    )
                                                                    : "-"
                                                            }

                                                        </td>


                                                        <td className="px-5 py-4 text-sm">

                                                            {
                                                                outpass.expected_return
                                                                    ? new Date(
                                                                        outpass.expected_return
                                                                    ).toLocaleString(
                                                                        "en-GB",
                                                                        {
                                                                            dateStyle:
                                                                                "short",
                                                                            timeStyle:
                                                                                "short"
                                                                        }
                                                                    )
                                                                    : "-"
                                                            }

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <span
                                                                className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-black ${getOutpassStatusClass(
                                                                    outpass.status
                                                                )}`}
                                                            >

                                                                {
                                                                    outpass.status
                                                                }

                                                            </span>

                                                        </td>


                                                        <td className="px-5 py-4">

                                                            <div className="flex justify-end gap-2 flex-wrap">

                                                                {outpass.status ===
                                                                    "pending" && (

                                                                    <>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                updateOutpassStatus(
                                                                                    outpass,
                                                                                    "approved"
                                                                                )
                                                                            }
                                                                            className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-black"
                                                                        >

                                                                            Approve

                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                updateOutpassStatus(
                                                                                    outpass,
                                                                                    "rejected"
                                                                                )
                                                                            }
                                                                            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-black"
                                                                        >

                                                                            Reject

                                                                        </button>

                                                                    </>

                                                                )}


                                                                {outpass.status ===
                                                                    "approved" && (

                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateOutpassStatus(
                                                                                outpass,
                                                                                "returned"
                                                                            )
                                                                        }
                                                                        className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-black"
                                                                    >

                                                                        Mark Returned

                                                                    </button>

                                                                )}


                                                                <IconButton
                                                                    title="Edit Out Pass"
                                                                    blue
                                                                    onClick={() =>
                                                                        openEditOutpass(
                                                                            outpass
                                                                        )
                                                                    }
                                                                >

                                                                    <FaEdit />

                                                                </IconButton>


                                                                <IconButton
                                                                    title="Delete Out Pass"
                                                                    danger
                                                                    onClick={() =>
                                                                        deleteOutpass(
                                                                            outpass
                                                                        )
                                                                    }
                                                                >

                                                                    <FaTrash />

                                                                </IconButton>

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

            )}


            {/* =================================================
                ADD / EDIT DORMITORY
            ================================================= */}

            {showDormitoryModal && (

                <Modal
                    title={
                        editingDormitory
                            ? "Edit Dormitory"
                            : "Add Dormitory"
                    }
                    onClose={() =>
                        setShowDormitoryModal(
                            false
                        )
                    }
                >

                    <form
                        onSubmit={
                            saveDormitory
                        }
                        className="space-y-5"
                    >

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <FormField
                                label="Dormitory Name"
                                required
                            >

                                <input
                                    value={
                                        dormitoryForm.name
                                    }
                                    onChange={event =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                name:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    required
                                    className="form-input"
                                    placeholder="e.g. Boys Dormitory"
                                />

                            </FormField>


                            <FormField
                                label="Gender"
                                required
                            >

                                <select
                                    value={
                                        dormitoryForm.gender
                                    }
                                    onChange={event =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                gender:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    {GENDER_OPTIONS.map(
                                        option => (

                                            <option
                                                key={
                                                    option.value
                                                }
                                                value={
                                                    option.value
                                                }
                                            >

                                                {
                                                    option.label
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Capacity"
                                required
                            >

                                <input
                                    type="number"
                                    min="0"
                                    value={
                                        dormitoryForm.capacity
                                    }
                                    onChange={event =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                capacity:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    required
                                    className="form-input"
                                />

                            </FormField>


                            <FormField
                                label="Academic Year"
                            >

                                <select
                                    value={
                                        dormitoryForm.academic_year_id
                                    }
                                    onChange={event =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                academic_year_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    <option value="">
                                        Select Academic Year
                                    </option>

                                    {academicYears.map(
                                        year => (

                                            <option
                                                key={
                                                    year.id
                                                }
                                                value={
                                                    year.id
                                                }
                                            >

                                                {
                                                    year.year_name
                                                }

                                                {year.term
                                                    ? ` — ${year.term}`
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField label="Patron">

                                <select
                                    value={
                                        dormitoryForm.patron_profile_id
                                    }
                                    onChange={event =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                patron_profile_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    <option value="">
                                        Select Patron
                                    </option>

                                    {patrons.map(
                                        person => (

                                            <option
                                                key={
                                                    person.id
                                                }
                                                value={
                                                    person.id
                                                }
                                            >

                                                {
                                                    person.full_name
                                                }

                                                {person.phone
                                                    ? ` — ${person.phone}`
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField label="Matron">

                                <select
                                    value={
                                        dormitoryForm.matron_profile_id
                                    }
                                    onChange={event =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                matron_profile_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    <option value="">
                                        Select Matron
                                    </option>

                                    {matrons.map(
                                        person => (

                                            <option
                                                key={
                                                    person.id
                                                }
                                                value={
                                                    person.id
                                                }
                                            >

                                                {
                                                    person.full_name
                                                }

                                                {person.phone
                                                    ? ` — ${person.phone}`
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField label="Status">

                                <select
                                    value={
                                        dormitoryForm.status
                                    }
                                    onChange={event =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                status:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    <option value="active">
                                        Active
                                    </option>

                                    <option value="inactive">
                                        Inactive
                                    </option>

                                </select>

                            </FormField>

                        </div>


                        <ModalActions
                            onCancel={() =>
                                setShowDormitoryModal(
                                    false
                                )
                            }
                            saving={saving}
                            saveText={
                                editingDormitory
                                    ? "Save Changes"
                                    : "Create Dormitory"
                            }
                        />

                    </form>

                </Modal>

            )}


            {/* =================================================
                ASSIGN / EDIT STUDENT
            ================================================= */}

            {showAllocationModal && (

                <Modal
                    title={
                        editingAllocation
                            ? "Edit Student Boarding"
                            : "Assign Student to Dormitory"
                    }
                    onClose={() =>
                        setShowAllocationModal(
                            false
                        )
                    }
                >

                    <form
                        onSubmit={
                            saveAllocation
                        }
                        className="space-y-5"
                    >

                        <FormField
                            label="Student"
                            required
                        >

                            {editingAllocation ? (

                                <div className="bg-slate-50 border rounded-xl p-4">

                                    <div className="font-black">

                                        {
                                            allocationForm.student_name
                                        }

                                    </div>

                                    <div className="text-sm text-slate-500">

                                        Admission:
                                        {" "}
                                        {
                                            allocationForm.admission_number
                                        }

                                    </div>

                                </div>

                            ) : (

                                <select
                                    value={
                                        allocationForm.student_id
                                    }
                                    onChange={event => {

                                        const student =
                                            students.find(
                                                item =>
                                                    String(
                                                        item.id
                                                    ) ===
                                                    String(
                                                        event.target.value
                                                    )
                                            );

                                        setAllocationForm(
                                            previous => ({
                                                ...previous,
                                                student_id:
                                                    event.target.value,
                                                student_name:
                                                    getStudentName(
                                                        student
                                                    ),
                                                admission_number:
                                                    student?.admission_number ||
                                                    student?.admission_no ||
                                                    ""
                                            })
                                        );

                                    }}
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Student
                                    </option>

                                    {students
                                        .filter(
                                            student =>
                                                !allocations.some(
                                                    allocation =>
                                                        String(
                                                            allocation.student_id
                                                        ) ===
                                                        String(
                                                            student.id
                                                        ) &&
                                                        String(
                                                            allocation.academic_year_id
                                                        ) ===
                                                        String(
                                                            allocationForm.academic_year_id ||
                                                            activeAcademicYear?.id
                                                        )
                                                )
                                        )
                                        .map(
                                            student => (

                                                <option
                                                    key={
                                                        student.id
                                                    }
                                                    value={
                                                        student.id
                                                    }
                                                >

                                                    {
                                                        getStudentName(
                                                            student
                                                        )
                                                    }

                                                    {" — "}

                                                    {
                                                        student.admission_number ||
                                                        student.admission_no ||
                                                        "-"
                                                    }

                                                </option>

                                            )
                                        )}

                                </select>

                            )}

                        </FormField>


                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            <FormField
                                label="Academic Year"
                                required
                            >

                                <select
                                    value={
                                        allocationForm.academic_year_id
                                    }
                                    onChange={event =>
                                        setAllocationForm(
                                            previous => ({
                                                ...previous,
                                                academic_year_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select
                                    </option>

                                    {academicYears.map(
                                        year => (

                                            <option
                                                key={
                                                    year.id
                                                }
                                                value={
                                                    year.id
                                                }
                                            >

                                                {
                                                    year.year_name
                                                }

                                                {year.term
                                                    ? ` — ${year.term}`
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Dormitory"
                                required
                            >

                                <select
                                    value={
                                        allocationForm.dormitory_id
                                    }
                                    onChange={event =>
                                        setAllocationForm(
                                            previous => ({
                                                ...previous,
                                                dormitory_id:
                                                    event.target.value,
                                                bed_id:
                                                    ""
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Dormitory
                                    </option>

                                    {visibleDormitories
                                        .filter(
                                            dormitory =>
                                                dormitory.status ===
                                                "active"
                                        )
                                        .map(
                                            dormitory => (

                                                <option
                                                    key={
                                                        dormitory.id
                                                    }
                                                    value={
                                                        dormitory.id
                                                    }
                                                >

                                                    {
                                                        dormitory.name
                                                    }

                                                    {" — "}

                                                    {
                                                        getDormAvailableBeds(
                                                            dormitory.id
                                                        )
                                                    }

                                                    {" free"}

                                                </option>

                                            )
                                        )}

                                </select>

                            </FormField>


                            <FormField
                                label="Bed Number"
                                required
                            >

                                <select
                                    value={
                                        allocationForm.bed_id
                                    }
                                    onChange={event =>
                                        setAllocationForm(
                                            previous => ({
                                                ...previous,
                                                bed_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    disabled={
                                        !allocationForm.dormitory_id
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Bed
                                    </option>

                                    {availableBedsForForm.map(
                                        bed => (

                                            <option
                                                key={
                                                    bed.id
                                                }
                                                value={
                                                    bed.id
                                                }
                                            >

                                                {
                                                    bed.bed_number
                                                }

                                                {" — "}

                                                {
                                                    bed.condition
                                                }

                                                {
                                                    String(
                                                        bed.id
                                                    ) ===
                                                    String(
                                                        allocationForm.bed_id
                                                    )
                                                        ? " — CURRENT"
                                                        : ""
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>

                        </div>


                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">

                            <div className="font-black">

                                Bed Management

                            </div>

                            <div className="mt-1">

                                Uki-edit dormitory au bed,
                                kitanda cha zamani kitaachwa
                                kuwa Available na kipya kuwa
                                Occupied.

                            </div>

                        </div>


                        <ModalActions
                            onCancel={() =>
                                setShowAllocationModal(
                                    false
                                )
                            }
                            saving={saving}
                            saveText={
                                editingAllocation
                                    ? "Save Changes"
                                    : "Assign Student"
                            }
                        />

                    </form>

                </Modal>

            )}


            {/* =================================================
                VIEW DORMITORY
            ================================================= */}

            {showViewModal &&
                selectedDormitory && (

                <Modal
                    title={
                        `${selectedDormitory.name} — Dormitory Details`
                    }
                    onClose={() =>
                        setShowViewModal(
                            false
                        )
                    }
                >

                    <div className="space-y-6">

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                            <MiniStat
                                label="Capacity"
                                value={
                                    selectedDormitory.capacity
                                }
                            />

                            <MiniStat
                                label="Students"
                                value={
                                    getDormStudentCount(
                                        selectedDormitory.id
                                    )
                                }
                            />

                            <MiniStat
                                label="Occupied Beds"
                                value={
                                    getDormOccupiedBeds(
                                        selectedDormitory.id
                                    )
                                }
                            />

                            <MiniStat
                                label="Available Beds"
                                value={
                                    getDormAvailableBeds(
                                        selectedDormitory.id
                                    )
                                }
                            />

                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            <DetailBox
                                label="Gender"
                                value={
                                    getGenderLabel(
                                        selectedDormitory.gender
                                    )
                                }
                            />

                            <DetailBox
                                label="Patron"
                                value={
                                    getPatronName(
                                        selectedDormitory.patron_profile_id
                                    )
                                }
                            />

                            <DetailBox
                                label="Matron"
                                value={
                                    getMatronName(
                                        selectedDormitory.matron_profile_id
                                    )
                                }
                            />

                        </div>


                        <div>

                            <div className="flex justify-between items-center mb-3">

                                <h3 className="font-black text-lg">

                                    Students in Dormitory

                                </h3>


                                <button
                                    type="button"
                                    onClick={() => {

                                        setShowViewModal(
                                            false
                                        );

                                        openAddStudent(
                                            selectedDormitory
                                        );

                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2"
                                >

                                    <FaUserPlus />

                                    Add Student

                                </button>

                            </div>


                            <div className="overflow-x-auto border border-slate-200 rounded-xl">

                                <table className="min-w-full">

                                    <thead className="bg-slate-50">

                                        <tr>

                                            <Th>
                                                Student
                                            </Th>

                                            <Th>
                                                Admission
                                            </Th>

                                            <Th>
                                                Bed
                                            </Th>

                                            <Th>
                                                Class
                                            </Th>

                                            <Th right>
                                                Action
                                            </Th>

                                        </tr>

                                    </thead>


                                    <tbody className="divide-y">

                                        {getStudentsInDorm(
                                            selectedDormitory.id
                                        ).map(
                                            allocation => (

                                                <tr
                                                    key={
                                                        allocation.id
                                                    }
                                                >

                                                    <td className="px-4 py-3 font-black">

                                                        {
                                                            allocation.student_name
                                                        }

                                                    </td>

                                                    <td className="px-4 py-3">

                                                        {
                                                            allocation.admission_number
                                                        }

                                                    </td>

                                                    <td className="px-4 py-3 font-black">

                                                        {
                                                            allocation.bed?.bed_number ||
                                                            "-"
                                                        }

                                                    </td>

                                                    <td className="px-4 py-3">

                                                        {
                                                            allocation.student?.class_name ||
                                                            "-"
                                                        }

                                                    </td>

                                                    <td className="px-4 py-3">

                                                        <div className="flex justify-end gap-2">

                                                            <IconButton
                                                                title="View Student"
                                                                onClick={() =>
                                                                    openStudentView(
                                                                        allocation.student
                                                                    )
                                                                }
                                                            >

                                                                <FaEye />

                                                            </IconButton>


                                                            <IconButton
                                                                title="Edit Dormitory / Bed"
                                                                blue
                                                                onClick={() => {

                                                                    setShowViewModal(
                                                                        false
                                                                    );

                                                                    openEditAllocation(
                                                                        allocation
                                                                    );

                                                                }}
                                                            >

                                                                <FaEdit />

                                                            </IconButton>

                                                        </div>

                                                    </td>

                                                </tr>

                                            )
                                        )}


                                        {getStudentsInDorm(
                                            selectedDormitory.id
                                        ).length === 0 && (

                                            <tr>

                                                <td
                                                    colSpan="5"
                                                    className="px-5 py-10 text-center text-slate-500"
                                                >

                                                    No students allocated
                                                    to this dormitory.

                                                </td>

                                            </tr>

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </div>


                        {/* BED INVENTORY */}

                        <div>

                            <div className="flex items-center justify-between mb-3">

                                <h3 className="font-black text-lg">

                                    Bed Inventory

                                </h3>

                                <span className="text-sm font-bold text-slate-500">

                                    {
                                        getDormBeds(
                                            selectedDormitory.id
                                        ).length
                                    }
                                    {" beds"}

                                </span>

                            </div>


                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">

                                {getDormBeds(
                                    selectedDormitory.id
                                ).map(
                                    bed => {

                                        const allocation =
                                            decoratedAllocations.find(
                                                item =>
                                                    String(
                                                        item.bed_id
                                                    ) ===
                                                    String(
                                                        bed.id
                                                    )
                                            );

                                        return (

                                            <div
                                                key={
                                                    bed.id
                                                }
                                                className={
                                                    bed.status ===
                                                    "occupied"
                                                        ? "rounded-xl border border-orange-200 bg-orange-50 p-3"
                                                        : "rounded-xl border border-green-200 bg-green-50 p-3"
                                                }
                                            >

                                                <div className="font-black">

                                                    {
                                                        bed.bed_number
                                                    }

                                                </div>

                                                <div className="text-xs font-bold mt-1">

                                                    {
                                                        bed.status
                                                    }

                                                </div>

                                                <div className="text-xs text-slate-500 mt-1">

                                                    {
                                                        bed.condition ||
                                                        "good"
                                                    }

                                                </div>

                                                {allocation && (

                                                    <div className="text-xs mt-2 text-slate-600 font-bold">

                                                        {
                                                            allocation.student_name
                                                        }

                                                    </div>

                                                )}

                                            </div>

                                        );

                                    }
                                )}

                            </div>

                        </div>

                    </div>

                </Modal>

            )}


            {/* =================================================
                INCIDENT MODAL
            ================================================= */}

            {showIncidentModal && (

                <Modal
                    title={
                        editingIncident
                            ? "Edit Dormitory Incident"
                            : "Record Dormitory Incident"
                    }
                    onClose={() =>
                        setShowIncidentModal(
                            false
                        )
                    }
                >

                    <form
                        onSubmit={
                            saveIncident
                        }
                        className="space-y-5"
                    >

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <FormField
                                label="Dormitory"
                                required
                            >

                                <select
                                    value={
                                        incidentForm.dormitory_id
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                dormitory_id:
                                                    event.target.value,
                                                student_id:
                                                    ""
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Dormitory
                                    </option>

                                    {visibleDormitories.map(
                                        dormitory => (

                                            <option
                                                key={
                                                    dormitory.id
                                                }
                                                value={
                                                    dormitory.id
                                                }
                                            >

                                                {
                                                    dormitory.name
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField label="Student">

                                <select
                                    value={
                                        incidentForm.student_id
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                student_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    <option value="">
                                        General Dormitory Incident
                                    </option>

                                    {decoratedAllocations
                                        .filter(
                                            allocation =>
                                                String(
                                                    allocation.dormitory_id
                                                ) ===
                                                String(
                                                    incidentForm.dormitory_id
                                                )
                                        )
                                        .map(
                                            allocation => (

                                                <option
                                                    key={
                                                        allocation.student_id
                                                    }
                                                    value={
                                                        allocation.student_id
                                                    }
                                                >

                                                    {
                                                        allocation.student_name
                                                    }

                                                    {" — "}

                                                    {
                                                        allocation.admission_number
                                                    }

                                                </option>

                                            )
                                        )}

                                </select>

                            </FormField>


                            <FormField
                                label="Academic Year"
                                required
                            >

                                <select
                                    value={
                                        incidentForm.academic_year_id
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                academic_year_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Academic Year
                                    </option>

                                    {academicYears.map(
                                        year => (

                                            <option
                                                key={
                                                    year.id
                                                }
                                                value={
                                                    year.id
                                                }
                                            >

                                                {
                                                    year.year_name
                                                }

                                                {year.term
                                                    ? ` — ${year.term}`
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Incident Date"
                                required
                            >

                                <input
                                    type="date"
                                    value={
                                        incidentForm.incident_date
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                incident_date:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                />

                            </FormField>


                            <FormField
                                label="Incident Type"
                                required
                            >

                                <select
                                    value={
                                        incidentForm.incident_type
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                incident_type:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    {INCIDENT_TYPES.map(
                                        type => (

                                            <option
                                                key={
                                                    type
                                                }
                                                value={
                                                    type
                                                }
                                            >

                                                {
                                                    type
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Severity"
                                required
                            >

                                <select
                                    value={
                                        incidentForm.severity
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                severity:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    {INCIDENT_SEVERITIES.map(
                                        severity => (

                                            <option
                                                key={
                                                    severity
                                                }
                                                value={
                                                    severity
                                                }
                                            >

                                                {
                                                    severity.toUpperCase()
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Status"
                                required
                            >

                                <select
                                    value={
                                        incidentForm.status
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                status:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    {INCIDENT_STATUSES.map(
                                        status => (

                                            <option
                                                key={
                                                    status
                                                }
                                                value={
                                                    status
                                                }
                                            >

                                                {
                                                    status
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Title"
                                required
                            >

                                <input
                                    value={
                                        incidentForm.title
                                    }
                                    onChange={event =>
                                        setIncidentForm(
                                            previous => ({
                                                ...previous,
                                                title:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    placeholder="e.g. Student fight in dormitory"
                                    required
                                />

                            </FormField>

                        </div>


                        <FormField label="Description">

                            <textarea
                                value={
                                    incidentForm.description
                                }
                                onChange={event =>
                                    setIncidentForm(
                                        previous => ({
                                            ...previous,
                                            description:
                                                event.target.value
                                        })
                                    )
                                }
                                rows="4"
                                className="form-input"
                                placeholder="Explain what happened..."
                            />

                        </FormField>


                        <FormField label="Action Taken">

                            <textarea
                                value={
                                    incidentForm.action_taken
                                }
                                onChange={event =>
                                    setIncidentForm(
                                        previous => ({
                                            ...previous,
                                            action_taken:
                                                event.target.value
                                        })
                                    )
                                }
                                rows="3"
                                className="form-input"
                                placeholder="Action taken by Patron, Matron or management..."
                            />

                        </FormField>


                        <ModalActions
                            onCancel={() =>
                                setShowIncidentModal(
                                    false
                                )
                            }
                            saving={saving}
                            saveText={
                                editingIncident
                                    ? "Save Changes"
                                    : "Record Incident"
                            }
                        />

                    </form>

                </Modal>

            )}


            {/* =================================================
                OUTPASS MODAL
            ================================================= */}

            {showOutpassModal && (

                <Modal
                    title={
                        editingOutpass
                            ? "Edit Out Pass"
                            : "New Student Out Pass"
                    }
                    onClose={() =>
                        setShowOutpassModal(
                            false
                        )
                    }
                >

                    <form
                        onSubmit={
                            saveOutpass
                        }
                        className="space-y-5"
                    >

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <FormField
                                label="Dormitory"
                                required
                            >

                                <select
                                    value={
                                        outpassForm.dormitory_id
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                dormitory_id:
                                                    event.target.value,
                                                student_id:
                                                    ""
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Dormitory
                                    </option>

                                    {visibleDormitories.map(
                                        dormitory => (

                                            <option
                                                key={
                                                    dormitory.id
                                                }
                                                value={
                                                    dormitory.id
                                                }
                                            >

                                                {
                                                    dormitory.name
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Student"
                                required
                            >

                                <select
                                    value={
                                        outpassForm.student_id
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                student_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Student
                                    </option>

                                    {decoratedAllocations
                                        .filter(
                                            allocation =>
                                                String(
                                                    allocation.dormitory_id
                                                ) ===
                                                String(
                                                    outpassForm.dormitory_id
                                                )
                                        )
                                        .map(
                                            allocation => (

                                                <option
                                                    key={
                                                        allocation.student_id
                                                    }
                                                    value={
                                                        allocation.student_id
                                                    }
                                                >

                                                    {
                                                        allocation.student_name
                                                    }

                                                    {" — "}

                                                    {
                                                        allocation.admission_number
                                                    }

                                                </option>

                                            )
                                        )}

                                </select>

                            </FormField>


                            <FormField
                                label="Academic Year"
                                required
                            >

                                <select
                                    value={
                                        outpassForm.academic_year_id
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                academic_year_id:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                >

                                    <option value="">
                                        Select Academic Year
                                    </option>

                                    {academicYears.map(
                                        year => (

                                            <option
                                                key={
                                                    year.id
                                                }
                                                value={
                                                    year.id
                                                }
                                            >

                                                {
                                                    year.year_name
                                                }

                                                {year.term
                                                    ? ` — ${year.term}`
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>


                            <FormField
                                label="Request Date"
                                required
                            >

                                <input
                                    type="date"
                                    value={
                                        outpassForm.request_date
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                request_date:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                />

                            </FormField>


                            <FormField
                                label="Leave From"
                                required
                            >

                                <input
                                    type="datetime-local"
                                    value={
                                        outpassForm.leave_from
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                leave_from:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                />

                            </FormField>


                            <FormField
                                label="Expected Return"
                                required
                            >

                                <input
                                    type="datetime-local"
                                    value={
                                        outpassForm.expected_return
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                expected_return:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    required
                                />

                            </FormField>


                            <FormField
                                label="Destination"
                                required
                            >

                                <input
                                    value={
                                        outpassForm.destination
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                destination:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    placeholder="e.g. Arusha town"
                                    required
                                />

                            </FormField>


                            <FormField
                                label="Guardian Name"
                            >

                                <input
                                    value={
                                        outpassForm.guardian_name
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                guardian_name:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    placeholder="Guardian / parent name"
                                />

                            </FormField>


                            <FormField
                                label="Guardian Phone"
                            >

                                <input
                                    value={
                                        outpassForm.guardian_phone
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                guardian_phone:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                    placeholder="+255..."
                                />

                            </FormField>


                            <FormField
                                label="Status"
                                required
                            >

                                <select
                                    value={
                                        outpassForm.status
                                    }
                                    onChange={event =>
                                        setOutpassForm(
                                            previous => ({
                                                ...previous,
                                                status:
                                                    event.target.value
                                            })
                                        )
                                    }
                                    className="form-input"
                                >

                                    {OUTPASS_STATUSES.map(
                                        status => (

                                            <option
                                                key={
                                                    status
                                                }
                                                value={
                                                    status
                                                }
                                            >

                                                {
                                                    status
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </FormField>

                        </div>


                        <FormField
                            label="Reason"
                            required
                        >

                            <textarea
                                value={
                                    outpassForm.reason
                                }
                                onChange={event =>
                                    setOutpassForm(
                                        previous => ({
                                            ...previous,
                                            reason:
                                                event.target.value
                                        })
                                    )
                                }
                                rows="3"
                                className="form-input"
                                placeholder="Reason for leaving school..."
                                required
                            />

                        </FormField>


                        <FormField label="Notes">

                            <textarea
                                value={
                                    outpassForm.notes
                                }
                                onChange={event =>
                                    setOutpassForm(
                                        previous => ({
                                            ...previous,
                                            notes:
                                                event.target.value
                                        })
                                    )
                                }
                                rows="3"
                                className="form-input"
                                placeholder="Additional notes..."
                            />

                        </FormField>


                        <ModalActions
                            onCancel={() =>
                                setShowOutpassModal(
                                    false
                                )
                            }
                            saving={saving}
                            saveText={
                                editingOutpass
                                    ? "Save Changes"
                                    : "Create Out Pass"
                            }
                        />

                    </form>

                </Modal>

            )}


            {/* =================================================
                STUDENT VIEW
            ================================================= */}

            {showStudentModal &&
                selectedStudent && (

                <Modal
                    title="Student Details"
                    onClose={() =>
                        setShowStudentModal(
                            false
                        )
                    }
                >

                    <div className="space-y-5">

                        <div className="flex items-center gap-4">

                            {selectedStudent.photo_url ||
                            selectedStudent.photo ? (

                                <img
                                    src={
                                        selectedStudent.photo_url ||
                                        selectedStudent.photo
                                    }
                                    alt={
                                        getStudentName(
                                            selectedStudent
                                        )
                                    }
                                    className="w-20 h-20 rounded-2xl object-cover"
                                />

                            ) : (

                                <div className="w-20 h-20 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-black">

                                    {
                                        (
                                            selectedStudent.first_name ||
                                            "S"
                                        ).charAt(0)
                                    }

                                </div>

                            )}

                            <div>

                                <h3 className="text-xl font-black">

                                    {
                                        getStudentName(
                                            selectedStudent
                                        )
                                    }

                                </h3>

                                <p className="text-sm text-slate-500">

                                    {
                                        selectedStudent.admission_number ||
                                        selectedStudent.admission_no ||
                                        "-"
                                    }

                                </p>

                            </div>

                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                            <DetailBox
                                label="Gender"
                                value={
                                    getGenderLabel(
                                        selectedStudent.gender
                                    )
                                }
                            />

                            <DetailBox
                                label="Class"
                                value={
                                    selectedStudent.class_name ||
                                    "-"
                                }
                            />

                            <DetailBox
                                label="Stream"
                                value={
                                    selectedStudent.stream ||
                                    "-"
                                }
                            />

                            <DetailBox
                                label="Phone"
                                value={
                                    selectedStudent.phone ||
                                    "-"
                                }
                            />

                            <DetailBox
                                label="Parent"
                                value={
                                    selectedStudent.parent_name ||
                                    "-"
                                }
                            />

                            <DetailBox
                                label="Parent Phone"
                                value={
                                    selectedStudent.parent_phone ||
                                    "-"
                                }
                            />

                        </div>


                        {(() => {

                            const allocation =
                                decoratedAllocations.find(
                                    item =>
                                        String(
                                            item.student_id
                                        ) ===
                                        String(
                                            selectedStudent.id
                                        )
                                );

                            if (!allocation) {
                                return null;
                            }

                            return (

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                                    <DetailBox
                                        label="Dormitory"
                                        value={
                                            allocation.dormitory?.name ||
                                            "-"
                                        }
                                    />

                                    <DetailBox
                                        label="Bed"
                                        value={
                                            allocation.bed?.bed_number ||
                                            "-"
                                        }
                                    />

                                    <DetailBox
                                        label="Academic Year"
                                        value={
                                            academicYears.find(
                                                year =>
                                                    String(
                                                        year.id
                                                    ) ===
                                                    String(
                                                        allocation.academic_year_id
                                                    )
                                            )?.year_name ||
                                            "-"
                                        }
                                    />

                                </div>

                            );

                        })()}


                    </div>

                </Modal>

            )}

        </div>

    );

}


// =====================================================
// COMPONENTS
// =====================================================

function StatCard({
    icon,
    title,
    value
}) {

    return (

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">

            <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">

                    {icon}

                </div>

                <div>

                    <div className="text-xs uppercase font-black text-slate-400">

                        {title}

                    </div>

                    <div className="text-2xl font-black text-slate-800">

                        {value}

                    </div>

                </div>

            </div>

        </div>

    );

}


function SectionButton({
    active,
    onClick,
    icon,
    label
}) {

    return (

        <button
            type="button"
            onClick={onClick}
            className={
                active
                    ? "px-4 py-3 rounded-xl bg-blue-600 text-white font-black flex items-center gap-2"
                    : "px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 font-bold flex items-center gap-2"
            }
        >

            {icon}

            {label}

        </button>

    );

}


function IconButton({
    children,
    onClick,
    title,
    danger,
    blue
}) {

    return (

        <button
            type="button"
            title={title}
            onClick={onClick}
            className={
                danger
                    ? "w-9 h-9 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"
                    : blue
                        ? "w-9 h-9 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center"
                        : "w-9 h-9 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
            }
        >

            {children}

        </button>

    );

}


function MiniStat({
    label,
    value
}) {

    return (

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">

            <div className="font-black text-lg">

                {value}

            </div>

            <div className="text-[10px] uppercase font-black text-slate-400">

                {label}

            </div>

        </div>

    );

}


function Badge({
    children,
    green
}) {

    return (

        <span
            className={
                green
                    ? "inline-flex px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-black"
                    : "inline-flex px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-black"
            }
        >

            {children}

        </span>

    );

}


function SeverityBadge({
    severity
}) {

    const classes = {

        low:
            "bg-green-100 text-green-700",

        medium:
            "bg-yellow-100 text-yellow-700",

        high:
            "bg-orange-100 text-orange-700",

        critical:
            "bg-red-100 text-red-700"

    };


    return (

        <span
            className={
                `inline-flex px-3 py-1.5 rounded-lg text-xs font-black ${
                    classes[
                        severity
                    ] ||
                    "bg-slate-100 text-slate-600"
                }`
            }
        >

            {
                String(
                    severity ||
                    ""
                ).toUpperCase()
            }

        </span>

    );

}


function Th({
    children,
    right
}) {

    return (

        <th
            className={
                right
                    ? "px-5 py-4 text-right text-xs uppercase font-black text-slate-500"
                    : "px-5 py-4 text-left text-xs uppercase font-black text-slate-500"
            }
        >

            {children}

        </th>

    );

}


function FormField({
    label,
    required,
    children
}) {

    return (

        <label className="block">

            <span className="block text-sm font-black text-slate-700 mb-2">

                {label}

                {required && (
                    <span className="text-red-500">
                        {" "}*
                    </span>
                )}

            </span>

            {children}

        </label>

    );

}


function DetailBox({
    label,
    value
}) {

    return (

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">

            <div className="text-[10px] uppercase font-black text-slate-400">

                {label}

            </div>

            <div className="mt-1 font-bold text-slate-700">

                {value}

            </div>

        </div>

    );

}


function EmptyState({
    icon,
    title,
    text,
    action
}) {

    return (

        <div className="p-12 text-center">

            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl">

                {icon}

            </div>

            <h3 className="mt-4 font-black text-slate-800">

                {title}

            </h3>

            <p className="mt-2 text-sm text-slate-500">

                {text}

            </p>

            {action && (

                <div className="mt-5">

                    {action}

                </div>

            )}

        </div>

    );

}


function PersonList({
    title,
    subtitle,
    people,
    icon
}) {

    return (

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="p-5 border-b">

                <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">

                        {icon}

                    </div>

                    <div>

                        <h2 className="text-xl font-black">

                            {title}

                        </h2>

                        <p className="text-sm text-slate-500">

                            {subtitle}

                        </p>

                    </div>

                </div>

            </div>


            {people.length ===
            0 ? (

                <EmptyState
                    icon={icon}
                    title="No staff found"
                    text="No active staff member with this role was found."
                />

            ) : (

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">

                    {people.map(
                        person => (

                            <div
                                key={
                                    person.id
                                }
                                className="border border-slate-200 rounded-2xl p-4"
                            >

                                <div className="flex items-center gap-3">

                                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-600">

                                        {
                                            (
                                                person.full_name ||
                                                "P"
                                            ).charAt(0)
                                        }

                                    </div>

                                    <div>

                                        <div className="font-black">

                                            {
                                                person.full_name
                                            }

                                        </div>

                                        <div className="text-sm text-slate-500">

                                            {
                                                person.phone ||
                                                "No phone"
                                            }

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )
                    )}

                </div>

            )}

        </div>

    );

}


function Modal({
    title,
    onClose,
    children
}) {

    return (

        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">

                <div className="sticky top-0 z-20 bg-white border-b px-5 py-4 flex justify-between items-center">

                    <h2 className="text-xl font-black text-slate-800">

                        {title}

                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"
                    >

                        <FaTimes />

                    </button>

                </div>

                <div className="p-5">

                    {children}

                </div>

            </div>

        </div>

    );

}


function ModalActions({
    onCancel,
    saving,
    saveText
}) {

    return (

        <div className="flex justify-end gap-3 pt-4 border-t">

            <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-black"
            >

                Cancel

            </button>

            <button
                type="submit"
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-blue-600 text-white font-black flex items-center gap-2"
            >

                {saving ? (
                    <FaSpinner className="animate-spin" />
                ) : (
                    <FaSave />
                )}

                {saveText}

            </button>

        </div>

    );

}