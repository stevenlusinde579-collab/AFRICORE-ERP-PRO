import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://africore-erp-pro.onrender.com/api";

const SUBJECT_TEACHER_ROLE_ID = 5;
const CLASS_TEACHER_ROLE_ID = 12;

export default function AddTeacher() {
  const navigate = useNavigate();

  const {
    schoolId,
    loading: schoolLoading,
    activeAcademicYearId,
  } = useSchool();

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

  const [assignmentSubjectId, setAssignmentSubjectId] = useState("");
  const [assignmentClassId, setAssignmentClassId] = useState("");
  const [assignmentType, setAssignmentType] = useState("subject");

  const [createdAccount, setCreatedAccount] = useState(null);

  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [primaryRoleId, setPrimaryRoleId] = useState("");

  const [teacher, setTeacher] = useState({
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

  /* ============================================================
     LOAD ROLES
  ============================================================ */

  useEffect(() => {
    const loadRoles = async () => {
      try {
        setLoadingRoles(true);

        const { data, error } = await supabase
          .from("roles")
          .select("*")
          .order("id", { ascending: true });

        if (error) {
          console.error("LOAD ROLES ERROR:", error);
          setMessage("Failed to load roles.");
          setMessageType("error");
          return;
        }

        setRoles(data || []);
      } catch (error) {
        console.error("LOAD ROLES EXCEPTION:", error);
        setMessage("Failed to load roles.");
        setMessageType("error");
      } finally {
        setLoadingRoles(false);
      }
    };

    loadRoles();
  }, []);

  /* ============================================================
     LOAD SUBJECTS
  ============================================================ */

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setLoadingSubjects(true);

        const { data, error } = await supabase
          .from("subjects")
          .select("*")
          .order("subject_name", { ascending: true });

        if (error) {
          console.error("LOAD SUBJECTS ERROR:", error);
          setMessage("Failed to load subjects.");
          setMessageType("error");
          return;
        }

        setSubjects(data || []);
      } catch (error) {
        console.error("LOAD SUBJECTS EXCEPTION:", error);
        setMessage("Failed to load subjects.");
        setMessageType("error");
      } finally {
        setLoadingSubjects(false);
      }
    };

    loadSubjects();
  }, []);

  /* ============================================================
     LOAD CLASSES
  ============================================================ */

  useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoadingClasses(true);

        setAssignmentClassId("");
        setClasses([]);

        if (schoolLoading) {
          console.log(
            "WAITING FOR SCHOOL CONTEXT TO FINISH LOADING..."
          );
          return;
        }

        if (!schoolId) {
          console.warn(
            "NO SCHOOL ID AVAILABLE FOR CLASS LOADING"
          );

          setMessage(
            "Current school could not be determined."
          );
          setMessageType("error");

          return;
        }

        if (!activeAcademicYearId) {
          console.warn(
            "NO ACTIVE ACADEMIC YEAR AVAILABLE FOR CLASS LOADING"
          );

          setMessage(
            "No active academic year is available. Please select or activate an academic year first."
          );
          setMessageType("error");

          return;
        }

        console.log(
          "================================================="
        );
        console.log("LOADING CLASSES");
        console.log("SCHOOL ID:", schoolId);
        console.log(
          "ACTIVE ACADEMIC YEAR ID:",
          activeAcademicYearId
        );
        console.log(
          "================================================="
        );

        const { data, error } = await supabase
          .from("classes")
          .select(`
            id,
            school_id,
            academic_level,
            class_name,
            short_name,
            academic_year_id
          `)
          .eq("school_id", Number(schoolId))
          .eq(
            "academic_year_id",
            Number(activeAcademicYearId)
          )
          .order("class_name", {
            ascending: true,
          });

        if (error) {
          console.error("LOAD CLASSES ERROR:", error);

          setClasses([]);

          setMessage(
            error.message ||
              "Failed to load classes for the current school and academic year."
          );
          setMessageType("error");

          return;
        }

        console.log(
          "CLASSES LOADED FOR SCHOOL:",
          Number(schoolId)
        );

        console.log(
          "CLASSES LOADED FOR ACADEMIC YEAR:",
          Number(activeAcademicYearId)
        );

        console.log(
          "CLASSES COUNT:",
          data?.length || 0
        );

        console.log(
          "CLASSES DATA:",
          data
        );

        setClasses(data || []);

        if (!data || data.length === 0) {
          console.warn(
            "NO CLASSES FOUND FOR CURRENT SCHOOL + ACTIVE ACADEMIC YEAR"
          );
        }
      } catch (error) {
        console.error(
          "LOAD CLASSES EXCEPTION:",
          error
        );

        setClasses([]);

        setMessage(
          error?.message ||
            "Failed to load classes."
        );
        setMessageType("error");
      } finally {
        setLoadingClasses(false);
      }
    };

    loadClasses();
  }, [
    schoolId,
    activeAcademicYearId,
    schoolLoading,
  ]);

  /* ============================================================
     HANDLE INPUT
  ============================================================ */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setTeacher((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* ============================================================
     ROLE SELECTION
  ============================================================ */

  const handleRoleChange = (roleId) => {
    const numericRoleId = Number(roleId);

    setSelectedRoleIds((prev) => {
      if (prev.includes(numericRoleId)) {
        const updated = prev.filter(
          (id) => id !== numericRoleId
        );

        if (
          Number(primaryRoleId) === numericRoleId
        ) {
          setPrimaryRoleId(
            updated.length > 0
              ? String(updated[0])
              : ""
          );
        }

        return updated;
      }

      return [...prev, numericRoleId];
    });
  };

  /* ============================================================
     PRIMARY ROLE
  ============================================================ */

  useEffect(() => {
    if (
      primaryRoleId &&
      selectedRoleIds.includes(
        Number(primaryRoleId)
      )
    ) {
      return;
    }

    if (selectedRoleIds.length > 0) {
      setPrimaryRoleId(
        String(selectedRoleIds[0])
      );
    } else {
      setPrimaryRoleId("");
    }
  }, [
    selectedRoleIds,
    primaryRoleId,
  ]);

  /* ============================================================
     ADD ASSIGNMENT
  ============================================================ */

  const addAssignment = () => {
    setMessage("");
    setMessageType("");

    if (!schoolId) {
      setMessage(
        "Current school could not be determined."
      );
      setMessageType("error");
      return;
    }

    if (!activeAcademicYearId) {
      setMessage(
        "No active academic year is available."
      );
      setMessageType("error");
      return;
    }

    if (!assignmentClassId) {
      setMessage("Please select a class.");
      setMessageType("error");
      return;
    }

    if (
      assignmentType === "subject" &&
      !assignmentSubjectId
    ) {
      setMessage("Please select a subject.");
      setMessageType("error");
      return;
    }

    const duplicate = assignments.some((item) => {
      if (assignmentType === "subject") {
        return (
          String(item.class_id) ===
            String(assignmentClassId) &&
          String(item.subject_id) ===
            String(assignmentSubjectId)
        );
      }

      return (
        String(item.class_id) ===
          String(assignmentClassId) &&
        !item.subject_id
      );
    });

    if (duplicate) {
      setMessage(
        "This assignment already exists."
      );
      setMessageType("error");
      return;
    }

    const selectedClass = classes.find(
      (item) =>
        String(item.id) ===
        String(assignmentClassId)
    );

    const selectedSubject = subjects.find(
      (item) =>
        String(item.id) ===
        String(assignmentSubjectId)
    );

    const newAssignment = {
      id: Date.now(),

      assignment_type:
        assignmentType,

      subject_id:
        assignmentType === "subject"
          ? assignmentSubjectId
          : null,

      class_id:
        assignmentClassId,

      subject_name:
        assignmentType === "subject"
          ? selectedSubject?.subject_name ||
            "Subject"
          : null,

      class_name:
        selectedClass?.class_name ||
        "Class",
    };

    setAssignments((prev) => [
      ...prev,
      newAssignment,
    ]);

    setAssignmentSubjectId("");
    setAssignmentClassId("");
  };

  /* ============================================================
     REMOVE ASSIGNMENT
  ============================================================ */

  const removeAssignment = (id) => {
    setAssignments((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  };

  /* ============================================================
     PHOTO UPLOAD
  ============================================================ */

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setMessage("");
      setMessageType("");

      if (!schoolId) {
        setMessage(
          "Current school could not be determined. Please refresh and try again."
        );
        setMessageType("error");
        return;
      }

      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(file.type)) {
        setMessage(
          "Please upload a JPG, JPEG, PNG or WEBP image."
        );
        setMessageType("error");
        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        setMessage(
          "Photo must not exceed 5MB."
        );
        setMessageType("error");
        return;
      }

      const fileExtension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() || "jpg";

      const fileName = `${schoolId}-${Date.now()}.${fileExtension}`;

      const filePath =
        `${schoolId}/${fileName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("teacher-photos")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          "PHOTO UPLOAD ERROR:",
          uploadError
        );

        setMessage(
          uploadError.message ||
            "Failed to upload teacher photo."
        );
        setMessageType("error");

        return;
      }

      const { data } =
        supabase.storage
          .from("teacher-photos")
          .getPublicUrl(filePath);

      const publicUrl =
        data?.publicUrl || "";

      setTeacher((prev) => ({
        ...prev,
        photo_url: publicUrl,
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
        "Failed to upload teacher photo."
      );
      setMessageType("error");
    }
  };

  /* ============================================================
     VALIDATION
  ============================================================ */

  const validateForm = () => {
    if (!schoolId) {
      setMessage(
        "Current school could not be determined. Please refresh and try again."
      );
      setMessageType("error");
      return false;
    }

    if (!activeAcademicYearId) {
      setMessage(
        "No active academic year is available. Please activate an academic year first."
      );
      setMessageType("error");
      return false;
    }

    if (!teacher.first_name.trim()) {
      setMessage(
        "First name is required."
      );
      setMessageType("error");
      return false;
    }

    if (!teacher.last_name.trim()) {
      setMessage(
        "Last name is required."
      );
      setMessageType("error");
      return false;
    }

    if (!teacher.gender) {
      setMessage(
        "Please select gender."
      );
      setMessageType("error");
      return false;
    }

    if (!teacher.staff_type) {
      setMessage(
        "Please select staff type."
      );
      setMessageType("error");
      return false;
    }

    if (selectedRoleIds.length === 0) {
      setMessage(
        "Please select at least one role."
      );
      setMessageType("error");
      return false;
    }

    if (!primaryRoleId) {
      setMessage(
        "Please select a primary role."
      );
      setMessageType("error");
      return false;
    }

    return true;
  };

  /* ============================================================
     SUBMIT
  ============================================================ */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      setCreatedAccount(null);

      const {
        data: { session },
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

      if (!session?.access_token) {
        setMessage(
          "Your session has expired. Please login again."
        );
        setMessageType("error");

        return;
      }

      const cleanAssignments =
        assignments.map((item) => ({
          assignment_type:
            item.assignment_type,

          subject_id:
            item.subject_id || null,

          class_id:
            item.class_id,
        }));

      const payload = {
        school_id:
          Number(schoolId),

        employee_number:
          teacher.employee_number?.trim() ||
          null,

        first_name:
          teacher.first_name.trim(),

        middle_name:
          teacher.middle_name?.trim() ||
          null,

        last_name:
          teacher.last_name.trim(),

        gender:
          teacher.gender,

        phone:
          teacher.phone?.trim() ||
          null,

        email:
          teacher.email?.trim() ||
          null,

        employment_date:
          teacher.employment_date ||
          null,

        qualification:
          teacher.qualification?.trim() ||
          null,

        specialization:
          teacher.specialization?.trim() ||
          null,

        status:
          teacher.status ||
          "Active",

        photo_url:
          teacher.photo_url?.trim() ||
          null,

        staff_type:
          teacher.staff_type,

        role_ids:
          selectedRoleIds,

        primary_role_id:
          Number(primaryRoleId),

        assignments:
          cleanAssignments,

        active_academic_year_id:
          Number(activeAcademicYearId),
      };

      console.log(
        "================================================="
      );

      console.log(
        "ADDING STAFF PAYLOAD:"
      );

      console.log(payload);

      console.log(
        "SCHOOL ID:",
        Number(schoolId)
      );

      console.log(
        "ACTIVE ACADEMIC YEAR ID:",
        Number(activeAcademicYearId)
      );

      console.log(
        "ASSIGNMENTS:",
        cleanAssignments
      );

      console.log(
        "STAFF TYPE:",
        teacher.staff_type
      );

      console.log(
        "================================================="
      );

      const response =
        await axios.post(
          `${API_URL}/teachers`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type":
                "application/json",
            },
          }
        );

      console.log(
        "CREATE TEACHER RESPONSE:",
        response.data
      );

      /* ========================================================
         FIX:
         BACKEND CREDENTIALS ARE INSIDE login_credentials
      ======================================================== */

      const loginCredentials =
        response?.data?.login_credentials;

      if (loginCredentials) {
        setCreatedAccount({
          ...loginCredentials,

          login_email:
            loginCredentials.login_email ||
            loginCredentials.email ||
            null,

          login_phone:
            loginCredentials.login_phone ||
            loginCredentials.phone ||
            null,

          temporary_password:
            loginCredentials.temporary_password ||
            loginCredentials.password ||
            null,
        });
      } else {
        /*
         * Fallback for older backend response format.
         */
        setCreatedAccount({
          email:
            response?.data?.email ||
            null,

          username:
            response?.data?.username ||
            null,

          phone:
            response?.data?.phone ||
            null,

          temporary_password:
            response?.data?.temporary_password ||
            null,

          login_email:
            response?.data?.login_email ||
            response?.data?.email ||
            null,

          login_phone:
            response?.data?.login_phone ||
            response?.data?.phone ||
            null,
        });
      }

      setMessage(
        response.data?.message ||
          "Staff member created successfully. Login credentials have been generated."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      console.error(
        "CREATE TEACHER ERROR:",
        error
      );

      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;

      setMessage(
        serverMessage ||
          "Failed to create staff member."
      );

      setMessageType(
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     RESET FORM
  ============================================================ */

  const resetForm = () => {
    setTeacher({
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

  /* ============================================================
     ROLE HELPERS
  ============================================================ */

  const getRoleName = (roleId) => {
    const role = roles.find(
      (item) =>
        Number(item.id) ===
        Number(roleId)
    );

    return (
      role?.role_name ||
      role?.name ||
      `Role ${roleId}`
    );
  };

  const isSubjectTeacherSelected =
    selectedRoleIds.includes(
      SUBJECT_TEACHER_ROLE_ID
    );

  const isClassTeacherSelected =
    selectedRoleIds.includes(
      CLASS_TEACHER_ROLE_ID
    );

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                Add Staff
              </h1>

              <p className="text-gray-500 mt-1">
                Create a new staff member and assign roles,
                subjects and classes.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/teachers")
              }
              className="px-5 py-3 rounded-xl bg-gray-800 text-white hover:bg-gray-900 transition"
            >
              Back to Staff
            </button>

          </div>
        </div>

        {/* ======================================================
            CURRENT SCHOOL INDICATOR
        ====================================================== */}

        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Current School
              </p>

              <p className="text-lg font-bold text-blue-900">
                {schoolLoading
                  ? "Loading school..."
                  : schoolId
                  ? `School ID: ${schoolId}`
                  : "School not available"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Active Academic Year
              </p>

              <p className="text-lg font-bold text-blue-900">
                {schoolLoading
                  ? "Loading..."
                  : activeAcademicYearId
                  ? `Academic Year ID: ${activeAcademicYearId}`
                  : "Not available"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Classes Loaded
              </p>

              <p className="text-lg font-bold text-blue-900">
                {loadingClasses
                  ? "Loading..."
                  : classes.length}
              </p>
            </div>

          </div>
        </div>

        {/* ======================================================
            MESSAGE
        ====================================================== */}

        {message && (
          <div
            className={`mb-6 rounded-xl px-4 py-4 border ${
              messageType === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ====================================================
              PERSONAL INFORMATION
          ==================================================== */}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-6 mb-6">

            <h2 className="text-xl font-bold text-gray-800 mb-5">
              Personal Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name *
                </label>

                <input
                  type="text"
                  name="first_name"
                  value={teacher.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Middle Name
                </label>

                <input
                  type="text"
                  name="middle_name"
                  value={teacher.middle_name}
                  onChange={handleChange}
                  placeholder="Middle name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name *
                </label>

                <input
                  type="text"
                  name="last_name"
                  value={teacher.last_name}
                  onChange={handleChange}
                  placeholder="Last name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Gender *
                </label>

                <select
                  name="gender"
                  value={teacher.gender}
                  onChange={handleChange}
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Employee Number
                </label>

                <input
                  type="text"
                  name="employee_number"
                  value={teacher.employee_number}
                  onChange={handleChange}
                  placeholder="Employee number"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Staff Type *
                </label>

                <select
                  name="staff_type"
                  value={teacher.staff_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">
                    Select Staff Type
                  </option>

                  <option value="Staff">
                    Staff (Teaching Staff)
                  </option>

                  <option value="Non-Staff">
                    Non-Staff (Non-Teaching Staff)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone
                </label>

                <input
                  type="text"
                  name="phone"
                  value={teacher.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={teacher.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Employment Date
                </label>

                <input
                  type="date"
                  name="employment_date"
                  value={teacher.employment_date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

            </div>
          </div>

          {/* ====================================================
              PROFESSIONAL INFORMATION
          ==================================================== */}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-6 mb-6">

            <h2 className="text-xl font-bold text-gray-800 mb-5">
              Professional Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Qualification
                </label>

                <input
                  type="text"
                  name="qualification"
                  value={teacher.qualification}
                  onChange={handleChange}
                  placeholder="e.g. Bachelor of Education"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specialization
                </label>

                <input
                  type="text"
                  name="specialization"
                  value={teacher.specialization}
                  onChange={handleChange}
                  placeholder="e.g. Mathematics"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>

                <select
                  name="status"
                  value={teacher.status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>

                  <option value="Suspended">
                    Suspended
                  </option>

                  <option value="On Leave">
                    On Leave
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Staff Photo
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
                />

                {teacher.photo_url && (
                  <div className="mt-3">
                    <img
                      src={teacher.photo_url}
                      alt="Staff"
                      className="w-24 h-24 rounded-xl object-cover border"
                    />
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ====================================================
              ROLES
          ==================================================== */}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-6 mb-6">

            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Roles
            </h2>

            <p className="text-sm text-gray-500 mb-5">
              Select one or more roles for this staff member.
            </p>

            {loadingRoles ? (
              <div className="py-6 text-gray-500">
                Loading roles...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {roles.map((role) => {
                  const roleId =
                    Number(role.id);

                  const selected =
                    selectedRoleIds.includes(
                      roleId
                    );

                  return (
                    <label
                      key={role.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          handleRoleChange(
                            role.id
                          )
                        }
                        className="w-5 h-5"
                      />

                      <span className="font-medium text-gray-800">
                        {role.role_name ||
                          role.name ||
                          `Role ${role.id}`}
                      </span>
                    </label>
                  );
                })}

              </div>
            )}

            {selectedRoleIds.length > 0 && (
              <div className="mt-6">

                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Primary Role *
                </label>

                <select
                  value={primaryRoleId}
                  onChange={(e) =>
                    setPrimaryRoleId(
                      e.target.value
                    )
                  }
                  className="w-full md:w-1/2 px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">
                    Select Primary Role
                  </option>

                  {selectedRoleIds.map(
                    (roleId) => (
                      <option
                        key={roleId}
                        value={roleId}
                      >
                        {getRoleName(
                          roleId
                        )}
                      </option>
                    )
                  )}
                </select>

              </div>
            )}

          </div>

          {/* ====================================================
              TEACHING ASSIGNMENTS
          ==================================================== */}

          {(isSubjectTeacherSelected ||
            isClassTeacherSelected) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-6 mb-6">

              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Teaching Assignments
              </h2>

              <p className="text-sm text-gray-500 mb-5">
                Assign subjects and classes to this staff member.
              </p>

              <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      School
                    </p>

                    <p className="font-bold text-gray-800">
                      {schoolId
                        ? schoolId
                        : "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      Academic Year
                    </p>

                    <p className="font-bold text-gray-800">
                      {activeAcademicYearId
                        ? activeAcademicYearId
                        : "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      Available Classes
                    </p>

                    <p className="font-bold text-gray-800">
                      {loadingClasses
                        ? "Loading..."
                        : classes.length}
                    </p>
                  </div>

                </div>

              </div>

              <div className="mb-5">

                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assignment Type
                </label>

                <select
                  value={assignmentType}
                  onChange={(e) => {
                    setAssignmentType(
                      e.target.value
                    );
                    setAssignmentSubjectId("");
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="subject">
                    Subject Teacher — Subject + Class
                  </option>

                  <option value="class">
                    Class Teacher — Class Only
                  </option>
                </select>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {assignmentType === "subject" ? (
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subject
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
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
                            {subject.subject_name ||
                              subject.name}
                          </option>
                        )
                      )}
                    </select>

                  </div>
                ) : (
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Assignment
                    </label>

                    <div className="px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-800">
                      Class Teacher
                    </div>

                  </div>
                )}

                <div>

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Class
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
                      schoolLoading ||
                      loadingClasses ||
                      !schoolId ||
                      !activeAcademicYearId
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                  >

                    <option value="">
                      {schoolLoading
                        ? "Loading school..."
                        : !schoolId
                        ? "School not available"
                        : !activeAcademicYearId
                        ? "Academic year not available"
                        : loadingClasses
                        ? "Loading classes..."
                        : classes.length === 0
                        ? "No classes found"
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
                          {classItem.class_name}

                          {classItem.short_name
                            ? ` (${classItem.short_name})`
                            : ""}
                        </option>
                      )
                    )}

                  </select>

                  {!loadingClasses &&
                    schoolId &&
                    activeAcademicYearId &&
                    classes.length === 0 && (
                      <p className="mt-2 text-sm text-red-600">
                        No classes were found for the current school and active academic year.
                      </p>
                    )}

                </div>

              </div>

              <div className="mt-5">

                <button
                  type="button"
                  onClick={addAssignment}
                  disabled={
                    loadingClasses ||
                    !schoolId ||
                    !activeAcademicYearId ||
                    !assignmentClassId ||
                    (assignmentType ===
                      "subject" &&
                      !assignmentSubjectId)
                  }
                  className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add Assignment
                </button>

              </div>

              {assignments.length > 0 && (
                <div className="mt-6">

                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    Selected Assignments
                  </h3>

                  <div className="space-y-3">

                    {assignments.map(
                      (assignment) => (
                        <div
                          key={
                            assignment.id
                          }
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50"
                        >

                          <div>

                            <p className="font-semibold text-gray-800">
                              {assignment.assignment_type ===
                              "subject"
                                ? assignment.subject_name
                                : "Class Teacher"}
                            </p>

                            <p className="text-sm text-gray-500">
                              {assignment.class_name}
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeAssignment(
                                assignment.id
                              )
                            }
                            className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                          >
                            Remove
                          </button>

                        </div>
                      )
                    )}

                  </div>

                </div>
              )}

            </div>
          )}

          {/* ====================================================
              ACCOUNT CREATED
          ==================================================== */}

          {createdAccount && (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5 md:p-6 mb-6 shadow-sm">

              <div className="flex items-start gap-3 mb-5">

                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-lg">
                  ✓
                </div>

                <div>
                  <h2 className="text-xl font-bold text-green-800">
                    Staff Account Created Successfully
                  </h2>

                  <p className="text-sm text-green-700 mt-1">
                    The following credentials should be given to
                    the staff member for system login.
                  </p>
                </div>

              </div>

              <div className="bg-green-100 border border-green-200 rounded-xl p-5 space-y-4">

                {(createdAccount.login_email ||
                  createdAccount.email) && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-1">
                      Login Email
                    </p>

                    <p className="text-base md:text-lg font-semibold text-gray-900 break-all">
                      {createdAccount.login_email ||
                        createdAccount.email}
                    </p>
                  </div>
                )}

                {(createdAccount.login_phone ||
                  createdAccount.phone) && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-1">
                      Login Phone
                    </p>

                    <p className="text-base md:text-lg font-semibold text-gray-900">
                      {createdAccount.login_phone ||
                        createdAccount.phone}
                    </p>
                  </div>
                )}

                {createdAccount.username && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-1">
                      Username
                    </p>

                    <p className="text-base md:text-lg font-semibold text-gray-900">
                      {createdAccount.username}
                    </p>
                  </div>
                )}

                {createdAccount.temporary_password && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-1">
                      Temporary Password
                    </p>

                    <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 px-4 py-3">
                      <p className="text-lg md:text-xl font-mono font-bold text-gray-900 break-all">
                        {createdAccount.temporary_password}
                      </p>
                    </div>

                    <p className="text-xs text-gray-600 mt-2">
                      Give this temporary password to the
                      staff member for login.
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">

                  <p className="text-sm font-semibold text-blue-900">
                    Login Information
                  </p>

                  <p className="text-sm text-blue-800 mt-1">
                    Use the login email or phone together with
                    the temporary password to access the
                    AfriCore ERP system.
                  </p>

                </div>

              </div>

            </div>
          )}

          {/* ====================================================
              ACTIONS
          ==================================================== */}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-6 mb-8">

            <div className="flex flex-col md:flex-row gap-3 md:justify-end">

              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition disabled:opacity-50"
              >
                Reset
              </button>

              <button
                type="submit"
                disabled={
                  loading ||
                  schoolLoading ||
                  !schoolId ||
                  !activeAcademicYearId
                }
                className="px-7 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Creating Staff..."
                  : "Create Staff"}
              </button>

            </div>

          </div>

        </form>
      </div>
    </div>
  );
}