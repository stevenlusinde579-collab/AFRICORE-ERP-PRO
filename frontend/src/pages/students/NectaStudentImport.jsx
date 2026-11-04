import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";
import { parseNectaWorkbook } from "../../utils/nectaPremsWorkbook";
import { mergeNectaQualifiedProfiles, parseNectaQualifiedList, parseNectaStudentProfiles } from "../../utils/nectaPremsTextParser";

const normalizeSchoolNumber = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const normalizeGender = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (["m", "male", "boy"].includes(v)) return "Male";
  if (["f", "female", "girl"].includes(v)) return "Female";
  return "";
};

const normalizePremsForm = (value) => {
  const text = String(value || "").trim().toUpperCase()
    .replace(/^FORM\s*/, "").trim();
  const token = text.match(/^([1-6]|IV|VI|III|II|I|V|ONE|TWO|THREE|FOUR|FIVE|SIX)\b/)?.[1] || text;
  const forms = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6 };
  if (/^[1-6]$/.test(token)) return Number(token);
  return forms[token] || null;
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
  if (/^\d{4}$/.test(value)) return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (!Number.isFinite(serial) || serial < 1 || serial > 100000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function NectaStudentImport() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const { school, schoolId, activeAcademicYearId, activeAcademicYear, academicYearLoading } = useSchool();
  const { selectedRoleName } = useRole();
  const classTeacherSelected = String(selectedRoleName || "").trim().toLowerCase() === "class teacher";
  const [parsed, setParsed] = useState(null);
  const [classes, setClasses] = useState([]);
  const [assignedClassIds, setAssignedClassIds] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [classId, setClassId] = useState("");
  const [combinationId, setCombinationId] = useState("");
  const [subjectIds, setSubjectIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceMode, setSourceMode] = useState("workbook");
  const [qualifiedText, setQualifiedText] = useState("");
  const [profileText, setProfileText] = useState("");
  const [qualifiedPreview, setQualifiedPreview] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!schoolId || !activeAcademicYearId) return;
      const { data, error } = await supabase.from("classes")
        .select("id,class_name,short_name,academic_level,academic_year_id,school_id")
        .eq("school_id", Number(schoolId))
        .eq("academic_year_id", Number(activeAcademicYearId))
        .eq("is_active", true).order("class_name");
      if (!alive) return;
      if (error) { setMessage(error.message); return; }

      let visibleClasses = data || [];
      if (classTeacherSelected) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) { setMessage(authError.message); return; }
        if (!authData?.user) { setMessage("Your session has expired. Please login again."); return; }

        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("id,school_id,teacher_id")
          .eq("id", authData.user.id).single();
        if (profileError) { setMessage(profileError.message); return; }
        if (!profile?.teacher_id || Number(profile.school_id) !== Number(schoolId)) {
          setMessage("Your profile is not linked to a teacher record in this school.");
          setClasses([]); setAssignedClassIds([]); return;
        }

        const { data: assignments, error: assignmentError } = await supabase
          .from("teacher_assignments").select("class_id")
          .eq("school_id", Number(schoolId))
          .eq("teacher_id", profile.teacher_id);
        if (assignmentError) { setMessage(assignmentError.message); return; }

        const allowedIds = [...new Set((assignments || [])
          .map((item) => Number(item.class_id)).filter(Number.isFinite))];
        setAssignedClassIds(allowedIds);
        visibleClasses = visibleClasses.filter((item) => allowedIds.includes(Number(item.id)));
        if (!visibleClasses.length) {
          setMessage("You have not been assigned a class. Please contact the Academic Master or Headmaster.");
        }
      } else {
        setAssignedClassIds([]);
      }
      setClasses(visibleClasses);
    };
    load();
    return () => { alive = false; };
  }, [schoolId, activeAcademicYearId, classTeacherSelected]);

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
  const validation = useMemo(() => {
    const admissionCounts = new Map();
    for (const row of rows) {
      const key = String(row.admission_number || "").trim().toLowerCase();
      if (key) admissionCounts.set(key, (admissionCounts.get(key) || 0) + 1);
    }
    return rows.map((row) => {
      const errors = [];
      if (!row.first_name) errors.push("First name missing");
      if (!row.last_name) errors.push("Surname missing");
      if (!row.admission_number) errors.push("Admission number missing");
      if (row.admission_number && admissionCounts.get(String(row.admission_number).trim().toLowerCase()) > 1) {
        errors.push("Admission number repeated in this workbook");
      }
      if (!normalizeGender(row.gender)) errors.push("Sex must be Male/Female");
      if (row.date_of_birth && !normalizeDate(row.date_of_birth)) errors.push("Invalid date of birth");
      return { ...row, errors };
    });
  }, [rows]);
  const invalidCount = validation.filter((row) => row.errors.length).length;

  const readFile = async (file) => {
    setMessage(""); setParsed(null); setFileName(file?.name || "");
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setMessage("The Excel file is larger than 20 MB. Please split it into smaller files before importing.");
      return;
    }
    try { setParsed(await parseNectaWorkbook(file)); }
    catch (error) { setMessage(error.message || "Could not read the Excel file."); }
  };


  const previewCopiedPrems = () => {
    setMessage("");
    setQualifiedPreview(null);
    try {
      const qualified = parseNectaQualifiedList(qualifiedText);
      const profiles = parseNectaStudentProfiles(profileText);
      const merged = mergeNectaQualifiedProfiles(qualified, profiles.profiles);
      setQualifiedPreview({ ...merged, qualified_duplicates: qualified.duplicate_prem_numbers,
        profile_duplicates: profiles.duplicate_prem_numbers, total_qualified: qualified.row_count });
      if (qualified.duplicate_prem_numbers.length || profiles.duplicate_prem_numbers.length ||
          merged.unmatched_profile_prem_numbers.length || merged.mismatch_count) {
        setMessage("Preview imekamilika, lakini kuna marudio au kutolingana. Rekebisha kabla ya hatua ya kuingiza.");
      }
    } catch (error) {
      setMessage(error.message || "Imeshindikana kusoma maandishi ya PReMS.");
    }
  };


  const importCopiedProfiles = async () => {
    if (!qualifiedPreview?.students?.length) return setMessage("Tengeneza preview kwanza.");
    if (!schoolId || !activeAcademicYearId) return setMessage("School au academic year haijawa tayari.");
    if (!selectedClass) return setMessage("Chagua AfriCore class.");
    if (qualifiedPreview.qualified_duplicates.length || qualifiedPreview.profile_duplicates.length ||
        qualifiedPreview.unmatched_profile_prem_numbers.length ||
        qualifiedPreview.students.some((row) => row.profile_status !== "matched")) {
      return setMessage("Import imesimamishwa: rekebisha PREM duplicates, profiles zilizokosekana au taarifa zisizolingana kwanza.");
    }
    const rowsToImport = qualifiedPreview.students;
    if (rowsToImport.some((row) => !row.profile?.admission_number || !row.profile?.date_of_birth ||
        !normalizeDate(row.profile.date_of_birth) || !row.first_name || !row.last_name ||
        !normalizeGender(row.profile.gender))) {
      return setMessage("Kila profile lazima iwe na Admission Number, tarehe sahihi ya kuzaliwa, majina na jinsia.");
    }
    if (rowsToImport.length > 500) return setMessage("Ingiza wanafunzi kwa batch zisizozidi 500.");
    if (!subjectIds.length) return setMessage("Chagua angalau somo moja.");
    if (isAdvanced && !combinationId) return setMessage("Chagua Advanced combination.");
    if (isAdvanced) {
      const { data: links, error } = await supabase.from("combination_subjects").select("subject_id")
        .eq("combination_id", Number(combinationId));
      if (error) return setMessage(error.message);
      const expected = (links || []).map((item) => Number(item.subject_id)).sort((a,b)=>a-b);
      const actual = subjectIds.map(Number).sort((a,b)=>a-b);
      if (!expected.length || expected.length !== actual.length || expected.some((id,index)=>id!==actual[index])) {
        return setMessage("Masomo lazima yalingane kabisa na Advanced combination.");
      }
    }
    const classForm = normalizePremsForm(selectedClass.class_name) || normalizePremsForm(selectedClass.short_name);
    if (rowsToImport.some((row) => normalizePremsForm(row.profile.form) !== classForm)) {
      return setMessage("Form ya PReMS haifanani na class uliyochagua.");
    }
    const currentSchoolCode = String(school?.registration_number || "").trim().match(/^S\d+/i)?.[0]?.toUpperCase();
    const foreignSchool = rowsToImport.some((row) => {
      const sourceCode = String(row.profile.school || "").trim().match(/^S\d+/i)?.[0]?.toUpperCase();
      return currentSchoolCode && sourceCode && currentSchoolCode !== sourceCode;
    });
    if (foreignSchool) return setMessage("PReMS profile inaonyesha NECTA school number tofauti na shule ya AfriCore. Import imesimamishwa.");
    setBusy(true); setMessage("");
    try {
      const payload = rowsToImport.map((row) => ({
        ...row.profile, prem_number: row.prem_number, first_name: row.first_name,
        middle_name: row.middle_name || null, last_name: row.last_name,
        gender: normalizeGender(row.profile.gender), date_of_birth: normalizeDate(row.profile.date_of_birth)
      }));
      const { data, error } = await supabase.rpc("import_necta_prems_profile_students", {
        p_school_id: Number(schoolId), p_academic_year_id: Number(activeAcademicYearId),
        p_class_id: Number(classId), p_combination_id: isAdvanced ? Number(combinationId) : null,
        p_subject_ids: subjectIds.map(Number), p_profile_students: payload
      });
      if (error) {
        if (/import_necta_prems_profile_students.*does not exist|schema cache/i.test(error.message || "")) {
          throw new Error("NECTA profile migration bado haijawekwa kwenye database. Hakuna mwanafunzi aliyeingizwa.");
        }
        throw error;
      }
      if (Number(data?.imported_count || 0) !== rowsToImport.length) {
        throw new Error("Database haijathibitisha idadi yote ya wanafunzi. Wasiliana na msimamizi kabla ya kujaribu tena.");
      }
      setMessage(`Imefanikiwa: wanafunzi ${data.imported_count} wameingizwa pamoja na taarifa zao za PReMS.`);
      setQualifiedPreview(null); setQualifiedText(""); setProfileText("");
    } catch (error) {
      setMessage(error.message || "PReMS profile import imeshindikana.");
    } finally { setBusy(false); }
  };

  const toggleSubject = (id) => setSubjectIds((old) =>
    old.includes(id) ? old.filter((item) => item !== id) : [...old, id]
  );

  const importStudents = async () => {
    if (!schoolId || !activeAcademicYearId) return setMessage("School or active academic year is not ready.");
    if (!parsed || !rows.length) return setMessage("Choose a valid NECTA workbook first.");
    if (!selectedClass) return setMessage("Choose the AfriCore class for these students.");
    const sourceSchoolNumber = normalizeSchoolNumber(parsed.metadata?.["SCHOOL NUMBER"]);
    const currentSchoolNumber = normalizeSchoolNumber(school?.registration_number);
    const currentRegistrationLooksLikeNectaNumber = /^S\d+$/i.test(String(school?.registration_number || "").trim());
    if (!sourceSchoolNumber) {
      return setMessage("The NECTA workbook is missing its SCHOOL NUMBER metadata. Use the original PReMS template and confirm the source school.");
    }
    if (currentRegistrationLooksLikeNectaNumber && sourceSchoolNumber !== currentSchoolNumber) {
      return setMessage("The NECTA workbook School Number does not match this AfriCore school's NECTA-style registration number. Import stopped to protect school data.");
    }
    if (classTeacherSelected && !assignedClassIds.includes(Number(selectedClass.id))) {
      return setMessage("You can only import students into a class assigned to you.");
    }
    const premsForm = normalizePremsForm(parsed.metadata?.FORM);
    const classForm = normalizePremsForm(selectedClass.class_name) || normalizePremsForm(selectedClass.short_name);
    if (!premsForm) {
      return setMessage("The Form in the NECTA workbook could not be identified. Check that the workbook contains Form I, II, III, IV, V or VI.");
    }
    if (!classForm) {
      return setMessage("The selected AfriCore class name does not clearly identify Form I-VI. Select a correctly configured Form class before importing.");
    }
    if (premsForm !== classForm) {
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
    const currentSchoolId = Number(schoolId);
    const year = Number(activeAcademicYearId);
    const admissionNumbers = rows.map((r) => r.admission_number.trim());
    const normalizedAdmissions = admissionNumbers.map((value) => value.toLowerCase());
    if (new Set(normalizedAdmissions).size !== normalizedAdmissions.length) {
      setBusy(false);
      return setMessage("Import stopped: the Excel workbook contains repeated admission numbers. Correct the file before importing.");
    }
    try {
      const { error: metadataTableError } = await supabase
        .from("necta_student_records").select("id").limit(1);
      if (metadataTableError) {
        throw new Error("NECTA import storage is not ready. Ask the system administrator to apply the NECTA database migration before importing. No student records have been changed.");
      }

      const existingSet = new Set();
      let offset = 0;
      while (true) {
        const { data: existing, error: duplicateError } = await supabase.from("students")
          .select("admission_number").eq("school_id", currentSchoolId)
          .order("id", { ascending: true }).range(offset, offset + 999);
        if (duplicateError) throw duplicateError;
        for (const item of existing || []) {
          if (item.admission_number) existingSet.add(String(item.admission_number).trim().toLowerCase());
        }
        if (!existing || existing.length < 1000) break;
        offset += 1000;
      }
      const duplicates = admissionNumbers.filter((x) => existingSet.has(x.trim().toLowerCase()));
      if (duplicates.length) throw new Error(`Import stopped: ${duplicates.length} admission number(s) already exist in this school. No students were imported.`);

      const { data: classCheck, error: classError } = await supabase.from("classes")
        .select("id,school_id,academic_year_id,academic_level").eq("id", Number(classId))
        .eq("school_id", currentSchoolId).eq("academic_year_id", year).eq("is_active", true).single();
      if (classError || !classCheck) throw new Error("Selected class is no longer valid for this school and academic year.");

      const { data: verifiedSubjects, error: verifiedSubjectsError } = await supabase.from("subjects")
        .select("id").eq("education_level", classCheck.academic_level).eq("is_active", true)
        .in("id", subjectIds.map(Number));
      if (verifiedSubjectsError) throw verifiedSubjectsError;
      const verifiedIds = new Set((verifiedSubjects || []).map((item) => Number(item.id)));
      if (verifiedIds.size !== subjectIds.length || subjectIds.some((id) => !verifiedIds.has(Number(id)))) {
        throw new Error("One or more selected subjects are no longer active or do not belong to this class level. No students were imported.");
      }

      if (isAdvanced) {
        const { data: currentCombination, error: currentCombinationError } = await supabase
          .from("subject_combinations").select("id,school_id,is_active")
          .eq("id", Number(combinationId)).eq("school_id", currentSchoolId).eq("is_active", true).maybeSingle();
        if (currentCombinationError) throw currentCombinationError;
        if (!currentCombination) throw new Error("The selected Advanced combination is no longer active for this school.");
      }

      const importRows = rows.map((row) => ({
        admission_number: row.admission_number.trim(),
        first_name: row.first_name.trim(),
        middle_name: row.middle_name.trim() || null,
        last_name: row.last_name.trim(),
        gender: normalizeGender(row.gender),
        date_of_birth: normalizeDate(row.date_of_birth),
        stream: row.stream || null,
        exam_number: row.exam_number || null,
        exam_year: row.exam_year || null,
        registration_type: row.registration_type || null,
        form: parsed.metadata?.FORM || null,
        region: parsed.metadata?.REGION || null,
        district: parsed.metadata?.DISTRICT || null,
        source_school_number: parsed.metadata?.["SCHOOL NUMBER"] || null,
        source_school_name: parsed.metadata?.["SCHOOL NAME"] || null,
      }));

      const { data: importResult, error: importError } = await supabase.rpc(
        "import_necta_prems_students",
        {
          p_school_id: currentSchoolId,
          p_academic_year_id: year,
          p_class_id: Number(classId),
          p_combination_id: isAdvanced ? Number(combinationId) : null,
          p_subject_ids: subjectIds.map(Number),
          p_students: importRows,
        }
      );
      if (importError) {
        if (/function .*import_necta_prems_students.* does not exist|schema cache/i.test(importError.message || "")) {
          throw new Error("NECTA database migration is not installed yet. No students were imported.");
        }
        throw new Error(importError.message || "The NECTA import transaction failed. No students were imported.");
      }
      const importedCount = Number(importResult?.imported_count || 0);
      if (importedCount !== rows.length) {
        throw new Error("The database did not confirm every imported student. Please ask the administrator to verify the import.");
      }
      setMessage(`Success: ${importedCount} student(s) imported and assigned to the selected class and subjects.`);
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

      <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">Njia ya pili: PReMS Qualified List + Student Profile</h2>
          <p className="text-sm text-gray-600">Bandika orodha ya Qualified na profiles ulizonakili kutoka PReMS. Mfumo utaoanisha kwa PREM Number na kuonyesha preview tu.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setSourceMode("workbook"); setQualifiedPreview(null); }}
            className={`px-3 py-2 rounded-lg text-sm ${sourceMode === "workbook" ? "bg-blue-600 text-white" : "bg-white border"}`}>Excel workbook</button>
          <button type="button" onClick={() => { setSourceMode("copied"); setParsed(null); setFileName(""); }}
            className={`px-3 py-2 rounded-lg text-sm ${sourceMode === "copied" ? "bg-blue-600 text-white" : "bg-white border"}`}>Copied PReMS text</button>
        </div>
        {sourceMode === "copied" && <>
          <label className="block text-sm font-medium">Qualified List (copy table yote kutoka PReMS)
            <textarea value={qualifiedText} onChange={(e) => setQualifiedText(e.target.value)}
              rows={7} className="mt-1 w-full border rounded-lg p-3 font-mono text-xs"
              placeholder="Prem Number | Cert. Entry Number | Full Name | Sex | Status..." />
          </label>
          <label className="block text-sm font-medium">Student Profile(s) (bandika profile moja au nyingi)
            <textarea value={profileText} onChange={(e) => setProfileText(e.target.value)}
              rows={10} className="mt-1 w-full border rounded-lg p-3 font-mono text-xs"
              placeholder="Bandika maandishi ya Student Profile hapa..." />
          </label>
          {message && <div className="rounded-lg border p-3 text-sm" role="status">{message}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={previewCopiedPrems}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Tengeneza preview</button>
            <button type="button" onClick={() => { setQualifiedText(""); setProfileText(""); setQualifiedPreview(null); setMessage(""); }}
              className="px-4 py-2 rounded-lg bg-white border">Futa maandishi</button>
          </div>
          {qualifiedPreview && <>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm font-medium">AfriCore class
              <select value={classId} onChange={(e)=>setClassId(e.target.value)} className="mt-1 w-full border rounded-lg p-3">
                <option value="">Chagua class</option>{classes.map((item)=><option key={item.id} value={item.id}>{item.class_name} ({item.academic_level})</option>)}
              </select>
            </label>
            {isAdvanced && <label className="block text-sm font-medium">Advanced combination
              <select value={combinationId} onChange={(e)=>setCombinationId(e.target.value)} className="mt-1 w-full border rounded-lg p-3">
                <option value="">Chagua combination</option>{combinations.map((item)=><option key={item.id} value={item.id}>{item.combination_code} - {item.combination_name}</option>)}
              </select>
            </label>}
          </div>
          {selectedClass && <div className="border rounded-lg bg-white p-4">
            <p className="font-semibold mb-2">Masomo ya wanafunzi hawa</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {subjects.map((subject)=><label key={subject.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={()=>toggleSubject(subject.id)} />
                {subject.subject_name}
              </label>)}
            </div>
          </div>}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="rounded-lg bg-white border p-3"><b>{qualifiedPreview.total_qualified}</b><div>Qualified rows</div></div>
              <div className="rounded-lg bg-white border p-3"><b>{qualifiedPreview.matched_count}</b><div>Profiles matched</div></div>
              <div className="rounded-lg bg-white border p-3"><b>{qualifiedPreview.missing_profile_count}</b><div>Profiles missing</div></div>
              <div className="rounded-lg bg-white border p-3"><b>{qualifiedPreview.mismatch_count}</b><div>Mismatch/duplicate</div></div>
            </div>
            {(qualifiedPreview.qualified_duplicates.length || qualifiedPreview.profile_duplicates.length ||
              qualifiedPreview.unmatched_profile_prem_numbers.length) > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <b>Ukaguzi unahitajika:</b>
              {qualifiedPreview.qualified_duplicates.length > 0 && <p>PREM zilizojirudia Qualified: {qualifiedPreview.qualified_duplicates.join(", ")}</p>}
              {qualifiedPreview.profile_duplicates.length > 0 && <p>PREM zilizojirudia Profiles: {qualifiedPreview.profile_duplicates.join(", ")}</p>}
              {qualifiedPreview.unmatched_profile_prem_numbers.length > 0 && <p>Profiles zisizopatikana Qualified list: {qualifiedPreview.unmatched_profile_prem_numbers.join(", ")}</p>}
            </div>}
            <div className="overflow-auto border rounded-lg bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100"><tr>{["PREM Number","Full Name (Qualified)","Sex","Admission No.","DOB","Profile check","Warnings"].map((h)=><th key={h} className="text-left p-2 whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{qualifiedPreview.students.slice(0,100).map((row)=><tr key={row.prem_number} className="border-t">
                  <td className="p-2 whitespace-nowrap">{row.prem_number}</td><td className="p-2">{row.full_name}</td>
                  <td className="p-2">{row.gender || row.source_sex}</td><td className="p-2">{row.profile?.admission_number || "—"}</td>
                  <td className="p-2">{row.profile?.date_of_birth || "—"}</td><td className="p-2">{row.profile_status}</td>
                  <td className="p-2">{row.profile_warnings.join("; ") || "—"}</td>
                </tr>)}</tbody>
              </table>
              {qualifiedPreview.students.length > 100 && <p className="p-2 text-gray-500">Inaonyesha 100 kati ya {qualifiedPreview.students.length}.</p>}
            </div>
            <p className="text-xs text-amber-800">Import itaruhusiwa tu ikiwa kila profile imeoanisha na haina taarifa zinazokosekana au marudio.</p>
            <button type="button" disabled={busy || !selectedClass || qualifiedPreview.students.some((row)=>row.profile_status!=="matched")}
              onClick={importCopiedProfiles} className="px-5 py-3 rounded-lg bg-blue-700 text-white disabled:opacity-50">
              {busy ? "Inaingiza..." : `Ingiza ${qualifiedPreview.students.length} mwanafunzi`}
            </button>
          </>}
        </>}
      </div>
      {sourceMode === "workbook" && <>
      <label className="block font-medium">PReMS Excel workbook (.xlsx)
        <input ref={fileRef} type="file" accept=".xlsx" onChange={(e) => readFile(e.target.files?.[0])}
          className="block w-full mt-2 border rounded-lg p-3" />
      </label>
      {fileName && <p className="text-sm text-gray-600">Selected: {fileName}</p>}
      {parsed && <div className="text-sm text-gray-700">
        <p><b>NECTA source:</b> {parsed.metadata?.["SCHOOL NAME"] || "Not specified"} {parsed.metadata?.["SCHOOL NUMBER"] ? `(${parsed.metadata["SCHOOL NUMBER"]})` : ""}</p>
        <p><b>AfriCore destination:</b> {school?.school_name || "Current school"} {school?.registration_number ? `(${school.registration_number})` : ""}</p>
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
      </>}
      <p className="text-xs text-gray-500">Active academic year: {activeAcademicYear?.year_name || (academicYearLoading ? "Loading..." : "Not configured")}. Duplicate admission numbers are checked before import. If any row fails during saving, the importer attempts to remove all students created by that batch.</p>
    </div>
  </div>;
}
