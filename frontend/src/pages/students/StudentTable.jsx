import {
  useCallback,
  useEffect,
  useMemo,
  useState,
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


function StudentTable({ filters = {} }) {


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
    selectedRoleId,
    selectedRoleName,
  } = useRole();


  // =====================================================
  // STATE
  // =====================================================

  const [students, setStudents] = useState([]);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [deletingId, setDeletingId] = useState(null);

  const [isSubjectTeacher, setIsSubjectTeacher] =
    useState(false);

  const [isClassTeacher, setIsClassTeacher] =
    useState(false);

  const [teacherAssignments, setTeacherAssignments] =
    useState([]);


  // =====================================================
  // CLASS CARD STATE
  // =====================================================

  const [expandedClasses, setExpandedClasses] =
    useState({});


  // =====================================================
  // FETCH CURRENT PROFILE
  // =====================================================

  const loadCurrentProfile = useCallback(async () => {

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

        return null;

      }


      // -------------------------------------------------
      // GET PROFILE
      // -------------------------------------------------

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


      return null;

    }

  }, []);


  // =====================================================
  // FETCH STUDENTS
  // =====================================================

  const fetchStudents = useCallback(async () => {

    try {

      setLoading(true);

      setErrorMessage("");


      // =================================================
      // RESET ROLE-SPECIFIC STATE
      // =================================================

      setIsSubjectTeacher(false);

      setIsClassTeacher(false);

      setTeacherAssignments([]);


      // =================================================
      // CHECK SESSION
      // =================================================

      const {
        data: {
          session,
        },
        error: sessionError,
      } = await supabase.auth.getSession();


      if (sessionError) {

        console.error(
          "SESSION ERROR:",
          sessionError
        );

        throw sessionError;

      }


      if (!session) {

        throw new Error(
          "Your session has expired. Please login again."
        );

      }


      // =================================================
      // WAIT FOR GLOBAL ACADEMIC YEAR
      // =================================================

      if (academicYearLoading) {

        return;

      }


      // =================================================
      // REQUIRE ACTIVE ACADEMIC YEAR
      // =================================================

      if (!activeAcademicYearId) {

        setStudents([]);

        setErrorMessage(
          academicYearError ||
          "No active academic year has been configured for this school."
        );

        return;

      }


      // =================================================
      // CURRENT PROFILE
      // =================================================

      const profile =
        await loadCurrentProfile();


      if (!profile) {

        throw new Error(
          "Unable to load your profile."
        );

      }


      // =================================================
      // VERIFY SCHOOL
      // =================================================

      const currentSchoolId =
        schoolId ||
        profile.school_id;


      if (!currentSchoolId) {

        throw new Error(
          "Your profile is not assigned to a school."
        );

      }


      // =================================================
      // CURRENT SELECTED ROLE
      // =================================================

      const currentRoleId =
        Number(selectedRoleId);


      const normalizedRoleName =
        String(
          selectedRoleName || ""
        )
          .trim()
          .toLowerCase();


      // =================================================
      // ROLE DETECTION
      // =================================================

      const subjectTeacherSelected =
        currentRoleId === 5;


      const classTeacherSelected =
        normalizedRoleName ===
          "class teacher";


      console.log(
        "STUDENT MODULE SELECTED ROLE ID:",
        currentRoleId
      );


      console.log(
        "STUDENT MODULE SELECTED ROLE NAME:",
        selectedRoleName
      );


      console.log(
        "STUDENT MODULE SCHOOL ID:",
        currentSchoolId
      );


      console.log(
        "GLOBAL ACTIVE ACADEMIC YEAR:",
        activeAcademicYearId,
        activeAcademicYear?.year_name
      );


      console.log(
        "SUBJECT TEACHER SELECTED:",
        subjectTeacherSelected
      );


      console.log(
        "CLASS TEACHER SELECTED:",
        classTeacherSelected
      );


      // =================================================
      // TEACHER ASSIGNMENTS
      // =================================================
      //
      // Both Subject Teacher and Class Teacher use the
      // existing teacher_assignments table.
      //
      // Confirmed fields:
      //
      // id
      // school_id
      // teacher_id
      // subject_id
      // class_id
      //
      // We DO NOT add academic_year_id because that field
      // has not been confirmed in this table.
      //
      // =================================================

      let assignedClassIds = [];

      let assignedSubjectIds = [];

      let assignments = [];


      if (
        subjectTeacherSelected ||
        classTeacherSelected
      ) {

        // ------------------------------------------------
        // TEACHER ID
        // ------------------------------------------------

        const teacherId =
          profile.teacher_id;


        if (!teacherId) {

          throw new Error(
            "Your profile is not linked to a teacher record."
          );

        }


        console.log(
          "CURRENT TEACHER ID:",
          teacherId
        );


        // ------------------------------------------------
        // LOAD ASSIGNMENTS
        // ------------------------------------------------

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
            currentSchoolId
          )
          .eq(
            "teacher_id",
            teacherId
          );


        if (assignmentError) {

          console.error(
            "TEACHER ASSIGNMENTS ERROR:",
            assignmentError
          );

          throw assignmentError;

        }


        assignments =
          Array.isArray(
            assignmentRows
          )
            ? assignmentRows
            : [];


        setTeacherAssignments(
          assignments
        );


        // ------------------------------------------------
        // UNIQUE CLASS IDS
        // ------------------------------------------------

        assignedClassIds = [
          ...new Set(
            assignments
              .map(
                (assignment) =>
                  assignment.class_id
              )
              .filter(
                (classId) =>
                  classId !== null &&
                  classId !== undefined &&
                  String(classId).trim() !== ""
              )
          ),
        ];


        // ------------------------------------------------
        // UNIQUE SUBJECT IDS
        // ------------------------------------------------

        assignedSubjectIds = [
          ...new Set(
            assignments
              .map(
                (assignment) =>
                  assignment.subject_id
              )
              .filter(
                (subjectId) =>
                  subjectId !== null &&
                  subjectId !== undefined &&
                  String(subjectId).trim() !== ""
              )
          ),
        ];


        console.log(
          "TEACHER ASSIGNMENTS:",
          assignments
        );


        console.log(
          "ASSIGNED CLASS IDS:",
          assignedClassIds
        );


        console.log(
          "ASSIGNED SUBJECT IDS:",
          assignedSubjectIds
        );


        // ------------------------------------------------
        // SUBJECT TEACHER STATE
        // ------------------------------------------------

        if (
          subjectTeacherSelected
        ) {

          setIsSubjectTeacher(true);

        }


        // ------------------------------------------------
        // CLASS TEACHER STATE
        // ------------------------------------------------

        if (
          classTeacherSelected
        ) {

          setIsClassTeacher(true);

        }


        // ------------------------------------------------
        // NO CLASS ASSIGNMENT
        // ------------------------------------------------

        if (
          assignedClassIds.length === 0
        ) {

          setStudents([]);

          return;

        }

      }


      // =================================================
      // FETCH CURRENT-YEAR STUDENTS
      // =================================================

      let query = supabase
        .from("students")
        .select(`
          id,
          admission_number,
          first_name,
          middle_name,
          last_name,
          gender,
          status,
          student_status,
          current_class_id,
          academic_year_id,
          school_id,
          class_name,
          created_at,
          admission_date
        `);


      // ------------------------------------------------
      // SCHOOL SCOPE
      // ------------------------------------------------

      query = query.eq(
        "school_id",
        currentSchoolId
      );


      // ------------------------------------------------
      // GLOBAL ACTIVE ACADEMIC YEAR
      // ------------------------------------------------

      query = query.eq(
        "academic_year_id",
        activeAcademicYearId
      );


      // ------------------------------------------------
      // ACTIVE STUDENT
      // ------------------------------------------------

      query = query.eq(
        "status",
        "Active"
      );


      query = query.eq(
        "student_status",
        "Active"
      );


      // =================================================
      // TEACHER CLASS SCOPE
      // =================================================
      //
      // Subject Teacher:
      //     only assigned classes
      //
      // Class Teacher:
      //     only assigned classes
      //
      // Other roles:
      //     no teacher assignment restriction
      //
      // =================================================

      if (
        subjectTeacherSelected ||
        classTeacherSelected
      ) {

        query = query.in(
          "current_class_id",
          assignedClassIds
        );

      }


      // =================================================
      // ORDER
      // =================================================

      query = query.order(
        "created_at",
        {
          ascending: false,
        }
      );


      // =================================================
      // EXECUTE QUERY
      // =================================================

      const {
        data,
        error,
      } = await query;


      if (error) {

        console.error(
          "STUDENT FETCH ERROR:",
          error
        );


        if (
          error.code === "401" ||
          error.message
            ?.toLowerCase()
            .includes("jwt") ||
          error.message
            ?.toLowerCase()
            .includes("unauthorized")
        ) {

          throw new Error(
            "Unauthorized access. Please logout and login again."
          );

        }


        throw error;

      }


      console.log(
        "CURRENT SCHOOL:",
        currentSchoolId
      );


      console.log(
        "GLOBAL ACADEMIC YEAR:",
        activeAcademicYearId,
        activeAcademicYear?.year_name
      );


      console.log(
        "CURRENT SELECTED ROLE:",
        currentRoleId
      );


      console.log(
        "CURRENT SELECTED ROLE NAME:",
        selectedRoleName
      );


      console.log(
        "SUBJECT TEACHER SCOPE ACTIVE:",
        subjectTeacherSelected
      );


      console.log(
        "CLASS TEACHER SCOPE ACTIVE:",
        classTeacherSelected
      );


      console.log(
        "CURRENT-YEAR STUDENTS LOADED:",
        data
      );


      setStudents(
        Array.isArray(data)
          ? data
          : []
      );


    } catch (error) {

      console.error(
        "FETCH STUDENTS FAILED:",
        error
      );


      setStudents([]);


      setErrorMessage(
        error.message ||
        "Failed to load students. Please try again."
      );


    } finally {

      setLoading(false);

    }

  }, [
    schoolId,
    activeAcademicYear,
    activeAcademicYearId,
    academicYearLoading,
    academicYearError,
    loadCurrentProfile,
    selectedRoleId,
    selectedRoleName,
  ]);


  // =====================================================
  // LOAD STUDENTS
  // =====================================================

  useEffect(() => {

    if (academicYearLoading) {

      return;

    }


    fetchStudents();

  }, [
    fetchStudents,
    academicYearLoading,
    activeAcademicYearId,
    selectedRoleId,
    selectedRoleName,
  ]);


  // =====================================================
  // DELETE STUDENT
  // =====================================================

  const deleteStudent = async (id) => {

    // ---------------------------------------------------
    // Subject Teacher must not delete students
    // ---------------------------------------------------

    if (isSubjectTeacher) {

      alert(
        "Subject Teachers are not allowed to delete students."
      );

      return;

    }


    // ---------------------------------------------------
    // Class Teacher must not delete students
    // ---------------------------------------------------

    if (isClassTeacher) {

      alert(
        "Class Teachers are not allowed to delete students."
      );

      return;

    }


    // ---------------------------------------------------
    // Academic year must still be active
    // ---------------------------------------------------

    if (!activeAcademicYearId) {

      alert(
        "No active academic year is configured."
      );

      return;

    }


    // ---------------------------------------------------
    // Confirm
    // ---------------------------------------------------

    const confirmDelete =
      window.confirm(
        "Are you sure you want to delete this student?"
      );


    if (!confirmDelete) {

      return;

    }


    try {

      setDeletingId(id);

      setErrorMessage("");


      // =================================================
      // DELETE ONLY FROM CURRENT SCHOOL + CURRENT YEAR
      // =================================================

      const {
        error,
      } = await supabase
        .from("students")
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "school_id",
          schoolId
        )
        .eq(
          "academic_year_id",
          activeAcademicYearId
        );


      if (error) {

        console.error(
          "DELETE STUDENT ERROR:",
          error
        );

        throw error;

      }


      setStudents(
        (currentStudents) =>
          currentStudents.filter(
            (student) =>
              student.id !== id
          )
      );


      alert(
        "Student deleted successfully."
      );


    } catch (error) {

      console.error(
        "DELETE STUDENT FAILED:",
        error
      );


      alert(
        error.message ||
        "Failed to delete student."
      );


    } finally {

      setDeletingId(null);

    }

  };


  // =====================================================
  // FILTER VALUES
  // =====================================================

  const search = String(
    filters?.search || ""
  )
    .trim()
    .toLowerCase();


  const selectedGender =
    String(filters?.gender || "")
      .trim()
      .toLowerCase();


  const selectedStatus =
    String(filters?.status || "")
      .trim()
      .toLowerCase();


  // =====================================================
  // FILTER STUDENTS
  // =====================================================

  const filteredStudents =
    students.filter(
      (student) => {

        // ------------------------------------------------
        // GENDER
        // ------------------------------------------------

        if (
          selectedGender &&
          String(
            student.gender || ""
          )
            .trim()
            .toLowerCase() !==
          selectedGender
        ) {

          return false;

        }


        // ------------------------------------------------
        // STATUS
        // ------------------------------------------------

        if (
          selectedStatus &&
          String(
            student.status ||
            student.student_status ||
            ""
          )
            .trim()
            .toLowerCase() !==
          selectedStatus
        ) {

          return false;

        }


        // ------------------------------------------------
        // SEARCH
        // ------------------------------------------------

        if (!search) {

          return true;

        }


        const fullName = [

          student.first_name,

          student.middle_name,

          student.last_name,

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const admissionNumber =
          String(
            student.admission_number || ""
          ).toLowerCase();


        const gender =
          String(
            student.gender || ""
          ).toLowerCase();


        const className =
          String(
            student.class_name || ""
          ).toLowerCase();


        return (

          fullName.includes(search) ||

          admissionNumber.includes(search) ||

          gender.includes(search) ||

          className.includes(search)

        );

      }
    );


  // =====================================================
  // GROUP STUDENTS BY CLASS
  // =====================================================

  const studentsByClass = useMemo(() => {

    const groups = {};


    filteredStudents.forEach(
      (student) => {

        const className =
          String(
            student.class_name ||
            "Unassigned Class"
          ).trim() ||
          "Unassigned Class";


        // ------------------------------------------------
        // GROUP BY CURRENT CLASS ID
        // ------------------------------------------------

        const classKey =
          String(
            student.current_class_id ||
            className
          );


        if (!groups[classKey]) {

          groups[classKey] = {

            key: classKey,

            className,

            students: [],

          };

        }


        groups[classKey].students.push(
          student
        );

      }
    );


    return Object.values(groups)
      .sort((a, b) => {

        const aMatch =
          a.className.match(
            /(\d+)/
          );


        const bMatch =
          b.className.match(
            /(\d+)/
          );


        if (
          aMatch &&
          bMatch
        ) {

          const numberDifference =
            Number(aMatch[1]) -
            Number(bMatch[1]);


          if (
            numberDifference !== 0
          ) {

            return numberDifference;

          }

        }


        return a.className.localeCompare(
          b.className
        );

      });

  }, [
    filteredStudents,
  ]);


  // =====================================================
  // CLASS CARD TOGGLE
  // =====================================================

  const toggleClass = (
    classKey
  ) => {

    setExpandedClasses(
      (current) => ({

        ...current,

        [classKey]:
          !current[classKey],

      })
    );

  };


  // =====================================================
  // OPEN ALL
  // =====================================================

  const openAllClasses = () => {

    const nextState = {};


    studentsByClass.forEach(
      (group) => {

        nextState[group.key] =
          true;

      }
    );


    setExpandedClasses(
      nextState
    );

  };


  // =====================================================
  // CLOSE ALL
  // =====================================================

  const closeAllClasses = () => {

    setExpandedClasses({});

  };


  // =====================================================
  // LOADING
  // =====================================================

  if (
    loading ||
    academicYearLoading
  ) {

    return (

      <div className="rounded-xl bg-white p-6 shadow">

        <div className="text-slate-600">

          Loading students...

        </div>

      </div>

    );

  }


  // =====================================================
  // ACADEMIC YEAR ERROR
  // =====================================================

  if (
    !activeAcademicYearId
  ) {

    return (

      <div className="rounded-xl bg-white p-6 shadow">

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">

          <strong>
            No Active Academic Year
          </strong>


          <p className="mt-1">

            {
              academicYearError ||
              "Please configure an active academic year in Settings."
            }

          </p>

        </div>

      </div>

    );

  }


  // =====================================================
  // GENERAL ERROR
  // =====================================================

  if (errorMessage) {

    return (

      <div className="rounded-xl bg-white p-6 shadow">

        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">

          <strong>
            Unable to load students
          </strong>


          <p className="mt-1">

            {errorMessage}

          </p>

        </div>


        <button
          onClick={fetchStudents}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >

          Try Again

        </button>

      </div>

    );

  }


  // =====================================================
  // TEACHER INFORMATION
  // =====================================================

  const assignedClassCount =
    [
      ...new Set(
        teacherAssignments
          .map(
            (assignment) =>
              assignment.class_id
          )
          .filter(
            (classId) =>
              classId !== null &&
              classId !== undefined &&
              String(classId).trim() !== ""
          )
      ),
    ].length;


  const assignedSubjectCount =
    [
      ...new Set(
        teacherAssignments
          .map(
            (assignment) =>
              assignment.subject_id
          )
          .filter(
            (subjectId) =>
              subjectId !== null &&
              subjectId !== undefined &&
              String(subjectId).trim() !== ""
          )
      ),
    ].length;


  // =====================================================
  // MAIN UI
  // =====================================================

  return (

    <div>

      {/* =================================================
          ACTIVE ACADEMIC YEAR
          ================================================= */}

      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">

        <div>

          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">

            Academic Year

          </div>


          <div className="text-base font-semibold text-slate-900">

            {
              activeAcademicYear?.year_name ||
              "-"
            }


            {activeAcademicYear?.term && (

              <span className="ml-2 text-sm font-normal text-slate-500">

                ({activeAcademicYear.term})

              </span>

            )}

          </div>

        </div>


        <div className="text-sm text-slate-500">

          {filteredStudents.length} student

          {
            filteredStudents.length === 1
              ? ""
              : "s"
          }

        </div>

      </div>


      {/* =================================================
          SUBJECT TEACHER INFORMATION
          ================================================= */}

      {isSubjectTeacher && (

        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <h3 className="font-semibold text-blue-900">

                My Students

              </h3>


              <p className="text-sm text-blue-700">

                You are viewing students from
                your assigned classes only.

              </p>

            </div>


            <div className="flex flex-wrap gap-3 text-sm">

              <span className="rounded-lg bg-white px-3 py-2 text-blue-800 shadow-sm">

                Subjects:{" "}

                <strong>
                  {assignedSubjectCount}
                </strong>

              </span>


              <span className="rounded-lg bg-white px-3 py-2 text-blue-800 shadow-sm">

                Classes:{" "}

                <strong>
                  {assignedClassCount}
                </strong>

              </span>


              <span className="rounded-lg bg-white px-3 py-2 text-blue-800 shadow-sm">

                Students:{" "}

                <strong>
                  {filteredStudents.length}
                </strong>

              </span>

            </div>

          </div>

        </div>

      )}


      {/* =================================================
          CLASS TEACHER INFORMATION
          ================================================= */}

      {isClassTeacher && (

        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <h3 className="font-semibold text-emerald-900">

                My Class Students

              </h3>


              <p className="text-sm text-emerald-700">

                You are viewing students from
                your assigned class only.

              </p>

            </div>


            <div className="flex flex-wrap gap-3 text-sm">

              <span className="rounded-lg bg-white px-3 py-2 text-emerald-800 shadow-sm">

                Classes:{" "}

                <strong>
                  {assignedClassCount}
                </strong>

              </span>


              <span className="rounded-lg bg-white px-3 py-2 text-emerald-800 shadow-sm">

                Students:{" "}

                <strong>
                  {filteredStudents.length}
                </strong>

              </span>

            </div>

          </div>

        </div>

      )}


      {/* =================================================
          CLASS CARD CONTROLS
          ================================================= */}

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">

        <div>

          <h3 className="text-base font-semibold text-slate-900">

            Students by Class

          </h3>


          <p className="text-sm text-slate-500">

            {studentsByClass.length} class

            {
              studentsByClass.length === 1
                ? ""
                : "es"
            }

            {" • "}

            {filteredStudents.length} student

            {
              filteredStudents.length === 1
                ? ""
                : "s"
            }

          </p>

        </div>


        {studentsByClass.length > 0 && (

          <div className="flex gap-2">

            <button
              type="button"
              onClick={openAllClasses}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >

              Open All

            </button>


            <button
              type="button"
              onClick={closeAllClasses}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >

              Close All

            </button>

          </div>

        )}

      </div>


      {/* =================================================
          NO STUDENTS
          ================================================= */}

      {studentsByClass.length === 0 ? (

        <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow">

          {
            isSubjectTeacher

              ? "No students found in your assigned classes for the current academic year."

              : isClassTeacher

                ? "No students found in your assigned class for the current academic year."

                : "No students found for the current academic year."
          }

        </div>

      ) : (

        <div className="space-y-3">

          {studentsByClass.map(
            (group) => {

              const isExpanded =
                Boolean(
                  expandedClasses[
                    group.key
                  ]
                );


              return (

                <div
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >

                  {/* =======================================
                      CLASS CARD HEADER
                      ======================================= */}

                  <button
                    type="button"
                    onClick={() =>
                      toggleClass(
                        group.key
                      )
                    }
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50"
                    aria-expanded={
                      isExpanded
                    }
                  >

                    <div className="flex min-w-0 items-center gap-3">

                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold ${
                          isExpanded
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >

                        {
                          isExpanded
                            ? "−"
                            : "+"
                        }

                      </div>


                      <div className="min-w-0">

                        <div className="truncate text-base font-semibold text-slate-900">

                          {group.className}

                        </div>


                        <div className="text-sm text-slate-500">

                          {group.students.length} student

                          {
                            group.students.length === 1
                              ? ""
                              : "s"
                          }

                        </div>

                      </div>

                    </div>


                    <div className="flex shrink-0 items-center gap-2">

                      <span
                        className={`hidden rounded-full px-3 py-1 text-xs font-medium sm:inline-flex ${
                          isExpanded
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >

                        {
                          isExpanded
                            ? "Open"
                            : "Closed"
                        }

                      </span>


                      <span className="text-xl leading-none text-slate-500">

                        {
                          isExpanded
                            ? "⌃"
                            : "⌄"
                        }

                      </span>

                    </div>

                  </button>


                  {/* =======================================
                      STUDENT TABLE
                      ======================================= */}

                  {isExpanded && (

                    <div className="border-t border-slate-200">

                      <div className="overflow-x-auto">

                        <table className="w-full min-w-[850px]">

                          <thead className="bg-slate-900 text-white">

                            <tr>

                              <th className="p-4 text-left">
                                Admission No
                              </th>


                              <th className="p-4 text-left">
                                Name
                              </th>


                              <th className="p-4 text-left">
                                Gender
                              </th>


                              <th className="p-4 text-left">
                                Class
                              </th>


                              <th className="p-4 text-left">
                                Status
                              </th>


                              <th className="p-4 text-center">
                                Actions
                              </th>

                            </tr>

                          </thead>


                          <tbody>

                            {group.students.map(
                              (student) => (

                                <tr
                                  key={
                                    student.id
                                  }
                                  className="border-b border-slate-200 hover:bg-slate-50"
                                >

                                  <td className="p-4 font-medium">

                                    {
                                      student.admission_number ||
                                      "-"
                                    }

                                  </td>


                                  <td className="p-4">

                                    {[
                                      student.first_name,
                                      student.middle_name,
                                      student.last_name,
                                    ]
                                      .filter(Boolean)
                                      .join(" ") ||
                                      "-"}

                                  </td>


                                  <td className="p-4">

                                    {
                                      student.gender ||
                                      "-"
                                    }

                                  </td>


                                  <td className="p-4">

                                    {
                                      student.class_name ||
                                      "-"
                                    }

                                  </td>


                                  <td className="p-4">

                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">

                                      {
                                        student.status ||
                                        student.student_status ||
                                        "-"
                                      }

                                    </span>

                                  </td>


                                  <td className="p-4">

                                    <div className="flex justify-center gap-2">

                                      {/* =========================
                                          VIEW
                                          ========================= */}

                                      <button
                                        onClick={() =>
                                          navigate(
                                            `/students/profile/${student.id}`
                                          )
                                        }
                                        className="rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700"
                                      >

                                        View

                                      </button>


                                      {/* =========================
                                          EDIT
                                          ========================= */}

                                      {!isSubjectTeacher &&
                                        !isClassTeacher && (

                                          <button
                                            onClick={() =>
                                              navigate(
                                                `/students/edit/${student.id}`
                                              )
                                            }
                                            className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
                                          >

                                            Edit

                                          </button>

                                        )}


                                      {/* =========================
                                          DELETE
                                          ========================= */}

                                      {!isSubjectTeacher &&
                                        !isClassTeacher && (

                                          <button
                                            onClick={() =>
                                              deleteStudent(
                                                student.id
                                              )
                                            }
                                            disabled={
                                              deletingId ===
                                              student.id
                                            }
                                            className="rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                          >

                                            {
                                              deletingId ===
                                              student.id

                                                ? "Deleting..."

                                                : "Delete"
                                            }

                                          </button>

                                        )}

                                    </div>

                                  </td>

                                </tr>

                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    </div>

                  )}

                </div>

              );

            }
          )}

        </div>

      )}

    </div>

  );

}


export default StudentTable;