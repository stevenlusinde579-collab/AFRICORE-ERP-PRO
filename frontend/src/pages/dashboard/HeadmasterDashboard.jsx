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
                throw new Error("Session haijapatikana. Tafadhali ingia tena.");
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
                throw new Error("Akaunti yako haijaunganishwa na shule. Wasiliana na msimamizi wa mfumo.");
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

            let examsQuery = supabase
                .from("exams")
                .select("id", { count: "exact", head: true })
                .eq("school_id", schoolId);

            let attendanceQuery = supabase
                .from("class_attendance")
                .select("status")
                .eq("school_id", schoolId)
                .eq("attendance_date", today);

            // Use the active academic year where the table supports it.
            // If no active year is configured, show the school's records
            // without silently excluding older data.
            if (activeYearId !== null) {
                studentsQuery = studentsQuery.eq("academic_year_id", activeYearId);
                classesQuery = classesQuery.eq("academic_year_id", activeYearId);
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
                accountsResult,
            ] = await Promise.all([
                studentsQuery,
                teachersQuery,
                nonStaffQuery,
                classesQuery,
                examsQuery,
                attendanceQuery,

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
                accountsResult.error,
            ].filter(Boolean);

            if (queryErrors.length > 0) {
                console.error("Headmaster dashboard query errors:", queryErrors);
                throw queryErrors[0];
            }

            const attendanceRows = attendanceResult.data || [];
            const presentStatuses = new Set(["present", "yupo", "presenti"]);
            const absentStatuses = new Set(["absent", "hayupo", "absent"]);

            const present = attendanceRows.filter((row) =>
                presentStatuses.has(String(row.status || "").trim().toLowerCase())
            ).length;

            const absent = attendanceRows.filter((row) =>
                absentStatuses.has(String(row.status || "").trim().toLowerCase())
            ).length;

            const safeAccounts = accountsResult.data || [];
            const cashBalance = safeAccounts.reduce(
                (total, account) => total + Number(account.current_balance || 0),
                0
            );

            setSchool(schoolResult.data || null);
            setAcademicYear(yearResult.data || null);
            setAccounts(safeAccounts);
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
            setError(loadError?.message || "Imeshindikana kupakia taarifa za shule.");
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
            title: "Wanafunzi",
            value: stats.students,
            icon: <MdPeople />,
            color: "bg-blue-600",
            detail: academicYear?.year_name
                ? `Mwaka ${academicYear.year_name}`
                : "Shule nzima",
        },
        {
            title: "Walimu",
            value: stats.teachers,
            icon: <MdSchool />,
            color: "bg-emerald-600",
            detail: "Walio kazini",
        },
        {
            title: "Wafanyakazi wengine",
            value: stats.nonStaff,
            icon: <MdPeople />,
            color: "bg-cyan-700",
            detail: "Wasio walimu, walio kazini",
        },
        {
            title: "Madarasa",
            value: stats.classes,
            icon: <MdClass />,
            color: "bg-violet-600",
            detail: academicYear?.year_name
                ? `Mwaka ${academicYear.year_name}`
                : "Shule nzima",
        },
        {
            title: "Mitihani",
            value: stats.exams,
            icon: <MdAssessment />,
            color: "bg-orange-600",
            detail: academicYear?.year_name
                ? `Mwaka ${academicYear.year_name}`
                : "Shule nzima",
        },
        {
            title: "Mahudhurio leo",
            value: stats.attendanceTotal,
            icon: <MdCalendarToday />,
            color: "bg-indigo-600",
            detail: `${stats.present} wapo • ${stats.absent} hawapo`,
        },
    ];

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-gray-600 font-medium">
                        Inapakia taarifa halisi za shule...
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
                            {school?.school_name || "Dashboard ya Mkuu wa Shule"}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Muhtasari wa taarifa na shughuli za shule yako
                            {academicYear?.year_name
                                ? ` • Mwaka wa masomo ${academicYear.year_name}`
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
                    {refreshing ? "Inasasisha..." : "Refresh taarifa"}
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-semibold">Imeshindikana kupakia baadhi ya taarifa.</p>
                    <p className="mt-1">{error}</p>
                    <button
                        type="button"
                        onClick={() => loadDashboard()}
                        className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
                    >
                        Jaribu tena
                    </button>
                </div>
            )}

            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                        Taarifa za shule
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
                                Salio la fedha za shule
                            </h2>
                            <p className="text-xs text-slate-500">
                                Jumla ya akaunti zote hai
                            </p>
                        </div>
                    </div>

                    <p className="mt-6 text-2xl font-extrabold tracking-tight text-emerald-700">
                        {formatMoney(stats.cashBalance)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Salio limetokana na akaunti za fedha zilizosajiliwa kwenye mfumo.
                    </p>
                    <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-500">
                        <MdAccountBalance />
                        {accounts.length} akaunti hai
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900">
                                Salio kwa kila akaunti
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Benki na huduma za malipo za shule hii
                            </p>
                        </div>
                        <MdAccountBalance className="text-2xl text-blue-600" />
                    </div>

                    {accounts.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                            Hakuna akaunti hai ya fedha iliyosajiliwa kwa shule hii.
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
                                            {account.provider_name || account.account_type || "Akaunti"}
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

            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-bold text-slate-900">
                        Mahudhurio ya leo
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Taarifa zilizorekodiwa kwa tarehe ya leo
                    </p>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Yote</p>
                            <p className="mt-1 text-xl font-bold text-slate-900">
                                {stats.attendanceTotal}
                            </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-3">
                            <div className="flex items-center gap-1 text-emerald-700">
                                <MdCheckCircle />
                                <p className="text-xs">Wapo</p>
                            </div>
                            <p className="mt-1 text-xl font-bold text-emerald-800">
                                {stats.present}
                            </p>
                        </div>
                        <div className="rounded-xl bg-red-50 p-3">
                            <div className="flex items-center gap-1 text-red-700">
                                <MdCancel />
                                <p className="text-xs">Hawapo</p>
                            </div>
                            <p className="mt-1 text-xl font-bold text-red-800">
                                {stats.absent}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-bold text-slate-900">
                        Njia za mkato
                    </h2>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => navigate("/students")}
                            className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
                        >
                            <MdPeople className="text-2xl text-blue-600" />
                            <span className="mt-2 block text-sm font-semibold text-slate-800">
                                Wanafunzi
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/teachers")}
                            className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
                        >
                            <MdSchool className="text-2xl text-emerald-600" />
                            <span className="mt-2 block text-sm font-semibold text-slate-800">
                                Walimu
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/examination")}
                            className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
                        >
                            <MdAssessment className="text-2xl text-orange-600" />
                            <span className="mt-2 block text-sm font-semibold text-slate-800">
                                Mitihani
                            </span>
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/communication")}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
                    >
                        <MdCampaign />
                        Mawasiliano ya shule
                    </button>
                </div>
            </section>
        </div>
    );
}

export default HeadmasterDashboard;
