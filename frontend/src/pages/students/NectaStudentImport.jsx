import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { parseNectaWorkbook } from "../../utils/nectaPremsWorkbook";

const normalizeGender = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (["m", "male", "boy"].includes(v)) return "Male";
  if (["f", "female", "girl"].includes(v)) return "Female";
  return "";
};

const normalizePremsForm = (value) => {
  const text = String(value || "").trim().toUpperCase()
    .replace(/^FORM\s*/, "").replace(/^FORM\s*/, "").trim();
  const forms = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6 };
  if (/^[1-6]$/.test(text)) return Number(text);
  return forms[text] || null;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return value;
  }
  const localDate = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (localDate) {
    const day = Number(localDate[1]);
    const month = Number(localDate[2]);
    const year = Number(localDate[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString().slice(0, 10);
  }
  if (/^\d+(\.\d+)?$/.test(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

export default function NectaStudentImport() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const { schoolId, activeAcademicYearId, activeAcademicYear, academicYearLoading } = useSchool();
  const [parsed, setParsed] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [classId, setClassId] = useState("");
  const [combinationId, setCombinationId] = useState("");
  const [subjectIds, setSubjectIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!schoolId || !activeAcademicYearId) return;
      const { data, error } = await supabase.from("classes")
        .select("id,class_name,academic_level,academic_year_id,school_id")
        .eq("school_id", Number(schoolId))
        .eq("academic_year_id", Number(activeAcademicYearId))
        .eq("is_active", true).order("class_name");
      if (!alive) return;
      if (error) { setMessage(error.message); return; }
      setClasses(data || []);
    };
    load();
    return () => { alive = false; };
  }, [schoolId, activeAcademicYearId]);

  const selectedClass = classes.find((item) => String(item.id) === classId);
  const isAdvanced = String(selectedClass?.academic_level || "").trim().toLowerCase() === "advanced";

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setSubjects([]); setCombinations([]); setSubjectIds([]); setCombinationId("");
      if (!selectedClass || !schoolId) return;
      const [subjectResult, comboResult] = await Promise.all([
        supabase.from("subjects").select("id,subject_name,subject_code,education_level,is_active")
          .eq("education_level", selectedClass.academic_level).eq("is_active", true).order("subject_name"),
        supabase.from("subject_combinations").select("id,combination_code,combination_name,school_id,is_active")
          .eq("school_id", Number(schoolId)).eq("is_active", true).order("combination_name")
      ]);
      if (!alive) return;
      if (subjectResult.error) { setMessage(subjectResult.error.message); return; }
      setSubjects(subjectResult.data || []);
      if (comboResult.error) { setMessage(comboResult.error.message); return; }
      setCombinations(comboResult.data || []);
    };
    load();
    return () => { alive = false; };
  }, [classId, schoolId]);

  const rows = parsed?.students || [];
  const validation = useMemo(() => rows.map((row) => {
    const errors = [];
    if (!row.first_name) errors.push("First name missing");
    if (!row.last_name) errors.push("Surname missing");
    if (!row.admission_number) errors.push("Admission number missing");
    if (!normalizeGender(row.gender)) errors.push("Sex must be Male/Female");
    if (row.date_of_birth && !normalizeDate(row.date_of_birth)) errors.push("Invalid date of birth");
    return { ...row, errors };
  }), [rows]);
  const invalidCount = validation.filter((row) => row.errors.length).length;

  const readFile = async (file) => {
    setMessage(""); setParsed(null); setFileName(file?.name || "");
    if (!file) return;
    try { setParsed(await parseNectaWorkbook(file)); }
    catch (error) { setMessage(error.message || "Could not read the Excel file."); }
  };

  const toggleSubject = (id) => setSubjectIds((old) =>
    old.includes(id) ? old.filter((item) => item !== id) : [...old, id]
  );

  const importStudents = async () => {
    if (!schoolId || !activeAcademicYearId) return setMessage("School or active academic year is not ready.");
    if (!parsed || !rows.length) return setMessage("Choose a valid NECTA workbook first.");
    if (!selectedClass) return setMessage("Choose the AfriCore class for these students.");
    const premsForm = normalizePremsForm(parsed.metadata?.FORM);
    const classForm = normalizePremsForm(selectedClass.class_name);
    if (premsForm && classForm && premsForm !== classForm) {
      return setMessage("The Form in the NECTA workbook does not match the selected AfriCore class. Choose the matching class.");
    }
    if (invalidCount) return setMessage("Correct or remove all invalid rows before importing.");
    if (!subjectIds.length) return setMessage("Select at least one subject, as required by AfriCore.");
    if (isAdvanced && !combinationId) return setMessage("Choose the active Advanced combination.");
    if (isAdvanced) {
      const { data: links, error } = await supabase.from("combination_subjects")
        .select("subject_id").eq("combination_id", Number(combinationId));
      if (error) return setMessage(error.message);
      const expected = (links || []).map((x) => Number(x.subject_id)).sort((a,b)=>a-b);
      const actual = subjectIds.map(Number).sort((a,b)=>a-b);
      if (!expected.length || expected.length !== actual.length || expected.some((x,i)=>x!==actual[i])) {
        return setMessage("Selected subjects must exactly match the chosen Advanced combination.");
      }
    }
    setBusy(true); setMessage("");
    const school = Number(schoolId);
    const year = Number(activeAcademicYearId);
    const admissionNumbers = rows.map((r) => r.admission_number.trim());
    const normalizedAdmissions = admissionNumbers.map((value) => value.toLowerCase());
    if (new Set(normalizedAdmissions).size !== normalizedAdmissions.length) {
      setBusy(false);
      return setMessage("Import stopped: the Excel workbook contains repeated admission numbers. Correct the file before importing.");
    }
    try {
      const { data: existing, error: duplicateError } = await supabase.from("students")
        .select("admission_number").eq("school_id", school).eq("academic_year_id", year)
        .in("admission_number", admissionNumbers);
      if (duplicateError) throw duplicateError;
      const existingSet = new Set((existing || []).map((x) => String(x.admission_number).toLowerCase()));
      const duplicates = admissionNumbers.filter((x) => existingSet.has(x.toLowerCase()));
      if (duplicates.length) throw new Error(`Import stopped: ${duplicates.length} admission number(s) already exist in this school and academic year. No students were imported.`);

      const { data: classCheck, error: classError } = await supabase.from("classes")
        .select("id,school_id,academic_year_id,academic_level").eq("id", Number(classId))
        .eq("school_id", school).eq("academic_year_id", year).eq("is_active", true).single();
      if (classError || !classCheck) throw new Error("Selected class is no longer valid for this school and academic year.");

      const imported = [];
      try {
        for (const row of rows) {
          const payload = {
            school_id: school,
            academic_year_id: year,
            current_class_id: Number(classId),
            admission_number: row.admission_number.trim(),
            first_name: row.first_name.trim(),
            middle_name: row.middle_name.trim() || null,
            last_name: row.last_name.trim(),
            gender: normalizeGender(row.gender),
            date_of_birth: normalizeDate(row.date_of_birth),
            admission_date: null,
            student_status: "Active",
            status: "Active",
            stream: row.stream || null,
            combination_id: isAdvanced ? Number(combinationId) : null,
          };
          const { data: saved, error: saveError } = await supabase.from("students").insert(payload).select("id").single();
          if (saveError) throw new Error(`Row ${row.source_row}: ${saveError.message}`);
          imported.push(saved.id);
          const assignments = subjectIds.map((subjectId) => ({
            student_id: saved.id, subject_id: Number(subjectId),
            class_id: Number(classId), academic_year_id: year,
          }));
          const { error: subjectError } = await supabase.from("student_subjects").insert(assignments);
          if (subjectError) throw new Error(`Row ${row.source_row}: subject assignment failed: ${subjectError.message}`);
          const metadata = {
            student_id: saved.id, school_id: school,
            exam_number: row.exam_number || null,
            exam_year: /^\d{4}$/.test(row.exam_year) ? Number(row.exam_year) : null,
            registration_type: row.registration_type || null,
            form: parsed.metadata?.FORM || null,
            stream_trade: row.stream || null,
            source_school_number: parsed.metadata?.["SCHOOL NUMBER"] || null,
            source_school_name: parsed.metadata?.["SCHOOL NAME"] || null,
            import_source: "NECTA_PReMS",
          };
          const { error: metaError } = await supabase.from("necta_student_records").insert(metadata);
          if (metaError) throw new Error(`Row ${row.source_row}: NECTA details could not be saved: ${metaError.message}`);
        }
      } catch (error) {
        if (imported.length) {
          const { error: rollbackError } = await supabase.from("students").delete()
            .eq("school_id", school).in("id", imported);
          if (rollbackError) throw new Error(`${error.message} Rollback also failed; contact the system administrator immediately.`);
        }
        throw error;
      }
      setMessage(`Success: ${imported.length} student(s) imported and assigned to the selected class and subjects.`);
      setParsed(null); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) { setMessage(error.message || "Import failed."); }
    finally { setBusy(false); }
  };

  return <div className="p-6 max-w-7xl mx-auto">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div><h1 className="text-2xl font-bold text-gray-800">NECTA PReMS Student Import</h1>
        <p className="text-gray-600 mt-1">Import students using the official PReMS Admission Uploading Excel template.</p></div>
      <button onClick={() => navigate("/students")} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Back to Students</button>
    </div>
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        The import uses the currently selected AfriCore school and active academic year. It does not create classes or guess subject combinations. Guardian, disability, health and other profile fields are not in the 11-column PReMS template and will not be fabricated.
      </div>
      <label className="block font-medium">PReMS Excel workbook (.xlsx)
        <input ref={fileRef} type="file" accept=".xlsx" onChange={(e) => readFile(e.target.files?.[0])}
          className="block w-full mt-2 border rounded-lg p-3" />
      </label>
      {fileName && <p className="text-sm text-gray-600">Selected: {fileName}</p>}
      {parsed && <div className="text-sm text-gray-700">
        <p><b>NECTA source:</b> {parsed.metadata?.["SCHOOL NAME"] || "Not specified"} {parsed.metadata?.["SCHOOL NUMBER"] ? `(${parsed.metadata["SCHOOL NUMBER"]})` : ""}</p>
        <p><b>Form:</b> {parsed.metadata?.FORM || "Not specified"} · <b>Rows:</b> {rows.length} · <b>Invalid rows:</b> {invalidCount}</p>
      </div>}
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block text-sm font-medium">AfriCore class
          <select value={classId} onChange={(e)=>setClassId(e.target.value)} className="mt-1 w-full border rounded-lg p-3">
            <option value="">Choose class</option>{classes.map((c)=><option key={c.id} value={c.id}>{c.class_name} ({c.academic_level})</option>)}
          </select>
        </label>
        {isAdvanced && <label className="block text-sm font-medium">Advanced combination
          <select value={combinationId} onChange={(e)=>setCombinationId(e.target.value)} className="mt-1 w-full border rounded-lg p-3">
            <option value="">Choose combination</option>{combinations.map((c)=><option key={c.id} value={c.id}>{c.combination_code} - {c.combination_name}</option>)}
          </select>
        </label>}
      </div>
      {selectedClass && <div className="border rounded-lg p-4">
        <p className="font-semibold mb-2">Subjects to assign to every imported student</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {subjects.map((s)=><label key={s.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={subjectIds.includes(s.id)} onChange={()=>toggleSubject(s.id)} />
            {s.subject_name}
          </label>)}
        </div>
        {!subjects.length && <p className="text-sm text-amber-700">No active subjects found for this class level.</p>}
      </div>}
      {message && <div className="rounded-lg border p-3 text-sm" role="status">{message}</div>}
      {parsed && <div className="overflow-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50"><tr>{["Row","Admission No.","First name","Other name","Surname","Sex","Date of birth","Stream/Trade","Validation"].map((h)=><th key={h} className="text-left p-2 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{validation.slice(0,100).map((r)=><tr key={r.source_row} className="border-t">
            <td className="p-2">{r.source_row}</td><td className="p-2">{r.admission_number}</td><td className="p-2">{r.first_name}</td>
            <td className="p-2">{r.middle_name}</td><td className="p-2">{r.last_name}</td><td className="p-2">{r.gender}</td>
            <td className="p-2">{r.date_of_birth}</td><td className="p-2">{r.stream}</td>
            <td className="p-2 text-red-700">{r.errors.join(", ") || "OK"}</td>
          </tr>)}</tbody>
        </table>
        {validation.length>100 && <p className="p-3 text-sm text-gray-500">Showing first 100 of {validation.length} rows.</p>}
      </div>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy || academicYearLoading || !parsed || !selectedClass || invalidCount>0}
          onClick={importStudents} className="px-5 py-3 rounded-lg bg-blue-600 text-white disabled:opacity-50">
          {busy ? "Importing..." : `Import ${rows.length || 0} Student(s)`}
        </button>
      </div>
      <p className="text-xs text-gray-500">Active academic year: {activeAcademicYear?.year_name || (academicYearLoading ? "Loading..." : "Not configured")}. Duplicate admission numbers are checked before import. If any row fails during saving, the importer attempts to remove all students created by that batch.</p>
    </div>
  </div>;
}
