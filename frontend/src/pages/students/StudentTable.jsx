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
  // SCHOOL CONTEXT
  // =====================================================

  const {
    schoolId,
    activeAcademicYear,
    activeAcademicYearId,
  } = useSchool();


  // =====================================================
  // ROLE CONTEXT
  // =====================================================

  const {
    selectedRoleId,
    selectedRoleName,
    isSuperAdmin,
    selectedRoleIsSuperAdmin,
  } = useRole();


  // =====================================================
  // STATE
  // =====================================================

  const [students, setStudents] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [deletingId, setDeletingId] =
    useState(null);

  const [resolvedSchoolId, setResolvedSchoolId] =
    useState(null);

  const [resolvedAcademicYearId, setResolvedAcademicYearId] =
    useState(null);

  const [resolvedAcademicYearName, setResolvedAcademicYearName] =
    useState("");

  const [expandedClasses, setExpandedClasses] =
    useState({});

  const [isSubjectTeacher, setIsSubjectTeacher] =
    useState(false);

  const [isClassTeacher, setIsClassTeacher] =
    useState(false);

  const [teacherAssignments, setTeacherAssignments] =
    useState([]);


  // =====================================================
  // GET CURRENT PROFILE
  // =====================================================

  const loadCurrentProfile =
    useCallback(async () => {

      const {
        data: {
          user,
        },
        error: authError,
      } =
        await supabase.auth.getUser();


      if (authError) {
        throw authError;
      }


      if (!user) {

        throw new Error(
          "No authenticated user was found."
        );

      }


      const {
        data: profile,
        error: profileError,
      } =
        await supabase
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


      if (!profile) {

        throw new Error(
          "Your profile could not be found."
        );

      }


      return profile;

    }, []);


  // =====================================================
  // RESOLVE ACTIVE ACADEMIC YEAR
  // =====================================================

  const resolveAcademicYear =
    useCallback(async (
      currentSchoolId
    ) => {

      // -------------------------------------------------
      // FIRST: USE SCHOOL CONTEXT IF VALID
      // -------------------------------------------------

      if (
        activeAcademicYearId &&
        Number(activeAcademicYearId) > 0
      ) {

        return {

          id:
            Number(
              activeAcademicYearId
            ),

          name:
            activeAcademicYear?.year_name ||
            activeAcademicYear?.name ||
            activeAcademicYear?.year ||
            "",

        };

      }


      // -------------------------------------------------
      // FALLBACK: DIRECT SUPABASE QUERY
      // -------------------------------------------------

      console.log(
        "STUDENT TABLE: resolving active academic year directly..."
      );


      const {
        data: activeYear,
        error: activeYearError,
      } =
        await supabase
          .from("academic_years")
          .select(`
            id,
            year_name,
            year,
            is_active,
            school_id
          `)
          .eq(
            "school_id",
            currentSchoolId
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "id",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();


      if (activeYearError) {
        throw activeYearError;
      }


      if (!activeYear) {

        throw new Error(
          "No active academic year was found for this school."
        );

      }


      return {

        id:
          Number(
            activeYear.id
          ),

        name:
          activeYear.year_name ||
          activeYear.year ||
          "",

      };

    }, [
      activeAcademicYearId,
      activeAcademicYear,
    ]);


  // =====================================================
  // FETCH STUDENTS
  // =====================================================

  const fetchStudents =
    useCallback(async () => {

      try {

        setLoading(true);

        setErrorMessage("");

        setStudents([]);

        setExpandedClasses({});

        setTeacherAssignments([]);

        setIsSubjectTeacher(false);

        setIsClassTeacher(false);


        // =================================================
        // SESSION
        // =================================================

        const {
          data: {
            session,
          },
          error: sessionError,
        } =
          await supabase.auth.getSession();


        if (sessionError) {
          throw sessionError;
        }


        if (!session) {

          throw new Error(
            "Your session has expired. Please login again."
          );

        }


        console.log(
          "=================================================="
        );

        console.log(
          "STUDENT TABLE - AUTHORITATIVE PROFILE LOAD"
        );

        console.log(
          "=================================================="
        );


        // =================================================
        // PROFILE
        // =================================================

        const profile =
          await loadCurrentProfile();


        // =================================================
        // SCHOOL
        // =================================================
        //
        // PROFILE SCHOOL ID IS AUTHORITATIVE.
        // CONTEXT IS ONLY A FALLBACK.
        // =================================================

        const currentSchoolId =
          Number(
            profile.school_id ||
            schoolId
          );


        if (
          !currentSchoolId ||
          Number.isNaN(currentSchoolId)
        ) {

          throw new Error(
            "No school is assigned to your profile."
          );

        }


        setResolvedSchoolId(
          currentSchoolId
        );


        // =================================================
        // ACADEMIC YEAR
        // =================================================

        const academicYear =
          await resolveAcademicYear(
            currentSchoolId
          );


        const currentAcademicYearId =
          Number(
            academicYear.id
          );


        if (
          !currentAcademicYearId ||
          Number.isNaN(
            currentAcademicYearId
          )
        ) {

          throw new Error(
            "Unable to resolve the active academic year."
          );

        }


        setResolvedAcademicYearId(
          currentAcademicYearId
        );


        setResolvedAcademicYearName(
          academicYear.name ||
          ""
        );


        // =================================================
        // AUTHORITATIVE ROLE RESOLUTION
        // =================================================
        //
        // IMPORTANT:
        //
        // profiles.role_id is checked FIRST.
        //
        // If profiles.role_id = 1, this user is ALWAYS
        // treated as Super Admin in this module.
        //
        // RoleContext must NOT be allowed to downgrade
        // a Super Admin to another selected role here.
        // =================================================

        const profileRoleId =
          Number(
            profile.role_id
          );


        const contextRoleId =
          Number(
            selectedRoleId
          );


        const contextRoleName =
          String(
            selectedRoleName || ""
          )
            .trim()
            .toLowerCase();


        const profileIsSuperAdmin =
          profileRoleId === 1;


        const contextIsSuperAdmin =
          Boolean(
            isSuperAdmin ||
            selectedRoleIsSuperAdmin ||
            contextRoleId === 1 ||
            contextRoleName === "super admin" ||
            contextRoleName === "super administrator"
          );


        // -------------------------------------------------
        // AUTHORITATIVE CURRENT ROLE
        // -------------------------------------------------

        const currentRoleId =
          profileIsSuperAdmin
            ? 1
            : (
                contextRoleId ||
                profileRoleId
              );


        const superAdminSelected =
          profileIsSuperAdmin ||
          contextIsSuperAdmin ||
          currentRoleId === 1;


        console.log(
          "PROFILE ROLE ID:",
          profileRoleId
        );

        console.log(
          "CONTEXT ROLE ID:",
          contextRoleId
        );

        console.log(
          "CONTEXT ROLE NAME:",
          selectedRoleName
        );

        console.log(
          "PROFILE IS SUPER ADMIN:",
          profileIsSuperAdmin
        );

        console.log(
          "CONTEXT IS SUPER ADMIN:",
          contextIsSuperAdmin
        );

        console.log(
          "FINAL ROLE ID:",
          currentRoleId
        );

        console.log(
          "FINAL SUPER ADMIN:",
          superAdminSelected
        );


        // =================================================
        // TEACHER TYPES
        // =================================================
        //
        // SUPER ADMIN MUST NEVER ENTER THESE RESTRICTIONS.
        // =================================================

        const subjectTeacherSelected =
          !superAdminSelected &&
          currentRoleId === 5;


        const classTeacherSelected =
          !superAdminSelected &&
          (
            contextRoleName === "class teacher" ||
            currentRoleId === 12
          );


        // =================================================
        // TEACHER ASSIGNMENTS
        // =================================================

        let assignedClassIds = [];


        if (
          subjectTeacherSelected ||
          classTeacherSelected
        ) {

          const teacherId =
            profile.teacher_id;


          if (!teacherId) {

            throw new Error(
              "Your profile is not linked to a teacher record."
            );

          }


          const {
            data: assignments,
            error: assignmentError,
          } =
            await supabase
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
            throw assignmentError;
          }


          const safeAssignments =
            Array.isArray(
              assignments
            )
              ? assignments
              : [];


          setTeacherAssignments(
            safeAssignments
          );


          assignedClassIds = [
            ...new Set(
              safeAssignments
                .map(
                  (item) =>
                    item.class_id
                )
                .filter(
                  (id) =>
                    id !== null &&
                    id !== undefined
                )
            ),
          ];


          setIsSubjectTeacher(
            subjectTeacherSelected
          );


          setIsClassTeacher(
            classTeacherSelected
          );


          if (
            assignedClassIds.length === 0
          ) {

            setStudents([]);

            return;

          }

        }


        // =================================================
        // STUDENTS QUERY
        // =================================================
        //
        // SUPER ADMIN:
        // NO TEACHER FILTER.
        //
        // ALL ACTIVE STUDENTS IN THE CURRENT SCHOOL
        // AND ACTIVE ACADEMIC YEAR ARE RETURNED.
        // =================================================

        let studentQuery =
          supabase
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
            `)
            .eq(
              "school_id",
              currentSchoolId
            )
            .eq(
              "academic_year_id",
              currentAcademicYearId
            )
            .eq(
              "status",
              "Active"
            )
            .eq(
              "student_status",
              "Active"
            );


        // =================================================
        // TEACHER RESTRICTION
        // =================================================

        if (
          !superAdminSelected &&
          (
            subjectTeacherSelected ||
            classTeacherSelected
          ) &&
          assignedClassIds.length > 0
        ) {

          studentQuery =
            studentQuery.in(
              "current_class_id",
              assignedClassIds
            );

        }


        // =================================================
        // ORDER
        // =================================================

        studentQuery =
          studentQuery.order(
            "created_at",
            {
              ascending: false,
            }
          );


        // =================================================
        // EXECUTE STUDENT QUERY
        // =================================================

        const {
          data: studentRows,
          error: studentError,
        } =
          await studentQuery;


        if (studentError) {
          throw studentError;
        }


        const loadedStudents =
          Array.isArray(
            studentRows
          )
            ? studentRows
            : [];


        console.log(
          "STUDENT QUERY SCHOOL:",
          currentSchoolId
        );

        console.log(
          "STUDENT QUERY ACADEMIC YEAR:",
          currentAcademicYearId
        );

        console.log(
          "STUDENT QUERY SUPER ADMIN:",
          superAdminSelected
        );

        console.log(
          "STUDENT ROWS RETURNED:",
          loadedStudents.length
        );

        console.log(
          "STUDENT ROWS:",
          loadedStudents
        );


        // =================================================
        // GET CLASS IDS
        // =================================================

        const classIds = [
          ...new Set(
            loadedStudents
              .map(
                (student) =>
                  student.current_class_id
              )
              .filter(
                (id) =>
                  id !== null &&
                  id !== undefined
              )
          ),
        ];


        console.log(
          "CLASS IDS FROM STUDENTS:",
          classIds
        );


        // =================================================
        // FETCH CLASSES
        // =================================================

        let classRows = [];


        if (
          classIds.length > 0
        ) {

          const {
            data: classes,
            error: classError,
          } =
            await supabase
              .from("classes")
              .select(`
                id,
                class_name,
                school_id,
                academic_year_id
              `)
              .in(
                "id",
                classIds
              );


          if (classError) {

            console.error(
              "CLASS QUERY ERROR:",
              classError
            );

          } else {

            classRows =
              Array.isArray(
                classes
              )
                ? classes
                : [];

          }

        }


        console.log(
          "CLASS ROWS:",
          classRows
        );


        // =================================================
        // CLASS MAP
        // =================================================

        const classMap =
          new Map();


        classRows.forEach(
          (classRow) => {

            classMap.set(
              String(
                classRow.id
              ),

              classRow.class_name ||
              `Class ${classRow.id}`
            );

          }
        );


        // =================================================
        // BUILD FINAL STUDENT DATA
        // =================================================

        const finalStudents =
          loadedStudents.map(
            (student) => {

              const className =
                classMap.get(
                  String(
                    student.current_class_id
                  )
                ) ||
                student.class_name ||
                "Unassigned Class";


              return {

                ...student,

                class_name:
                  className,

              };

            }
          );


        // =================================================
        // SAVE STUDENTS
        // =================================================

        setStudents(
          finalStudents
        );


        // =================================================
        // AUTO EXPAND CLASSES
        // =================================================

        const classState = {};


        finalStudents.forEach(
          (student) => {

            const classKey =
              String(
                student.current_class_id ||
                student.class_name ||
                "unassigned"
              );


            classState[
              classKey
            ] = true;

          }
        );


        setExpandedClasses(
          classState
        );


        console.log(
          "FINAL STUDENTS:",
          finalStudents
        );

        console.log(
          "FINAL STUDENT COUNT:",
          finalStudents.length
        );

        console.log(
          "FINAL CLASS COUNT:",
          Object.keys(
            classState
          ).length
        );

        console.log(
          "=================================================="
        );


      } catch (error) {

        console.error(
          "=================================================="
        );

        console.error(
          "STUDENT TABLE FAILED"
        );

        console.error(
          error
        );

        console.error(
          "=================================================="
        );


        setStudents([]);

        setExpandedClasses({});


        setErrorMessage(
          error?.message ||
          "Failed to load students."
        );


      } finally {

        setLoading(false);

      }

    }, [
      schoolId,
      activeAcademicYear,
      activeAcademicYearId,
      loadCurrentProfile,
      resolveAcademicYear,
      selectedRoleId,
      selectedRoleName,
      isSuperAdmin,
      selectedRoleIsSuperAdmin,
    ]);


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {

    fetchStudents();

  }, [
    fetchStudents,
  ]);


  // =====================================================
  // DELETE STUDENT
  // =====================================================

  const deleteStudent =
    async (
      studentId
    ) => {

      if (
        isSubjectTeacher ||
        isClassTeacher
      ) {

        alert(
          "You are not allowed to delete students."
        );

        return;

      }


      if (
        !resolvedSchoolId ||
        !resolvedAcademicYearId
      ) {

        alert(
          "School or academic year could not be resolved."
        );

        return;

      }


      const confirmed =
        window.confirm(
          "Are you sure you want to delete this student?"
        );


      if (!confirmed) {
        return;
      }


      try {

        setDeletingId(
          studentId
        );


        const {
          error,
        } =
          await supabase
            .from("students")
            .delete()
            .eq(
              "id",
              studentId
            )
            .eq(
              "school_id",
              resolvedSchoolId
            )
            .eq(
              "academic_year_id",
              resolvedAcademicYearId
            );


        if (error) {
          throw error;
        }


        setStudents(
          (current) =>
            current.filter(
              (student) =>
                student.id !==
                studentId
            )
        );


      } catch (error) {

        console.error(
          "DELETE STUDENT ERROR:",
          error
        );


        alert(
          error?.message ||
          "Failed to delete student."
        );


      } finally {

        setDeletingId(null);

      }

    };


  // =====================================================
  // FILTERS
  // =====================================================

  const search =
    String(
      filters?.search || ""
    )
      .trim()
      .toLowerCase();


  const selectedGender =
    String(
      filters?.gender || ""
    )
      .trim()
      .toLowerCase();


  const selectedStatus =
    String(
      filters?.status || ""
    )
      .trim()
      .toLowerCase();


  // =====================================================
  // FILTER STUDENTS
  // =====================================================

  const filteredStudents =
    useMemo(() => {

      return students.filter(
        (student) => {

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


          if (!search) {
            return true;
          }


          const fullName =
            [
              student.first_name,
              student.middle_name,
              student.last_name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


          const admission =
            String(
              student.admission_number ||
              ""
            ).toLowerCase();


          const className =
            String(
              student.class_name ||
              ""
            ).toLowerCase();


          return (
            fullName.includes(search) ||
            admission.includes(search) ||
            className.includes(search)
          );

        }
      );

    }, [
      students,
      search,
      selectedGender,
      selectedStatus,
    ]);


  // =====================================================
  // GROUP BY CLASS
  // =====================================================

  const studentsByClass =
    useMemo(() => {

      const groups = {};


      filteredStudents.forEach(
        (student) => {

          const className =
            String(
              student.class_name ||
              "Unassigned Class"
            ).trim() ||
            "Unassigned Class";


          const classKey =
            String(
              student.current_class_id ||
              className
            );


          if (
            !groups[classKey]
          ) {

            groups[classKey] = {

              key:
                classKey,

              className:
                className,

              students: [],

            };

          }


          groups[
            classKey
          ].students.push(
            student
          );

        }
      );


      return Object.values(
        groups
      ).sort(
        (a, b) => {

          return a.className.localeCompare(
            b.className,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          );

        }
      );

    }, [
      filteredStudents,
    ]);


  // =====================================================
  // TOGGLE CLASS
  // =====================================================

  const toggleClass =
    (classKey) => {

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

  const openAllClasses =
    () => {

      const next = {};


      studentsByClass.forEach(
        (group) => {

          next[
            group.key
          ] = true;

        }
      );


      setExpandedClasses(
        next
      );

    };


  // =====================================================
  // CLOSE ALL
  // =====================================================

  const closeAllClasses =
    () => {

      setExpandedClasses(
        {}
      );

    };


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (

      <div className="rounded-xl bg-white p-6 shadow">

        <div className="animate-pulse">

          <div className="mb-4 h-6 w-48 rounded bg-slate-200" />

          <div className="h-20 rounded bg-slate-100" />

        </div>

      </div>

    );

  }


  // =====================================================
  // ERROR
  // =====================================================

  if (errorMessage) {

    return (

      <div className="rounded-xl bg-white p-6 shadow">

        <div className="rounded-lg border border-red-200 bg-red-50 p-5">

          <h3 className="font-semibold text-red-800">

            Unable to load students

          </h3>


          <p className="mt-2 text-sm text-red-700">

            {errorMessage}

          </p>

        </div>


        <button
          type="button"
          onClick={fetchStudents}
          className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Try Again
        </button>

      </div>

    );

  }


  // =====================================================
  // MAIN
  // =====================================================

  return (

    <div className="space-y-4">

      {/* =================================================
          SCOPE INFORMATION
          ================================================= */}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <div>

            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">

              Academic Year

            </div>


            <div className="text-lg font-bold text-slate-900">

              {
                resolvedAcademicYearName ||
                activeAcademicYear?.year_name ||
                activeAcademicYear?.year ||
                "Active Year"
              }

            </div>

          </div>


          <div className="flex flex-wrap gap-2">

            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">

              School:{" "}

              {resolvedSchoolId || "-"}

            </span>


            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">

              Students:{" "}

              {filteredStudents.length}

            </span>


            <span className="rounded-lg bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700">

              Classes:{" "}

              {studentsByClass.length}

            </span>

          </div>

        </div>

      </div>


      {/* =================================================
          SUPER ADMIN
          ================================================= */}

      {
        (
          isSuperAdmin ||
          selectedRoleIsSuperAdmin ||
          Number(selectedRoleId) === 1
        ) && (

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

            <div className="font-semibold text-blue-900">

              Super Admin — Full Student Access

            </div>


            <div className="mt-1 text-sm text-blue-700">

              All active students for this school and
              academic year are displayed below.

            </div>

          </div>

        )
      }


      {/* =================================================
          CLASS CONTROLS
          ================================================= */}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">

        <div>

          <h3 className="font-semibold text-slate-900">

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


        <div className="flex gap-2">

          <button
            type="button"
            onClick={openAllClasses}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open All
          </button>


          <button
            type="button"
            onClick={closeAllClasses}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close All
          </button>

        </div>

      </div>


      {/* =================================================
          NO DATA
          ================================================= */}

      {
        studentsByClass.length === 0 ? (

          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">

            <div className="text-lg font-semibold text-slate-800">

              No Students Found

            </div>


            <p className="mt-2 text-sm text-slate-500">

              No active students were found for the
              resolved school and academic year.

            </p>


            <div className="mt-4 text-xs text-slate-400">

              School ID:{" "}
              {resolvedSchoolId || "-"}

              {" • "}

              Academic Year ID:{" "}
              {resolvedAcademicYearId || "-"}

            </div>

          </div>

        ) : (

          <div className="space-y-3">

            {
              studentsByClass.map(
                (group) => {

                  const isExpanded =
                    Boolean(
                      expandedClasses[
                        group.key
                      ]
                    );


                  return (

                    <div
                      key={
                        group.key
                      }
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >

                      {/* =================================
                          CLASS HEADER
                          ================================= */}

                      <button
                        type="button"
                        onClick={() =>
                          toggleClass(
                            group.key
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
                      >

                        <div className="flex items-center gap-3">

                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold ${
                              isExpanded
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >

                            {
                              isExpanded
                                ? "−"
                                : "+"
                            }

                          </div>


                          <div>

                            <div className="font-semibold text-slate-900">

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


                        <div className="text-slate-500">

                          {
                            isExpanded
                              ? "▲"
                              : "▼"
                          }

                        </div>

                      </button>


                      {/* =================================
                          STUDENT TABLE
                          ================================= */}

                      {
                        isExpanded && (

                          <div className="overflow-x-auto border-t border-slate-200">

                            <table className="w-full min-w-[900px]">

                              <thead className="bg-slate-900 text-white">

                                <tr>

                                  <th className="px-4 py-3 text-left text-sm">
                                    Admission No
                                  </th>


                                  <th className="px-4 py-3 text-left text-sm">
                                    Student Name
                                  </th>


                                  <th className="px-4 py-3 text-left text-sm">
                                    Gender
                                  </th>


                                  <th className="px-4 py-3 text-left text-sm">
                                    Class
                                  </th>


                                  <th className="px-4 py-3 text-left text-sm">
                                    Status
                                  </th>


                                  <th className="px-4 py-3 text-center text-sm">
                                    Actions
                                  </th>

                                </tr>

                              </thead>


                              <tbody>

                                {
                                  group.students.map(
                                    (student) => (

                                      <tr
                                        key={
                                          student.id
                                        }
                                        className="border-b border-slate-200 hover:bg-slate-50"
                                      >

                                        <td className="px-4 py-4 font-medium text-slate-800">

                                          {
                                            student.admission_number ||
                                            "-"
                                          }

                                        </td>


                                        <td className="px-4 py-4 font-medium text-slate-900">

                                          {
                                            [
                                              student.first_name,
                                              student.middle_name,
                                              student.last_name,
                                            ]
                                              .filter(Boolean)
                                              .join(" ") ||
                                            "-"
                                          }

                                        </td>


                                        <td className="px-4 py-4 text-slate-700">

                                          {
                                            student.gender ||
                                            "-"
                                          }

                                        </td>


                                        <td className="px-4 py-4 text-slate-700">

                                          {
                                            student.class_name ||
                                            "-"
                                          }

                                        </td>


                                        <td className="px-4 py-4">

                                          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">

                                            {
                                              student.status ||
                                              student.student_status ||
                                              "Active"
                                            }

                                          </span>

                                        </td>


                                        <td className="px-4 py-4">

                                          <div className="flex justify-center gap-2">

                                            <button
                                              type="button"
                                              onClick={() =>
                                                navigate(
                                                  `/students/profile/${student.id}`
                                                )
                                              }
                                              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                                            >
                                              View
                                            </button>


                                            {
                                              !isSubjectTeacher &&
                                              !isClassTeacher && (

                                                <>

                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      navigate(
                                                        `/students/edit/${student.id}`
                                                      )
                                                    }
                                                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                                  >
                                                    Edit
                                                  </button>


                                                  <button
                                                    type="button"
                                                    disabled={
                                                      deletingId ===
                                                      student.id
                                                    }
                                                    onClick={() =>
                                                      deleteStudent(
                                                        student.id
                                                      )
                                                    }
                                                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                  >

                                                    {
                                                      deletingId ===
                                                      student.id
                                                        ? "Deleting..."
                                                        : "Delete"
                                                    }

                                                  </button>

                                                </>

                                              )
                                            }

                                          </div>

                                        </td>

                                      </tr>

                                    )
                                  )
                                }

                              </tbody>

                            </table>

                          </div>

                        )
                      }

                    </div>

                  );

                }
              )
            }

          </div>

        )
      }

    </div>

  );

}


export default StudentTable;