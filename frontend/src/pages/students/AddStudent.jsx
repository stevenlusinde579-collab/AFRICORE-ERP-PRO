import {
  useState,
  useEffect,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../../services/supabase";

import {
  useSchool,
} from "../../context/SchoolContext";

import {
  useRole,
} from "../../context/RoleContext";


function AddStudent() {

  const navigate = useNavigate();


  // =====================================================
  // GLOBAL SCHOOL + ACADEMIC YEAR
  // =====================================================

  const {
    schoolId,
    activeAcademicYear,
    activeAcademicYearId,
    academicYearLoading,
    academicYearError,
  } = useSchool();


  // =====================================================
  // CURRENT SELECTED ROLE
  // =====================================================

  const {
    selectedRoleName,
  } = useRole();


  // =====================================================
  // STATE
  // =====================================================

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [classes, setClasses] =
    useState([]);

  const [subjects, setSubjects] =
    useState([]);

  const [loadingSubjects, setLoadingSubjects] =
    useState(false);

  const [loadingClasses, setLoadingClasses] =
    useState(false);


  // =====================================================
  // CLASS TEACHER STATE
  // =====================================================

  const [isClassTeacher, setIsClassTeacher] =
    useState(false);

  const [teacherAssignments, setTeacherAssignments] =
    useState([]);

  const [assignedClassIds, setAssignedClassIds] =
    useState([]);


  // =====================================================
  // STUDENT STATE
  // =====================================================

  const [student, setStudent] = useState({

    admission_number: "",

    first_name: "",

    middle_name: "",

    last_name: "",

    gender: "",

    date_of_birth: "",

    current_class_id: "",

    admission_date: "",

    student_status: "Active",

    address: "",

    phone: "",

    email: "",

    parent_name: "",

    parent_phone: "",

    parent_email: "",

    stream: ""

  });


  // =====================================================
  // SELECTED SUBJECTS
  // =====================================================

  const [selectedSubjects, setSelectedSubjects] =
    useState([]);


  // =====================================================
  // NORMALIZED ROLE
  // =====================================================

  const normalizedRoleName =
    String(
      selectedRoleName || ""
    )
      .trim()
      .toLowerCase();


  const classTeacherSelected =
    normalizedRoleName ===
    "class teacher";


  // =====================================================
  // LOAD CURRENT PROFILE
  // =====================================================

  const loadCurrentProfile = async () => {

    try {

      const {
        data: {
          user,
        },
        error: authError,
      } = await supabase.auth.getUser();


      if (authError) {

        throw authError;

      }


      if (!user) {

        throw new Error(
          "Your session has expired. Please login again."
        );

      }


      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          role_id,
          employee_id,
          teacher_id,
          school_id
        `)
        .eq(
          "id",
          user.id
        )
        .single();


      if (profileError) {

        throw profileError;

      }


      return profile || null;


    } catch (error) {

      console.error(
        "LOAD CURRENT PROFILE ERROR:",
        error
      );


      throw error;

    }

  };


  // =====================================================
  // LOAD CLASS TEACHER ASSIGNMENTS
  // =====================================================

  const loadClassTeacherAssignments = async (
    currentSchoolId
  ) => {

    // ---------------------------------------------------
    // RESET
    // ---------------------------------------------------

    setTeacherAssignments([]);

    setAssignedClassIds([]);


    // ---------------------------------------------------
    // Only Class Teacher needs this restriction
    // ---------------------------------------------------

    if (!classTeacherSelected) {

      setIsClassTeacher(false);

      return [];

    }


    setIsClassTeacher(true);


    // ---------------------------------------------------
    // CURRENT PROFILE
    // ---------------------------------------------------

    const profile =
      await loadCurrentProfile();


    if (!profile) {

      throw new Error(
        "Unable to load your profile."
      );

    }


    // ---------------------------------------------------
    // VERIFY PROFILE SCHOOL
    // ---------------------------------------------------

    const profileSchoolId =
      Number(
        profile.school_id
      );


    if (
      profileSchoolId &&
      Number(currentSchoolId) !==
      profileSchoolId
    ) {

      throw new Error(
        "Your profile school does not match the current school."
      );

    }


    // ---------------------------------------------------
    // TEACHER ID
    // ---------------------------------------------------

    const teacherId =
      profile.teacher_id;


    if (!teacherId) {

      throw new Error(
        "Your profile is not linked to a teacher record."
      );

    }


    console.log(
      "CLASS TEACHER ID:",
      teacherId
    );


    // ---------------------------------------------------
    // LOAD ASSIGNMENTS
    //
    // Confirmed table:
    //
    // teacher_assignments
    // id
    // school_id
    // teacher_id
    // subject_id
    // class_id
    //
    // ---------------------------------------------------

    const {
      data: assignmentRows,
      error: assignmentError,
    } = await supabase
      .from("teacher_assignments")
      .select(`
        id,
        school_id,
        teacher_id,
        subject_id,
        class_id
      `)
      .eq(
        "school_id",
        Number(currentSchoolId)
      )
      .eq(
        "teacher_id",
        teacherId
      );


    if (assignmentError) {

      console.error(
        "CLASS TEACHER ASSIGNMENTS ERROR:",
        assignmentError
      );

      throw assignmentError;

    }


    const assignments =
      Array.isArray(
        assignmentRows
      )
        ? assignmentRows
        : [];


    // ---------------------------------------------------
    // UNIQUE ASSIGNED CLASS IDS
    // ---------------------------------------------------

    const uniqueClassIds = [
      ...new Set(
        assignments
          .map(
            assignment =>
              assignment.class_id
          )
          .filter(
            classId =>
              classId !== null &&
              classId !== undefined &&
              String(classId).trim() !== ""
          )
          .map(
            classId =>
              Number(classId)
          )
          .filter(
            classId =>
              Number.isFinite(classId)
          )
      ),
    ];


    console.log(
      "CLASS TEACHER ASSIGNMENTS:",
      assignments
    );


    console.log(
      "CLASS TEACHER ASSIGNED CLASS IDS:",
      uniqueClassIds
    );


    setTeacherAssignments(
      assignments
    );


    setAssignedClassIds(
      uniqueClassIds
    );


    return uniqueClassIds;

  };


  // =====================================================
  // LOAD CLASSES FOR GLOBAL ACTIVE ACADEMIC YEAR
  // =====================================================

  const loadClasses = async () => {

    if (
      !schoolId ||
      !activeAcademicYearId
    ) {

      setClasses([]);

      setAssignedClassIds([]);

      setTeacherAssignments([]);

      return;

    }


    try {

      setLoadingClasses(true);

      setMessage("");


      // =================================================
      // CURRENT SCHOOL
      // =================================================

      const currentSchoolId =
        Number(schoolId);


      const currentAcademicYearId =
        Number(activeAcademicYearId);


      // =================================================
      // LOAD ALL CLASSES FOR CURRENT SCHOOL + YEAR
      // =================================================

      const {
        data,
        error
      } = await supabase
        .from("classes")
        .select(`
          id,
          class_name,
          academic_level,
          academic_year_id,
          school_id
        `)
        .eq(
          "school_id",
          currentSchoolId
        )
        .eq(
          "academic_year_id",
          currentAcademicYearId
        )
        .order(
          "class_name"
        );


      console.log(
        "GLOBAL ACTIVE ACADEMIC YEAR ID:",
        activeAcademicYearId
      );


      console.log(
        "ALL CLASSES FOR GLOBAL ACADEMIC YEAR:",
        data
      );


      console.log(
        "CLASS ERROR:",
        error
      );


      if (error) {

        throw error;

      }


      const allClasses =
        Array.isArray(data)
          ? data
          : [];


      // =================================================
      // CLASS TEACHER RESTRICTION
      // =================================================
      //
      // If Class Teacher:
      //
      // classes =
      //     only classes assigned through
      //     teacher_assignments
      //
      // =================================================

      let classesForDisplay =
        allClasses;


      if (classTeacherSelected) {

        const teacherClassIds =
          await loadClassTeacherAssignments(
            currentSchoolId
          );


        // ------------------------------------------------
        // NO ASSIGNED CLASS
        // ------------------------------------------------

        if (
          teacherClassIds.length === 0
        ) {

          classesForDisplay = [];

          setMessage(
            "You have not been assigned a class. Please contact the Academic Master or Headmaster."
          );

        } else {

          // ----------------------------------------------
          // ONLY ASSIGNED CLASSES
          // ----------------------------------------------

          classesForDisplay =
            allClasses.filter(
              item =>
                teacherClassIds.includes(
                  Number(item.id)
                )
            );

        }

      } else {

        // ------------------------------------------------
        // NON CLASS TEACHER
        // ------------------------------------------------

        setIsClassTeacher(false);

        setTeacherAssignments([]);

        setAssignedClassIds([]);

      }


      console.log(
        "CLASSES DISPLAYED TO CURRENT USER:",
        classesForDisplay
      );


      setClasses(
        classesForDisplay
      );


      // =================================================
      // IF CURRENT CLASS IS NO LONGER AVAILABLE
      // =================================================

      if (
        student.current_class_id &&
        !classesForDisplay.some(
          item =>
            Number(item.id) ===
            Number(student.current_class_id)
        )
      ) {

        setStudent(
          previous => ({
            ...previous,
            current_class_id: ""
          })
        );


        setSubjects([]);

        setSelectedSubjects([]);

      }


    } catch (error) {

      console.error(
        "LOAD CLASSES ERROR:",
        error
      );


      setClasses([]);

      setAssignedClassIds([]);

      setTeacherAssignments([]);


      setMessage(
        error?.message ||
        "Unable to load classes for the current academic year."
      );


    } finally {

      setLoadingClasses(false);

    }

  };


  // =====================================================
  // LOAD CLASSES WHEN GLOBAL ACADEMIC YEAR / ROLE CHANGES
  // =====================================================

  useEffect(() => {

    if (academicYearLoading) {

      return;

    }


    loadClasses();

  }, [
    schoolId,
    activeAcademicYearId,
    academicYearLoading,
    selectedRoleName,
  ]);


  // =====================================================
  // LOAD SUBJECTS FOR SELECTED CLASS
  // =====================================================

  const loadSubjectsForClass = async (
    classId
  ) => {

    if (!classId) {

      setSubjects([]);

      setSelectedSubjects([]);

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

      setSelectedSubjects([]);

      setMessage(
        "The selected class is not available to you."
      );

      return;

    }


    // =================================================
    // CLASS TEACHER SECURITY CHECK
    // =================================================

    if (
      classTeacherSelected
    ) {

      const allowedClass =
        assignedClassIds.includes(
          Number(classId)
        );


      if (!allowedClass) {

        setStudent(
          previous => ({
            ...previous,
            current_class_id: ""
          })
        );


        setSubjects([]);

        setSelectedSubjects([]);


        setMessage(
          "You can only add students to your assigned class."
        );


        return;

      }

    }


    // =================================================
    // VERIFY SCHOOL
    // =================================================

    if (
      !schoolId ||
      Number(selectedClass.school_id) !==
      Number(schoolId)
    ) {

      setSubjects([]);

      setSelectedSubjects([]);

      setMessage(
        "The selected class does not belong to your school."
      );

      return;

    }


    // =================================================
    // VERIFY GLOBAL ACADEMIC YEAR
    // =================================================

    if (
      !activeAcademicYearId ||
      Number(selectedClass.academic_year_id) !==
      Number(activeAcademicYearId)
    ) {

      setSubjects([]);

      setSelectedSubjects([]);

      setMessage(
        "The selected class does not belong to the current academic year."
      );

      return;

    }


    setLoadingSubjects(true);

    setMessage("");


    console.log(
      "SELECTED CLASS:",
      selectedClass
    );


    console.log(
      "CLASS ACADEMIC YEAR:",
      selectedClass.academic_year_id
    );


    console.log(
      "GLOBAL ACADEMIC YEAR:",
      activeAcademicYearId
    );


    // =================================================
    // LOAD SUBJECTS FOR CLASS LEVEL
    // =================================================

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
      "SUBJECTS FOR CLASS:",
      data
    );


    console.log(
      "SUBJECT ERROR:",
      error
    );


    setLoadingSubjects(false);


    if (error) {

      setMessage(
        error.message
      );

      setSubjects([]);

      return;

    }


    setSubjects(
      data || []
    );


    // =================================================
    // CLEAR PREVIOUS SUBJECT SELECTIONS
    // =================================================

    setSelectedSubjects([]);

  };


  // =====================================================
  // HANDLE FORM CHANGE
  // =====================================================

  const handleChange = (e) => {

    const {
      name,
      value
    } = e.target;


    // =================================================
    // CLASS CHANGE
    // =================================================

    if (
      name === "current_class_id"
    ) {

      // -----------------------------------------------
      // CLASS TEACHER SECURITY CHECK
      // -----------------------------------------------

      if (
        classTeacherSelected
      ) {

        const selectedId =
          Number(value);


        if (
          value &&
          !assignedClassIds.includes(
            selectedId
          )
        ) {

          setMessage(
            "You can only select your assigned class."
          );


          setStudent(
            previous => ({
              ...previous,
              current_class_id: ""
            })
          );


          setSubjects([]);

          setSelectedSubjects([]);

          return;

        }

      }


      setStudent(
        previous => ({
          ...previous,
          [name]: value
        })
      );


      // -----------------------------------------------
      // Clear previous subjects
      // -----------------------------------------------

      setSelectedSubjects([]);

      setSubjects([]);


      loadSubjectsForClass(
        value
      );


      return;

    }


    // =================================================
    // OTHER FORM FIELDS
    // =================================================

    setStudent(
      previous => ({
        ...previous,
        [name]: value
      })
    );

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
            id =>
              id !== numericSubjectId
          );

        }


        return [

          ...previous,

          numericSubjectId

        ];

      }
    );

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
  // SAVE STUDENT
  // =====================================================

  const saveStudent = async (e) => {

    e.preventDefault();


    setLoading(true);

    setMessage("");


    try {

      // =================================================
      // GLOBAL CONTEXT VALIDATION
      // =================================================

      if (!schoolId) {

        throw new Error(
          "Unable to determine the student's school."
        );

      }


      if (!activeAcademicYearId) {

        throw new Error(
          academicYearError ||
          "Unable to determine the current active academic year."
        );

      }


      // =================================================
      // AUTHORITATIVE GLOBAL VALUES
      // =================================================

      const currentSchoolId =
        Number(schoolId);


      const currentAcademicYearId =
        Number(activeAcademicYearId);


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


      // =================================================
      // CLASS TEACHER AUTHORITATIVE VALIDATION
      // =================================================
      //
      // Do NOT rely only on the dropdown.
      //
      // We verify the teacher assignment again
      // immediately before INSERT.
      //
      // =================================================

      if (
        classTeacherSelected
      ) {

        // ------------------------------------------------
        // If state is empty/stale, reload assignments
        // ------------------------------------------------

        let currentAssignedClassIds =
          assignedClassIds;


        if (
          currentAssignedClassIds.length === 0
        ) {

          currentAssignedClassIds =
            await loadClassTeacherAssignments(
              currentSchoolId
            );

        }


        const classIsAssigned =
          currentAssignedClassIds.includes(
            currentClassId
          );


        if (!classIsAssigned) {

          throw new Error(
            "You cannot add a student to this class because it is not assigned to you."
          );

        }

      }


      // =================================================
      // VERIFY SELECTED CLASS EXISTS IN CURRENT LIST
      // =================================================

      const selectedClassForSave =
        classes.find(
          item =>
            Number(item.id) ===
            currentClassId
        );


      if (!selectedClassForSave) {

        throw new Error(
          "The selected class is not available for the current academic year."
        );

      }


      // =================================================
      // VERIFY CLASS SCHOOL
      // =================================================

      if (
        Number(selectedClassForSave.school_id) !==
        currentSchoolId
      ) {

        throw new Error(
          "The selected class does not belong to your school."
        );

      }


      // =================================================
      // VERIFY CLASS ACADEMIC YEAR
      // =================================================

      if (
        Number(selectedClassForSave.academic_year_id) !==
        currentAcademicYearId
      ) {

        throw new Error(
          "The selected class does not belong to the current academic year."
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


      // =================================================
      // VERIFY SELECTED SUBJECTS
      // =================================================

      const availableSubjectIds =
        new Set(
          subjects.map(
            subject =>
              Number(subject.id)
          )
        );


      const invalidSubject =
        selectedSubjects.find(
          subjectId =>
            !availableSubjectIds.has(
              Number(subjectId)
            )
        );


      if (
        invalidSubject !== undefined
      ) {

        throw new Error(
          "One or more selected subjects are no longer available for this class."
        );

      }


      // =================================================
      // STUDENT PAYLOAD
      // =================================================

      const payload = {

        admission_number:
          student.admission_number.trim(),

        first_name:
          student.first_name.trim(),

        middle_name:
          student.middle_name?.trim() ||
          null,

        last_name:
          student.last_name.trim(),

        gender:
          student.gender ||
          null,

        date_of_birth:
          student.date_of_birth ||
          null,

        current_class_id:
          currentClassId,

        // =================================================
        // AUTHORITATIVE GLOBAL ACADEMIC YEAR
        // =================================================

        academic_year_id:
          currentAcademicYearId,

        admission_date:
          student.admission_date ||
          null,

        // =================================================
        // STATUS
        // =================================================

        status:
          student.student_status ||
          "Active",

        student_status:
          student.student_status ||
          "Active",

        // =================================================
        // CURRENT SCHOOL
        // =================================================

        school_id:
          currentSchoolId,

        address:
          student.address ||
          null,

        phone:
          student.phone ||
          null,

        email:
          student.email ||
          null,

        parent_name:
          student.parent_name ||
          null,

        parent_phone:
          student.parent_phone ||
          null,

        parent_email:
          student.parent_email ||
          null,

        stream:
          student.stream ||
          null

      };


      console.log(
        "FINAL STUDENT PAYLOAD:",
        payload
      );


      console.log(
        "STUDENT SCHOOL ID:",
        currentSchoolId
      );


      console.log(
        "STUDENT GLOBAL ACADEMIC YEAR ID:",
        currentAcademicYearId
      );


      console.log(
        "STUDENT CLASS ID:",
        currentClassId
      );


      console.log(
        "CLASS TEACHER SELECTED:",
        classTeacherSelected
      );


      console.log(
        "ASSIGNED CLASS IDS:",
        assignedClassIds
      );


      // =================================================
      // INSERT STUDENT
      // =================================================

      const {
        data: studentData,
        error: studentError
      } = await supabase
        .from("students")
        .insert([
          payload
        ])
        .select()
        .single();


      console.log(
        "STUDENT RESULT:",
        studentData
      );


      console.log(
        "STUDENT ERROR:",
        studentError
      );


      if (studentError) {

        throw studentError;

      }


      if (!studentData) {

        throw new Error(
          "Student was not returned after saving."
        );

      }


      // =================================================
      // VERIFY SAVED STUDENT
      // =================================================

      console.log(
        "SAVED STUDENT LIST CONTEXT:",
        {

          id:
            studentData.id,

          school_id:
            studentData.school_id,

          academic_year_id:
            studentData.academic_year_id,

          status:
            studentData.status,

          student_status:
            studentData.student_status,

          current_class_id:
            studentData.current_class_id

        }
      );


      // =================================================
      // PREPARE STUDENT SUBJECT ASSIGNMENTS
      // =================================================

      const studentSubjectRecords =
        selectedSubjects.map(
          subjectId => ({

            student_id:
              studentData.id,

            subject_id:
              Number(subjectId),

            class_id:
              currentClassId,

            // =================================================
            // SAME GLOBAL ACADEMIC YEAR
            // =================================================

            academic_year_id:
              currentAcademicYearId

          })
        );


      console.log(
        "STUDENT SUBJECT ASSIGNMENTS:",
        studentSubjectRecords
      );


      // =================================================
      // SAVE STUDENT SUBJECT ASSIGNMENTS
      // =================================================

      const {
        data: subjectAssignmentData,
        error: subjectAssignmentError
      } = await supabase
        .from("student_subjects")
        .insert(
          studentSubjectRecords
        )
        .select();


      console.log(
        "SUBJECT ASSIGNMENT RESULT:",
        subjectAssignmentData
      );


      console.log(
        "SUBJECT ASSIGNMENT ERROR:",
        subjectAssignmentError
      );


      // =================================================
      // IF SUBJECT ASSIGNMENT FAILS
      // =================================================

      if (subjectAssignmentError) {

        console.error(
          "STUDENT SUBJECT ASSIGNMENT ERROR:",
          subjectAssignmentError
        );


        // =================================================
        // ROLLBACK STUDENT
        // =================================================

        const {
          error: rollbackError
        } = await supabase
          .from("students")
          .delete()
          .eq(
            "id",
            studentData.id
          )
          .eq(
            "school_id",
            currentSchoolId
          )
          .eq(
            "academic_year_id",
            currentAcademicYearId
          );


        if (rollbackError) {

          console.error(
            "STUDENT ROLLBACK ERROR:",
            rollbackError
          );

        }


        throw new Error(
          `Student could not be assigned subjects: ${subjectAssignmentError.message}`
        );

      }


      // =================================================
      // SUCCESS
      // =================================================

      setMessage(
        `Student added successfully with ${selectedSubjects.length} subject(s) for Academic Year ${activeAcademicYear?.year_name || currentAcademicYearId} ✅`
      );


      // =================================================
      // RETURN TO STUDENT MANAGEMENT
      // =================================================

      setTimeout(() => {

        navigate(
          "/students"
        );

      }, 1000);


    } catch (error) {

      console.error(
        "SAVE STUDENT FAILED:",
        error
      );


      setMessage(
        error?.message ||
        "Failed to save student."
      );


    } finally {

      setLoading(false);

    }

  };


  // =====================================================
  // GET SELECTED CLASS
  // =====================================================

  const selectedClass =
    classes.find(
      item =>
        Number(item.id) ===
        Number(
          student.current_class_id
        )
    );


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="p-6">


      <h1 className="text-3xl font-bold text-gray-800">

        Add New Student

      </h1>


      <p className="text-gray-600 mt-2">

        Register student and assign subjects in AfriCore ERP PRO

      </p>


      {/* =================================================
          CLASS TEACHER INFORMATION
      ================================================= */}

      {isClassTeacher && (

        <div className="mt-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

            <div>

              <div className="font-semibold">

                Class Teacher Mode

              </div>

              <div className="text-sm mt-1">

                You can add students only to the class assigned to you.

              </div>

            </div>


            <div className="bg-white rounded-lg px-4 py-2 shadow-sm text-sm">

              Assigned Classes:

              <span className="font-bold ml-1">

                {assignedClassIds.length}

              </span>

            </div>

          </div>

        </div>

      )}


      {/* =================================================
          GLOBAL ACADEMIC YEAR INFORMATION
      ================================================= */}

      {academicYearLoading ? (

        <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-lg">

          Loading school and current academic year...

        </div>

      ) : activeAcademicYear ? (

        <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">

            <div>

              <span className="font-semibold">

                Current Academic Year:

              </span>{" "}

              {activeAcademicYear.year_name}

            </div>


            {activeAcademicYear.term && (

              <div>

                <span className="font-semibold">

                  Term:

                </span>{" "}

                {activeAcademicYear.term}

              </div>

            )}

          </div>

        </div>

      ) : (

        <div className="mt-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">

          <span className="font-semibold">

            No Active Academic Year

          </span>

          <p className="mt-1">

            {academicYearError ||
              "Please configure an active academic year in Settings."}

          </p>

        </div>

      )}


      <form
        onSubmit={saveStudent}
        className="bg-white shadow rounded-xl p-6 mt-6"
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
              placeholder="Admission Number"
              value={
                student.admission_number
              }
              onChange={
                handleChange
              }
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
              placeholder="First Name"
              value={
                student.first_name
              }
              onChange={
                handleChange
              }
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
              placeholder="Middle Name"
              value={
                student.middle_name
              }
              onChange={
                handleChange
              }
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
              placeholder="Last Name"
              value={
                student.last_name
              }
              onChange={
                handleChange
              }
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
                student.gender
              }
              onChange={
                handleChange
              }
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
                student.date_of_birth
              }
              onChange={
                handleChange
              }
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* =================================================
              CLASS
          ================================================= */}

          <div>

            <label className="block mb-2 font-medium">

              Current Class

            </label>


            <select
              name="current_class_id"
              value={
                student.current_class_id
              }
              onChange={
                handleChange
              }
              required
              disabled={
                academicYearLoading ||
                loadingClasses ||
                !activeAcademicYear ||
                classes.length === 0
              }
              className="w-full border p-3 rounded-lg"
            >

              <option value="">

                {academicYearLoading

                  ? "Loading academic year..."

                  : loadingClasses

                    ? "Loading classes..."

                    : classes.length === 0

                      ? (
                        classTeacherSelected
                          ? "No assigned class"
                          : "No classes for this academic year"
                      )

                      : classTeacherSelected

                        ? "Select Your Assigned Class"

                        : "Select Class"

                }

              </option>


              {classes.map(
                item => (

                  <option
                    key={item.id}
                    value={item.id}
                  >

                    {item.class_name}

                  </option>

                )
              )}

            </select>


            {/* =================================================
                CLASS TEACHER NOTICE
            ================================================= */}

            {isClassTeacher &&
              classes.length > 0 && (

                <div className="mt-2 text-sm text-emerald-700">

                  Only your assigned class is available here.

                </div>

              )}


            {/* =================================================
                GLOBAL YEAR INFORMATION
            ================================================= */}

            {selectedClass &&
              activeAcademicYear && (

                <div className="text-sm text-blue-600 mt-2">

                  Academic Year:

                  <span className="font-semibold ml-1">

                    {activeAcademicYear.year_name}

                  </span>

                </div>

              )}

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
                student.admission_date
              }
              onChange={
                handleChange
              }
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* STUDENT STATUS */}

          <div>

            <label className="block mb-2 font-medium">

              Student Status

            </label>

            <select
              name="student_status"
              value={
                student.student_status
              }
              onChange={
                handleChange
              }
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
                student.stream
              }
              onChange={
                handleChange
              }
              className="w-full border p-3 rounded-lg"
            />

          </div>


          {/* STUDENT PHONE */}

          <div>

            <label className="block mb-2 font-medium">

              Student Phone

            </label>

            <input
              name="phone"
              placeholder="Student Phone"
              value={
                student.phone
              }
              onChange={
                handleChange
              }
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
              placeholder="Email"
              value={
                student.email
              }
              onChange={
                handleChange
              }
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
              placeholder="Student Address"
              value={
                student.address
              }
              onChange={
                handleChange
              }
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
                placeholder="Parent Name"
                value={
                  student.parent_name
                }
                onChange={
                  handleChange
                }
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
                placeholder="Parent Phone"
                value={
                  student.parent_phone
                }
                onChange={
                  handleChange
                }
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
                placeholder="Parent Email"
                value={
                  student.parent_email
                }
                onChange={
                  handleChange
                }
                className="w-full border p-3 rounded-lg"
              />

            </div>

          </div>

        </div>


        {/* =================================================
            STUDENT SUBJECT ASSIGNMENT
        ================================================= */}

        <div className="mt-8 border-t pt-8">


          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">


            <div>

              <h2 className="text-xl font-semibold text-gray-800">

                Student Subject Assignment

              </h2>


              <p className="text-gray-600 mt-1">

                Select the subjects this student will study.

              </p>

            </div>


            {selectedClass && (

              <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">

                Class:

                <span className="font-semibold ml-1">

                  {selectedClass.class_name}

                </span>


                <div className="text-xs mt-1">

                  Academic Year:

                  <span className="font-semibold ml-1">

                    {activeAcademicYear?.year_name || "-"}

                  </span>

                </div>

              </div>

            )}

          </div>


          {/* =================================================
              NO CLASS SELECTED
          ================================================= */}

          {!student.current_class_id && (

            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">

              Please select the student's class first.
              Subjects for that class level will appear here.

            </div>

          )}


          {/* =================================================
              LOADING SUBJECTS
          ================================================= */}

          {student.current_class_id &&
            loadingSubjects && (

              <div className="bg-gray-50 p-4 rounded-lg">

                Loading subjects...

              </div>

            )}


          {/* =================================================
              SUBJECTS
          ================================================= */}

          {student.current_class_id &&
            !loadingSubjects &&
            subjects.length > 0 && (

              <div>


                {/* SUBJECT ACTIONS */}

                <div className="flex flex-wrap gap-3 mb-5">


                  <button
                    type="button"
                    onClick={
                      selectAllSubjects
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >

                    Select All

                  </button>


                  <button
                    type="button"
                    onClick={
                      clearSubjects
                    }
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


                  {subjects.map(
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


                              {subject.subject_code && (

                                <div className="text-sm text-gray-500 mt-1">

                                  Code:

                                  <span className="ml-1">

                                    {
                                      subject.subject_code
                                    }

                                  </span>

                                </div>

                              )}


                              {subject.class_scope && (

                                <div className="text-sm text-gray-500 mt-1">

                                  Scope:

                                  <span className="ml-1">

                                    {
                                      subject.class_scope
                                    }

                                  </span>

                                </div>

                              )}


                              {subject.is_compulsory && (

                                <div className="text-xs text-blue-600 font-medium mt-2">

                                  Compulsory Subject

                                </div>

                              )}

                            </div>


                          </div>

                        </label>

                      );

                    }
                  )}

                </div>

              </div>

            )}


          {/* =================================================
              NO SUBJECTS
          ================================================= */}

          {student.current_class_id &&
            !loadingSubjects &&
            subjects.length === 0 && (

              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">

                No active subjects were found for this
                class level.

              </div>

            )}

        </div>


        {/* =================================================
            MESSAGE
        ================================================= */}

        {message && (

          <div className="mt-6 bg-gray-100 border p-4 rounded-lg">

            {message}

          </div>

        )}


        {/* =================================================
            BUTTONS
        ================================================= */}

        <div className="mt-8 flex gap-4">


          <button
            type="submit"
            disabled={
              loading ||
              academicYearLoading ||
              loadingClasses ||
              !schoolId ||
              !activeAcademicYearId ||
              classes.length === 0
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg"
          >

            {loading
              ? "Saving..."
              : "Save Student"
            }

          </button>


          <button
            type="button"
            onClick={() =>
              navigate("/students")
            }
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg"
          >

            Back

          </button>


        </div>


      </form>

    </div>

  );

}


export default AddStudent;