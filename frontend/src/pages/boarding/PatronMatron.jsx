import React, {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import {
    FaUsers,
    FaUserTie,
    FaFemale,
    FaHome,
    FaBed,
    FaClipboardCheck,
    FaExclamationTriangle,
    FaSignOutAlt,
    FaChartBar,
    FaSearch,
    FaSyncAlt,
    FaEye,
    FaTimes,
    FaArrowRight,
    FaSpinner,
    FaBuilding,
    FaUserCheck,
    FaUserClock,
    FaInfoCircle,
    FaPlus,
    FaEdit,
    FaSave,
    FaUserPlus,
    FaCheckCircle
} from "react-icons/fa";

import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";


/* =========================================================
   ROLES
========================================================= */

const ROLE_MATRON = 14;
const ROLE_PATRON = 15;


/* =========================================================
   HELPERS
========================================================= */

const safeNumber = value => {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

};


const getStudentName = student => {

    if (!student) {
        return "Unknown Student";
    }

    return [
        student.first_name,
        student.middle_name,
        student.last_name
    ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Unknown Student";

};


const getStudentAdmission = student => {

    return (
        student?.admission_number ||
        student?.admission_no ||
        "—"
    );

};


const getStaffName = profile => {

    return (
        profile?.full_name ||
        "Unnamed Staff"
    );

};


const getRoleName = profile => {

    const roleId =
        Number(profile?.role_id);

    if (roleId === ROLE_PATRON) {
        return "Patron";
    }

    if (roleId === ROLE_MATRON) {
        return "Matron";
    }

    return (
        profile?.roles?.role_name ||
        "Staff"
    );

};


const normalizeSearch = value => {

    return String(value || "")
        .toLowerCase()
        .trim();

};


/* =========================================================
   MAIN COMPONENT
========================================================= */

function PatronMatron() {

    const {
        schoolId,
        schoolName,
        showSchoolName
    } = useSchool();

    const {
        selectedRoleId,
        selectedRoleName
    } = useRole();


    /* =====================================================
       UI
    ===================================================== */

    const [activeTab, setActiveTab] =
        useState("dormitories");

    const [search, setSearch] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");


    /* =====================================================
       MODALS
    ===================================================== */

    const [showDormitoryModal, setShowDormitoryModal] =
        useState(false);

    const [showAssignModal, setShowAssignModal] =
        useState(false);

    const [selectedDormitory, setSelectedDormitory] =
        useState(null);

    const [selectedStaff, setSelectedStaff] =
        useState(null);

    const [selectedStudent, setSelectedStudent] =
        useState(null);


    /* =====================================================
       FORM
    ===================================================== */

    const emptyDormitoryForm = {

        name: "",

        gender: "Male",

        capacity: "",

        status: "Active"

    };


    const [dormitoryForm, setDormitoryForm] =
        useState(
            emptyDormitoryForm
        );


    const [selectedStudentIds, setSelectedStudentIds] =
        useState([]);


    /* =====================================================
       DATA
    ===================================================== */

    const [profiles, setProfiles] =
        useState([]);

    const [dormitories, setDormitories] =
        useState([]);

    const [dormitoryStudents, setDormitoryStudents] =
        useState([]);

    const [students, setStudents] =
        useState([]);

    const [activeAcademicYear, setActiveAcademicYear] =
        useState(null);


    /* =====================================================
       CLEAR MESSAGES
    ===================================================== */

    useEffect(() => {

        if (!success) {
            return;
        }

        const timer =
            setTimeout(
                () => setSuccess(""),
                4000
            );

        return () => clearTimeout(timer);

    }, [success]);


    /* =====================================================
       LOAD ACTIVE ACADEMIC YEAR
    ===================================================== */

    const loadActiveAcademicYear =
        useCallback(
            async () => {

                let query =
                    supabase
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
                            "is_active",
                            true
                        )
                        .order(
                            "id",
                            {
                                ascending: false
                            }
                        )
                        .limit(1);


                if (
                    schoolId !== null &&
                    schoolId !== undefined &&
                    schoolId !== ""
                ) {

                    query =
                        query.or(
                            `school_id.eq.${schoolId},school_id.is.null`
                        );

                }


                const {
                    data,
                    error
                } = await query;


                if (error) {
                    throw error;
                }


                const year =
                    data?.[0] || null;


                setActiveAcademicYear(
                    year
                );


                return year;

            },
            [
                schoolId
            ]
        );


    /* =====================================================
       LOAD STAFF
    ===================================================== */

    const loadStaff =
        useCallback(
            async () => {

                let query =
                    supabase
                        .from("profiles")
                        .select(`
                            id,
                            full_name,
                            phone,
                            role_id,
                            school_id,
                            teacher_id,
                            employee_id,
                            roles (
                                id,
                                role_name
                            )
                        `)
                        .order(
                            "full_name",
                            {
                                ascending: true
                            }
                        );


                if (
                    schoolId !== null &&
                    schoolId !== undefined &&
                    schoolId !== ""
                ) {

                    query =
                        query.eq(
                            "school_id",
                            schoolId
                        );

                }


                const {
                    data,
                    error
                } = await query;


                if (error) {
                    throw error;
                }


                const staff =
                    (data || [])
                        .filter(profile => {

                            const roleId =
                                Number(
                                    profile?.role_id
                                );

                            return (
                                roleId === ROLE_PATRON ||
                                roleId === ROLE_MATRON
                            );

                        });


                setProfiles(
                    staff
                );

            },
            [
                schoolId
            ]
        );


    /* =====================================================
       LOAD DORMITORIES
    ===================================================== */

    const loadDormitories =
        useCallback(
            async yearId => {

                if (!yearId) {

                    setDormitories([]);

                    return;

                }


                let query =
                    supabase
                        .from("dormitories")
                        .select(`
                            id,
                            school_id,
                            academic_year_id,
                            name,
                            gender,
                            capacity,
                            status,
                            leader_student_id,
                            created_by,
                            created_at
                        `)
                        .eq(
                            "academic_year_id",
                            yearId
                        )
                        .order(
                            "name",
                            {
                                ascending: true
                            }
                        );


                if (
                    schoolId !== null &&
                    schoolId !== undefined &&
                    schoolId !== ""
                ) {

                    query =
                        query.eq(
                            "school_id",
                            schoolId
                        );

                }


                const {
                    data,
                    error
                } = await query;


                if (error) {
                    throw error;
                }


                setDormitories(
                    data || []
                );

            },
            [
                schoolId
            ]
        );


    /* =====================================================
       LOAD DORMITORY STUDENTS
    ===================================================== */

    const loadDormitoryStudents =
        useCallback(
            async yearId => {

                if (!yearId) {

                    setDormitoryStudents([]);

                    return;

                }


                let query =
                    supabase
                        .from("dormitory_students")
                        .select(`
                            id,
                            dormitory_id,
                            student_id,
                            school_id,
                            academic_year_id,
                            assigned_at,
                            assigned_by
                        `)
                        .eq(
                            "academic_year_id",
                            yearId
                        )
                        .order(
                            "assigned_at",
                            {
                                ascending: false
                            }
                        );


                if (
                    schoolId !== null &&
                    schoolId !== undefined &&
                    schoolId !== ""
                ) {

                    query =
                        query.eq(
                            "school_id",
                            schoolId
                        );

                }


                const {
                    data,
                    error
                } = await query;


                if (error) {
                    throw error;
                }


                setDormitoryStudents(
                    data || []
                );

            },
            [
                schoolId
            ]
        );


    /* =====================================================
       LOAD STUDENTS
    ===================================================== */

    const loadStudents =
        useCallback(
            async yearId => {

                let query =
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
                            photo,
                            photo_url,
                            parent_name,
                            parent_phone,
                            parent_email
                        `)
                        .order(
                            "first_name",
                            {
                                ascending: true
                            }
                        );


                if (
                    schoolId !== null &&
                    schoolId !== undefined &&
                    schoolId !== ""
                ) {

                    query =
                        query.eq(
                            "school_id",
                            schoolId
                        );

                }


                if (yearId) {

                    query =
                        query.eq(
                            "academic_year_id",
                            yearId
                        );

                }


                const {
                    data,
                    error
                } = await query;


                if (error) {
                    throw error;
                }


                setStudents(
                    data || []
                );

            },
            [
                schoolId
            ]
        );


    /* =====================================================
       LOAD EVERYTHING
    ===================================================== */

    const loadData =
        useCallback(
            async (
                showMainLoader = true
            ) => {

                try {

                    if (
                        showMainLoader
                    ) {

                        setLoading(
                            true
                        );

                    } else {

                        setRefreshing(
                            true
                        );

                    }


                    setError("");


                    const year =
                        await loadActiveAcademicYear();


                    await Promise.all([
                        loadStaff(),
                        loadDormitories(
                            year?.id
                        ),
                        loadDormitoryStudents(
                            year?.id
                        ),
                        loadStudents(
                            year?.id
                        )
                    ]);


                } catch (err) {

                    console.error(
                        "PATRON MATRON LOAD ERROR:",
                        err
                    );


                    setError(
                        err?.message ||
                        "Imeshindikana kupakia taarifa za Patron, Matron na Dormitory."
                    );


                } finally {

                    setLoading(
                        false
                    );

                    setRefreshing(
                        false
                    );

                }

            },
            [
                loadActiveAcademicYear,
                loadStaff,
                loadDormitories,
                loadDormitoryStudents,
                loadStudents
            ]
        );


    useEffect(
        () => {

            loadData(
                true
            );

        },
        [
            loadData
        ]
    );


    /* =====================================================
       COUNTS
    ===================================================== */

    const patrons =
        useMemo(
            () =>
                profiles.filter(
                    profile =>
                        Number(
                            profile?.role_id
                        ) === ROLE_PATRON
                ),
            [
                profiles
            ]
        );


    const matrons =
        useMemo(
            () =>
                profiles.filter(
                    profile =>
                        Number(
                            profile?.role_id
                        ) === ROLE_MATRON
                ),
            [
                profiles
            ]
        );


    const boardingStudentIds =
        useMemo(
            () =>
                new Set(
                    dormitoryStudents.map(
                        item =>
                            String(
                                item.student_id
                            )
                    )
                ),
            [
                dormitoryStudents
            ]
        );


    const boardingStudents =
        useMemo(
            () =>
                students.filter(
                    student =>
                        boardingStudentIds.has(
                            String(
                                student.id
                            )
                        )
                ),
            [
                students,
                boardingStudentIds
            ]
        );


    /* =====================================================
       DORMITORY STATS
    ===================================================== */

    const dormitoryStats =
        useMemo(
            () => {

                return dormitories.map(
                    dormitory => {

                        const occupied =
                            dormitoryStudents.filter(
                                item =>
                                    Number(
                                        item.dormitory_id
                                    ) ===
                                    Number(
                                        dormitory.id
                                    )
                            ).length;


                        const capacity =
                            safeNumber(
                                dormitory.capacity
                            );


                        const percentage =
                            capacity > 0
                                ? Math.min(
                                    100,
                                    Math.round(
                                        (
                                            occupied /
                                            capacity
                                        ) *
                                        100
                                    )
                                )
                                : 0;


                        return {
                            ...dormitory,
                            occupied,
                            percentage,
                            remaining:
                                Math.max(
                                    0,
                                    capacity -
                                    occupied
                                )
                        };

                    }
                );

            },
            [
                dormitories,
                dormitoryStudents
            ]
        );


    const totalCapacity =
        useMemo(
            () =>
                dormitories.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        safeNumber(
                            item.capacity
                        ),
                    0
                ),
            [
                dormitories
            ]
        );


    const totalOccupied =
        dormitoryStudents.length;


    const availableBeds =
        Math.max(
            0,
            totalCapacity -
            totalOccupied
        );


    /* =====================================================
       FILTER
    ===================================================== */

    const filteredDormitories =
        useMemo(
            () => {

                const term =
                    normalizeSearch(
                        search
                    );


                if (!term) {
                    return dormitoryStats;
                }


                return dormitoryStats.filter(
                    dormitory => {

                        return (
                            normalizeSearch(
                                dormitory.name
                            ).includes(
                                term
                            ) ||
                            normalizeSearch(
                                dormitory.gender
                            ).includes(
                                term
                            ) ||
                            normalizeSearch(
                                dormitory.status
                            ).includes(
                                term
                            )
                        );

                    }
                );

            },
            [
                dormitoryStats,
                search
            ]
        );


    /* =====================================================
       STUDENTS NOT ASSIGNED TO A DORMITORY
    ===================================================== */

    const availableStudents =
        useMemo(
            () => {

                const currentDormStudentIds =
                    new Set(
                        dormitoryStudents
                            .filter(
                                item =>
                                    Number(
                                        item.dormitory_id
                                    ) !==
                                    Number(
                                        selectedDormitory?.id
                                    )
                            )
                            .map(
                                item =>
                                    String(
                                        item.student_id
                                    )
                            )
                    );


                return students.filter(
                    student =>
                        !currentDormStudentIds.has(
                            String(
                                student.id
                            )
                        )
                );

            },
            [
                students,
                dormitoryStudents,
                selectedDormitory
            ]
        );


    /* =====================================================
       OPEN CREATE DORMITORY
    ===================================================== */

    const openCreateDormitory =
        () => {

            setSelectedDormitory(
                null
            );

            setDormitoryForm(
                emptyDormitoryForm
            );

            setError("");

            setShowDormitoryModal(
                true
            );

        };


    /* =====================================================
       OPEN EDIT DORMITORY
    ===================================================== */

    const openEditDormitory =
        dormitory => {

            setSelectedDormitory(
                dormitory
            );

            setDormitoryForm({

                name:
                    dormitory?.name ||
                    "",

                gender:
                    dormitory?.gender ||
                    "Male",

                capacity:
                    dormitory?.capacity ??
                    "",

                status:
                    dormitory?.status ||
                    "Active"

            });

            setError("");

            setShowDormitoryModal(
                true
            );

        };


    /* =====================================================
       SAVE DORMITORY
    ===================================================== */

    const saveDormitory =
        async event => {

            event.preventDefault();


            if (
                !dormitoryForm.name.trim()
            ) {

                setError(
                    "Weka jina la dormitory."
                );

                return;

            }


            const capacity =
                Number(
                    dormitoryForm.capacity
                );


            if (
                !Number.isInteger(
                    capacity
                ) ||
                capacity <= 0
            ) {

                setError(
                    "Capacity lazima iwe namba kubwa kuliko 0."
                );

                return;

            }


            if (
                !activeAcademicYear?.id
            ) {

                setError(
                    "Hakuna active academic year iliyopatikana."
                );

                return;

            }


            if (
                !schoolId
            ) {

                setError(
                    "School ID haijapatikana."
                );

                return;

            }


            try {

                setSaving(
                    true
                );

                setError("");


                if (
                    selectedDormitory
                ) {

                    const {
                        error
                    } =
                        await supabase
                            .from("dormitories")
                            .update({

                                name:
                                    dormitoryForm.name.trim(),

                                gender:
                                    dormitoryForm.gender,

                                capacity:
                                    capacity,

                                status:
                                    dormitoryForm.status

                            })
                            .eq(
                                "id",
                                selectedDormitory.id
                            )
                            .eq(
                                "school_id",
                                schoolId
                            );


                    if (error) {
                        throw error;
                    }


                    setSuccess(
                        "Dormitory imehaririwa kikamilifu."
                    );

                } else {

                    const {
                        data: {
                            user
                        }
                    } =
                        await supabase.auth.getUser();


                    const {
                        error
                    } =
                        await supabase
                            .from("dormitories")
                            .insert({

                                school_id:
                                    schoolId,

                                academic_year_id:
                                    activeAcademicYear.id,

                                name:
                                    dormitoryForm.name.trim(),

                                gender:
                                    dormitoryForm.gender,

                                capacity:
                                    capacity,

                                status:
                                    dormitoryForm.status,

                                created_by:
                                    user?.id ||
                                    null

                            });


                    if (error) {
                        throw error;
                    }


                    setSuccess(
                        "Dormitory mpya imeundwa kikamilifu."
                    );

                }


                setShowDormitoryModal(
                    false
                );

                setSelectedDormitory(
                    null
                );


                await loadData(
                    false
                );


            } catch (err) {

                console.error(
                    "SAVE DORMITORY ERROR:",
                    err
                );


                setError(
                    err?.message ||
                    "Imeshindikana kuhifadhi dormitory."
                );

            } finally {

                setSaving(
                    false
                );

            }

        };


    /* =====================================================
       OPEN ASSIGN STUDENTS
    ===================================================== */

    const openAssignStudents =
        dormitory => {

            setSelectedDormitory(
                dormitory
            );

            setSelectedStudentIds(
                []
            );

            setError("");

            setShowAssignModal(
                true
            );

        };


    /* =====================================================
       TOGGLE STUDENT
    ===================================================== */

    const toggleStudent =
        studentId => {

            setSelectedStudentIds(
                previous => {

                    const id =
                        String(
                            studentId
                        );


                    if (
                        previous.includes(
                            id
                        )
                    ) {

                        return previous.filter(
                            item =>
                                item !== id
                        );

                    }


                    return [
                        ...previous,
                        id
                    ];

                }
            );

        };


    /* =====================================================
       ASSIGN STUDENTS
    ===================================================== */

    const assignStudents =
        async event => {

            event.preventDefault();


            if (
                !selectedDormitory
            ) {

                setError(
                    "Chagua dormitory."
                );

                return;

            }


            if (
                selectedStudentIds.length ===
                0
            ) {

                setError(
                    "Chagua angalau student mmoja."
                );

                return;

            }


            const occupied =
                dormitoryStudents.filter(
                    item =>
                        Number(
                            item.dormitory_id
                        ) ===
                        Number(
                            selectedDormitory.id
                        )
                ).length;


            const capacity =
                safeNumber(
                    selectedDormitory.capacity
                );


            if (
                occupied +
                selectedStudentIds.length >
                capacity
            ) {

                setError(
                    `Dormitory ina nafasi ${Math.max(
                        0,
                        capacity - occupied
                    )} tu.`
                );

                return;

            }


            if (
                !activeAcademicYear?.id
            ) {

                setError(
                    "Active academic year haijapatikana."
                );

                return;

            }


            try {

                setSaving(
                    true
                );

                setError("");


                const {
                    data: {
                        user
                    }
                } =
                    await supabase.auth.getUser();


                const rows =
                    selectedStudentIds.map(
                        studentId => ({

                            dormitory_id:
                                selectedDormitory.id,

                            student_id:
                                Number(
                                    studentId
                                ),

                            school_id:
                                schoolId,

                            academic_year_id:
                                activeAcademicYear.id,

                            assigned_by:
                                user?.id ||
                                null

                        })
                    );


                const {
                    error
                } =
                    await supabase
                        .from(
                            "dormitory_students"
                        )
                        .insert(
                            rows
                        );


                if (error) {
                    throw error;
                }


                setSuccess(
                    `${selectedStudentIds.length} student(s) assigned kwenye ${selectedDormitory.name}.`
                );


                setShowAssignModal(
                    false
                );

                setSelectedStudentIds(
                    []
                );


                await loadData(
                    false
                );


            } catch (err) {

                console.error(
                    "ASSIGN STUDENTS ERROR:",
                    err
                );


                setError(
                    err?.code === "23505"
                        ? "Baadhi ya students tayari wamepewa dormitory."
                        : (
                            err?.message ||
                            "Imeshindikana ku-assign students."
                        )
                );

            } finally {

                setSaving(
                    false
                );

            }

        };


    /* =====================================================
       REMOVE STUDENT FROM DORMITORY
    ===================================================== */

    const removeStudent =
        async assignment => {

            const confirmed =
                window.confirm(
                    "Una uhakika unataka kumuondoa student huyu kwenye dormitory?"
                );


            if (!confirmed) {
                return;
            }


            try {

                setSaving(
                    true
                );

                setError("");


                const {
                    error
                } =
                    await supabase
                        .from(
                            "dormitory_students"
                        )
                        .delete()
                        .eq(
                            "id",
                            assignment.id
                        );


                if (error) {
                    throw error;
                }


                setSuccess(
                    "Student ameondolewa kwenye dormitory."
                );


                await loadData(
                    false
                );


            } catch (err) {

                console.error(
                    "REMOVE STUDENT ERROR:",
                    err
                );


                setError(
                    err?.message ||
                    "Imeshindikana kumuondoa student."
                );

            } finally {

                setSaving(
                    false
                );

            }

        };


    /* =====================================================
       STAFF
    ===================================================== */

    const staffCount =
        profiles.length;


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        return (

            <div className="min-h-screen bg-slate-50 flex items-center justify-center">

                <div className="text-center">

                    <FaSpinner
                        className="animate-spin text-blue-600 text-4xl mx-auto mb-4"
                    />

                    <p className="text-slate-600 font-medium">

                        Loading Patron, Matron & Dormitory Management...

                    </p>

                </div>

            </div>

        );

    }


    /* =====================================================
       MAIN UI
    ===================================================== */

    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            {/* HEADER */}

            <div className="mb-6">

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                    <div>

                        <div className="flex items-center gap-3">

                            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow">

                                <FaHome />

                            </div>

                            <div>

                                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">

                                    Patron & Matron Management

                                </h1>

                                <p className="text-sm text-slate-500">

                                    {showSchoolName &&
                                    schoolName
                                        ? schoolName
                                        : "AfriCore ERP"}

                                    {" • "}

                                    {activeAcademicYear
                                        ? `${activeAcademicYear.year_name} - ${activeAcademicYear.term}`
                                        : "No active academic year"}

                                </p>

                            </div>

                        </div>

                    </div>


                    <button
                        type="button"
                        onClick={() =>
                            loadData(false)
                        }
                        disabled={refreshing}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-60"
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


            {/* SUCCESS */}

            {success && (

                <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">

                    <FaCheckCircle className="text-green-600" />

                    <p className="text-sm font-medium text-green-800">

                        {success}

                    </p>

                </div>

            )}


            {/* ERROR */}

            {error && (

                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">

                    <FaExclamationTriangle className="text-red-600 mt-1" />

                    <div className="flex-1">

                        <p className="font-semibold text-red-800">

                            Error

                        </p>

                        <p className="text-sm text-red-700 mt-1">

                            {error}

                        </p>

                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            setError("")
                        }
                        className="text-red-500"
                    >

                        <FaTimes />

                    </button>

                </div>

            )}


            {/* SUMMARY */}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">

                <SummaryCard
                    icon={FaUsers}
                    title="Supervisors"
                    value={staffCount}
                    subtitle="Patron & Matron"
                />

                <SummaryCard
                    icon={FaUserTie}
                    title="Patrons"
                    value={patrons.length}
                    subtitle="Role 15"
                />

                <SummaryCard
                    icon={FaFemale}
                    title="Matrons"
                    value={matrons.length}
                    subtitle="Role 14"
                />

                <SummaryCard
                    icon={FaHome}
                    title="Dormitories"
                    value={dormitories.length}
                    subtitle="This academic year"
                />

                <SummaryCard
                    icon={FaBed}
                    title="Boarding Students"
                    value={boardingStudents.length}
                    subtitle="Assigned"
                />

                <SummaryCard
                    icon={FaUserClock}
                    title="Available Beds"
                    value={availableBeds}
                    subtitle="Remaining capacity"
                />

            </div>


            {/* TABS */}

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6 overflow-x-auto">

                <div className="flex min-w-max">

                    <TabButton
                        active={
                            activeTab ===
                            "dormitories"
                        }
                        onClick={() =>
                            setActiveTab(
                                "dormitories"
                            )
                        }
                        icon={FaHome}
                        label="Dormitories"
                    />

                    <TabButton
                        active={
                            activeTab ===
                            "students"
                        }
                        onClick={() =>
                            setActiveTab(
                                "students"
                            )
                        }
                        icon={FaBed}
                        label="Boarding Students"
                    />

                    <TabButton
                        active={
                            activeTab ===
                            "staff"
                        }
                        onClick={() =>
                            setActiveTab(
                                "staff"
                            )
                        }
                        icon={FaUsers}
                        label="Patron & Matron"
                    />

                    <TabButton
                        active={
                            activeTab ===
                            "rollcall"
                        }
                        onClick={() =>
                            setActiveTab(
                                "rollcall"
                            )
                        }
                        icon={FaClipboardCheck}
                        label="Roll Call"
                    />

                    <TabButton
                        active={
                            activeTab ===
                            "incidents"
                        }
                        onClick={() =>
                            setActiveTab(
                                "incidents"
                            )
                        }
                        icon={FaExclamationTriangle}
                        label="Incidents"
                    />

                    <TabButton
                        active={
                            activeTab ===
                            "leave"
                        }
                        onClick={() =>
                            setActiveTab(
                                "leave"
                            )
                        }
                        icon={FaSignOutAlt}
                        label="Leave / Out Pass"
                    />

                    <TabButton
                        active={
                            activeTab ===
                            "reports"
                        }
                        onClick={() =>
                            setActiveTab(
                                "reports"
                            )
                        }
                        icon={FaChartBar}
                        label="Reports"
                    />

                </div>

            </div>


            {/* =================================================
                DORMITORIES
            ================================================= */}

            {activeTab === "dormitories" && (

                <section>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">

                        <div className="relative w-full md:max-w-xl">

                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={search}
                                onChange={e =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Search dormitory..."
                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                        </div>


                        <button
                            type="button"
                            onClick={
                                openCreateDormitory
                            }
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm"
                        >

                            <FaPlus />

                            Add Dormitory

                        </button>

                    </div>


                    {filteredDormitories.length === 0 ? (

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">

                            <EmptyState
                                icon={FaHome}
                                title="No dormitories found"
                                message="Hakuna dormitory iliyoundwa kwenye active academic year. Bonyeza Add Dormitory kuanza."
                            />

                            <div className="pb-8 text-center">

                                <button
                                    type="button"
                                    onClick={
                                        openCreateDormitory
                                    }
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                >

                                    <FaPlus />

                                    Create First Dormitory

                                </button>

                            </div>

                        </div>

                    ) : (

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

                            {filteredDormitories.map(
                                dormitory => (

                                    <DormitoryCard
                                        key={
                                            dormitory.id
                                        }
                                        dormitory={
                                            dormitory
                                        }
                                        onView={() => {

                                            setSelectedDormitory(
                                                dormitory
                                            );

                                        }}
                                        onEdit={() =>
                                            openEditDormitory(
                                                dormitory
                                            )
                                        }
                                        onAssign={() =>
                                            openAssignStudents(
                                                dormitory
                                            )
                                        }
                                    />

                                )
                            )}

                        </div>

                    )}

                </section>

            )}


            {/* =================================================
                BOARDING STUDENTS
            ================================================= */}

            {activeTab === "students" && (

                <BoardingStudentsSection
                    students={
                        boardingStudents
                    }
                    dormitoryStudents={
                        dormitoryStudents
                    }
                    dormitories={
                        dormitories
                    }
                    search={
                        search
                    }
                    setSearch={
                        setSearch
                    }
                    onView={
                        student =>
                            setSelectedStudent(
                                student
                            )
                    }
                    onRemove={
                        removeStudent
                    }
                    saving={
                        saving
                    }
                />

            )}


            {/* =================================================
                STAFF
            ================================================= */}

            {activeTab === "staff" && (

                <StaffSection
                    profiles={
                        profiles
                    }
                    selectedStaff={
                        selectedStaff
                    }
                    setSelectedStaff={
                        setSelectedStaff
                    }
                />

            )}


            {/* =================================================
                ROLL CALL
            ================================================= */}

            {activeTab === "rollcall" && (

                <ModulePlaceholder
                    icon={
                        FaClipboardCheck
                    }
                    title="Boarding Roll Call"
                    description="Roll call ya morning/evening itajengwa juu ya boarding students na dormitories zilizopo."
                    stats={[
                        [
                            "Boarding Students",
                            boardingStudents.length
                        ],
                        [
                            "Dormitories",
                            dormitories.length
                        ]
                    ]}
                />

            )}


            {/* =================================================
                INCIDENTS
            ================================================= */}

            {activeTab === "incidents" && (

                <ModulePlaceholder
                    icon={
                        FaExclamationTriangle
                    }
                    title="Boarding Incidents"
                    description="Sehemu ya kurekodi na kufuatilia incidents za wanafunzi wa boarding."
                    stats={[
                        [
                            "Boarding Students",
                            boardingStudents.length
                        ],
                        [
                            "Supervisors",
                            profiles.length
                        ]
                    ]}
                />

            )}


            {/* =================================================
                LEAVE
            ================================================= */}

            {activeTab === "leave" && (

                <ModulePlaceholder
                    icon={
                        FaSignOutAlt
                    }
                    title="Leave / Out Pass"
                    description="Sehemu ya kusimamia ruhusa za wanafunzi kutoka boarding."
                    stats={[
                        [
                            "Boarding Students",
                            boardingStudents.length
                        ],
                        [
                            "Supervisors",
                            profiles.length
                        ]
                    ]}
                />

            )}


            {/* =================================================
                REPORTS
            ================================================= */}

            {activeTab === "reports" && (

                <ReportsSection
                    dormitoryStats={
                        dormitoryStats
                    }
                    totalCapacity={
                        totalCapacity
                    }
                    totalOccupied={
                        totalOccupied
                    }
                    availableBeds={
                        availableBeds
                    }
                    boardingStudents={
                        boardingStudents.length
                    }
                />

            )}


            {/* =================================================
                CREATE / EDIT DORMITORY MODAL
            ================================================= */}

            {showDormitoryModal && (

                <Modal
                    title={
                        selectedDormitory
                            ? "Edit Dormitory"
                            : "Create Dormitory"
                    }
                    onClose={() => {

                        if (!saving) {

                            setShowDormitoryModal(
                                false
                            );

                        }

                    }}
                >

                    <form
                        onSubmit={
                            saveDormitory
                        }
                        className="space-y-5"
                    >

                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">

                            <div className="flex gap-3">

                                <FaInfoCircle className="text-blue-600 mt-1" />

                                <div>

                                    <p className="font-semibold text-blue-800">

                                        Academic Year

                                    </p>

                                    <p className="text-sm text-blue-700 mt-1">

                                        {activeAcademicYear
                                            ? `${activeAcademicYear.year_name} - ${activeAcademicYear.term}`
                                            : "No active academic year"}

                                    </p>

                                </div>

                            </div>

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">

                                Dormitory Name

                            </label>

                            <input
                                type="text"
                                value={
                                    dormitoryForm.name
                                }
                                onChange={e =>
                                    setDormitoryForm(
                                        previous => ({
                                            ...previous,
                                            name:
                                                e.target.value
                                        })
                                    )
                                }
                                placeholder="e.g. Kilimanjaro House"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={saving}
                            />

                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">

                                    Gender

                                </label>

                                <select
                                    value={
                                        dormitoryForm.gender
                                    }
                                    onChange={e =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                gender:
                                                    e.target.value
                                            })
                                        )
                                    }
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={saving}
                                >

                                    <option value="Male">
                                        Male
                                    </option>

                                    <option value="Female">
                                        Female
                                    </option>

                                    <option value="Mixed">
                                        Mixed
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label className="block text-sm font-semibold text-slate-700 mb-2">

                                    Capacity

                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    value={
                                        dormitoryForm.capacity
                                    }
                                    onChange={e =>
                                        setDormitoryForm(
                                            previous => ({
                                                ...previous,
                                                capacity:
                                                    e.target.value
                                            })
                                        )
                                    }
                                    placeholder="e.g. 40"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={saving}
                                />

                            </div>

                        </div>


                        <div>

                            <label className="block text-sm font-semibold text-slate-700 mb-2">

                                Status

                            </label>

                            <select
                                value={
                                    dormitoryForm.status
                                }
                                onChange={e =>
                                    setDormitoryForm(
                                        previous => ({
                                            ...previous,
                                            status:
                                                e.target.value
                                        })
                                    )
                                }
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={saving}
                            >

                                <option value="Active">
                                    Active
                                </option>

                                <option value="Inactive">
                                    Inactive
                                </option>

                            </select>

                        </div>


                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">

                            <button
                                type="button"
                                onClick={() =>
                                    setShowDormitoryModal(
                                        false
                                    )
                                }
                                disabled={saving}
                                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                            >

                                Cancel

                            </button>


                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                            >

                                {saving ? (
                                    <FaSpinner className="animate-spin" />
                                ) : (
                                    <FaSave />
                                )}

                                {selectedDormitory
                                    ? "Save Changes"
                                    : "Create Dormitory"}

                            </button>

                        </div>

                    </form>

                </Modal>

            )}


            {/* =================================================
                ASSIGN STUDENTS MODAL
            ================================================= */}

            {showAssignModal && (
                
                <Modal
                    title={`Assign Students - ${selectedDormitory?.name || ""}`}
                    onClose={() => {

                        if (!saving) {

                            setShowAssignModal(
                                false
                            );

                        }

                    }}
                >

                    <form
                        onSubmit={
                            assignStudents
                        }
                        className="space-y-5"
                    >

                        <div className="grid grid-cols-3 gap-3">

                            <MiniStat
                                label="Capacity"
                                value={
                                    selectedDormitory?.capacity ||
                                    0
                                }
                            />

                            <MiniStat
                                label="Occupied"
                                value={
                                    dormitoryStats.find(
                                        item =>
                                            Number(
                                                item.id
                                            ) ===
                                            Number(
                                                selectedDormitory?.id
                                            )
                                    )?.occupied ||
                                    0
                                }
                            />

                            <MiniStat
                                label="Selected"
                                value={
                                    selectedStudentIds.length
                                }
                            />

                        </div>


                        <div className="relative">

                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                placeholder="Search students..."
                                className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onChange={e => {

                                    const value =
                                        normalizeSearch(
                                            e.target.value
                                        );

                                    const filtered =
                                        document.querySelectorAll(
                                            "[data-assign-student]"
                                        );


                                    filtered.forEach(
                                        element => {

                                            const text =
                                                normalizeSearch(
                                                    element.dataset.search
                                                );

                                            element.style.display =
                                                text.includes(
                                                    value
                                                )
                                                    ? ""
                                                    : "none";

                                        }
                                    );

                                }}
                            />

                        </div>


                        {availableStudents.length === 0 ? (

                            <EmptyState
                                icon={FaBed}
                                title="No available students"
                                message="Hakuna student mwingine wa kupewa dormitory kwenye active academic year."
                            />

                        ) : (

                            <div className="border border-slate-200 rounded-xl overflow-hidden">

                                <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100">

                                    {availableStudents.map(
                                        student => {

                                            const checked =
                                                selectedStudentIds.includes(
                                                    String(
                                                        student.id
                                                    )
                                                );


                                            const studentName =
                                                getStudentName(
                                                    student
                                                );


                                            return (

                                                <label
                                                    key={
                                                        student.id
                                                    }
                                                    data-assign-student
                                                    data-search={`${studentName} ${getStudentAdmission(student)} ${student.gender || ""}`}
                                                    className={[
                                                        "flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50",
                                                        checked
                                                            ? "bg-blue-50"
                                                            : ""
                                                    ].join(" ")}
                                                >

                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            checked
                                                        }
                                                        onChange={() =>
                                                            toggleStudent(
                                                                student.id
                                                            )
                                                        }
                                                        className="w-4 h-4"
                                                    />


                                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">

                                                        <FaUsers />

                                                    </div>


                                                    <div className="flex-1">

                                                        <p className="font-semibold text-sm text-slate-800">

                                                            {studentName}

                                                        </p>

                                                        <p className="text-xs text-slate-500">

                                                            {getStudentAdmission(
                                                                student
                                                            )}

                                                            {" • "}

                                                            {student.gender ||
                                                            "Gender —"}

                                                        </p>

                                                    </div>


                                                    {checked && (

                                                        <FaCheckCircle className="text-blue-600" />

                                                    )}

                                                </label>

                                            );

                                        }
                                    )}

                                </div>

                            </div>

                        )}


                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">

                            <button
                                type="button"
                                onClick={() =>
                                    setShowAssignModal(
                                        false
                                    )
                                }
                                disabled={saving}
                                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                            >

                                Cancel

                            </button>


                            <button
                                type="submit"
                                disabled={
                                    saving ||
                                    selectedStudentIds.length ===
                                    0
                                }
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                            >

                                {saving ? (
                                    <FaSpinner className="animate-spin" />
                                ) : (
                                    <FaUserPlus />
                                )}

                                Assign Selected Students

                            </button>

                        </div>

                    </form>

                </Modal>

            )}


            {/* =================================================
                STAFF MODAL
            ================================================= */}

            {selectedStaff && (

                <Modal
                    title="Staff Details"
                    onClose={() =>
                        setSelectedStaff(
                            null
                        )
                    }
                >

                    <div className="space-y-5">

                        <div className="flex items-center gap-4">

                            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl">

                                {
                                    Number(
                                        selectedStaff.role_id
                                    ) === ROLE_PATRON
                                        ? <FaUserTie />
                                        : <FaFemale />
                                }

                            </div>

                            <div>

                                <h3 className="text-xl font-bold text-slate-800">

                                    {getStaffName(
                                        selectedStaff
                                    )}

                                </h3>

                                <span className="inline-flex mt-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">

                                    {getRoleName(
                                        selectedStaff
                                    )}

                                </span>

                            </div>

                        </div>


                        <DetailRow
                            label="Phone"
                            value={
                                selectedStaff.phone ||
                                "—"
                            }
                        />

                        <DetailRow
                            label="Teacher ID"
                            value={
                                selectedStaff.teacher_id ||
                                "—"
                            }
                        />

                        <DetailRow
                            label="Employee ID"
                            value={
                                selectedStaff.employee_id ||
                                "—"
                            }
                        />

                        <DetailRow
                            label="Profile ID"
                            value={
                                selectedStaff.id
                            }
                        />

                    </div>

                </Modal>

            )}


            {/* =================================================
                DORMITORY STUDENTS MODAL
            ================================================= */}

            {selectedDormitory &&
            !showAssignModal &&
            !showDormitoryModal && (

                <Modal
                    title={`${selectedDormitory.name} - Students`}
                    onClose={() =>
                        setSelectedDormitory(
                            null
                        )
                    }
                >

                    <DormitoryStudentList
                        dormitory={
                            selectedDormitory
                        }
                        dormitoryStudents={
                            dormitoryStudents
                        }
                        students={
                            students
                        }
                        onRemove={
                            removeStudent
                        }
                        saving={
                            saving
                        }
                    />

                </Modal>

            )}


            {/* =================================================
                STUDENT DETAILS
            ================================================= */}

            {selectedStudent && (

                <Modal
                    title="Student Details"
                    onClose={() =>
                        setSelectedStudent(
                            null
                        )
                    }
                >

                    <div className="space-y-4">

                        <div className="flex items-center gap-4">

                            {selectedStudent.photo_url ||
                            selectedStudent.photo ? (

                                <img
                                    src={
                                        selectedStudent.photo_url ||
                                        selectedStudent.photo
                                    }
                                    alt=""
                                    className="w-16 h-16 rounded-full object-cover"
                                />

                            ) : (

                                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl">

                                    <FaUsers />

                                </div>

                            )}


                            <div>

                                <h3 className="text-xl font-bold text-slate-800">

                                    {getStudentName(
                                        selectedStudent
                                    )}

                                </h3>

                                <p className="text-sm text-slate-500">

                                    {getStudentAdmission(
                                        selectedStudent
                                    )}

                                </p>

                            </div>

                        </div>


                        <DetailRow
                            label="Gender"
                            value={
                                selectedStudent.gender ||
                                "—"
                            }
                        />

                        <DetailRow
                            label="Student Status"
                            value={
                                selectedStudent.student_status ||
                                "—"
                            }
                        />

                        <DetailRow
                            label="Parent / Guardian"
                            value={
                                selectedStudent.parent_name ||
                                "—"
                            }
                        />

                        <DetailRow
                            label="Parent Phone"
                            value={
                                selectedStudent.parent_phone ||
                                "—"
                            }
                        />


                        {(() => {

                            const assignment =
                                dormitoryStudents.find(
                                    item =>
                                        Number(
                                            item.student_id
                                        ) ===
                                        Number(
                                            selectedStudent.id
                                        )
                                );


                            const dormitory =
                                dormitories.find(
                                    item =>
                                        Number(
                                            item.id
                                        ) ===
                                        Number(
                                            assignment?.dormitory_id
                                        )
                                );


                            return (

                                <DetailRow
                                    label="Dormitory"
                                    value={
                                        dormitory?.name ||
                                        "—"
                                    }
                                />

                            );

                        })()}

                    </div>

                </Modal>

            )}

        </div>

    );

}


/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
    icon: Icon,
    title,
    value,
    subtitle
}) {

    return (

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">

            <div className="flex items-start justify-between gap-3">

                <div>

                    <p className="text-sm font-medium text-slate-500">

                        {title}

                    </p>

                    <p className="text-3xl font-bold text-slate-800 mt-2">

                        {value}

                    </p>

                    <p className="text-xs text-slate-400 mt-1">

                        {subtitle}

                    </p>

                </div>


                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">

                    <Icon />

                </div>

            </div>

        </div>

    );

}


/* ============================================================
   TAB
============================================================ */

function TabButton({
    active,
    onClick,
    icon: Icon,
    label
}) {

    return (

        <button
            type="button"
            onClick={onClick}
            className={[
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition",
                active
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            ].join(" ")}
        >

            <Icon />

            {label}

        </button>

    );

}


/* ============================================================
   DORMITORY CARD
============================================================ */

function DormitoryCard({
    dormitory,
    onView,
    onEdit,
    onAssign
}) {

    return (

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">

            <div className="flex items-start justify-between gap-3">

                <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">

                        <FaBuilding />

                    </div>

                    <div>

                        <h3 className="font-bold text-slate-800">

                            {dormitory.name}

                        </h3>

                        <p className="text-xs text-slate-500">

                            {dormitory.gender}

                        </p>

                    </div>

                </div>


                <span className={[
                    "px-2.5 py-1 rounded-full text-xs font-semibold",
                    String(
                        dormitory.status ||
                        ""
                    ).toLowerCase() ===
                    "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                ].join(" ")}>

                    {dormitory.status}

                </span>

            </div>


            <div className="mt-5">

                <div className="flex items-center justify-between mb-2">

                    <span className="text-sm text-slate-500">

                        Occupancy

                    </span>

                    <span className="font-semibold text-slate-800">

                        {dormitory.occupied}
                        {" / "}
                        {dormitory.capacity}

                    </span>

                </div>


                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">

                    <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                            width: `${dormitory.percentage}%`
                        }}
                    />

                </div>


                <div className="flex justify-between mt-2 text-xs text-slate-500">

                    <span>

                        {dormitory.percentage}%
                        occupied

                    </span>

                    <span>

                        {dormitory.remaining}
                        {" "}beds free

                    </span>

                </div>

            </div>


            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">

                <button
                    type="button"
                    onClick={onView}
                    className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >

                    <FaEye />

                    View

                </button>


                <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                >

                    <FaEdit />

                    Edit

                </button>


                <button
                    type="button"
                    onClick={onAssign}
                    className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >

                    <FaUserPlus />

                    Assign

                </button>

            </div>

        </div>

    );

}


/* ============================================================
   BOARDING STUDENTS SECTION
============================================================ */

function BoardingStudentsSection({
    students,
    dormitoryStudents,
    dormitories,
    search,
    setSearch,
    onView,
    onRemove,
    saving
}) {

    const filtered =
        useMemo(
            () => {

                const term =
                    normalizeSearch(
                        search
                    );


                if (!term) {
                    return students;
                }


                return students.filter(
                    student =>
                        normalizeSearch(
                            getStudentName(
                                student
                            )
                        ).includes(
                            term
                        ) ||
                        normalizeSearch(
                            getStudentAdmission(
                                student
                            )
                        ).includes(
                            term
                        )
                );

            },
            [
                students,
                search
            ]
        );


    return (

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                <div>

                    <h2 className="font-bold text-lg text-slate-800">

                        Boarding Students

                    </h2>

                    <p className="text-sm text-slate-500">

                        Students assigned to dormitories.

                    </p>

                </div>


                <div className="relative w-full md:w-80">

                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                        type="text"
                        value={search}
                        onChange={e =>
                            setSearch(
                                e.target.value
                            )
                        }
                        placeholder="Search student..."
                        className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                </div>

            </div>


            {filtered.length === 0 ? (

                <EmptyState
                    icon={FaBed}
                    title="No boarding students"
                    message="Hakuna student aliyeassigniwa dormitory kwenye active academic year."
                />

            ) : (

                <div className="overflow-x-auto">

                    <table className="w-full min-w-[850px]">

                        <thead className="bg-slate-50">

                            <tr>

                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Student
                                </th>

                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Admission
                                </th>

                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Gender
                                </th>

                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Dormitory
                                </th>

                                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody className="divide-y divide-slate-100">

                            {filtered.map(
                                student => {

                                    const assignment =
                                        dormitoryStudents.find(
                                            item =>
                                                Number(
                                                    item.student_id
                                                ) ===
                                                Number(
                                                    student.id
                                                )
                                        );


                                    const dormitory =
                                        dormitories.find(
                                            item =>
                                                Number(
                                                    item.id
                                                ) ===
                                                Number(
                                                    assignment?.dormitory_id
                                                )
                                        );


                                    return (

                                        <tr
                                            key={
                                                student.id
                                            }
                                            className="hover:bg-slate-50"
                                        >

                                            <td className="px-5 py-4">

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onView(
                                                            student
                                                        )
                                                    }
                                                    className="flex items-center gap-3 text-left"
                                                >

                                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">

                                                        <FaUsers />

                                                    </div>

                                                    <div>

                                                        <p className="font-semibold text-slate-800">

                                                            {getStudentName(
                                                                student
                                                            )}

                                                        </p>

                                                        <p className="text-xs text-slate-400">

                                                            Student ID:
                                                            {" "}
                                                            {student.id}

                                                        </p>

                                                    </div>

                                                </button>

                                            </td>


                                            <td className="px-5 py-4 text-sm text-slate-600">

                                                {getStudentAdmission(
                                                    student
                                                )}

                                            </td>


                                            <td className="px-5 py-4 text-sm text-slate-600">

                                                {student.gender ||
                                                "—"}

                                            </td>


                                            <td className="px-5 py-4">

                                                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">

                                                    <FaHome className="text-blue-600" />

                                                    {dormitory?.name ||
                                                    "Unknown"}

                                                </span>

                                            </td>


                                            <td className="px-5 py-4 text-right">

                                                <button
                                                    type="button"
                                                    disabled={
                                                        saving
                                                    }
                                                    onClick={() =>
                                                        onRemove(
                                                            assignment
                                                        )
                                                    }
                                                    className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                                                >

                                                    Remove

                                                </button>

                                            </td>

                                        </tr>

                                    );

                                }
                            )}

                        </tbody>

                    </table>

                </div>

            )}

        </section>

    );

}


/* ============================================================
   STAFF SECTION
============================================================ */

function StaffSection({
    profiles,
    selectedStaff,
    setSelectedStaff
}) {

    return (

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-200">

                <h2 className="font-bold text-lg text-slate-800">

                    Patron & Matron Staff

                </h2>

                <p className="text-sm text-slate-500">

                    Staff accounts with Patron or Matron role.

                </p>

            </div>


            {profiles.length === 0 ? (

                <EmptyState
                    icon={FaUsers}
                    title="No Patron or Matron found"
                    message="Hakuna profile yenye role ya Patron au Matron kwa school hii."
                />

            ) : (

                <div className="overflow-x-auto">

                    <table className="w-full min-w-[750px]">

                        <thead className="bg-slate-50">

                            <tr>

                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Staff
                                </th>

                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Role
                                </th>

                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Phone
                                </th>

                                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody className="divide-y divide-slate-100">

                            {profiles.map(
                                profile => (

                                    <tr
                                        key={
                                            profile.id
                                        }
                                        className="hover:bg-slate-50"
                                    >

                                        <td className="px-5 py-4">

                                            <div className="flex items-center gap-3">

                                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">

                                                    {
                                                        Number(
                                                            profile.role_id
                                                        ) ===
                                                        ROLE_PATRON
                                                            ? <FaUserTie />
                                                            : <FaFemale />
                                                    }

                                                </div>


                                                <div>

                                                    <p className="font-semibold text-slate-800">

                                                        {getStaffName(
                                                            profile
                                                        )}

                                                    </p>

                                                    <p className="text-xs text-slate-400">

                                                        Profile ID:
                                                        {" "}
                                                        {profile.id}

                                                    </p>

                                                </div>

                                            </div>

                                        </td>


                                        <td className="px-5 py-4">

                                            <span className="inline-flex px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">

                                                {getRoleName(
                                                    profile
                                                )}

                                            </span>

                                        </td>


                                        <td className="px-5 py-4 text-sm text-slate-600">

                                            {profile.phone ||
                                            "—"}

                                        </td>


                                        <td className="px-5 py-4 text-right">

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedStaff(
                                                        profile
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                                            >

                                                <FaEye />

                                                View

                                            </button>

                                        </td>

                                    </tr>

                                )
                            )}

                        </tbody>

                    </table>

                </div>

            )}

        </section>

    );

}


/* ============================================================
   DORMITORY STUDENT LIST
============================================================ */

function DormitoryStudentList({
    dormitory,
    dormitoryStudents,
    students,
    onRemove,
    saving
}) {

    const assignments =
        dormitoryStudents.filter(
            item =>
                Number(
                    item.dormitory_id
                ) ===
                Number(
                    dormitory.id
                )
        );


    const assignedStudents =
        assignments
            .map(
                assignment => ({
                    assignment,
                    student:
                        students.find(
                            item =>
                                Number(
                                    item.id
                                ) ===
                                Number(
                                    assignment.student_id
                                )
                        )
                })
            )
            .filter(
                item =>
                    item.student
            );


    return (

        <div>

            <div className="grid grid-cols-3 gap-3 mb-5">

                <MiniStat
                    label="Capacity"
                    value={
                        dormitory.capacity
                    }
                />

                <MiniStat
                    label="Occupied"
                    value={
                        assignedStudents.length
                    }
                />

                <MiniStat
                    label="Free Beds"
                    value={
                        Math.max(
                            0,
                            safeNumber(
                                dormitory.capacity
                            ) -
                            assignedStudents.length
                        )
                    }
                />

            </div>


            {assignedStudents.length === 0 ? (

                <EmptyState
                    icon={FaBed}
                    title="No students"
                    message="Dormitory hii bado haina students."
                />

            ) : (

                <div className="space-y-2 max-h-[55vh] overflow-y-auto">

                    {assignedStudents.map(
                        ({
                            assignment,
                            student
                        }) => (

                            <div
                                key={
                                    assignment.id
                                }
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50"
                            >

                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">

                                    <FaUsers />

                                </div>


                                <div className="flex-1">

                                    <p className="font-semibold text-sm text-slate-800">

                                        {getStudentName(
                                            student
                                        )}

                                    </p>

                                    <p className="text-xs text-slate-500">

                                        {getStudentAdmission(
                                            student
                                        )}

                                        {" • "}

                                        {student.gender ||
                                        "—"}

                                    </p>

                                </div>


                                <button
                                    type="button"
                                    disabled={
                                        saving
                                    }
                                    onClick={() =>
                                        onRemove(
                                            assignment
                                        )
                                    }
                                    className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                                >

                                    Remove

                                </button>

                            </div>

                        )
                    )}

                </div>

            )}

        </div>

    );

}


/* ============================================================
   REPORTS
============================================================ */

function ReportsSection({
    dormitoryStats,
    totalCapacity,
    totalOccupied,
    availableBeds,
    boardingStudents
}) {

    return (

        <section>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                <ReportCard
                    icon={FaBuilding}
                    title="Dormitories"
                    value={
                        dormitoryStats.length
                    }
                    description="Active academic year"
                />

                <ReportCard
                    icon={FaBed}
                    title="Boarding Students"
                    value={
                        boardingStudents
                    }
                    description="Assigned students"
                />

                <ReportCard
                    icon={FaUsers}
                    title="Total Capacity"
                    value={
                        totalCapacity
                    }
                    description="Available dormitory capacity"
                />

                <ReportCard
                    icon={FaUserClock}
                    title="Available Beds"
                    value={
                        availableBeds
                    }
                    description={`${totalOccupied} beds currently occupied`}
                />

            </div>


            <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">

                <h2 className="font-bold text-lg text-slate-800 mb-5">

                    Dormitory Occupancy

                </h2>


                {dormitoryStats.length === 0 ? (

                    <EmptyState
                        icon={FaChartBar}
                        title="No dormitory data"
                        message="Create dormitories first."
                    />

                ) : (

                    <div className="space-y-4">

                        {dormitoryStats.map(
                            dormitory => (

                                <div
                                    key={
                                        dormitory.id
                                    }
                                    className="border border-slate-100 rounded-xl p-4"
                                >

                                    <div className="flex items-center justify-between mb-2">

                                        <div>

                                            <p className="font-semibold text-slate-800">

                                                {dormitory.name}

                                            </p>

                                            <p className="text-xs text-slate-500">

                                                {dormitory.gender}

                                            </p>

                                        </div>


                                        <p className="font-bold text-slate-700">

                                            {dormitory.occupied}
                                            {" / "}
                                            {dormitory.capacity}

                                        </p>

                                    </div>


                                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">

                                        <div
                                            className="h-full bg-blue-600 rounded-full"
                                            style={{
                                                width:
                                                    `${dormitory.percentage}%`
                                            }}
                                        />

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                )}

            </div>

        </section>

    );

}


/* ============================================================
   REPORT CARD
============================================================ */

function ReportCard({
    icon: Icon,
    title,
    value,
    description
}) {

    return (

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">

            <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">

                    <Icon />

                </div>

                <div>

                    <p className="text-sm text-slate-500">

                        {title}

                    </p>

                    <p className="text-2xl font-bold text-slate-800">

                        {value}

                    </p>

                </div>

            </div>


            <p className="text-xs text-slate-400 mt-4">

                {description}

            </p>

        </div>

    );

}


/* ============================================================
   MINI STAT
============================================================ */

function MiniStat({
    label,
    value
}) {

    return (

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">

            <p className="text-xs text-slate-500">

                {label}

            </p>

            <p className="text-xl font-bold text-slate-800 mt-1">

                {value}

            </p>

        </div>

    );

}


/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
    icon: Icon,
    title,
    message
}) {

    return (

        <div className="p-10 text-center">

            <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl">

                <Icon />

            </div>

            <h3 className="font-semibold text-slate-700 mt-4">

                {title}

            </h3>

            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">

                {message}

            </p>

        </div>

    );

}


/* ============================================================
   DETAIL ROW
============================================================ */

function DetailRow({
    label,
    value
}) {

    return (

        <div className="flex items-start justify-between gap-5 py-3 border-b border-slate-100 last:border-0">

            <span className="text-sm font-medium text-slate-500">

                {label}

            </span>

            <span className="text-sm font-semibold text-slate-800 text-right break-all">

                {value}

            </span>

        </div>

    );

}


/* ============================================================
   MODULE PLACEHOLDER
============================================================ */

function ModulePlaceholder({
    icon: Icon,
    title,
    description,
    stats
}) {

    return (

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">

            <div className="flex items-start gap-4">

                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">

                    <Icon />

                </div>

                <div>

                    <h2 className="text-xl font-bold text-slate-800">

                        {title}

                    </h2>

                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">

                        {description}

                    </p>

                </div>

            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">

                {stats.map(
                    ([label, value]) => (

                        <div
                            key={
                                label
                            }
                            className="rounded-xl bg-slate-50 border border-slate-100 p-5"
                        >

                            <p className="text-sm text-slate-500">

                                {label}

                            </p>

                            <p className="text-3xl font-bold text-slate-800 mt-2">

                                {value}

                            </p>

                        </div>

                    )
                )}

            </div>


            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-3">

                <FaInfoCircle className="text-blue-600 mt-1" />

                <p className="text-sm text-blue-800">

                    Database ya Dormitory na Boarding Students tayari imeunganishwa.
                    Sehemu hii itajengwa juu ya data hiyo.

                </p>

            </div>

        </section>

    );

}


/* ============================================================
   MODAL
============================================================ */

function Modal({
    title,
    children,
    onClose
}) {

    return (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={
                    onClose
                }
            />


            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl">

                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">

                    <h2 className="text-lg font-bold text-slate-800">

                        {title}

                    </h2>


                    <button
                        type="button"
                        onClick={
                            onClose
                        }
                        className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                    >

                        <FaTimes />

                    </button>

                </div>


                <div className="p-5 overflow-y-auto max-h-[calc(90vh-70px)]">

                    {children}

                </div>

            </div>

        </div>

    );

}


export default PatronMatron;