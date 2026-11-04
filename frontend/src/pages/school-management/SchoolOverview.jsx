import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    MdArrowBack,
    MdPeople,
    MdSchool,
    MdWork,
    MdGroups,
    MdRefresh,
    MdBusiness,
    MdPhone,
    MdEmail,
    MdLocationOn
} from "react-icons/md";
import api from "../../services/api";

const numberFormat = (value) =>
    Number(value || 0).toLocaleString("en-TZ");

export default function SchoolOverview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [school, setSchool] = useState(null);
    const [overview, setOverview] = useState({
        students: 0,
        staff: 0,
        nonStaff: 0,
        totalUsers: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadOverview = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get(`/schools/${id}/overview`);
            if (!response?.data?.school || !response?.data?.overview) {
                throw new Error("Taarifa za shule hazijarudishwa kwa usahihi.");
            }
            setSchool(response.data.school);
            setOverview(response.data.overview);
        } catch (requestError) {
            setError(
                requestError?.response?.data?.message ||
                requestError?.message ||
                "Imeshindikana kupakia taarifa za shule."
            );
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    const cards = [
        {
            label: "Wanafunzi",
            value: overview.students,
            description: "Jumla ya wanafunzi waliosajiliwa",
            icon: <MdSchool />,
            iconClass: "bg-blue-50 text-blue-700"
        },
        {
            label: "Staff",
            value: overview.staff,
            description: "Watumishi wenye aina ya Staff",
            icon: <MdWork />,
            iconClass: "bg-emerald-50 text-emerald-700"
        },
        {
            label: "Non-Staff",
            value: overview.nonStaff,
            description: "Watumishi wenye aina ya Non-Staff",
            icon: <MdGroups />,
            iconClass: "bg-amber-50 text-amber-700"
        }
    ];

    return (
        <main className="mx-auto min-h-[70vh] max-w-7xl space-y-6 p-1 sm:p-2">
            <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
                <MdArrowBack /> Rudi kwenye orodha ya shule
            </button>

            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                            <MdBusiness /> SCHOOL USAGE OVERVIEW
                        </div>
                        <h1 className="text-2xl font-extrabold sm:text-3xl">
                            {school?.school_name || (loading ? "Inapakia shule..." : "Taarifa za shule")}
                        </h1>
                        <p className="mt-2 text-sm text-blue-100">
                            Muhtasari wa wanafunzi, staff na non-staff wanaotumia AfriCore ERP katika shule hii.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {school?.is_active === true && (
                            <button
                                type="button"
                                onClick={() => navigate(`/school-management/headmasters/add?school_id=${encodeURIComponent(id)}`)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-950 transition hover:bg-blue-50"
                            >
                                + Add Headmaster
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={loadOverview}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                        >
                            <MdRefresh className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
                {school && (
                    <div className="mt-6 grid gap-3 border-t border-white/15 pt-5 text-sm text-blue-100 sm:grid-cols-2 lg:grid-cols-3">
                        <p className="flex items-center gap-2"><MdBusiness /> {school.registration_number || "Namba ya usajili haijawekwa"}</p>
                        <p className="flex items-center gap-2"><MdPhone /> {school.phone || "Simu haijawekwa"}</p>
                        <p className="flex min-w-0 items-center gap-2"><MdEmail /> <span className="truncate">{school.email || "Email haijawekwa"}</span></p>
                        <p className="flex items-center gap-2 sm:col-span-2 lg:col-span-3"><MdLocationOn /> {school.address || "Anuani haijawekwa"}</p>
                    </div>
                )}
            </section>

            {error && (
                <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                    <span>{error}</span>
                    <button type="button" onClick={loadOverview} className="rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800">
                        Jaribu tena
                    </button>
                </div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                    <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                                <p className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">
                                    {loading ? "—" : numberFormat(card.value)}
                                </p>
                            </div>
                            <span className={`rounded-2xl p-3 text-2xl ${card.iconClass}`}>{card.icon}</span>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">{card.description}</p>
                    </article>
                ))}

                <article className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold text-indigo-800">Jumla ya watumiaji</p>
                            <p className="mt-3 text-4xl font-extrabold tracking-tight text-indigo-950">
                                {loading ? "—" : numberFormat(overview.totalUsers)}
                            </p>
                        </div>
                        <span className="rounded-2xl bg-indigo-100 p-3 text-2xl text-indigo-800"><MdPeople /></span>
                    </div>
                    <p className="mt-3 text-xs text-indigo-700">Wanafunzi + Staff + Non-Staff</p>
                </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-bold text-slate-900">Maelezo ya hesabu</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                    Jumla ya watumiaji inahesabiwa kwa kujumlisha idadi ya wanafunzi, Staff na Non-Staff wa shule hii pekee. Takwimu hupakiwa kutoka kwenye rekodi za shule husika na zinaweza kusasishwa kwa kubonyeza Refresh.
                </p>
                {school && (
                    <div className="mt-4">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${school.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {school.is_active ? "SHULE ACTIVE" : "SHULE INACTIVE"}
                        </span>
                    </div>
                )}
            </section>
        </main>
    );
}
