import React from "react";
import { useNavigate } from "react-router-dom";
import {
    BarChart3,
    BookOpenCheck,
    GraduationCap,
    School,
    Users,
    ArrowRight,
    FileText,
    CheckCircle2,
} from "lucide-react";

function Report() {
    const navigate = useNavigate();

    const reportCards = [
        {
            title: "Examination Reports",
            description:
                "Open the examination area to view result analysis, subject performance, student performance and printable result reports.",
            icon: BookOpenCheck,
            tone: "blue",
            action: () => navigate("/examination"),
            button: "Open Examination Reports",
            available: true,
        },
        {
            title: "Student Reports",
            description:
                "A central place for individual student academic performance, grades, GPA, division and report information.",
            icon: GraduationCap,
            tone: "emerald",
            available: false,
        },
        {
            title: "Class Reports",
            description:
                "Class-level performance summaries including subjects, grades, GPA, division distribution and student comparison.",
            icon: Users,
            tone: "amber",
            available: false,
        },
        {
            title: "School Reports",
            description:
                "School-wide academic summaries for management, including overall performance and key reporting indicators.",
            icon: School,
            tone: "violet",
            available: false,
        },
    ];

    const toneMap = {
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        violet: "bg-violet-50 text-violet-700 border-violet-100",
    };

    return (
        <div className="min-h-full space-y-8 bg-slate-50 p-1 text-slate-800">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
                                AfriCore ERP
                            </p>
                            <h1 className="mt-1 text-3xl font-bold text-slate-900">
                                Reports
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                A simple reporting center for academic and school performance. Detailed reporting remains connected to the modules where the source data is created.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        <div className="flex items-center gap-2 font-semibold">
                            <CheckCircle2 className="h-4 w-4" />
                            Reporting Center Ready
                        </div>
                        <p className="mt-1 text-xs text-blue-600">
                            Examination reporting is already connected to the examination workflow.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {reportCards.map((card) => {
                    const Icon = card.icon;

                    return (
                        <div
                            key={card.title}
                            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div
                                    className={`flex h-11 w-11 items-center justify-center rounded-xl border ${toneMap[card.tone]}`}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        card.available
                                            ? "bg-green-100 text-green-700"
                                            : "bg-slate-100 text-slate-500"
                                    }`}
                                >
                                    {card.available ? "Available" : "Next Phase"}
                                </span>
                            </div>

                            <h2 className="mt-5 text-lg font-bold text-slate-900">
                                {card.title}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                {card.description}
                            </p>

                            {card.available ? (
                                <button
                                    type="button"
                                    onClick={card.action}
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                                >
                                    {card.button}
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            ) : (
                                <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500">
                                    <FileText className="h-4 w-4" />
                                    Prepared for next development phase
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900">Report Structure</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            Student, class and school reporting will use the same academic data already captured by AfriCore, including marks, grades, GPA, division and subject analysis. No separate duplicate data entry is required.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Report;
