import React from "react";
import { useNavigate } from "react-router-dom";
import {
    BrainCircuit,
    FileSearch,
    Lightbulb,
    Sparkles,
    ArrowRight,
    CheckCircle2,
    ShieldCheck,
    BarChart3,
} from "lucide-react";

function AI() {
    const navigate = useNavigate();

    const tools = [
        {
            title: "Examination Paper Analysis",
            description:
                "Use the existing examination AI workflow to upload a paper, analyze questions and continue through the examination process.",
            icon: FileSearch,
            available: true,
        },
        {
            title: "AI Result Insights",
            description:
                "Use examination result data to identify patterns, strong areas and areas that may need attention.",
            icon: BarChart3,
            available: false,
        },
        {
            title: "Smart School Assistant",
            description:
                "A future AI assistant for simple questions about school operations, academics and AfriCore ERP usage.",
            icon: Lightbulb,
            available: false,
        },
    ];

    return (
        <div className="min-h-full space-y-8 bg-slate-50 p-1 text-slate-800">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white md:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                                <BrainCircuit className="h-7 w-7" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-blue-200">
                                    <Sparkles className="h-4 w-4" />
                                    AfriCore Intelligence
                                </div>
                                <h1 className="mt-1 text-3xl font-bold">AI Center</h1>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
                                    A simple home for AfriCore AI features. The first practical AI workflow is already part of Examination: paper analysis and question extraction.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate("/examination")}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50"
                        >
                            Open Examination AI
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
                    <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Existing Workflow
                        </div>
                        <p className="mt-2 text-xs leading-5 text-green-700/80">
                            Examination paper AI analysis is already part of the examination workflow.
                        </p>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                            <ShieldCheck className="h-4 w-4" />
                            Controlled Use
                        </div>
                        <p className="mt-2 text-xs leading-5 text-blue-700/80">
                            AI supports staff workflows; it does not replace approval or academic controls.
                        </p>
                    </div>

                    <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                            <Sparkles className="h-4 w-4" />
                            Expandable
                        </div>
                        <p className="mt-2 text-xs leading-5 text-violet-700/80">
                            New AI features can be added here without changing existing school modules.
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-slate-900">AI Tools</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Simple entry points for the AI capabilities planned for AfriCore ERP.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {tools.map((tool) => {
                        const Icon = tool.icon;

                        return (
                            <div
                                key={tool.title}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            tool.available
                                                ? "bg-green-100 text-green-700"
                                                : "bg-slate-100 text-slate-500"
                                        }`}
                                    >
                                        {tool.available ? "Ready" : "Next Phase"}
                                    </span>
                                </div>

                                <h3 className="mt-5 text-lg font-bold text-slate-900">
                                    {tool.title}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {tool.description}
                                </p>

                                {tool.available && (
                                    <button
                                        type="button"
                                        onClick={() => navigate("/examination")}
                                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                                    >
                                        Go to Examination
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default AI;
