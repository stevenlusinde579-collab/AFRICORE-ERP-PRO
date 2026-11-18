import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

function TimetableSettings() {
    const { schoolId, loading: schoolLoading } = useSchool();
    const [form, setForm] = useState({
        break_start: "",
        break_end: "",
        lunch_start: "",
        lunch_end: "",
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        let cancelled = false;

        const loadSettings = async () => {
            if (schoolLoading || !schoolId) return;

            const { data, error } = await supabase
                .from("timetable_settings")
                .select("*")
                .eq("school_id", Number(schoolId))
                .maybeSingle();

            if (error) {
                console.error("Unable to load timetable settings:", error);
                if (!cancelled) setMessage(error.message);
                return;
            }

            if (!cancelled && data) {
                setForm({
                    break_start: data.break_start || "",
                    break_end: data.break_end || "",
                    lunch_start: data.lunch_start || "",
                    lunch_end: data.lunch_end || "",
                });
            }
        };

        loadSettings();
        return () => { cancelled = true; };
    }, [schoolId, schoolLoading]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((previous) => ({ ...previous, [name]: value }));
    };

    const saveSettings = async (event) => {
        event.preventDefault();
        setMessage("");

        if (!schoolId) {
            setMessage("School information is unavailable. Please refresh and try again.");
            return;
        }

        setLoading(true);

        const { data: existing, error: lookupError } = await supabase
            .from("timetable_settings")
            .select("id")
            .eq("school_id", Number(schoolId))
            .maybeSingle();

        if (lookupError) {
            setMessage(lookupError.message);
            setLoading(false);
            return;
        }

        const response = existing
            ? await supabase.from("timetable_settings")
                .update(form)
                .eq("school_id", Number(schoolId))
            : await supabase.from("timetable_settings")
                .insert([{ school_id: Number(schoolId), ...form }]);

        if (response.error) {
            setMessage("Error: " + response.error.message);
        } else {
            setMessage("Settings saved successfully.");
        }

        setLoading(false);
    };

    if (schoolLoading) return <div className="p-6">Loading school settings...</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Timetable Settings</h1>
            <form onSubmit={saveSettings} className="bg-white shadow rounded-xl p-6 max-w-xl">
                <h2 className="font-bold text-xl mb-4">Break Time</h2>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <label>
                        <span className="block mb-1">Start Time</span>
                        <input type="time" name="break_start" value={form.break_start} onChange={handleChange} className="border p-3 rounded-lg w-full" />
                    </label>
                    <label>
                        <span className="block mb-1">End Time</span>
                        <input type="time" name="break_end" value={form.break_end} onChange={handleChange} className="border p-3 rounded-lg w-full" />
                    </label>
                </div>

                <h2 className="font-bold text-xl mb-4">Lunch Time</h2>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <label>
                        <span className="block mb-1">Start Time</span>
                        <input type="time" name="lunch_start" value={form.lunch_start} onChange={handleChange} className="border p-3 rounded-lg w-full" />
                    </label>
                    <label>
                        <span className="block mb-1">End Time</span>
                        <input type="time" name="lunch_end" value={form.lunch_end} onChange={handleChange} className="border p-3 rounded-lg w-full" />
                    </label>
                </div>

                {message && <div className="mt-4 bg-gray-100 p-3 rounded">{message}</div>}
                <button type="submit" disabled={loading || !schoolId} className="bg-purple-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg">
                    {loading ? "Saving..." : "Save Settings"}
                </button>
            </form>
        </div>
    );
}

export default TimetableSettings;
