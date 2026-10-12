import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

const EMPTY_FORM = {
  combination_code: "",
  combination_name: "",
  level_scope: "Both",
  description: "",
  subject_ids: [],
};

function AdvancedCombinations() {
  const { schoolId } = useSchool();
  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!schoolId) {
      setRows([]);
      setSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [combinationResult, subjectResult] = await Promise.all([
      supabase
        .from("subject_combinations")
        .select("id,school_id,combination_code,combination_name,level_scope,description,suggested_subjects,is_system_default,is_active")
        .or("school_id.is.null,school_id.eq." + Number(schoolId))
        .order("combination_code"),
      supabase
        .from("subjects")
        .select("id,subject_name,subject_code,education_level,is_active")
        .eq("education_level", "Advanced")
        .eq("is_active", true)
        .order("subject_name"),
    ]);
    if (combinationResult.error) setError(combinationResult.error.message);
    else {
      const combinations = combinationResult.data || [];
      const ids = combinations.map((item) => item.id);
      let mapping = [];
      if (ids.length) {
        const result = await supabase
          .from("combination_subjects")
          .select("combination_id,subject_id")
          .in("combination_id", ids);
        if (result.error) setError(result.error.message);
        else mapping = result.data || [];
      }
      setRows(combinations.map((item) => ({
        ...item,
        subject_ids: mapping
          .filter((link) => Number(link.combination_id) === Number(item.id))
          .map((link) => Number(link.subject_id)),
      })));
    }
    if (subjectResult.error) setError((old) => old || subjectResult.error.message);
    else setSubjects(subjectResult.data || []);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setMessage("");
    setError("");
  };

  const chooseTemplate = (row) => {
    setEditingId(null);
    setMessage("");
    setError("");
    const suggestedIds = subjects
      .filter((subject) => (row.suggested_subjects || []).some(
        (name) => name.toLowerCase() === subject.subject_name.toLowerCase()
      ))
      .map((subject) => Number(subject.id));
    setForm({
      combination_code: row.combination_code,
      combination_name: row.combination_name,
      level_scope: row.level_scope || "Both",
      description: row.description || "",
      subject_ids: suggestedIds,
    });
    if (!suggestedIds.length && (row.suggested_subjects || []).length) {
      setMessage("Template loaded. Choose the matching subjects from your school's Advanced subject list.");
    }
  };

  const editCombination = (row) => {
    if (row.is_system_default || Number(row.school_id) !== Number(schoolId)) return;
    setEditingId(row.id);
    setMessage("");
    setError("");
    setForm({
      combination_code: row.combination_code || "",
      combination_name: row.combination_name || "",
      level_scope: row.level_scope || "Both",
      description: row.description || "",
      subject_ids: row.subject_ids || [],
    });
  };

  const toggleSubject = (subjectId) => {
    setForm((old) => ({
      ...old,
      subject_ids: old.subject_ids.includes(Number(subjectId))
        ? old.subject_ids.filter((id) => id !== Number(subjectId))
        : [...old.subject_ids, Number(subjectId)],
    }));
  };

  const saveCombination = async (event) => {
    event.preventDefault();
    if (!schoolId) return setError("School could not be identified.");
    if (!form.combination_code.trim() || !form.combination_name.trim()) {
      return setError("Enter both combination code and name.");
    }
    if (!form.subject_ids.length) {
      return setError("Choose at least one Advanced subject for this combination.");
    }

    setSaving(true);
    setError("");
    setMessage("");
    let combinationId = editingId;
    const payload = {
      school_id: Number(schoolId),
      combination_code: form.combination_code.trim().toUpperCase(),
      combination_name: form.combination_name.trim(),
      level_scope: form.level_scope,
      description: form.description.trim() || null,
      suggested_subjects: subjects
        .filter((subject) => form.subject_ids.includes(Number(subject.id)))
        .map((subject) => subject.subject_name),
      is_system_default: false,
      is_active: true,
    };

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("subject_combinations")
          .update(payload)
          .eq("id", editingId)
          .eq("school_id", Number(schoolId));
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("subject_combinations")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        combinationId = data.id;
      }

      if (editingId) {
        const { error: deleteError } = await supabase
          .from("combination_subjects")
          .delete()
          .eq("combination_id", combinationId);
        if (deleteError) throw deleteError;
      }

      const links = form.subject_ids.map((subjectId) => ({
        combination_id: combinationId,
        subject_id: Number(subjectId),
      }));
      const { error: linkError } = await supabase
        .from("combination_subjects")
        .insert(links);
      if (linkError) throw linkError;

      setMessage(editingId ? "Combination updated successfully." : "Combination created successfully.");
      resetForm();
      await loadData();
    } catch (saveError) {
      setError(saveError?.message || "Unable to save combination.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    if (row.is_system_default || Number(row.school_id) !== Number(schoolId)) return;
    const { error: updateError } = await supabase
      .from("subject_combinations")
      .update({ is_active: !row.is_active })
      .eq("id", row.id)
      .eq("school_id", Number(schoolId));
    if (updateError) setError(updateError.message);
    else await loadData();
  };

  const deleteCombination = async (row) => {
    if (row.is_system_default || Number(row.school_id) !== Number(schoolId)) return;
    if (!window.confirm("Delete " + row.combination_code + "? This does not delete subjects or marks.")) return;
    const { error: deleteError } = await supabase
      .from("subject_combinations")
      .delete()
      .eq("id", row.id)
      .eq("school_id", Number(schoolId));
    if (deleteError) setError(deleteError.message);
    else {
      setMessage("Combination deleted. Existing student records and marks were not deleted.");
      await loadData();
    }
  };

  const defaults = rows.filter((row) => row.is_system_default);
  const customRows = rows.filter((row) => !row.is_system_default);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Advanced Combinations</h1>
        <p className="mt-2 text-slate-600">Manage Form 5 and Form 6 subject combinations. Templates are starting points; verify subjects against the curriculum approved by your school.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800">{message}</div>}

      <section className="rounded-xl border bg-white p-4 md:p-6">
        <h2 className="text-xl font-semibold mb-3">Standard Tanzania templates</h2>
        <p className="text-sm text-slate-600 mb-4">Choose a template to start a school-owned combination. Suggested subject names are matched to your school's active Advanced subjects where possible.</p>
        {loading ? <p>Loading combinations...</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {defaults.map((row) => (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="font-bold text-blue-800">{row.combination_code}</div>
                <div className="text-sm font-medium mt-1">{row.combination_name}</div>
                <div className="text-xs text-slate-500 mt-2">Suggested: {(row.suggested_subjects || []).join(", ") || "Choose subjects manually"}</div>
                <button type="button" onClick={() => chooseTemplate(row)} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Use template</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">{editingId ? "Edit school combination" : "Create your school's combination"}</h2>
          {(editingId || form.combination_code) && <button type="button" onClick={resetForm} className="rounded-lg border px-3 py-2 text-sm">Clear form</button>}
        </div>
        <form onSubmit={saveCombination} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm font-medium">Combination code
              <input value={form.combination_code} onChange={(e) => setForm((old) => ({ ...old, combination_code: e.target.value }))} required maxLength={24} className="mt-1 w-full rounded-lg border p-3" placeholder="e.g. PCM" />
            </label>
            <label className="block text-sm font-medium">Combination name
              <input value={form.combination_name} onChange={(e) => setForm((old) => ({ ...old, combination_name: e.target.value }))} required className="mt-1 w-full rounded-lg border p-3" placeholder="e.g. Physics, Chemistry and Mathematics" />
            </label>
            <label className="block text-sm font-medium">Applies to
              <select value={form.level_scope} onChange={(e) => setForm((old) => ({ ...old, level_scope: e.target.value }))} className="mt-1 w-full rounded-lg border p-3">
                <option>Both</option><option>Form 5</option><option>Form 6</option>
              </select>
            </label>
            <label className="block text-sm font-medium">Description (optional)
              <input value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} className="mt-1 w-full rounded-lg border p-3" placeholder="Notes for this combination" />
            </label>
          </div>
          <div>
            <div className="font-semibold mb-2">Select Advanced subjects ({form.subject_ids.length} selected)</div>
            {subjects.length === 0 ? <p className="text-sm text-amber-700">No active subjects with education level “Advanced” were found. Add or activate Advanced subjects first.</p> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {subjects.map((subject) => (
                  <label key={subject.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <input type="checkbox" checked={form.subject_ids.includes(Number(subject.id))} onChange={() => toggleSubject(subject.id)} />
                    <span>{subject.subject_name}{subject.subject_code ? " (" + subject.subject_code + ")" : ""}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button disabled={saving || !subjects.length} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save changes" : "Create combination"}</button>
        </form>
      </section>

      <section className="rounded-xl border bg-white p-4 md:p-6">
        <h2 className="text-xl font-semibold mb-4">Your school's combinations</h2>
        {loading ? <p>Loading...</p> : customRows.length === 0 ? <p className="text-slate-600">No school-owned combinations yet. Create one above or start from a template.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b bg-slate-50"><th className="p-3">Code</th><th className="p-3">Name</th><th className="p-3">Level</th><th className="p-3">Subjects</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
              <tbody>{customRows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-3 font-bold">{row.combination_code}</td>
                  <td className="p-3">{row.combination_name}</td>
                  <td className="p-3">{row.level_scope}</td>
                  <td className="p-3">{row.subject_ids.map((id) => subjects.find((s) => Number(s.id) === id)?.subject_name).filter(Boolean).join(", ") || (row.suggested_subjects || []).join(", ")}</td>
                  <td className="p-3">{row.is_active ? "Active" : "Inactive"}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => editCombination(row)} className="rounded border px-2 py-1">Edit</button>
                    <button type="button" onClick={() => toggleActive(row)} className="rounded border px-2 py-1">{row.is_active ? "Deactivate" : "Activate"}</button>
                    <button type="button" onClick={() => deleteCombination(row)} className="rounded border border-red-200 px-2 py-1 text-red-700">Delete</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdvancedCombinations;
