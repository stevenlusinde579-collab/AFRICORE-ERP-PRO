import {
  useCallback,
  useEffect,
  useState
} from "react";

import {
  useParams,
  useNavigate
} from "react-router-dom";

import { supabase } from "../../services/supabase";

import { useSchool } from "../../context/SchoolContext";


function EditStudent() {

  const { id } = useParams();

  const navigate = useNavigate();


  // =====================================================
  // GLOBAL SCHOOL / ACADEMIC YEAR
  // =====================================================

  const {
    schoolId,
    activeAcademicYear,
    activeAcademicYearId,
    academicYearLoading,
    academicYearError
  } = useSchool();


  // =====================================================
  // STATES
  // =====================================================

  const [student, setStudent] = useState(null);

  const [classes, setClasses] = useState([]);

  const [subjects, setSubjects] = useState([]);

  const [selectedSubjects, setSelectedSubjects] = useState([]);

  const [loading, setLoading] = useState(true);

  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");


  // =====================================================
  // LOAD CLASSES
  // =====================================================

  const loadClasses = useCallback(
    async (
      currentSchoolId,
      currentAcademicYearId
    ) => {

      if (
        !currentSchoolId ||
        !currentAcademicYearId
      ) {

        setClasses([]);

        return;

      }


      const {
        data,
        error
      } = await supabase

        .from("classes")

        .select(`
          id,
          class_name,
          academic_level,
          short_name,
          academic_year_id,
          school_id
        `)

        .eq(
          "school_id",
          Number(currentSchoolId)
        )

        .eq(
          "academic_year_id",
          Number(currentAcademicYearId)
        )

        .order(
          "class_name"
        );


      console.log(
        "EDIT STUDENT CLASSES:",
        data
      );


      console.log(
        "EDIT STUDENT CLASS ERROR:",
        error
      );


      if (error) {

        setError(
          error.message
        );

        setClasses([]);

        return;

      }


      setClasses(
        data || []
      );

    },
    []
  );


  // =====================================================
  // LOAD STUDENT SUBJECT ASSIGNMENTS
  // =====================================================

  const loadStudentSubjects = useCallback(
    async (
      studentId,
      classId,
      currentAcademicYearId
    ) => {

      if (!studentId) {

        setSelectedSubjects([]);

        return;

      }


      const {
        data,
        error
      } = await supabase

        .from("student_subjects")

        .select(`
          student_id,
          subject_id,
          class_id,
          academic_year_id
        `)

        .eq(
          "student_id",
          Number(studentId)
        );


      console.log(
        "STUDENT SUBJECT ASSIGNMENTS:",
        data
      );


      console.log(
        "STUDENT SUBJECT ASSIGNMENT ERROR:",
        error
      );


      if (error) {

        setError(
          error.message
        );

        setSelectedSubjects([]);

        return;

      }


      // =================================================
      // ONLY SUBJECTS FOR CURRENT CLASS
      //
      // AND CURRENT GLOBAL ACADEMIC YEAR
      //
      // Some old records may not have academic_year_id.
      // Therefore class matching remains the primary
      // protection while the current-year records are
      // preferred.
      // =================================================

      let currentAssignments =
        (data || []).filter(
          record =>
            !classId ||
            Number(record.class_id) ===
            Number(classId)
        );


      if (
        currentAcademicYearId
      ) {

        const yearAssignments =
          currentAssignments.filter(
            record =>
              record.academic_year_id == null ||
              Number(
                record.academic_year_id
              ) ===
              Number(
                currentAcademicYearId
              )
          );


        if (
          yearAssignments.length > 0
        ) {

          currentAssignments =
            yearAssignments;

        }

      }


      const subjectIds =
        currentAssignments

          .map(
            record =>
              Number(
                record.subject_id
              )
          )

          .filter(
            subjectId =>
              Number.isFinite(
                subjectId
              )
          );


      setSelectedSubjects(
        Array.from(
          new Set(
            subjectIds
          )
        )
      );

    },
    []
  );


  // =====================================================
  // LOAD STUDENT
  // =====================================================

  const loadStudent = useCallback(
    async (
      studentId,
      currentSchoolId,
      currentAcademicYearId
    ) => {

      if (
        !studentId ||
        !currentSchoolId ||
        !currentAcademicYearId
      ) {

        setStudent(null);

        return;

      }


      const {
        data,
        error
      } = await supabase

        .from("students")

        .select("*")

        .eq(
          "id",
          studentId
        )

        .eq(
          "school_id",
          Number(currentSchoolId)
        )

        .eq(
          "academic_year_id",
          Number(currentAcademicYearId)
        )

        .single();


      console.log(
        "EDIT STUDENT:",
        data
      );


      console.log(
        "EDIT STUDENT ERROR:",
        error
      );


      if (error) {

        console.error(
          "LOAD STUDENT ERROR:",
          error
        );

        setStudent(null);

        setError(
          error.code === "PGRST116"
            ? "Student could not be found in the active academic year."
            : error.message
        );

        return;

      }


      setStudent(
        data
      );


      // =================================================
      // LOAD STUDENT SUBJECTS
      // =================================================

      await loadStudentSubjects(
        data.id,
        data.current_class_id,
        currentAcademicYearId
      );

    },
    [
      loadStudentSubjects
    ]
  );


  // =====================================================
  // LOAD INITIAL DATA
  //
  // GLOBAL ACADEMIC YEAR IS READY FIRST
  // =====================================================

  useEffect(() => {

    if (
      academicYearLoading
    ) {

      return;

    }


    if (
      !schoolId ||
      !activeAcademicYearId
    ) {

      setLoading(false);

      setClasses([]);

      setStudent(null);

      return;

    }


    const loadData = async () => {

      setLoading(true);

      setError("");

      setMessage("");

      setStudent(null);

      setSubjects([]);

      setSelectedSubjects([]);


      await Promise.all([

        loadClasses(
          schoolId,
          activeAcademicYearId
        ),

        loadStudent(
          id,
          schoolId,
          activeAcademicYearId
        )

      ]);


      setLoading(false);

    };


    loadData();

  }, [
    id,
    schoolId,
    activeAcademicYearId,
    academicYearLoading,
    loadClasses,
    loadStudent
  ]);


  // =====================================================
  // LOAD SUBJECTS FOR CLASS
  // =====================================================

  const loadSubjectsForClass = useCallback(
    async (
      classId,
      preserveSelection = false
    ) => {

      if (!classId) {

        setSubjects([]);

        if (
          !preserveSelection
        ) {

          setSelectedSubjects([]);

        }

        return;

      }


      const selectedClass =
        classes.find(
          item =>
            Number(item.id) ===
            Number(classId)
        );


      if (!selectedClass) {

        setSubjects([]);

        if (
          !preserveSelection
        ) {

          setSelectedSubjects([]);

        }

        return;

      }


      // =================================================
      // SECURITY / YEAR VALIDATION
      // =================================================

      if (
        !schoolId ||
        !activeAcademicYearId
      ) {

        setSubjects([]);

        setSelectedSubjects([]);

        setError(
          "No active academic year is configured."
        );

        return;

      }


      if (
        Number(
          selectedClass.school_id
        ) !==
        Number(
          schoolId
        )
      ) {

        setSubjects([]);

        setSelectedSubjects([]);

        setError(
          "The selected class does not belong to the current school."
        );

        return;

      }


      if (
        Number(
          selectedClass.academic_year_id
        ) !==
        Number(
          activeAcademicYearId
        )
      ) {

        setSubjects([]);

        setSelectedSubjects([]);

        setError(
          "The selected class does not belong to the active academic year."
        );

        return;

      }


      setLoadingSubjects(true);

      setError("");


      console.log(
        "SELECTED EDIT CLASS:",
        selectedClass
      );


      const {
        data,
        error
      } = await supabase

        .from("subjects")

        .select(`
          id,
          subject_name,
          subject_code,
          education_level,
          class_scope,
          is_active,
          is_compulsory
        `)

        .eq(
          "education_level",
          selectedClass.academic_level
        )

        .eq(
          "is_active",
          true
        )

        .order(
          "subject_name"
        );


      console.log(
        "EDIT SUBJECTS:",
        data
      );


      console.log(
        "EDIT SUBJECT ERROR:",
        error
      );


      setLoadingSubjects(false);


      if (error) {

        setError(
          error.message
        );

        setSubjects([]);

        return;

      }


      setSubjects(
        data || []
      );


      // =================================================
      // WHEN CHANGING CLASS
      // CLEAR OLD SELECTION
      // =================================================

      if (
        !preserveSelection
      ) {

        setSelectedSubjects([]);

      }

    },
    [
      classes,
      schoolId,
      activeAcademicYearId
    ]
  );


  // =====================================================
  // WHEN STUDENT + CLASSES ARE READY
  //
  // LOAD SUBJECTS FOR CURRENT CLASS
  // =====================================================

  useEffect(() => {

    if (
      !student ||
      !student.current_class_id ||
      classes.length === 0 ||
      !activeAcademicYearId
    ) {

      return;

    }


    const loadEditSubjects =
      async () => {

        await loadSubjectsForClass(
          student.current_class_id,
          true
        );

      };


    loadEditSubjects();

  }, [
    student,
    classes,
    activeAcademicYearId,
    loadSubjectsForClass
  ]);


  // =====================================================
  // HANDLE FORM CHANGE
  // =====================================================

  const handleChange = async (e) => {

    const {
      name,
      value
    } = e.target;


    // =================================================
    // ACADEMIC YEAR MUST NEVER BE MANUALLY CHANGED
    // =================================================

    if (
      name === "academic_year_id"
    ) {

      return;

    }


    setStudent(
      previous => ({
        ...previous,
        [name]: value
      })
    );


    setMessage("");

    setError("");


    // =================================================
    // CLASS CHANGED
    // =================================================

    if (
      name === "current_class_id"
    ) {

      await loadSubjectsForClass(
        value,
        false
      );

    }

  };


  // =====================================================
  // HANDLE SUBJECT SELECTION
  // =====================================================

  const handleSubjectChange = (
    subjectId
  ) => {

    const numericSubjectId =
      Number(subjectId);


    setSelectedSubjects(
      previous => {

        if (
          previous.includes(
            numericSubjectId
          )
        ) {

          return previous.filter(
            subject =>
              Number(subject) !==
              numericSubjectId
          );

        }


        return [
          ...previous,
          numericSubjectId
        ];

      }
    );


    setMessage("");

    setError("");

  };


  // =====================================================
  // SELECT ALL SUBJECTS
  // =====================================================

  const selectAllSubjects = () => {

    const allSubjectIds =
      subjects.map(
        subject =>
          Number(subject.id)
      );


    setSelectedSubjects(
      allSubjectIds
    );

  };


  // =====================================================
  // CLEAR SUBJECTS
  // =====================================================

  const clearSubjects = () => {

    setSelectedSubjects([]);

  };


  // =====================================================
  // UPDATE STUDENT
  // =====================================================

  const updateStudent = async (e) => {

    e.preventDefault();


    if (!student) {

      return;

    }


    setSaving(true);

    setMessage("");

    setError("");


    try {

      // =================================================
      // GLOBAL CONTEXT VALIDATION
      // =================================================

      if (
        !schoolId
      ) {

        throw new Error(
          "School information is not available."
        );

      }


      if (
        !activeAcademicYearId
      ) {

        throw new Error(
          "No active academic year is configured. Please configure it in Settings."
        );

      }


      const currentSchoolId =
        Number(
          schoolId
        );


      const currentAcademicYearId =
        Number(
          activeAcademicYearId
        );


      // =================================================
      // CLASS VALIDATION
      // =================================================

      if (
        !student.current_class_id
      ) {

        throw new Error(
          "Please select the student's class."
        );

      }


      const currentClassId =
        Number(
          student.current_class_id
        );


      const selectedClass =
        classes.find(
          item =>
            Number(item.id) ===
            currentClassId
        );


      if (
        !selectedClass
      ) {

        throw new Error(
          "The selected class is not available in the active academic year."
        );

      }


      if (
        Number(
          selectedClass.school_id
        ) !==
        currentSchoolId
      ) {

        throw new Error(
          "The selected class does not belong to the current school."
        );

      }


      if (
        Number(
          selectedClass.academic_year_id
        ) !==
        currentAcademicYearId
      ) {

        throw new Error(
          "The selected class does not belong to the active academic year."
        );

      }


      // =================================================
      // SUBJECT VALIDATION
      // =================================================

      if (
        selectedSubjects.length === 0
      ) {

        throw new Error(
          "Please select at least one subject for this student."
        );

      }


      const availableSubjectIds =
        new Set(
          subjects.map(
            subject =>
              Number(
                subject.id
              )
          )
        );


      const wantedSubjectIds =
        Array.from(
          new Set(
            selectedSubjects

              .map(
                subjectId =>
                  Number(
                    subjectId
                  )
              )

              .filter(
                subjectId =>
                  Number.isFinite(
                    subjectId
                  )
              )
          )
        );


      const invalidSubjectIds =
        wantedSubjectIds.filter(
          subjectId =>
            !availableSubjectIds.has(
              subjectId
            )
        );


      if (
        invalidSubjectIds.length > 0
      ) {

        throw new Error(
          "One or more selected subjects are not available for the student's current class."
        );

      }


      // =================================================
      // STUDENT PAYLOAD
      //
      // IMPORTANT:
      // GLOBAL ACTIVE ACADEMIC YEAR IS AUTHORITATIVE.
      //
      // DO NOT USE:
      // student.academic_year_id
      // =================================================

      const studentPayload = {

        admission_number:
          student.admission_number || "",

        first_name:
          student.first_name || "",

        middle_name:
          student.middle_name || null,

        last_name:
          student.last_name || "",

        gender:
          student.gender || null,

        date_of_birth:
          student.date_of_birth || null,

        current_class_id:
          currentClassId,

        academic_year_id:
          currentAcademicYearId,

        admission_date:
          student.admission_date || null,

        student_status:
          student.student_status ||
          "Active",

        address:
          student.address || null,

        phone:
          student.phone || null,

        email:
          student.email || null,

        parent_name:
          student.parent_name || null,

        parent_phone:
          student.parent_phone || null,

        parent_email:
          student.parent_email || null,

        stream:
          student.stream || null

      };


      console.log(
        "UPDATE STUDENT PAYLOAD:",
        studentPayload
      );


      // =================================================
      // UPDATE STUDENT
      //
      // IMPORTANT:
      // SCOPE BY:
      // student id
      // school
      // active academic year
      // =================================================

      const {
        error: studentError
      } = await supabase

        .from("students")

        .update(
          studentPayload
        )

        .eq(
          "id",
          id
        )

        .eq(
          "school_id",
          currentSchoolId
        )

        .eq(
          "academic_year_id",
          currentAcademicYearId
        );


      if (
        studentError
      ) {

        console.error(
          "UPDATE STUDENT ERROR:",
          studentError
        );

        throw studentError;

      }


      // =================================================
      // GET EXISTING SUBJECT ASSIGNMENTS
      // =================================================

      const {
        data: existingAssignments,
        error: existingError
      } = await supabase

        .from("student_subjects")

        .select(`
          student_id,
          subject_id,
          class_id,
          academic_year_id
        `)

        .eq(
          "student_id",
          Number(id)
        );


      if (
        existingError
      ) {

        console.error(
          "LOAD EXISTING SUBJECTS ERROR:",
          existingError
        );

        throw existingError;

      }


      console.log(
        "EXISTING ASSIGNMENTS BEFORE UPDATE:",
        existingAssignments
      );


      // =================================================
      // EXISTING ASSIGNMENTS FOR THIS CLASS
      //
      // Keep legacy rows without academic_year_id
      // compatible, while current-year rows are
      // matched normally.
      // =================================================

      const existingForClass =
        (existingAssignments || [])

          .filter(
            record =>
              Number(record.class_id) ===
              currentClassId
          )

          .filter(
            record =>
              record.academic_year_id == null ||
              Number(
                record.academic_year_id
              ) ===
              currentAcademicYearId
          );


      // =================================================
      // EXISTING SUBJECT IDS
      // =================================================

      const existingSubjectIds =
        existingForClass.map(
          record =>
            Number(
              record.subject_id
            )
        );


      // =================================================
      // SUBJECTS TO INSERT
      //
      // ONLY INSERT SUBJECTS THAT DO NOT EXIST.
      // =================================================

      const subjectsToInsert =
        wantedSubjectIds.filter(
          subjectId =>
            !existingSubjectIds.includes(
              subjectId
            )
        );


      console.log(
        "SUBJECTS TO INSERT:",
        subjectsToInsert
      );


      // =================================================
      // INSERT ONLY NEW SUBJECT ASSIGNMENTS
      // =================================================

      if (
        subjectsToInsert.length > 0
      ) {

        const newAssignments =
          subjectsToInsert.map(
            subjectId => ({

              student_id:
                Number(id),

              subject_id:
                Number(subjectId),

              class_id:
                currentClassId,

              academic_year_id:
                currentAcademicYearId

            })
          );


        console.log(
          "NEW SUBJECT ASSIGNMENTS:",
          newAssignments
        );


        const {
          data: insertedAssignments,
          error: insertAssignmentError
        } = await supabase

          .from("student_subjects")

          .insert(
            newAssignments
          )

          .select();


        console.log(
          "INSERTED SUBJECT ASSIGNMENTS:",
          insertedAssignments
        );


        console.log(
          "INSERT ASSIGNMENT ERROR:",
          insertAssignmentError
        );


        if (
          insertAssignmentError
        ) {

          throw insertAssignmentError;

        }

      }


      // =================================================
      // REMOVE SUBJECTS THAT WERE UNCHECKED
      // =================================================

      const assignmentsToDelete =
        existingForClass.filter(
          record =>
            !wantedSubjectIds.includes(
              Number(
                record.subject_id
              )
            )
        );


      console.log(
        "ASSIGNMENTS TO DELETE:",
        assignmentsToDelete
      );


      // =================================================
      // DELETE OLD / UNCHECKED ASSIGNMENTS
      // =================================================

      for (
        const assignment
        of assignmentsToDelete
      ) {

        let deleteQuery =
          supabase

            .from("student_subjects")

            .delete()

            .eq(
              "student_id",
              Number(id)
            )

            .eq(
              "subject_id",
              Number(
                assignment.subject_id
              )
            )

            .eq(
              "class_id",
              currentClassId
            );


        // =================================================
        // IF ASSIGNMENT HAS A YEAR, ALSO SCOPE DELETE
        // TO THAT YEAR.
        // =================================================

        if (
          assignment.academic_year_id != null
        ) {

          deleteQuery =
            deleteQuery.eq(
              "academic_year_id",
              currentAcademicYearId
            );

        }


        const {
          error: deleteError
        } = await deleteQuery;


        if (
          deleteError
        ) {

          console.error(
            "DELETE SUBJECT ASSIGNMENT ERROR:",
            deleteError
          );

          throw deleteError;

        }

      }


      // =================================================
      // SUCCESS
      // =================================================

      setMessage(
        `Student updated successfully with ${wantedSubjectIds.length} subject(s) for ${activeAcademicYear?.year_name || "the active academic year"} ✅`
      );


      console.log(
        "STUDENT UPDATE COMPLETE:",
        {
          studentId: id,
          schoolId: currentSchoolId,
          academicYearId:
            currentAcademicYearId,
          classId:
            currentClassId,
          subjects:
            wantedSubjectIds
        }
      );


      // =================================================
      // REDIRECT
      // =================================================

      setTimeout(
        () => {

          navigate(
            "/students"
          );

        },
        1000
      );

    } catch (err) {

      console.error(
        "EDIT STUDENT ERROR:",
        err
      );


      setError(
        err?.message ||
        "Failed to update student."
      );

    } finally {

      setSaving(false);

    }

  };


  // =====================================================
  // SELECTED CLASS
  // =====================================================

  const selectedClass =
    classes.find(
      item =>
        Number(item.id) ===
        Number(
          student?.current_class_id
        )
    );


  // =====================================================
  // ACADEMIC YEAR LOADING
  // =====================================================

  if (
    academicYearLoading
  ) {

    return (

      <div className="p-6">

        <div className="bg-white rounded-xl shadow p-6">

          Loading active academic year...

        </div>

      </div>

    );

  }


  // =====================================================
  // NO ACTIVE ACADEMIC YEAR
  // =====================================================

  if (
    !activeAcademicYearId
  ) {

    return (

      <div className="p-6">

        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-5">

          <h2 className="font-semibold text-lg">

            No Active Academic Year

          </h2>


          <p className="mt-2">

            {
              academicYearError ||
              "Please configure and activate an academic year in Settings before editing students."
            }

          </p>

        </div>

      </div>

    );

  }


  // =====================================================
  // LOADING
  // =====================================================

  if (
    loading
  ) {

    return (

      <div className="p-6">

        <div className="bg-white rounded-xl shadow p-6">

          Loading student information...

        </div>

      </div>

    );

  }


  // =====================================================
  // STUDENT NOT FOUND
  // =====================================================

  if (!student) {

    return (

      <div className="p-6">

        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-5">

          Student could not be found in the active academic year.

          <div className="mt-2 text-sm">

            Active Academic Year:

            <strong className="ml-1">

              {
                activeAcademicYear?.year_name ||
                "Not configured"
              }

            </strong>

          </div>

        </div>

      </div>

    );

  }


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="p-6">


      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-6">

        <h1 className="text-3xl font-bold text-gray-800">

          Edit Student

        </h1>


        <p className="text-gray-600 mt-2">

          Update student information and subject
          assignments in AfriCore ERP PRO.

        </p>


        {/* GLOBAL ACTIVE YEAR */}

        <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg">

          <span className="font-medium">

            Active Academic Year:

          </span>


          <span className="font-bold">

            {
              activeAcademicYear?.year_name ||
              "Not configured"
            }

          </span>


          {
            activeAcademicYear?.term && (

              <span className="text-blue-600">

                • Term {activeAcademicYear.term}

              </span>

            )
          }

        </div>

      </div>


      {/* =================================================
          FORM
      ================================================= */}

      <form
        onSubmit={updateStudent}
        className="bg-white shadow rounded-xl p-6"
      >


        {/* =================================================
            STUDENT INFORMATION
        ================================================= */}

        <h2 className="text-xl font-semibold text-gray-800 mb-5">

          Student Information

        </h2>


        <div className="grid md:grid-cols-2 gap-5">


          {/* ADMISSION NUMBER */}

          <div>

            <label className="block mb-2 font-medium">

              Admission Number

            </label>


            <input
              name="admission_number"
              value={
                student.admission_number || ""
              }
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* FIRST NAME */}

          <div>

            <label className="block mb-2 font-medium">

              First Name

            </label>


            <input
              name="first_name"
              value={
                student.first_name || ""
              }
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* MIDDLE NAME */}

          <div>

            <label className="block mb-2 font-medium">

              Middle Name

            </label>


            <input
              name="middle_name"
              value={
                student.middle_name || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* LAST NAME */}

          <div>

            <label className="block mb-2 font-medium">

              Last Name

            </label>


            <input
              name="last_name"
              value={
                student.last_name || ""
              }
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* GENDER */}

          <div>

            <label className="block mb-2 font-medium">

              Gender

            </label>


            <select
              name="gender"
              value={
                student.gender || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            >

              <option value="">

                Select Gender

              </option>


              <option value="Male">

                Male

              </option>


              <option value="Female">

                Female

              </option>

            </select>

          </div>


          {/* DATE OF BIRTH */}

          <div>

            <label className="block mb-2 font-medium">

              Date of Birth

            </label>


            <input
              type="date"
              name="date_of_birth"
              value={
                student.date_of_birth || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* CLASS */}

          <div>

            <label className="block mb-2 font-medium">

              Current Class

            </label>


            <select
              name="current_class_id"
              value={
                student.current_class_id || ""
              }
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            >

              <option value="">

                Select Class

              </option>


              {
                classes.map(
                  item => (

                    <option
                      key={item.id}
                      value={item.id}
                    >

                      {item.class_name}

                    </option>

                  )
                )
              }

            </select>

          </div>


          {/* ACADEMIC YEAR */}

          <div>

            <label className="block mb-2 font-medium">

              Academic Year

            </label>


            <input
              value={
                activeAcademicYear?.year_name ||
                ""
              }
              readOnly
              disabled
              className="w-full border p-3 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />


            <p className="text-xs text-gray-500 mt-1">

              Academic year is controlled globally from
              Settings.

            </p>

          </div>


          {/* ADMISSION DATE */}

          <div>

            <label className="block mb-2 font-medium">

              Admission Date

            </label>


            <input
              type="date"
              name="admission_date"
              value={
                student.admission_date || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* STATUS */}

          <div>

            <label className="block mb-2 font-medium">

              Student Status

            </label>


            <select
              name="student_status"
              value={
                student.student_status ||
                "Active"
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            >

              <option value="Active">

                Active

              </option>


              <option value="Inactive">

                Inactive

              </option>


              <option value="Graduated">

                Graduated

              </option>


              <option value="Transferred">

                Transferred

              </option>

            </select>

          </div>


          {/* STREAM */}

          <div>

            <label className="block mb-2 font-medium">

              Stream

            </label>


            <input
              name="stream"
              placeholder="Example: A"
              value={
                student.stream || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* PHONE */}

          <div>

            <label className="block mb-2 font-medium">

              Student Phone

            </label>


            <input
              name="phone"
              value={
                student.phone || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* EMAIL */}

          <div>

            <label className="block mb-2 font-medium">

              Email

            </label>


            <input
              type="email"
              name="email"
              value={
                student.email || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* ADDRESS */}

          <div className="md:col-span-2">

            <label className="block mb-2 font-medium">

              Address

            </label>


            <input
              name="address"
              value={
                student.address || ""
              }
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
            />

          </div>

        </div>


        {/* =================================================
            PARENT INFORMATION
        ================================================= */}

        <div className="mt-8">

          <h2 className="text-xl font-semibold text-gray-800 mb-5">

            Parent / Guardian Information

          </h2>


          <div className="grid md:grid-cols-2 gap-5">


            {/* PARENT NAME */}

            <div>

              <label className="block mb-2 font-medium">

                Parent / Guardian Name

              </label>


              <input
                name="parent_name"
                value={
                  student.parent_name || ""
                }
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

            </div>


            {/* PARENT PHONE */}

            <div>

              <label className="block mb-2 font-medium">

                Parent / Guardian Phone

              </label>


              <input
                name="parent_phone"
                value={
                  student.parent_phone || ""
                }
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

            </div>


            {/* PARENT EMAIL */}

            <div>

              <label className="block mb-2 font-medium">

                Parent / Guardian Email

              </label>


              <input
                type="email"
                name="parent_email"
                value={
                  student.parent_email || ""
                }
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

            </div>

          </div>

        </div>


        {/* =================================================
            SUBJECT ASSIGNMENT
        ================================================= */}

        <div className="mt-8 border-t pt-8">


          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">


            <div>

              <h2 className="text-xl font-semibold text-gray-800">

                Student Subject Assignment

              </h2>


              <p className="text-gray-600 mt-1">

                Edit the subjects this student will study.

              </p>

            </div>


            {selectedClass && (

              <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">

                Class:

                <span className="font-semibold ml-1">

                  {selectedClass.class_name}

                </span>

              </div>

            )}

          </div>


          {/* LOADING */}

          {
            loadingSubjects && (

              <div className="bg-gray-50 p-4 rounded-lg">

                Loading subjects...

              </div>

            )
          }


          {/* SUBJECT ACTIONS */}

          {
            !loadingSubjects &&
            subjects.length > 0 && (

              <>

                <div className="flex flex-wrap gap-3 mb-5">


                  <button
                    type="button"
                    onClick={selectAllSubjects}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >

                    Select All

                  </button>


                  <button
                    type="button"
                    onClick={clearSubjects}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                  >

                    Clear All

                  </button>


                  <div className="flex items-center px-4 py-2 bg-green-50 text-green-700 rounded-lg">

                    Selected:

                    <span className="font-bold ml-1">

                      {selectedSubjects.length}

                    </span>

                  </div>

                </div>


                {/* SUBJECT GRID */}

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">


                  {
                    subjects.map(
                      subject => {

                        const isSelected =
                          selectedSubjects.includes(
                            Number(
                              subject.id
                            )
                          );


                        return (

                          <label
                            key={subject.id}
                            className={`border rounded-xl p-4 cursor-pointer transition ${
                              isSelected
                                ? "border-blue-600 bg-blue-50"
                                : "border-gray-200 bg-white hover:border-blue-300"
                            }`}
                          >

                            <div className="flex items-start gap-3">


                              <input
                                type="checkbox"
                                checked={
                                  isSelected
                                }
                                onChange={() =>
                                  handleSubjectChange(
                                    subject.id
                                  )
                                }
                                className="mt-1 w-5 h-5"
                              />


                              <div className="flex-1">


                                <div className="font-semibold text-gray-800">

                                  {
                                    subject.subject_name
                                  }

                                </div>


                                {
                                  subject.subject_code && (

                                    <div className="text-sm text-gray-500 mt-1">

                                      Code:

                                      <span className="ml-1">

                                        {
                                          subject.subject_code
                                        }

                                      </span>

                                    </div>

                                  )
                                }


                                {
                                  subject.class_scope && (

                                    <div className="text-sm text-gray-500 mt-1">

                                      Scope:

                                      <span className="ml-1">

                                        {
                                          subject.class_scope
                                        }

                                      </span>

                                    </div>

                                  )
                                }


                                {
                                  subject.is_compulsory && (

                                    <div className="text-xs text-blue-600 font-medium mt-2">

                                      Compulsory Subject

                                    </div>

                                  )
                                }


                              </div>

                            </div>

                          </label>

                        );

                      }
                    )
                  }

                </div>

              </>

            )
          }


          {/* NO SUBJECTS */}

          {
            !loadingSubjects &&
            student.current_class_id &&
            subjects.length === 0 && (

              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">

                No active subjects were found for this
                class level.

              </div>

            )
          }

        </div>


        {/* =================================================
            SUCCESS MESSAGE
        ================================================= */}

        {
          message && (

            <div className="mt-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg">

              {message}

            </div>

          )
        }


        {/* =================================================
            ERROR MESSAGE
        ================================================= */}

        {
          error && (

            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">

              <strong>
                Error:
              </strong>


              <div className="mt-1">

                {error}

              </div>

            </div>

          )
        }


        {/* =================================================
            BUTTONS
        ================================================= */}

        <div className="mt-8 flex gap-4">


          <button
            type="submit"
            disabled={
              saving ||
              loadingSubjects ||
              academicYearLoading ||
              !schoolId ||
              !activeAcademicYearId
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg"
          >

            {
              saving
                ? "Updating..."
                : "Update Student"
            }

          </button>


          <button
            type="button"
            onClick={() =>
              navigate("/students")
            }
            disabled={saving}
            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg"
          >

            Cancel

          </button>


        </div>


      </form>

    </div>

  );

}


export default EditStudent;