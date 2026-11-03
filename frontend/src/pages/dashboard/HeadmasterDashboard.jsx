import {
    useCallback,
    useEffect,
    useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
    MdPeople,
    MdSchool,
    MdClass,
    MdAssessment,
    MdCampaign,
    MdAccountBalance,
    MdRefresh,
    MdCalendarToday,
    MdCheckCircle,
    MdCancel,
    MdAccountBalanceWallet,
} from "react-icons/md";

import { supabase } from "../../services/supabase";


const EMPTY_STATS = {
    students: 0,
    teachers: 0,
    nonStaff: 0,
    classes: 0,
    exams: 0,
    attendanceTotal: 0,
    present: 0,
    absent: 0,
    cashBalance: 0,
};

const formatMoney = (value) =>
    new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency: "TZS",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};


function HeadmasterDashboard() {
    const navigate = useNavigate();

    const [stats, setStats] = useState(EMPTY_STATS);
    const [accounts, setAccounts] = useState([]);
    const [classAttendance, setClassAttendance] = useState([]);
    const [school, setSchool] = useState(null);
    const [academicYear, setAcademicYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const loadDashboard = useCallback(async ({ silent = false } = {}) => {
        try {
            if (silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError("");

            // Resolve the school from the signed-in user's own profile.
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;
            if (!user?.id) {
                throw new Error("Your session could not be found. Please sign in again.");
            }

            const {
                data: profile,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select("id, school_id, full_name")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) throw profileError;

            const schoolId = Number(profile?.school_id);
            if (!Number.isInteger(schoolId) || schoolId <= 0) {
                throw new Error("Your account is not linked to a school. Please contact the system administrator.");
            }

            const [
                schoolResult,
                yearResult,
            ] = await Promise.all([
                supabase
                    .from("schools")
                    .select("id, school_name, logo")
                    .eq("id", schoolId)
                    .maybeSingle(),

                supabase
                    .from("academic_years")
                    .select("id, year_name, term, start_date, end_date")
                    .eq("school_id", schoolId)
                    .eq("is_active", true)
                    .order("start_date", { ascending: false })
                    .limit(1)
                    .maybeSingle(),
            ]);

            if (schoolResult.error) throw schoolResult.error;
            if (yearResult.error) throw yearResult.error;

            const activeYearId = yearResult.data?.id ?? null;
            const today = getLocalDate();

            let studentsQuery = supabase
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("school_id", schoolId);

            let teachersQuery = supabase
                .from("teachers")
                .select("id", { count: "exact", head: true })
                .eq("school_id", schoolId)
                .eq("staff_type", "Staff")
                .eq("status", "Active");

            let nonStaffQuery = supabase
                .from("teachers")
                .select("id", { count: "exact", head: true })
                .eq("school_id", schoolId)
                .eq("staff_type", "Non-Staff")
                .eq("status", "Active");

            let classesQuery = supabase
                .from("classes")
                .select("id", { count: "exact", head: true })
                .eq("school_id", schoolId);

            let attendanceClassesQuery = supabase
                .from("classes")
                .select("id, class_name, academic_level")
                .eq("school_id", schoolId)
                .order("class_name", { ascending: true });

            let classStudentsQuery = supabase
                .from("students")
                .select("id, current_class_id")
                .eq("school_id", schoolId)
                .eq("student_status", "Active");

            let examsQuery = supabase
                .from("exams")
                .select("id", { count: "exact", head: true })
                .eq("school_id", schoolId);

            let attendanceQuery = supabase
                .from("class_attendance")
                .select("class_id, student_id, status")
                .eq("school_id", schoolId)
                .eq("attendance_date", today);

            // Use the active academic year where the table supports it.
            // If no active year is configured, show the school's records
            // without silently excluding older data.
            if (activeYearId !== null) {
                studentsQuery = studentsQuery.eq("academic_year_id", activeYearId);
                classesQuery = classesQuery.eq("academic_year_id", activeYearId);
                attendanceClassesQuery = attendanceClassesQuery.eq("academic_year_id", activeYearId);
                classStudentsQuery = classStudentsQuery.eq("academic_year_id", activeYearId);
                examsQuery = examsQuery.eq("academic_year_id", activeYearId);
                attendanceQuery = attendanceQuery.eq("academic_year_id", activeYearId);
            }

            const [
                studentsResult,
                teachersResult,
                nonStaffResult,
                classesResult,
                examsResult,
                attendanceResult,
                attendanceClassesResult,
                classStudentsResult,
                accountsResult,
            ] = await Promise.all([
                studentsQuery,
                teachersQuery,
                nonStaffQuery,
                classesQuery,
                examsQuery,
                attendanceQuery,
                attendanceClassesQuery,
                classStudentsQuery,

                // finance.cash_accounts is the active finance module's
                // source of account balances. Do not also sum the legacy
                // public.financial_accounts table, as that duplicates accounts.
                supabase
                    .schema("finance")
                    .from("cash_accounts")
                    .select("id, account_name, account_type, provider_name, account_number, current_balance")
                    .eq("school_id", schoolId)
                    .eq("is_active", true)
                    .order("account_name", { ascending: true }),
            ]);

            const queryErrors = [
                studentsResult.error,
                teachersResult.error,
                nonStaffResult.error,
                classesResult.error,
                examsResult.error,
                attendanceResult.error,
                attendanceClassesResult.error,
                classStudentsResult.error,
                accountsResult.error,
            ].filter(Boolean);

            if (queryErrors.length > 0) {
                console.error("Headmaster dashboard query errors:", queryErrors);
                throw queryErrors[0];
            }

            const attendanceRows = attendanceResult.data || [];
            const presentStatuses = new Set(["present", "yupo", "presenti"]);
            const absentStatuses = new Set(["absent", "hayupo"]);
            const studentsByClass = new Map();

            (classStudentsResult.data || []).forEach((student) => {
                const classId = Number(student.current_class_id);
                if (!Number.isInteger(classId)) return;
                studentsByClass.set(classId, (studentsByClass.get(classId) || 0) + 1);
            });

            const attendanceByClass = new Map();
            attendanceRows.forEach((row) => {
                const classId = Number(row.class_id);
                const studentId = Number(row.student_id);
                if (!Number.isInteger(classId) || !Number.isInteger(studentId)) return;
                if (!attendanceByClass.has(classId)) attendanceByClass.set(classId, new Map());
                attendanceByClass.get(classId).set(studentId, row.status);
            });

            const classAttendanceRows = (attendanceClassesResult.data || []).map((schoolClass) => {
                const records = attendanceByClass.get(Number(schoolClass.id)) || new Map();
                let presentCount = 0;
                let absentCount = 0;
                records.forEach((status) => {
                    const normalizedStatus = String(status || "").trim().toLowerCase();
                    if (presentStatuses.has(normalizedStatus)) presentCount += 1;
                    else if (absentStatuses.has(normalizedStatus)) absentCount += 1;
                });
                const marked = records.size;
                const enrolled = studentsByClass.get(Number(schoolClass.id)) || 0;
                return {
                    id: schoolClass.id,
                    name: schoolClass.class_name,
                    level: schoolClass.academic_level,
                    enrolled,
                    marked,
                    present: presentCount,
                    absent: absentCount,
                    status: marked === 0 ? "not-taken" : marked < enrolled ? "partial" : "recorded",
                    unmarked: Math.max(enrolled - marked, 0),
                };
            });

            const present = classAttendanceRows.reduce((sum, item) => sum + item.present, 0);
            const absent = classAttendanceRows.reduce((sum, item) => sum + item.absent, 0);

            const safeAccounts = accountsResult.data || [];
            const cashBalance = safeAccounts.reduce(
                (total, account) => total + Number(account.current_balance || 0),
                0
            );

            setSchool(schoolResult.data || null);
            setAcademicYear(yearResult.data || null);
            setAccounts(safeAccounts);
            setClassAttendance(classAttendanceRows);
            setStats({
                students: studentsResult.count || 0,
                teachers: teachersResult.count || 0,
                nonStaff: nonStaffResult.count || 0,
                classes: classesResult.count || 0,
                exams: examsResult.count || 0,
                attendanceTotal: attendanceRows.length,
                present,
                absent,
                cashBalance,
            });
        } catch (loadError) {
            console.error("Headmaster Dashboard Error:", loadError);
            setError(loadError?.message || "Failed to load school information.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();

        return () => {
            // The data loader is self-contained; React ignores state updates
            // after the page is unmounted in supported React versions.
        };
    }, [loadDashboard]);

    const cards = [
        {
            title: "Students",
            value: stats.students,
            icon: <MdPeople />,
            color: "bg-blue-600",
            detail: academicYear?.year_name
                ? `Year ${academicYear.year_name}`
                : "All school records",
        },
        {
            title: "Teachers",
            value: stats.teachers,
            icon: <MdSchool />,
            color: "bg-emerald-600",
            detail: "Currently active",
        },
        {
            title: "Other Staff",
            value: stats.nonStaff,
            icon: <MdPeople />,
            color: "bg-cyan-700",
            detail: "Non-teaching staff currently active",
        },
        {
            title: "Classes",
            value: stats.classes,
            icon: <MdClass />,
            color: "bg-violet-600",
            detail: academicYear?.year_name
                ? `Year ${academicYear.year_name}`
                : "All school records",
        },
        {
            title: "Examinations",
            value: stats.exams,
            icon: <MdAssessment />,
            color: "bg-orange-600",
            detail: academicYear?.year_name
                ? `Year ${academicYear.year_name}`
                : "All school records",
        },
        {
            title: "Today's Attendance",
            value: stats.attendanceTotal,
            icon: <MdCalendarToday />,
            color: "bg-indigo-600",
            detail: `${stats.present} Present • ${stats.absent} Absent`,
        },
    ];

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-gray-600 font-medium">
                        Loading live school information...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    {school?.logo ? (
                        <img
                            src={school.logo}
                            alt=""
                            className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-contain p-1"
                        />
                    ) : (
                        <div className="h-14 w-14 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-3xl">
                            <MdSchool />
                        </div>
                    )}

                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                            {school?.school_name || "Headmaster Dashboard"}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Overview of your school's information and activities
                            {academicYear?.year_name
                                ? ` • Academic Year ${academicYear.year_name}`
                                : ""}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => loadDashboard({ silent: true })}
                    disabled={refreshing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                    <MdRefresh className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-semibold">Some information could not be loaded.</p>
                    <p className="mt-1">{error}</p>
                    <button
                        type="button"
                        onClick={() => loadDashboard()}
                        className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
                    >
                        Try Again
                    </button>
                </div>
            )}

            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                        School Information
                    </h2>
                    {academicYear?.term && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {academicYear.term}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {cards.map((card) => (
                        <div
                            key={card.title}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <div>
                                <p className="text-sm font-medium text-slate-500">
                                    {card.title}
                                </p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                                    {card.value.toLocaleString("en-TZ")}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {card.detail}
                                </p>
                            </div>
                            <div className={`${card.color} rounded-2xl p-3 text-3xl text-white`}>
                                {card.icon}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-100 p-3 text-2xl text-emerald-700">
                            <MdAccountBalanceWallet />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900">
                                School Account Balance
                            </h2>
                            <p className="text-xs text-slate-500">
                                Total balance across all active accounts
                            </p>
                        </div>
                    </div>

                    <p className="mt-6 text-2xl font-extrabold tracking-tight text-emerald-700">
                        {formatMoney(stats.cashBalance)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Balance based on financial accounts registered in the system.
                    </p>
                    <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-500">
                        <MdAccountBalance />
                        {accounts.length} active accounts
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900">
                                Balance by Account
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Banks and payment services for this school
                            </p>
                        </div>
                        <MdAccountBalance className="text-2xl text-blue-600" />
                    </div>

                    {accounts.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                            No active financial accounts are registered for this school.
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {accounts.map((account) => (
                                <div
                                    key={account.id}
                                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            {account.account_name}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {account.provider_name || account.account_type || "Account"}
                                            {account.account_number
                                                ? ` • ${account.account_number}`
                                                : ""}
                                        </p>
                                    </div>
                                    <p className="font-bold tabular-nums text-slate-900">
                                        {formatMoney(account.current_balance)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-bold text-slate-900">Class Attendance</h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Daily attendance status for each class
                        </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                        {new Date().toLocaleDateString("en-TZ", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                </div>

                {classAttendance.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        No classes were found for the active academic year.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {classAttendance.map((item) => (
                            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-slate-900">{item.name}</h3>
                                        <p className="mt-1 text-xs text-slate-500">{item.level || "Class"}</p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                        item.status === "recorded"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : item.status === "partial"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-slate-100 text-slate-600"
                                    }`}>
                                        {item.status === "recorded" ? "Recorded" : item.status === "partial" ? "Partially Recorded" : "N/A — Not Taken"}
                                    </span>
                                </div>
                                {item.status === "not-taken" ? (
                                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                        Attendance has not been taken for this class today.
                                    </div>
                                ) : (
                                    <>
                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            <div className="rounded-lg bg-slate-50 p-3">
                                                <p className="text-xs text-slate-500">Enrolled</p>
                                                <p className="mt-1 text-xl font-bold text-slate-900">{item.enrolled}</p>
                                            </div>
                                            <div className="rounded-lg bg-emerald-50 p-3">
                                                <p className="text-xs text-emerald-700">Present</p>
                                                <p className="mt-1 text-xl font-bold text-emerald-800">{item.present}</p>
                                            </div>
                                            <div className="rounded-lg bg-red-50 p-3">
                                                <p className="text-xs text-red-700">Absent</p>
                                                <p className="mt-1 text-xl font-bold text-red-800">{item.absent}</p>
                                            </div>
                                        </div>
                                        {item.status === "partial" && (
                                            <p className="mt-3 text-xs font-medium text-amber-700">
                                                {item.marked} of {item.enrolled} students recorded; {item.unmarked} not yet recorded.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-bold text-slate-900">
                        Quick Links
                    </h2>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => navigate("/students")}
                            className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
                        >
                            <MdPeople className="text-2xl text-blue-600" />
                            <span className="mt-2 block text-sm font-semibold text-slate-800">
                                Students
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/teachers")}
                            className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
                        >
                            <MdSchool className="text-2xl text-emerald-600" />
                            <span className="mt-2 block text-sm font-semibold text-slate-800">
                                Teachers
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/examination")}
                            className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
                        >
                            <MdAssessment className="text-2xl text-orange-600" />
                            <span className="mt-2 block text-sm font-semibold text-slate-800">
                                Examinations
                            </span>
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/communication")}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
                    >
                        <MdCampaign />
                        School Communication
                    </button>
                </div>
            </section>
        </div>
    );
}

export default HeadmasterDashboard;
