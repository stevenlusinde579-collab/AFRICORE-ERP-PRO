import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaCog, FaPlus } from "react-icons/fa";
import TimetableTable from "./TimetableTable";
import TimetableFilters from "./TimetableFilters";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

const LEVEL_LABELS = {
    Secondary: "Secondary",
    Advanced: "High School",
    Primary: "Primary",
    Nursery: "Kindergarten",
};

const LEVEL_ORDER = ["Secondary", "Advanced", "Primary", "Nursery"];

function Timetable() {
    const navigate = useNavigate();
    const { schoolId, loading: schoolLoading } = useSchool();
    const [availableLevels, setAvailableLevels] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState("");
    const [levelsLoading, setLevelsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadLevels = async () => {
            if (schoolLoading || !schoolId) return;
            setLevelsLoading(true);

            const { data, error } = await supabase
                .from("classes")
                .select("academic_level")
                .eq("school_id", Number(schoolId))
                .eq("is_active", true);

            if (error) {
                console.error("Unable to load timetable education levels:", error);
                if (!cancelled) {
                    setAvailableLevels([]);
                    setSelectedLevel("");
                    setLevelsLoading(false);
                }
                return;
            }

            const found = [...new Set(
                (data || [])
                    .map((item) => String(item.academic_level || "").trim())
                    .filter(Boolean)
            )].sort((a, b) => {
                const ai = LEVEL_ORDER.indexOf(a);
                const bi = LEVEL_ORDER.indexOf(b);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
            });

            if (!cancelled) {
                setAvailableLevels(found);
                setSelectedLevel((current) => found.includes(current) ? current : (found[0] || ""));
                setLevelsLoading(false);
            }
        };

        loadLevels();
        return () => { cancelled = true; };
    }, [schoolId, schoolLoading]);

    const selectedLevelLabel = LEVEL_LABELS[selectedLevel] || selectedLevel;

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                            <FaCalendarAlt className="text-xl" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-800">Timetable</h1>
                            <p className="text-slate-500 mt-1">
                                Manage and view the school timetable by education level.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/timetable/duty-schedule")}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-semibold shadow-sm transition"
                    >
                        <FaCalendarAlt /> Duty Schedule
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/timetable/settings")}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl font-semibold shadow-sm transition"
                    >
                        <FaCog /> Timetable Settings
                    </button>
                    <button
                        type="button"
                        disabled={!selectedLevel}
                        onClick={() => navigate(`/timetable/add?level=${encodeURIComponent(selectedLevel)}`)}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold shadow-sm transition"
                    >
                        <FaPlus /> Add Timetable
                    </button>
                </div>
            </div>

            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div>
                        <h2 className="font-bold text-slate-800">Education Level</h2>
                        <p className="text-sm text-slate-500">Switch between the levels offered by this school.</p>
                    </div>
                    {selectedLevel && (
                        <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                            {selectedLevelLabel} Timetable
                        </span>
                    )}
                </div>

                {schoolLoading || levelsLoading ? (
                    <p className="text-sm text-slate-500 py-2">Loading education levels...</p>
                ) : availableLevels.length > 0 ? (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Select education level">
                        {availableLevels.map((level) => {
                            const active = selectedLevel === level;
                            return (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setSelectedLevel(level)}
                                    aria-pressed={active}
                                    className={`px-5 py-2.5 rounded-lg border font-semibold transition ${active
                                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                        : "bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700"}`}
                                >
                                    {LEVEL_LABELS[level] || level}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                        No active classes with an education level were found for this school. Add or activate classes first.
                    </p>
                )}
            </section>

            <TimetableFilters />
            {selectedLevel ? (
                <TimetableTable academicLevel={selectedLevel} />
            ) : (
                <div className="bg-white rounded-xl shadow p-6 text-slate-500">
                    Select or configure an education level to view its timetable.
                </div>
            )}
        </div>
    );
}

export default Timetable;
