import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../services/supabase";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/*
 * VERIFIED SYSTEM ROLE IDS
 *
 * Subject Teacher = 5
 * Class Teacher   = 12
 */
const SUBJECT_TEACHER_ROLE_ID = 5;
const CLASS_TEACHER_ROLE_ID = 12;

function AddTeacher() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [roles, setRoles] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const [assignments, setAssignments] = useState([]);

  const [assignmentSubjectId, setAssignmentSubjectId] =
    useState("");

  const [assignmentClassId, setAssignmentClassId] =
    useState("");

  /*
   * ASSIGNMENT TYPE
   *
   * subject = Subject Teacher assignment
   * class   = Class Teacher assignment
   */
  const [assignmentType, setAssignmentType] =
    useState("subject");

  const [createdAccount, setCreatedAccount] = useState(null);

  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [primaryRoleId, setPrimaryRoleId] = useState("");

  const [teacher, setTeacher] = useState({
    school_id: 1,
    employee_number: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "",
    phone: "",
    email: "",
    employment_date: "",
    qualification: "",
    specialization: "",
    status: "Active",
    photo_url: "",
    staff_type: "",
  });

  /* =========================================================
     DERIVED ROLE STATE
  ========================================================= */

  const hasSubjectTeacherRole =
    selectedRoleIds.includes(
      String(SUBJECT_TEACHER_ROLE_ID)
    );

  const hasClassTeacherRole =
    selectedRoleIds.includes(
      String(CLASS_TEACHER_ROLE_ID)
    );

  /*
   * Determine which assignment mode should be used.
   *
   * Subject Teacher only
   * -> subject + class
   *
   * Class Teacher only
   * -> class only
   *
   * Both roles
   * -> user can choose assignment type
   */
  const effectiveAssignmentType =
    hasSubjectTeacherRole && hasClassTeacherRole
      ? assignmentType
      : hasClassTeacherRole
      ? "class"
      : hasSubjectTeacherRole
      ? "subject"
      : assignmentType;

  /* =========================================================
     LOAD SYSTEM ROLES
  ========================================================= */
  useEffect(() => {
    const loadRoles = async () => {
      try {
        setLoadingRoles(true);

        const { data, error } = await supabase
          .from("roles")
          .select("*")
          .order("role_name", {
            ascending: true,
          });

        if (error) {
          console.error(
            "LOAD ROLES ERROR:",
            error
          );

          setMessage(
            "Failed to load system roles."
          );

          setMessageType("error");

          return;
        }

        setRoles(data || []);
      } catch (error) {
        console.error(
          "LOAD ROLES EXCEPTION:",
          error
        );

        setMessage(
          "Failed to load system roles."
        );

        setMessageType("error");
      } finally {
        setLoadingRoles(false);
      }
    };

    loadRoles();
  }, []);

  /* =========================================================
     LOAD SUBJECTS
  ========================================================= */
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setLoadingSubjects(true);

        const { data, error } = await supabase
          .from("subjects")
          .select("*")
          .order("subject_name", {
            ascending: true,
          });

        if (error) {
          console.error(
            "LOAD SUBJECTS ERROR:",
            error
          );

          setMessage(
            "Failed to load subjects."
          );

          setMessageType("error");

          return;
        }

        console.log(
          "SUBJECTS LOADED:",
          data
        );

        setSubjects(data || []);
      } catch (error) {
        console.error(
          "LOAD SUBJECTS EXCEPTION:",
          error
        );

        setMessage(
          "Failed to load subjects."
        );

        setMessageType("error");
      } finally {
        setLoadingSubjects(false);
      }
    };

    loadSubjects();
  }, []);

  /* =========================================================
     LOAD CLASSES
  ========================================================= */
  useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoadingClasses(true);

        console.log(
          "LOADING CLASSES FOR SCHOOL:",
          teacher.school_id
        );

        const { data, error } = await supabase
          .from("classes")
          .select("*")
          .eq(
            "school_id",
            teacher.school_id
          )
          .order("class_name", {
            ascending: true,
          });

        if (error) {
          console.error(
            "LOAD CLASSES ERROR:",
            error
          );

          setMessage(
            "Failed to load classes."
          );

          setMessageType("error");

          return;
        }

        console.log(
          "CLASSES LOADED:",
          data
        );

        setClasses(data || []);
      } catch (error) {
        console.error(
          "LOAD CLASSES EXCEPTION:",
          error
        );

        setMessage(
          "Failed to load classes."
        );

        setMessageType("error");
      } finally {
        setLoadingClasses(false);
      }
    };

    loadClasses();
  }, [teacher.school_id]);

  /* =========================================================
     KEEP ASSIGNMENT TYPE IN SYNC WITH ROLES
  ========================================================= */
  useEffect(() => {
    /*
     * Class Teacher only
     */
    if (
      hasClassTeacherRole &&
      !hasSubjectTeacherRole
    ) {
      setAssignmentType("class");

      setAssignmentSubjectId("");

      return;
    }

    /*
     * Subject Teacher only
     */
    if (
      hasSubjectTeacherRole &&
      !hasClassTeacherRole
    ) {
      setAssignmentType("subject");

      return;
    }

    /*
     * Both roles
     *
     * Keep the user's selected assignment type.
     */
  }, [
    hasSubjectTeacherRole,
    hasClassTeacherRole,
  ]);

  /* =========================================================
     HANDLE FORM CHANGE
  ========================================================= */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setTeacher((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* =========================================================
     TOGGLE SYSTEM ROLE
  ========================================================= */
  const toggleRole = (roleId) => {
    const id = String(roleId);

    setSelectedRoleIds((prev) => {
      if (prev.includes(id)) {
        const updated = prev.filter(
          (item) => item !== id
        );

        if (
          String(primaryRoleId) ===
          id
        ) {
          setPrimaryRoleId("");
        }

        /*
         * If Class Teacher is removed,
         * clear class-only subject state.
         */
        if (
          id ===
          String(
            CLASS_TEACHER_ROLE_ID
          )
        ) {
          setAssignmentSubjectId("");

          /*
           * If Subject Teacher remains,
           * switch back to subject mode.
           */
          if (
            updated.includes(
              String(
                SUBJECT_TEACHER_ROLE_ID
              )
            )
          ) {
            setAssignmentType(
              "subject"
            );
          }
        }

        /*
         * If Subject Teacher is removed
         * but Class Teacher remains,
         * switch to class-only mode.
         */
        if (
          id ===
          String(
            SUBJECT_TEACHER_ROLE_ID
          )
        ) {
          if (
            updated.includes(
              String(
                CLASS_TEACHER_ROLE_ID
              )
            )
          ) {
            setAssignmentType(
              "class"
            );
          } else {
            setAssignmentSubjectId("");
          }
        }

        return updated;
      }

      const updated = [
        ...prev,
        id,
      ];

      /*
       * First Class Teacher selection
       */
      if (
        id ===
        String(CLASS_TEACHER_ROLE_ID)
      ) {
        if (
          !updated.includes(
            String(
              SUBJECT_TEACHER_ROLE_ID
            )
          )
        ) {
          setAssignmentType("class");
        }
      }

      /*
       * First Subject Teacher selection
       */
      if (
        id ===
        String(
          SUBJECT_TEACHER_ROLE_ID
        )
      ) {
        if (
          !updated.includes(
            String(
              CLASS_TEACHER_ROLE_ID
            )
          )
        ) {
          setAssignmentType("subject");
        }
      }

      return updated;
    });
  };

  /* =========================================================
     SET PRIMARY ROLE
  ========================================================= */
  const handlePrimaryRoleChange = (
    roleId
  ) => {
    const id = String(roleId);

    if (
      !selectedRoleIds.includes(id)
    ) {
      setSelectedRoleIds((prev) => [
        ...prev,
        id,
      ]);
    }

    setPrimaryRoleId(id);
  };

  /* =========================================================
     CHANGE ASSIGNMENT TYPE
  ========================================================= */
  const handleAssignmentTypeChange = (
    type
  ) => {
    setAssignmentType(type);

    /*
     * Subject is only meaningful for
     * Subject Teacher assignments.
     */
    if (type === "class") {
      setAssignmentSubjectId("");
    }

    setAssignmentClassId("");
  };

  /* =========================================================
     ADD ASSIGNMENT
  ========================================================= */
  const addAssignment = () => {
    /*
     * No assignment role selected
     */
    if (
      !hasSubjectTeacherRole &&
      !hasClassTeacherRole
    ) {
      setMessage(
        "Please select Subject Teacher or Class Teacher role before adding an assignment."
      );

      setMessageType("error");

      return;
    }

    /* -------------------------------------------------------
       CLASS TEACHER ASSIGNMENT
       subject_id MUST be NULL
    ------------------------------------------------------- */
    if (
      effectiveAssignmentType ===
      "class"
    ) {
      if (!assignmentClassId) {
        setMessage(
          "Please select a class for the Class Teacher."
        );

        setMessageType("error");

        return;
      }

      const exists = assignments.some(
        (assignment) =>
          assignment.subject_id ===
            null &&
          String(
            assignment.class_id
          ) ===
            String(
              assignmentClassId
            )
      );

      if (exists) {
        setMessage(
          "This class is already assigned as a Class Teacher assignment."
        );

        setMessageType("error");

        return;
      }

      const classItem =
        classes.find(
          (item) =>
            String(item.id) ===
            String(
              assignmentClassId
            )
        );

      const newAssignment = {
        assignment_type:
          "class_teacher",

        subject_id: null,

        class_id:
          assignmentClassId,

        subject_name: "",

        class_name:
          classItem?.class_name ||
          `Class #${assignmentClassId}`,
      };

      setAssignments((prev) => [
        ...prev,
        newAssignment,
      ]);

      setAssignmentClassId("");

      setAssignmentSubjectId("");

      setMessage("");

      setMessageType("");

      return;
    }

    /* -------------------------------------------------------
       SUBJECT TEACHER ASSIGNMENT
    ------------------------------------------------------- */
    if (
      effectiveAssignmentType ===
      "subject"
    ) {
      if (!assignmentSubjectId) {
        setMessage(
          "Please select a subject."
        );

        setMessageType("error");

        return;
      }

      if (!assignmentClassId) {
        setMessage(
          "Please select a class."
        );

        setMessageType("error");

        return;
      }

      const exists = assignments.some(
        (assignment) =>
          String(
            assignment.subject_id
          ) ===
            String(
              assignmentSubjectId
            ) &&
          String(
            assignment.class_id
          ) ===
            String(
              assignmentClassId
            )
      );

      if (exists) {
        setMessage(
          "This subject and class assignment already exists."
        );

        setMessageType("error");

        return;
      }

      const subject =
        subjects.find(
          (item) =>
            String(item.id) ===
            String(
              assignmentSubjectId
            )
        );

      const classItem =
        classes.find(
          (item) =>
            String(item.id) ===
            String(
              assignmentClassId
            )
        );

      const newAssignment = {
        assignment_type:
          "subject_teacher",

        subject_id:
          assignmentSubjectId,

        class_id:
          assignmentClassId,

        subject_name:
          subject?.subject_name ||
          `Subject #${assignmentSubjectId}`,

        class_name:
          classItem?.class_name ||
          `Class #${assignmentClassId}`,
      };

      setAssignments((prev) => [
        ...prev,
        newAssignment,
      ]);

      setAssignmentSubjectId("");

      setAssignmentClassId("");

      setMessage("");

      setMessageType("");
    }
  };

  /* =========================================================
     REMOVE ASSIGNMENT
  ========================================================= */
  const removeAssignment = (
    index
  ) => {
    setAssignments((prev) =>
      prev.filter(
        (_, assignmentIndex) =>
          assignmentIndex !== index
      )
    );
  };

  /* =========================================================
     PHOTO UPLOAD
  ========================================================= */
  const handlePhotoUpload = async (
    e
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    try {
      setMessage(
        "Uploading photo..."
      );

      setMessageType("info");

      const filePath =
        `teachers/${Date.now()}-${file.name}`;

      const {
        error: uploadError,
      } =
        await supabase.storage
          .from("teacher-photos")
          .upload(
            filePath,
            file
          );

      if (uploadError) {
        console.error(
          "PHOTO UPLOAD ERROR:",
          uploadError
        );

        setMessage(
          "Failed to upload photo."
        );

        setMessageType("error");

        return;
      }

      const { data } =
        supabase.storage
          .from("teacher-photos")
          .getPublicUrl(
            filePath
          );

      setTeacher((prev) => ({
        ...prev,
        photo_url:
          data?.publicUrl || "",
      }));

      setMessage(
        "Photo uploaded successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "PHOTO UPLOAD EXCEPTION:",
        error
      );

      setMessage(
        "Failed to upload photo."
      );

      setMessageType("error");
    }
  };

  /* =========================================================
     RESET FORM
  ========================================================= */
  const resetForm = () => {
    setTeacher({
      school_id: 1,
      employee_number: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      gender: "",
      phone: "",
      email: "",
      employment_date: "",
      qualification: "",
      specialization: "",
      status: "Active",
      photo_url: "",
      staff_type: "",
    });

    setSelectedRoleIds([]);

    setPrimaryRoleId("");

    setAssignments([]);

    setAssignmentSubjectId("");

    setAssignmentClassId("");

    setAssignmentType("subject");

    setCreatedAccount(null);

    setMessage("");

    setMessageType("");
  };

  /* =========================================================
     SAVE STAFF / NON-STAFF
  ========================================================= */
  const handleSubmit = async (
    e
  ) => {
    e.preventDefault();

    setMessage("");

    setMessageType("");

    setCreatedAccount(null);

    /* ---------------------------------------------------------
       STAFF TYPE
    --------------------------------------------------------- */
    if (!teacher.staff_type) {
      setMessage(
        "Please select whether this person is Teaching Staff / Teacher or Non-Staff."
      );

      setMessageType("error");

      return;
    }

    /* ---------------------------------------------------------
       SYSTEM ROLE
    --------------------------------------------------------- */
    if (
      selectedRoleIds.length ===
      0
    ) {
      setMessage(
        "Please select at least one system role."
      );

      setMessageType("error");

      return;
    }

    if (!primaryRoleId) {
      setMessage(
        "Please select a primary system role."
      );

      setMessageType("error");

      return;
    }

    /* ---------------------------------------------------------
       CONTACT
    --------------------------------------------------------- */
    if (
      !teacher.email &&
      !teacher.phone
    ) {
      setMessage(
        "Please provide either email or phone number."
      );

      setMessageType("error");

      return;
    }

    /*
     * CLASS / SUBJECT TEACHER ASSIGNMENT CHECK
     *
     * If either role is selected, at least one
     * assignment must be provided.
     */
    if (
      (hasSubjectTeacherRole ||
        hasClassTeacherRole) &&
      assignments.length === 0
    ) {
      setMessage(
        hasClassTeacherRole &&
        !hasSubjectTeacherRole
          ? "Please assign at least one class to this Class Teacher."
          : hasSubjectTeacherRole &&
            !hasClassTeacherRole
          ? "Please add at least one Subject & Class assignment for this Subject Teacher."
          : "Please add at least one Class Teacher or Subject Teacher assignment."
      );

      setMessageType("error");

      return;
    }

    try {
      setLoading(true);

      /* -------------------------------------------------------
         GET SESSION
      ------------------------------------------------------- */
      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "SESSION ERROR:",
          sessionError
        );

        setMessage(
          "Unable to verify your login session."
        );

        setMessageType("error");

        return;
      }

      if (
        !session?.access_token
      ) {
        setMessage(
          "Your login session has expired. Please login again."
        );

        setMessageType("error");

        return;
      }

      /* -------------------------------------------------------
         PREPARE ASSIGNMENTS
      ------------------------------------------------------- */

      const cleanAssignments =
        assignments.map(
          (assignment) => ({
            /*
             * IMPORTANT:
             *
             * Subject Teacher:
             * subject_id = actual subject ID
             *
             * Class Teacher:
             * subject_id = null
             */
            subject_id:
              assignment.subject_id
                ? Number(
                    assignment.subject_id
                  )
                : null,

            class_id:
              Number(
                assignment.class_id
              ),
          })
        );

      /* -------------------------------------------------------
         REQUEST BODY
      ------------------------------------------------------- */
      const payload = {
        school_id:
          teacher.school_id,

        employee_number:
          teacher.employee_number,

        first_name:
          teacher.first_name,

        middle_name:
          teacher.middle_name,

        last_name:
          teacher.last_name,

        gender:
          teacher.gender,

        phone:
          teacher.phone,

        email:
          teacher.email,

        employment_date:
          teacher.employment_date,

        qualification:
          teacher.qualification,

        specialization:
          teacher.specialization,

        status:
          teacher.status,

        photo_url:
          teacher.photo_url,

        staff_type:
          teacher.staff_type,

        role_ids:
          selectedRoleIds.map(
            (id) =>
              Number(id)
          ),

        primary_role_id:
          Number(
            primaryRoleId
          ),

        assignments:
          cleanAssignments,
      };

      console.log(
        "CREATE STAFF PAYLOAD:",
        payload
      );

      /* -------------------------------------------------------
         POST
      ------------------------------------------------------- */
      const response =
        await axios.post(
          `${API_URL}/teachers`,
          payload,
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              "Content-Type":
                "application/json",
            },
          }
        );

      const result =
        response.data;

      console.log(
        "CREATE STAFF RESPONSE:",
        result
      );

      if (
        !result?.success
      ) {
        throw new Error(
          result?.message ||
            "Failed to create staff account."
        );
      }

      /* -------------------------------------------------------
         SUCCESS
      ------------------------------------------------------- */
      setCreatedAccount({
        ...(result?.login_credentials ||
          {}),

        teacher:
          result?.teacher ||
          null,

        roles:
          result?.roles ||
          [],

        primary_role:
          result?.primary_role
            ?.role_name ||
          result?.role
            ?.role_name ||
          "",

        assignments:
          result?.assignments ||
          [],

        staff_type:
          result?.teacher
            ?.staff_type ||
          teacher.staff_type,
      });

      setMessage(
        "Staff & Non-Staff member was created successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "CREATE STAFF ERROR:",
        error
      );

      const serverMessage =
        error?.response
          ?.data?.message ||
        error?.response
          ?.data?.error ||
        error?.message;

      setMessage(
        serverMessage ||
          "Failed to create Staff & Non-Staff member."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     SUCCESS SCREEN
  ========================================================= */
  if (createdAccount) {
    const displayStaffType =
      createdAccount.staff_type ===
      "Staff"
        ? "Teaching Staff / Teacher"
        : "Non-Staff";

    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">

          <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-8 text-white">
            <h1 className="text-2xl font-bold">
              Staff & Non-Staff Created Successfully
            </h1>

            <p className="mt-2 text-blue-100">
              The staff member has been successfully added to the system.
            </p>
          </div>

          <div className="p-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* STAFF TYPE */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">
                  Staff Type
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {displayStaffType}
                </p>
              </div>

              {/* PRIMARY ROLE */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">
                  Primary Role
                </p>

                <p className="font-semibold text-gray-900 mt-1">
                  {createdAccount.primary_role ||
                    "Not specified"}
                </p>
              </div>

              {/* EMAIL */}
              {createdAccount.login_email && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">
                    Login Email
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {createdAccount.login_email}
                  </p>
                </div>
              )}

              {/* PHONE */}
              {createdAccount.login_phone && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">
                    Login Phone
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {createdAccount.login_phone}
                  </p>
                </div>
              )}

              {/* PASSWORD */}
              {createdAccount.temporary_password && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 md:col-span-2">
                  <p className="text-sm text-yellow-700">
                    Temporary Password
                  </p>

                  <p className="font-bold text-gray-900 mt-1 text-lg">
                    {createdAccount.temporary_password}
                  </p>

                  <p className="text-xs text-yellow-700 mt-2">
                    Please keep this credential secure.
                  </p>
                </div>
              )}

            </div>

            {/* ROLES */}
            {createdAccount.roles?.length > 0 && (
              <div className="mt-6">

                <h3 className="font-semibold text-gray-900 mb-3">
                  System Roles
                </h3>

                <div className="flex flex-wrap gap-2">

                  {createdAccount.roles.map(
                    (role, index) => (
                      <span
                        key={
                          role?.id ||
                          index
                        }
                        className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm"
                      >
                        {role?.role_name ||
                          role?.name ||
                          role}
                      </span>
                    )
                  )}

                </div>
              </div>
            )}

            {/* ASSIGNMENTS */}
            {createdAccount.assignments?.length > 0 && (
              <div className="mt-6">

                <h3 className="font-semibold text-gray-900 mb-3">
                  Teacher Assignments
                </h3>

                <div className="space-y-2">

                  {createdAccount.assignments.map(
                    (assignment, index) => {

                      const isClassTeacherAssignment =
                        !assignment?.subject_id &&
                        !assignment?.subject?.id &&
                        !assignment?.subject?.subject_name;

                      return (
                        <div
                          key={
                            assignment?.id ||
                            index
                          }
                          className="bg-gray-50 rounded-lg p-3"
                        >

                          {isClassTeacherAssignment ? (
                            <>
                              <div className="text-xs font-semibold text-purple-600 uppercase">
                                Class Teacher
                              </div>

                              <div className="font-semibold text-gray-900 mt-1">
                                {assignment?.class_name ||
                                  assignment?.class?.class_name ||
                                  "Class"}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-semibold text-blue-600 uppercase">
                                Subject Teacher
                              </div>

                              <div className="font-semibold text-gray-900 mt-1">
                                {assignment?.subject_name ||
                                  assignment?.subject?.subject_name ||
                                  "Subject"}

                                {" - "}

                                {assignment?.class_name ||
                                  assignment?.class?.class_name ||
                                  "Class"}
                              </div>
                            </>
                          )}

                        </div>
                      );
                    }
                  )}

                </div>
              </div>
            )}

            {/* BUTTONS */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">

              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                + Add Another Staff
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/teachers")
                }
                className="px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                Back to Staff & Non-Staff
              </button>

            </div>

          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     MAIN FORM
  ========================================================= */
  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* HEADER */}
      <div className="mb-6">

        <h1 className="text-2xl font-bold text-gray-900">
          Add Staff & Non-Staff
        </h1>

        <p className="text-gray-500 mt-1">
          Add teaching staff and non-teaching staff members to your school.
        </p>

      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >

        {/* =====================================================
            STAFF INFORMATION
        ====================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          <div className="mb-6">

            <h2 className="text-lg font-bold text-gray-900">
              Staff & Non-Staff Information
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Enter the person's basic employment information.
            </p>

          </div>

          {/* STAFF TYPE */}
          <div className="mb-6 p-5 rounded-xl border-2 border-blue-100 bg-blue-50">

            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Staff Type{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <select
              name="staff_type"
              value={
                teacher.staff_type
              }
              onChange={
                handleChange
              }
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">
                Select Staff Type
              </option>

              <option value="Staff">
                Teaching Staff / Teacher
              </option>

              <option value="Non-Staff">
                Non-Staff
              </option>
            </select>

            <p className="text-xs text-gray-500 mt-2">
              This classification is used by AfriCore ERP to
              separate Teaching Staff from Non-Staff.
            </p>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* EMPLOYEE NUMBER */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Number
              </label>

              <input
                type="text"
                name="employee_number"
                value={
                  teacher.employee_number
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Employee number"
              />
            </div>

            {/* FIRST NAME */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>

              <input
                type="text"
                name="first_name"
                value={
                  teacher.first_name
                }
                onChange={
                  handleChange
                }
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="First name"
              />
            </div>

            {/* MIDDLE NAME */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Middle Name
              </label>

              <input
                type="text"
                name="middle_name"
                value={
                  teacher.middle_name
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Middle name"
              />
            </div>

            {/* LAST NAME */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>

              <input
                type="text"
                name="last_name"
                value={
                  teacher.last_name
                }
                onChange={
                  handleChange
                }
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Last name"
              />
            </div>

            {/* GENDER */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>

              <select
                name="gender"
                value={
                  teacher.gender
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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

            {/* PHONE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>

              <input
                type="tel"
                name="phone"
                value={
                  teacher.phone
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Phone number"
              />
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>

              <input
                type="email"
                name="email"
                value={
                  teacher.email
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Email address"
              />
            </div>

            {/* EMPLOYMENT DATE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employment Date
              </label>

              <input
                type="date"
                name="employment_date"
                value={
                  teacher.employment_date
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* QUALIFICATION */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Qualification
              </label>

              <input
                type="text"
                name="qualification"
                value={
                  teacher.qualification
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Qualification"
              />
            </div>

            {/* SPECIALIZATION */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialization
              </label>

              <input
                type="text"
                name="specialization"
                value={
                  teacher.specialization
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Specialization"
              />
            </div>

            {/* STATUS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>

              <select
                name="status"
                value={
                  teacher.status
                }
                onChange={
                  handleChange
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>
            </div>

          </div>
        </div>

        {/* =====================================================
            SYSTEM ROLES
        ====================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          <div className="mb-5">

            <h2 className="text-lg font-bold text-gray-900">
              System Roles
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Select one or more system roles and choose the primary role.
            </p>

          </div>

          {loadingRoles ? (
            <div className="text-gray-500">
              Loading system roles...
            </div>
          ) : roles.length === 0 ? (
            <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800">
              No system roles were found.
            </div>
          ) : (
            <div className="space-y-3">

              {roles.map(
                (role) => {

                  const roleId =
                    String(
                      role.id
                    );

                  const checked =
                    selectedRoleIds.includes(
                      roleId
                    );

                  const primary =
                    String(
                      primaryRoleId
                    ) ===
                    roleId;

                  return (
                    <div
                      key={
                        role.id
                      }
                      className={`border rounded-xl p-4 ${
                        checked
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200"
                      }`}
                    >

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                        <label className="flex items-center gap-3 cursor-pointer">

                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={() =>
                              toggleRole(
                                role.id
                              )
                            }
                            className="w-4 h-4"
                          />

                          <span className="font-medium text-gray-900">
                            {role.role_name ||
                              role.name}
                          </span>

                        </label>

                        {checked && (
                          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">

                            <input
                              type="radio"
                              name="primary_role"
                              checked={
                                primary
                              }
                              onChange={() =>
                                handlePrimaryRoleChange(
                                  role.id
                                )
                              }
                            />

                            Primary Role

                          </label>
                        )}

                      </div>
                    </div>
                  );
                }
              )}

            </div>
          )}
        </div>

        {/* =====================================================
            PHOTO
        ====================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Photo
          </h2>

          <input
            type="file"
            accept="image/*"
            onChange={
              handlePhotoUpload
            }
            className="w-full"
          />

          {teacher.photo_url && (
            <div className="mt-4">

              <img
                src={
                  teacher.photo_url
                }
                alt="Staff"
                className="w-28 h-28 object-cover rounded-xl border"
              />

            </div>
          )}

        </div>

        {/* =====================================================
            TEACHER ASSIGNMENTS
        ====================================================== */}
        {(hasSubjectTeacherRole ||
          hasClassTeacherRole) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

            <div className="mb-5">

              <h2 className="text-lg font-bold text-gray-900">
                Teacher Assignments
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Assign the teacher to a class or to a subject and class.
              </p>

            </div>

            {/* =================================================
                ASSIGNMENT TYPE
            ================================================== */}
            {hasSubjectTeacherRole &&
              hasClassTeacherRole && (
                <div className="mb-6 p-4 rounded-xl bg-purple-50 border border-purple-200">

                  <label className="block text-sm font-semibold text-purple-900 mb-2">
                    Assignment Type
                  </label>

                  <select
                    value={
                      assignmentType
                    }
                    onChange={(e) =>
                      handleAssignmentTypeChange(
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-3 rounded-xl border border-purple-200 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  >

                    <option value="subject">
                      Subject Teacher — Subject + Class
                    </option>

                    <option value="class">
                      Class Teacher — Class Only
                    </option>

                  </select>

                  <p className="text-xs text-purple-700 mt-2">
                    This teacher has both Subject Teacher and Class Teacher roles.
                    Choose the type of assignment you want to add.
                  </p>

                </div>
              )}

            {/* =================================================
                CLASS TEACHER INFORMATION
            ================================================== */}
            {effectiveAssignmentType ===
              "class" && (
                <div className="mb-5 p-4 rounded-xl bg-purple-50 border border-purple-200">

                  <div className="font-semibold text-purple-900">
                    Class Teacher Assignment
                  </div>

                  <p className="text-sm text-purple-700 mt-1">
                    A Class Teacher is assigned directly to a class.
                    No subject is required.
                  </p>

                </div>
              )}

            {/* =================================================
                SUBJECT TEACHER INFORMATION
            ================================================== */}
            {effectiveAssignmentType ===
              "subject" && (
                <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200">

                  <div className="font-semibold text-blue-900">
                    Subject Teacher Assignment
                  </div>

                  <p className="text-sm text-blue-700 mt-1">
                    A Subject Teacher must be assigned to both a subject and a class.
                  </p>

                </div>
              )}

            <div
              className={`grid grid-cols-1 ${
                effectiveAssignmentType ===
                "subject"
                  ? "md:grid-cols-3"
                  : "md:grid-cols-2"
              } gap-4`}
            >

              {/* =================================================
                  SUBJECT
              ================================================== */}
              {effectiveAssignmentType ===
                "subject" && (
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                    <span className="text-red-500 ml-1">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      assignmentSubjectId
                    }
                    onChange={(e) =>
                      setAssignmentSubjectId(
                        e.target.value
                      )
                    }
                    disabled={
                      loadingSubjects
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >

                    <option value="">
                      {loadingSubjects
                        ? "Loading subjects..."
                        : "Select Subject"}
                    </option>

                    {subjects.map(
                      (subject) => (
                        <option
                          key={
                            subject.id
                          }
                          value={
                            subject.id
                          }
                        >
                          {
                            subject.subject_name
                          }

                          {subject.subject_code
                            ? ` (${subject.subject_code})`
                            : ""}
                        </option>
                      )
                    )}

                  </select>

                </div>
              )}

              {/* =================================================
                  CLASS
              ================================================== */}
              <div>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                  <span className="text-red-500 ml-1">
                    *
                  </span>
                </label>

                <select
                  value={
                    assignmentClassId
                  }
                  onChange={(e) =>
                    setAssignmentClassId(
                      e.target.value
                    )
                  }
                  disabled={
                    loadingClasses
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >

                  <option value="">
                    {loadingClasses
                      ? "Loading classes..."
                      : "Select Class"}
                  </option>

                  {classes.map(
                    (classItem) => (
                      <option
                        key={
                          classItem.id
                        }
                        value={
                          classItem.id
                        }
                      >
                        {
                          classItem.class_name
                        }

                        {classItem.short_name
                          ? ` (${classItem.short_name})`
                          : ""}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* =================================================
                  ADD ASSIGNMENT
              ================================================== */}
              <div className="flex items-end">

                <button
                  type="button"
                  onClick={
                    addAssignment
                  }
                  className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                >
                  {effectiveAssignmentType ===
                  "class"
                    ? "+ Assign Class Teacher"
                    : "+ Add Subject Assignment"}
                </button>

              </div>

            </div>

            {/* =================================================
                ASSIGNMENT LIST
            ================================================== */}
            {assignments.length > 0 && (
              <div className="mt-6 space-y-3">

                {assignments.map(
                  (
                    assignment,
                    index
                  ) => {

                    const isClassTeacher =
                      !assignment?.subject_id;

                    return (
                      <div
                        key={`${assignment.subject_id || "class"}-${assignment.class_id}-${index}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-xl border"
                      >

                        <div>

                          {isClassTeacher ? (
                            <>
                              <div className="inline-flex px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold mb-2">
                                CLASS TEACHER
                              </div>

                              <p className="font-semibold text-gray-900">
                                {
                                  assignment.class_name
                                }
                              </p>

                              <p className="text-sm text-gray-500">
                                Class Teacher Assignment
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="inline-flex px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-2">
                                SUBJECT TEACHER
                              </div>

                              <p className="font-semibold text-gray-900">
                                {
                                  assignment.subject_name
                                }
                              </p>

                              <p className="text-sm text-gray-500">
                                {
                                  assignment.class_name
                                }
                              </p>
                            </>
                          )}

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeAssignment(
                              index
                            )
                          }
                          className="text-red-600 font-medium hover:text-red-700"
                        >
                          Remove
                        </button>

                      </div>
                    );
                  }
                )}

              </div>
            )}

            {/* =================================================
                ASSIGNMENT SUMMARY
            ================================================== */}
            {assignments.length > 0 && (
              <div className="mt-5 p-4 rounded-xl bg-green-50 border border-green-200">

                <p className="text-sm font-semibold text-green-800">
                  {assignments.length} assignment
                  {assignments.length !== 1
                    ? "s"
                    : ""}{" "}
                  added.
                </p>

                <p className="text-xs text-green-700 mt-1">
                  Class Teacher assignments are saved with
                  <strong> subject_id = NULL </strong>
                  and the selected class ID.
                </p>

              </div>
            )}

          </div>
        )}

        {/* =====================================================
            MESSAGE
        ====================================================== */}
        {message && (
          <div
            className={`rounded-xl p-4 border ${
              messageType ===
              "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : messageType ===
                  "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            {message}
          </div>
        )}

        {/* =====================================================
            BUTTONS
        ====================================================== */}
        <div className="flex flex-col sm:flex-row gap-3">

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading
              ? "Saving..."
              : "Save Staff & Non-Staff"}
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/teachers"
              )
            }
            className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
          >
            Cancel
          </button>

        </div>

        {/* =====================================================
            INFORMATION
        ====================================================== */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">

          <h3 className="font-semibold text-blue-900">
            Information
          </h3>

          <p className="text-sm text-blue-800 mt-2">
            Staff Type determines how this person will be
            classified in AfriCore ERP. Teaching Staff / Teacher
            will be counted separately from Non-Staff in the
            dashboard and reports.
          </p>

        </div>

      </form>
    </div>
  );
}

export default AddTeacher;