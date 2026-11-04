import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  MdPeople,
  MdSchool,
  MdClass,
  MdAccountBalance,
  MdAssignment,
  MdPsychology,
  MdAdd,
  MdUpload,
  MdDashboard,
  MdMenuBook,
  MdAssessment,
  MdEventNote,
  MdPayments,
  MdPerson,
  MdAdminPanelSettings,
  MdGroups,
  MdSecurity,
  MdWarning,
  MdArrowForward,
  MdWork,
  MdChildCare,
  MdBusiness,
  MdSupervisorAccount,
} from "react-icons/md";

import { supabase } from "../../services/supabase";
import api from "../../services/api";
import { useRole } from "../../context/RoleContext";
import { useSchool } from "../../context/SchoolContext";

import StudentAnalytics from "./StudentAnalytics";
import HeadmasterDashboardLive from "./HeadmasterDashboard";


/* =========================================================
   ROLE NORMALIZER
========================================================= */

const normalizeRoleName = (roleName) => {

  if (
    roleName === null ||
    roleName === undefined
  ) {
    return "";
  }

  return String(roleName)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

};


/* =========================================================
   ROLE DASHBOARD TYPE
========================================================= */

const getDashboardType = (roleName) => {

  const role =
    normalizeRoleName(roleName);

  console.log(
    "DASHBOARD ROLE NORMALIZATION:",
    {
      original: roleName,
      normalized: role,
      isClassTeacher:
        role === "class teacher",
      isSubjectTeacher:
        role === "subject teacher",
    }
  );

  switch (role) {

    case "super admin":
      return "super_admin";

    case "headmaster":
      return "headmaster";

    case "deputy headmaster":
      return "deputy_headmaster";

    case "academic master":
      return "academic_master";

    case "subject teacher":
      return "subject_teacher";

    case "class teacher":
      return "class_teacher";

    case "accountant":
      return "accountant";

    case "secretary":
      return "secretary";

    case "social welfare manager":
      return "social_welfare";

    case "teacher on duty":
      return "teacher_on_duty";

    /* =====================================================
       MATRON
    ===================================================== */

    case "matron":
      return "matron";

    /* =====================================================
       PATRON
    ===================================================== */

    case "patron":
      return "patron";

    default:

      console.warn(
        "UNKNOWN DASHBOARD ROLE:",
        {
          original: roleName,
          normalized: role,
        }
      );

      return "general";

  }

};


/* =========================================================
   NORMALIZE ROLE CONTEXT DATA
========================================================= */

const normalizeContextRole = (role) => {

  if (!role) {
    return null;
  }

  return {

    ...role,

    id:
      role.profileRoleId ??
      role.roleId ??
      role.id ??
      null,

    profile_role_id:
      role.profileRoleId ??
      role.id ??
      null,

    role_id:
      role.roleId ??
      role.role?.id ??
      role.role_id ??
      null,

    role_name:
      role.roleName ??
      role.role?.name ??
      role.role_name ??
      "",

    school_id:
      role.schoolId ??
      role.school_id ??
      null,

    is_primary:
      role.isPrimary ??
      role.is_primary ??
      false,

  };

};


/* =========================================================
   MAIN DASHBOARD
========================================================= */

function Dashboard() {

  const navigate = useNavigate();


  /* =======================================================
     ROLE CONTEXT
  ======================================================= */

  const {
    loading: roleContextLoading,
    roles: contextRoles = [],
    selectedRoleId,
    selectedProfileRoleId,
    selectedRoleName,
  } = useRole();


  /* =======================================================
     SCHOOL CONTEXT
  ======================================================= */

  const {
    schoolId,
    activeAcademicYearId,
    activeAcademicYear,
    academicYearLoading,
  } = useSchool();


  /* =======================================================
     AUTH USER
  ======================================================= */

  const [currentUser, setCurrentUser] =
    useState(null);


  /* =======================================================
     SUPER ADMIN DATA
  ======================================================= */

  const [stats, setStats] = useState({

    students: 0,

    totalSchools: 0,

    activeSchools: 0,

    inactiveSchools: 0,

    teachingStaff: 0,

    nonStaff: 0,

    totalStaff: 0,

    classes: 0,

    cashBalance: 0,

  });


  const [recentStudents, setRecentStudents] =
    useState([]);

  const [managedSchools, setManagedSchools] = useState([]);
  const [schoolListLoading, setSchoolListLoading] = useState(false);
  const [schoolListError, setSchoolListError] = useState("");


  /* =======================================================
     NORMALIZE ALL ACTIVE ROLES
  ======================================================= */

  const activeRoles =
    Array.isArray(contextRoles)
      ? contextRoles
          .map(normalizeContextRole)
          .filter(Boolean)
      : [];


  /* =======================================================
     FIND SELECTED ROLE
  ======================================================= */

  const selectedContextRole =
    activeRoles.find((role) => {

      const profileRoleMatch =
        selectedProfileRoleId !== null &&
        selectedProfileRoleId !== undefined &&
        role.profile_role_id !== null &&
        role.profile_role_id !== undefined &&
        String(role.profile_role_id) ===
          String(selectedProfileRoleId);

      const roleIdMatch =
        selectedRoleId !== null &&
        selectedRoleId !== undefined &&
        role.role_id !== null &&
        role.role_id !== undefined &&
        Number(role.role_id) ===
          Number(selectedRoleId);

      const roleNameMatch =
        selectedRoleName &&
        normalizeRoleName(
          role.role_name
        ) ===
          normalizeRoleName(
            selectedRoleName
          );

      return (
        profileRoleMatch ||
        roleIdMatch ||
        roleNameMatch
      );

    }) || null;


  /* =======================================================
     SELECTED ROLE FALLBACK
  ======================================================= */

  const fallbackSelectedRole =
    selectedRoleName
      ? {
          id:
            selectedProfileRoleId ??
            selectedRoleId ??
            null,

          profile_role_id:
            selectedProfileRoleId ??
            null,

          role_id:
            selectedRoleId ??
            null,

          role_name:
            selectedRoleName,

          school_id:
            null,

          is_primary:
            false,
        }
      : null;


  /* =======================================================
     PRIMARY / SELECTED ROLE
  ======================================================= */

  const primaryRole =
    selectedContextRole ||
    fallbackSelectedRole ||
    activeRoles.find(
      (role) =>
        role.is_primary === true
    ) ||
    activeRoles[0] ||
    null;


  /* =======================================================
     CURRENT ROLE NAME

     SELECTED ROLE IS AUTHORITATIVE
  ======================================================= */

  const currentRoleName =
    selectedRoleName ||
    primaryRole?.role_name ||
    "";


  /* =======================================================
     ROLE CHECK HELPERS
  ======================================================= */

  const hasActiveRole = (roleName) => {

    const target =
      normalizeRoleName(roleName);

    return activeRoles.some(
      (role) =>
        normalizeRoleName(
          role.role_name
        ) === target
    );

  };


  /* =======================================================
     CLASS TEACHER ROLE
  ======================================================= */

  const hasClassTeacherRole =
    hasActiveRole("Class Teacher") ||
    normalizeRoleName(selectedRoleName) ===
      "class teacher";


  /* =======================================================
     SUBJECT TEACHER ROLE
  ======================================================= */

  const hasSubjectTeacherRole =
    hasActiveRole("Subject Teacher") ||
    normalizeRoleName(selectedRoleName) ===
      "subject teacher";


  /* =======================================================
     LOAD CURRENT AUTH USER
  ======================================================= */

  useEffect(() => {

    let mounted = true;

    const loadCurrentUser = async () => {

      try {

        const {
          data: {
            user
          },
          error,
        } = await supabase.auth.getUser();

        if (error) {

          console.log(
            "Dashboard Auth Error:",
            error
          );

        }

        if (mounted) {

          setCurrentUser(
            user || null
          );

        }

      } catch (error) {

        console.log(
          "Dashboard Current User Error:",
          error
        );

      }

    };

    loadCurrentUser();

    return () => {

      mounted = false;

    };

  }, []);



  const loadSuperAdminSchools = useCallback(async () => {
    setSchoolListLoading(true);
    setSchoolListError("");

    try {
      const response = await api.get("/schools");
      const rows = response?.data?.schools;

      if (!Array.isArray(rows)) {
        throw new Error("Backend haikurudisha orodha sahihi ya shule.");
      }

      setManagedSchools(rows);
      const activeCount = rows.filter((school) => school.is_active === true).length;
      setStats((current) => ({
        ...current,
        totalSchools: rows.length,
        activeSchools: activeCount,
        inactiveSchools: rows.length - activeCount,
      }));
    } catch (error) {
      console.error("Super Admin Schools Dashboard Error:", error);
      setSchoolListError(
        error?.response?.data?.message ||
        error?.message ||
        "Imeshindikana kupakia orodha ya shule. Tafadhali jaribu tena."
      );
    } finally {
      setSchoolListLoading(false);
    }
  }, []);

  /* =======================================================
     LOAD SUPER ADMIN DASHBOARD DATA
  ======================================================= */

  const loadDashboardData = async ({
    schoolId: scopedSchoolId = null,
  } = {}) => {

    try {
      const schoolFilter = scopedSchoolId
        ? Number(scopedSchoolId)
        : null;

      let schoolsQuery = supabase
        .from("schools")
        .select("id", { count: "exact", head: true });

      let activeSchoolsQuery = supabase
        .from("schools")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      let inactiveSchoolsQuery = supabase
        .from("schools")
        .select("id", { count: "exact", head: true })
        .eq("is_active", false);

      let studentsQuery = supabase
        .from("students")
        .select("*", { count: "exact", head: true });

      let teachingStaffQuery = supabase
        .from("teachers")
        .select("*", { count: "exact", head: true })
        .eq("staff_type", "Staff");

      let nonStaffQuery = supabase
        .from("teachers")
        .select("*", { count: "exact", head: true })
        .eq("staff_type", "Non-Staff");

      let totalStaffQuery = supabase
        .from("teachers")
        .select("*", { count: "exact", head: true });

      let classesQuery = supabase
        .from("classes")
        .select("*", { count: "exact", head: true });

      let cashAccountsQuery = supabase
        .schema("finance")
        .from("cash_accounts")
        .select("current_balance,balance")
        .eq("is_active", true);

      let recentStudentsQuery = supabase
        .from("students")
        .select("first_name,last_name,admission_number,created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      // Headmasters must only see records belonging to their own school.
      // Super Admin calls this loader without a school filter.
      if (schoolFilter) {
        schoolsQuery = schoolsQuery.eq("id", schoolFilter);
        activeSchoolsQuery = activeSchoolsQuery.eq("id", schoolFilter);
        inactiveSchoolsQuery = inactiveSchoolsQuery.eq("id", schoolFilter);
        studentsQuery = studentsQuery.eq("school_id", schoolFilter);
        teachingStaffQuery = teachingStaffQuery.eq("school_id", schoolFilter);
        nonStaffQuery = nonStaffQuery.eq("school_id", schoolFilter);
        totalStaffQuery = totalStaffQuery.eq("school_id", schoolFilter);
        classesQuery = classesQuery.eq("school_id", schoolFilter);
        cashAccountsQuery = cashAccountsQuery.eq("school_id", schoolFilter);
        recentStudentsQuery = recentStudentsQuery.eq("school_id", schoolFilter);
      }

      const [
        schoolsResult,
        activeSchoolsResult,
        inactiveSchoolsResult,
        studentResult,
        teachingStaffResult,
        nonStaffResult,
        totalStaffResult,
        classResult,
        cashAccountsResult,
        recentResult,
      ] = await Promise.all([
        schoolsQuery,
        activeSchoolsQuery,
        inactiveSchoolsQuery,
        studentsQuery,
        teachingStaffQuery,
        nonStaffQuery,
        totalStaffQuery,
        classesQuery,
        cashAccountsQuery,
        recentStudentsQuery,
      ]);

      const queryErrors = [
        schoolsResult.error,
        activeSchoolsResult.error,
        inactiveSchoolsResult.error,
        studentResult.error,
        teachingStaffResult.error,
        nonStaffResult.error,
        totalStaffResult.error,
        classResult.error,
        cashAccountsResult.error,
        recentResult.error,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        console.error(
          "Dashboard data query errors:",
          queryErrors
        );
        throw queryErrors[0];
      }

      setStats({
        totalSchools: schoolsResult.count || 0,
        activeSchools: activeSchoolsResult.count || 0,
        inactiveSchools: inactiveSchoolsResult.count || 0,
        students: studentResult.count || 0,
        teachingStaff: teachingStaffResult.count || 0,
        nonStaff: nonStaffResult.count || 0,
        totalStaff: totalStaffResult.count || 0,
        classes: classResult.count || 0,
        cashBalance: (cashAccountsResult.data || []).reduce(
          (total, account) =>
            total + Number(
              account.current_balance ??
              account.balance ??
              0
            ),
          0
        ),
      });

      setRecentStudents(recentResult.data || []);
    } catch (error) {
      console.error("Dashboard Data Error:", error);
    }
  };


  /* =======================================================
     LOAD SUPER ADMIN DATA ONLY FOR SELECTED SUPER ADMIN
  ======================================================= */

  useEffect(() => {

    if (
      roleContextLoading ||
      !primaryRole
    ) {

      return;

    }

    const dashboardType =
      getDashboardType(
        currentRoleName
      );

    if (dashboardType === "super_admin") {
      loadSuperAdminSchools();
    } else if (
      dashboardType === "headmaster" &&
      schoolId
    ) {
      loadDashboardData({ schoolId });
    }

  }, [
    roleContextLoading,
    selectedRoleId,
    selectedProfileRoleId,
    selectedRoleName,
    currentRoleName,
    schoolId,
    loadSuperAdminSchools,
  ]);


  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (roleContextLoading) {

    return (

      <div className="min-h-[60vh] flex items-center justify-center">

        <div className="text-center">

          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>

          <h2 className="text-lg font-semibold text-gray-700">
            Loading Dashboard...
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Checking your system role
          </p>

        </div>

      </div>

    );

  }


  /* =======================================================
     NO ROLE SCREEN
  ======================================================= */

  if (!primaryRole) {

    return (

      <div className="min-h-[60vh] flex items-center justify-center">

        <div className="bg-white rounded-2xl shadow p-8 max-w-lg w-full text-center">

          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">

            <MdWarning />

          </div>

          <h1 className="text-2xl font-bold text-gray-800">
            Dashboard Access
          </h1>

          <p className="text-gray-500 mt-3">
            Your account does not currently have an active
            system role assigned.
          </p>

          <p className="text-sm text-gray-400 mt-2">
            Please contact the system administrator.
          </p>

        </div>

      </div>

    );

  }


  /* =======================================================
     DETERMINE DASHBOARD
  ======================================================= */

  const dashboardType =
    getDashboardType(
      currentRoleName
    );


  /* =======================================================
     DEBUG
  ======================================================= */

  console.log(
    "========================================"
  );

  console.log(
    "DASHBOARD ROLE DEBUG"
  );

  console.log(
    "SELECTED ROLE ID:",
    selectedRoleId
  );

  console.log(
    "SELECTED PROFILE ROLE ID:",
    selectedProfileRoleId
  );

  console.log(
    "SELECTED ROLE NAME:",
    selectedRoleName
  );

  console.log(
    "NORMALIZED SELECTED ROLE:",
    normalizeRoleName(
      selectedRoleName
    )
  );

  console.log(
    "CURRENT ROLE:",
    currentRoleName
  );

  console.log(
    "DASHBOARD TYPE:",
    dashboardType
  );

  console.log(
    "ACTIVE ROLES COUNT:",
    activeRoles.length
  );

  console.log(
    "ACTIVE ROLES:",
    activeRoles
  );

  console.log(
    "HAS SUBJECT TEACHER ROLE:",
    hasSubjectTeacherRole
  );

  console.log(
    "HAS CLASS TEACHER ROLE:",
    hasClassTeacherRole
  );

  console.log(
    "========================================"
  );


  /* =======================================================
     SUPER ADMIN DASHBOARD
  ======================================================= */

  if (
    dashboardType ===
    "super_admin"
  ) {

    return (

      <SuperAdminDashboard
        navigate={navigate}
        schools={managedSchools}
        loading={schoolListLoading}
        error={schoolListError}
        onRefresh={loadSuperAdminSchools}
        primaryRole={primaryRole}
      />

    );

  }


  /* =======================================================
     HEADMASTER
  ======================================================= */

  if (
    dashboardType ===
    "headmaster"
  ) {

    return (

      <HeadmasterDashboardLive />

    );

  }


  /* =======================================================
     DEPUTY HEADMASTER
  ======================================================= */

  if (
    dashboardType ===
    "deputy_headmaster"
  ) {

    return (

      <DeputyHeadmasterDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     ACADEMIC MASTER
  ======================================================= */

  if (
    dashboardType ===
    "academic_master"
  ) {

    return (

      <AcademicMasterDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     SUBJECT TEACHER
  ======================================================= */

  if (
    dashboardType ===
    "subject_teacher"
  ) {

    return (

      <SubjectTeacherDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
        hasClassTeacherRole={
          hasClassTeacherRole
        }
      />

    );

  }


  /* =======================================================
     CLASS TEACHER
  ======================================================= */

  if (
    dashboardType ===
    "class_teacher"
  ) {

    return (

      <ClassTeacherDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
        hasSubjectTeacherRole={
          hasSubjectTeacherRole
        }
        schoolId={schoolId}
        activeAcademicYearId={
          activeAcademicYearId
        }
        activeAcademicYear={
          activeAcademicYear
        }
        academicYearLoading={
          academicYearLoading
        }
      />

    );

  }


  /* =======================================================
     ACCOUNTANT
  ======================================================= */

  if (
    dashboardType ===
    "accountant"
  ) {

    return (

      <AccountantDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     SECRETARY
  ======================================================= */

  if (
    dashboardType ===
    "secretary"
  ) {

    return (

      <SecretaryDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     SOCIAL WELFARE
  ======================================================= */

  if (
    dashboardType ===
    "social_welfare"
  ) {

    return (

      <SocialWelfareDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     TEACHER ON DUTY
  ======================================================= */

  if (
    dashboardType ===
    "teacher_on_duty"
  ) {

    return (

      <TeacherOnDutyDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     MATRON
  ======================================================= */

  if (
    dashboardType ===
    "matron"
  ) {

    return (

      <MatronDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     PATRON
  ======================================================= */

  if (
    dashboardType ===
    "patron"
  ) {

    return (

      <PatronDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

    );

  }


  /* =======================================================
     GENERAL FALLBACK
  ======================================================= */

  return (

    <GeneralRoleDashboard
      navigate={navigate}
      primaryRole={primaryRole}
      activeRoles={activeRoles}
      currentUser={currentUser}
    />

  );

}


/* =========================================================
   DASHBOARD HEADER
========================================================= */

function DashboardHeader({
  title,
  subtitle,
  role,
  icon,
}) {

  return (

    <div className="mb-8">

      <div className="flex items-center gap-4">

        <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl shadow-lg">

          {icon}

        </div>

        <div>

          <h1 className="text-3xl font-bold text-gray-800">
            {title}
          </h1>

          <p className="text-gray-500 mt-1">
            {subtitle}
          </p>

        </div>

      </div>

      <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">

        <MdSecurity />

        {role}

      </div>

    </div>

  );

}


/* =========================================================
   DASHBOARD CARD
========================================================= */

function DashboardCard({
  title,
  description,
  icon,
  color = "bg-blue-600",
  onClick,
}) {

  return (

    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-200 w-full"
    >

      <div className="flex items-start justify-between">

        <div>

          <h3 className="text-lg font-bold text-gray-800">
            {title}
          </h3>

          <p className="text-sm text-gray-500 mt-2">
            {description}
          </p>

        </div>

        <div
          className={`${color} text-white p-3 rounded-xl text-2xl`}
        >

          {icon}

        </div>

      </div>

      <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold mt-6">

        Open

        <MdArrowForward />

      </div>

    </button>

  );

}


/* =========================================================
   SUPER ADMIN DASHBOARD
========================================================= */

function SuperAdminDashboard({
  navigate,
  schools = [],
  loading,
  error,
  onRefresh,
  primaryRole,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const activeCount = schools.filter((school) => school.is_active === true).length;
  const inactiveCount = schools.length - activeCount;
  const normalizedSearch = search.trim().toLowerCase();

  const visibleSchools = schools.filter((school) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && school.is_active === true) ||
      (statusFilter === "inactive" && school.is_active !== true);
    const matchesSearch =
      !normalizedSearch ||
      [
        school.school_name,
        school.registration_number,
        school.address,
        school.phone,
        school.email,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));

    return matchesStatus && matchesSearch;
  });

  const statCards = [
    {
      label: "Shule zote",
      value: schools.length,
      filter: "all",
      accent: "from-blue-600 to-indigo-600",
      icon: <MdBusiness />,
      note: "Shule zilizo chini ya usimamizi wako",
    },
    {
      label: "Shule active",
      value: activeCount,
      filter: "active",
      accent: "from-emerald-500 to-teal-600",
      icon: <MdSchool />,
      note: "Zinazoendelea kutumia mfumo",
    },
    {
      label: "Shule inactive",
      value: inactiveCount,
      filter: "inactive",
      accent: "from-rose-500 to-orange-500",
      icon: <MdSecurity />,
      note: "Zisizotumika kwa sasa",
    },
  ];

  return (
    <div className="min-h-[70vh] space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-6 text-white shadow-xl sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-1/4 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100">
              <MdSecurity className="text-base" />
              SUPER ADMIN • SYSTEM OVERVIEW
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Schools Management
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Karibu {primaryRole?.role_name || "Super Admin"}. Simamia shule zote
              zilizosajiliwa, fuatilia hali yake na fungua taarifa za usimamizi
              sehemu moja.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MdDashboard className={loading ? "animate-pulse" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/school-management")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
            >
              <MdAdd />
              Manage Schools
              <MdArrowForward />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800"
          >
            Jaribu tena
          </button>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <button
            key={card.filter}
            type="button"
            onClick={() => setStatusFilter(card.filter)}
            aria-pressed={statusFilter === card.filter}
            className={`group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${statusFilter === card.filter ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">
                  {card.value.toLocaleString("en-TZ")}
                </p>
                <p className="mt-2 text-xs text-slate-500">{card.note}</p>
              </div>
              <span className={`rounded-2xl bg-gradient-to-br ${card.accent} p-3 text-2xl text-white shadow-md`}>
                {card.icon}
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold text-blue-700">
              {statusFilter === card.filter ? "Kichujio kimechaguliwa" : "Bonyeza kuona shule"}
            </p>
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-blue-50 p-2 text-xl text-blue-700"><MdBusiness /></span>
              <h2 className="text-xl font-bold text-slate-900">Shule ninazosimamia</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {visibleSchools.length} kati ya {schools.length} shule zinaonekana kwenye orodha.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:w-72">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><MdPeople /></span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tafuta shule, namba au eneo..."
                aria-label="Tafuta shule"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="button"
              onClick={() => navigate("/school-management")}
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
            >
              Fungua usimamizi
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="animate-pulse rounded-2xl border border-slate-100 p-5">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="mt-4 h-3 w-1/2 rounded bg-slate-100" />
                <div className="mt-7 h-8 w-24 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : visibleSchools.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">
              <MdBusiness />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {schools.length === 0 ? "Hakuna shule zilizopatikana" : "Hakuna shule zinazolingana"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {schools.length === 0
                ? "Shule zitakazoonekana hapa ni zile zilizosajiliwa na unazozisimamia."
                : "Badilisha neno la utafutaji au kichujio cha hali ya shule."}
            </p>
            {schools.length === 0 && (
              <button
                type="button"
                onClick={() => navigate("/school-management")}
                className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800"
              >
                Fungua School Management
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleSchools.map((school) => {
              const isActive = school.is_active === true;
              return (
                <article
                  key={school.id}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-2xl text-blue-800">
                        <MdSchool />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-slate-900" title={school.school_name}>
                          {school.school_name || "School"}
                        </h3>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {school.registration_number || "Registration number not set"}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-slate-400"><MdBusiness /></span>
                      <span className="line-clamp-2">{school.address || "Anuani haijawekwa"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-slate-400"><MdPhone /></span>
                      <span>{school.phone || "Simu haijawekwa"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-slate-400"><MdEmail /></span>
                      <span className="min-w-0 truncate">{school.email || "Email haijawekwa"}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/school-management")}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-100"
                  >
                    Simamia shule
                    <MdArrowForward />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


/* =========================================================
   HEADMASTER DASHBOARD
========================================================= */

function HeadmasterDashboard({
  navigate,
  stats,
  recentStudents,
  primaryRole,
  activeRoles,
  schoolId,
}) {
  return (
    <SuperAdminDashboard
      navigate={navigate}
      stats={stats}
      recentStudents={recentStudents}
      primaryRole={primaryRole}
      activeRoles={activeRoles}
      schoolId={schoolId}
      scopeToSchool={true}
      dashboardTitle="AfriCore ERP PRO Dashboard"
      welcomeMessage="Welcome back. Here's your school overview."
    />
  );
}


/* =========================================================
   DEPUTY HEADMASTER DASHBOARD
========================================================= */

function DeputyHeadmasterDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Deputy Headmaster Dashboard"
        subtitle="School administration, supervision and daily operations."
        role={primaryRole.role_name}
        icon={<MdSupervisorAccount />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="Students"
          description="Monitor student records and school population."
          icon={<MdPeople />}
          color="bg-blue-600"
          onClick={() => navigate("/students")}
        />

        <DashboardCard
          title="Staff & Non-Staff"
          description="Review teaching staff and non-staff activities."
          icon={<MdGroups />}
          color="bg-green-600"
          onClick={() => navigate("/teachers")}
        />

        <DashboardCard
          title="Classes"
          description="Monitor class structures and academic organization."
          icon={<MdClass />}
          color="bg-purple-600"
          onClick={() => navigate("/classes")}
        />

        <DashboardCard
          title="Timetable"
          description="Review school timetable and daily schedules."
          icon={<MdEventNote />}
          color="bg-orange-600"
          onClick={() => navigate("/timetable")}
        />

        <DashboardCard
          title="Examination"
          description="Monitor examination activities."
          icon={<MdAssessment />}
          color="bg-red-600"
          onClick={() => navigate("/examination")}
        />

        <DashboardCard
          title="Communication"
          description="Manage available school communication."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() => navigate("/communication")}
        />

      </div>

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   ACADEMIC MASTER DASHBOARD
========================================================= */

function AcademicMasterDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Academic Master Dashboard"
        subtitle="Academic management, examinations and learning performance."
        role={primaryRole.role_name}
        icon={<MdMenuBook />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="Examination"
          description="Create, upload, classify and manage examinations."
          icon={<MdAssignment />}
          color="bg-blue-600"
          onClick={() => navigate("/examination")}
        />

        <DashboardCard
          title="Subjects"
          description="Manage academic subjects."
          icon={<MdMenuBook />}
          color="bg-green-600"
          onClick={() => navigate("/subjects")}
        />

        <DashboardCard
          title="Classes"
          description="Review academic class structures."
          icon={<MdClass />}
          color="bg-purple-600"
          onClick={() => navigate("/classes")}
        />

        <DashboardCard
          title="Timetable"
          description="Review academic schedules and periods."
          icon={<MdEventNote />}
          color="bg-orange-600"
          onClick={() => navigate("/timetable")}
        />

        <DashboardCard
          title="Staff & Non-Staff"
          description="Review teaching staff and non-staff."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() => navigate("/teachers")}
        />

        <DashboardCard
          title="AI Analysis"
          description="Review available AI examination analysis."
          icon={<MdPsychology />}
          color="bg-cyan-600"
          onClick={() => navigate("/ai")}
        />

      </div>

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   SUBJECT TEACHER DASHBOARD
========================================================= */

function SubjectTeacherDashboard({
  navigate,
  primaryRole,
  activeRoles,
  hasClassTeacherRole,
}) {

  return (

    <div>

      <DashboardHeader
        title="Teacher Dashboard"
        subtitle="Manage your assigned classes, subjects, timetable and examination activities."
        role={primaryRole.role_name}
        icon={<MdSchool />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="My Classes"
          description="View only the classes assigned to you. Open a class to see its students within your assigned subject."
          icon={<MdClass />}
          color="bg-blue-600"
          onClick={() => navigate("/classes")}
        />

        <DashboardCard
          title="My Subjects"
          description="Access the academic subjects assigned to you."
          icon={<MdMenuBook />}
          color="bg-green-600"
          onClick={() => navigate("/subjects")}
        />

        <DashboardCard
          title="Timetable"
          description="View your teaching schedules and periods."
          icon={<MdEventNote />}
          color="bg-purple-600"
          onClick={() => navigate("/timetable")}
        />

        <DashboardCard
          title="Examination"
          description="Access examination activities available to you."
          icon={<MdAssignment />}
          color="bg-red-600"
          onClick={() => navigate("/examination")}
        />

        {hasClassTeacherRole && (

          <DashboardCard
            title="Class Teacher"
            description="Manage your assigned class, class students, attendance, communication and class welfare."
            icon={<MdSupervisorAccount />}
            color="bg-orange-600"
            onClick={() => navigate("/classes")}
          />

        )}

      </div>

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   CLASS TEACHER DASHBOARD
========================================================= */

function ClassTeacherDashboard({
  navigate,
  primaryRole,
  activeRoles,
  hasSubjectTeacherRole,
  schoolId,
  activeAcademicYearId,
  activeAcademicYear,
  academicYearLoading,
}) {

  const [assignedClasses, setAssignedClasses] =
    useState([]);

  const [classStudentsCount, setClassStudentsCount] =
    useState(0);

  const [mySubjects, setMySubjects] =
    useState([]);

  const [subjectTeachers, setSubjectTeachers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [assignmentError, setAssignmentError] =
    useState("");


  useEffect(() => {

    let mounted = true;

    const loadClassTeacherDashboard = async () => {

      if (
        academicYearLoading ||
        !schoolId ||
        !activeAcademicYearId
      ) {

        if (mounted) {

          setLoading(
            academicYearLoading
          );

          if (!activeAcademicYearId) {

            setAssignedClasses([]);
            setMySubjects([]);
            setSubjectTeachers([]);
            setClassStudentsCount(0);

          }

        }

        return;

      }


      if (mounted) {

        setLoading(true);
        setAssignmentError("");

      }


      try {

        const {
          data: authData,
          error: authError,
        } = await supabase.auth.getUser();


        if (
          authError ||
          !authData?.user
        ) {

          throw new Error(
            "Unable to identify the current user."
          );

        }


        const userId =
          authData.user.id;


        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name, school_id, role_id, teacher_id"
          )
          .eq(
            "id",
            userId
          )
          .maybeSingle();


        if (profileError) {

          throw profileError;

        }


        if (!profile) {

          throw new Error(
            "Your user profile could not be found."
          );

        }


        if (
          Number(profile.school_id) !==
          Number(schoolId)
        ) {

          throw new Error(
            "Your profile does not belong to the current school."
          );

        }


        const teacherId =
          profile.teacher_id;


        if (!teacherId) {

          throw new Error(
            "No teacher record is linked to your profile."
          );

        }


        console.log(
          "CLASS TEACHER DASHBOARD PROFILE:",
          profile
        );


        console.log(
          "CLASS TEACHER TEACHER ID:",
          teacherId
        );


        const {
          data: assignments,
          error: assignmentsError,
        } = await supabase
          .from("teacher_assignments")
          .select(
            "id, school_id, teacher_id, subject_id, class_id"
          )
          .eq(
            "school_id",
            schoolId
          )
          .eq(
            "teacher_id",
            teacherId
          );


        if (assignmentsError) {

          throw assignmentsError;

        }


        if (
          !assignments ||
          assignments.length === 0
        ) {

          if (mounted) {

            setAssignedClasses([]);
            setMySubjects([]);
            setSubjectTeachers([]);
            setClassStudentsCount(0);

            setAssignmentError(
              "No class assignment has been found for your Class Teacher account."
            );

          }

          return;

        }


        console.log(
          "CLASS TEACHER ASSIGNMENTS:",
          assignments
        );


        const assignedClassIds = [
          ...new Set(
            assignments
              .map(
                (assignment) =>
                  Number(
                    assignment.class_id
                  )
              )
              .filter(
                (id) =>
                  Number.isFinite(id)
              )
          ),
        ];


        if (
          assignedClassIds.length === 0
        ) {

          if (mounted) {

            setAssignedClasses([]);
            setMySubjects([]);
            setSubjectTeachers([]);
            setClassStudentsCount(0);

            setAssignmentError(
              "Your Class Teacher assignment does not contain a valid class."
            );

          }

          return;

        }


        const {
          data: classes,
          error: classesError,
        } = await supabase
          .from("classes")
          .select(
            "id, school_id, academic_year_id, class_name, academic_level, short_name"
          )
          .eq(
            "school_id",
            schoolId
          )
          .eq(
            "academic_year_id",
            activeAcademicYearId
          )
          .in(
            "id",
            assignedClassIds
          )
          .order(
            "class_name",
            {
              ascending: true,
            }
          );


        if (classesError) {

          throw classesError;

        }


        const validClasses =
          classes || [];


        if (mounted) {

          setAssignedClasses(
            validClasses
          );

        }


        console.log(
          "CLASS TEACHER ACTIVE CLASSES:",
          validClasses
        );


        const activeClassIds =
          new Set(
            validClasses.map(
              (item) =>
                Number(item.id)
            )
          );


        const activeAssignments =
          assignments.filter(
            (assignment) =>
              activeClassIds.has(
                Number(
                  assignment.class_id
                )
              )
          );


        const subjectIds = [
          ...new Set(
            activeAssignments
              .map(
                (assignment) =>
                  Number(
                    assignment.subject_id
                  )
              )
              .filter(
                (id) =>
                  Number.isFinite(id)
              )
          ),
        ];


        let subjectRows = [];


        if (
          subjectIds.length > 0
        ) {

          const {
            data: subjects,
            error: subjectsError,
          } = await supabase
            .from("subjects")
            .select(
              "id, subject_name, subject_code, education_level, is_active"
            )
            .in(
              "id",
              subjectIds
            )
            .eq(
              "is_active",
              true
            )
            .order(
              "subject_name",
              {
                ascending: true,
              }
            );


          if (subjectsError) {

            throw subjectsError;

          }


          subjectRows =
            subjects || [];

        }


        if (mounted) {

          setMySubjects(
            subjectRows
          );

        }


        console.log(
          "CLASS TEACHER SUBJECTS:",
          subjectRows
        );


        const allActiveClassIds =
          validClasses.map(
            (item) =>
              Number(item.id)
          );


        let teachersForClass = [];


        if (
          allActiveClassIds.length > 0
        ) {

          const {
            data: classAssignments,
            error: classAssignmentsError,
          } = await supabase
            .from("teacher_assignments")
            .select(
              "id, teacher_id, subject_id, class_id, school_id"
            )
            .eq(
              "school_id",
              schoolId
            )
            .in(
              "class_id",
              allActiveClassIds
            );


          if (classAssignmentsError) {

            throw classAssignmentsError;

          }


          const otherTeacherIds = [
            ...new Set(
              (classAssignments || [])
                .map(
                  (assignment) =>
                    Number(
                      assignment.teacher_id
                    )
                )
                .filter(
                  (id) =>
                    Number.isFinite(id) &&
                    id !==
                      Number(teacherId)
                )
            ),
          ];


          if (
            otherTeacherIds.length > 0
          ) {

            const {
              data: teacherRows,
              error: teacherError,
            } = await supabase
              .from("teachers")
              .select(
                "id, first_name, middle_name, last_name, phone, email, status"
              )
              .eq(
                "school_id",
                schoolId
              )
              .in(
                "id",
                otherTeacherIds
              );


            if (teacherError) {

              throw teacherError;

            }


            teachersForClass =
              teacherRows || [];

          }

        }


        if (mounted) {

          setSubjectTeachers(
            teachersForClass
          );

        }


        console.log(
          "CLASS TEACHER SUBJECT TEACHERS:",
          teachersForClass
        );


        if (
          validClasses.length > 0
        ) {

          const classIds =
            validClasses.map(
              (item) =>
                Number(item.id)
            );


          const {
            count,
            error: studentCountError,
          } = await supabase
            .from("students")
            .select(
              "id",
              {
                count: "exact",
                head: true,
              }
            )
            .eq(
              "school_id",
              schoolId
            )
            .eq(
              "academic_year_id",
              activeAcademicYearId
            )
            .in(
              "current_class_id",
              classIds
            );


          if (studentCountError) {

            throw studentCountError;

          }


          if (mounted) {

            setClassStudentsCount(
              count || 0
            );

          }

        } else {

          if (mounted) {

            setClassStudentsCount(0);

          }

        }

      } catch (error) {

        console.error(
          "CLASS TEACHER DASHBOARD ERROR:",
          error
        );

        if (mounted) {

          setAssignedClasses([]);
          setMySubjects([]);
          setSubjectTeachers([]);
          setClassStudentsCount(0);

          setAssignmentError(
            error?.message ||
            "Unable to load your Class Teacher information."
          );

        }

      } finally {

        if (mounted) {

          setLoading(false);

        }

      }

    };


    loadClassTeacherDashboard();


    return () => {

      mounted = false;

    };

  }, [
    schoolId,
    activeAcademicYearId,
    academicYearLoading,
  ]);


  const primaryAssignedClass =
    assignedClasses.length > 0
      ? assignedClasses[0]
      : null;


  const subjectNames =
    mySubjects
      .map(
        (subject) =>
          subject.subject_name
      )
      .filter(Boolean);


  const subjectSummary =
    subjectNames.length === 0
      ? "No subjects have been linked to your assigned class yet."
      : subjectNames.join(", ");


  const teacherNames =
    subjectTeachers
      .map((teacher) => {

        return [
          teacher.first_name,
          teacher.middle_name,
          teacher.last_name,
        ]
          .filter(Boolean)
          .join(" ");

      })
      .filter(Boolean);


  const teacherSummary =
    teacherNames.length === 0
      ? "No other subject teachers are currently assigned to your class."
      : teacherNames.join(", ");


  const classSummary =
    assignedClasses.length === 0
      ? "No class is currently assigned to you."
      : assignedClasses
          .map(
            (item) =>
              item.class_name
          )
          .filter(Boolean)
          .join(", ");


  const openAssignedClass = () => {

    if (
      !primaryAssignedClass?.id
    ) {

      return;

    }

    navigate(
      `/classes/profile/${primaryAssignedClass.id}`
    );

  };


  if (
    loading ||
    academicYearLoading
  ) {

    return (

      <div>

        <DashboardHeader
          title="Class Teacher Dashboard"
          subtitle="Manage your assigned class, students, attendance, communication and class welfare."
          role={primaryRole.role_name}
          icon={<MdSupervisorAccount />}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          <div className="flex items-center gap-4">

            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>

            <div>

              <h2 className="font-semibold text-gray-800">
                Loading your class information...
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Checking your Class Teacher assignment.
              </p>

            </div>

          </div>

        </div>

      </div>

    );

  }


  if (
    !primaryAssignedClass
  ) {

    return (

      <div>

        <DashboardHeader
          title="Class Teacher Dashboard"
          subtitle="Manage your assigned class, students, attendance, communication and class welfare."
          role={primaryRole.role_name}
          icon={<MdSupervisorAccount />}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-8">

          <div className="flex items-start gap-4">

            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">

              <MdWarning />

            </div>

            <div>

              <h2 className="text-xl font-bold text-gray-800">
                No Class Assigned
              </h2>

              <p className="text-gray-600 mt-2">
                {assignmentError ||
                  "No Class Teacher assignment was found for the active academic year."}
              </p>

              {activeAcademicYear?.year_name && (

                <p className="text-sm text-gray-500 mt-2">

                  Academic Year:{" "}

                  <span className="font-semibold">
                    {activeAcademicYear.year_name}
                  </span>

                </p>

              )}

            </div>

          </div>

          <RoleInformation
            activeRoles={activeRoles}
            primaryRole={primaryRole}
          />

        </div>

      </div>

    );

  }


  return (

    <div>

      <DashboardHeader
        title="Class Teacher Dashboard"
        subtitle="Manage your assigned class, students, attendance, communication and class welfare."
        role={primaryRole.role_name}
        icon={<MdSupervisorAccount />}
      />


      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <p className="text-sm text-blue-600 font-semibold">
              Assigned Class
            </p>

            <h2 className="text-2xl font-bold text-gray-800 mt-1">
              {classSummary}
            </h2>

            <p className="text-sm text-gray-500 mt-1">

              Academic Year:{" "}

              <span className="font-semibold text-gray-700">
                {activeAcademicYear?.year_name ||
                  "-"}
              </span>

            </p>

          </div>


          <button
            type="button"
            onClick={openAssignedClass}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold"
          >

            Open My Class

            <MdArrowForward />

          </button>

        </div>

      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="My Class"
          description={`Only your assigned class: ${classSummary}.`}
          icon={<MdClass />}
          color="bg-blue-600"
          onClick={openAssignedClass}
        />


        <DashboardCard
          title="My Class Students"
          description={`${classStudentsCount} student${classStudentsCount !== 1 ? "s" : ""} currently belong to your assigned class in the active academic year.`}
          icon={<MdPeople />}
          color="bg-green-600"
          onClick={openAssignedClass}
        />


        <DashboardCard
          title="My Subjects"
          description={
            subjectSummary
          }
          icon={<MdMenuBook />}
          color="bg-cyan-600"
          onClick={() =>
            navigate(
              "/class-teacher/subjects"
            )
          }
        />


        <DashboardCard
          title="My Subject Teacher"
          description={
            teacherSummary
          }
          icon={<MdSchool />}
          color="bg-indigo-600"
          onClick={() =>
            navigate(
              "/class-teacher/subject-teachers"
            )
          }
        />


        <DashboardCard
          title="Attendance"
          description="Manage and review attendance for students in your assigned class."
          icon={<MdEventNote />}
          color="bg-purple-600"
          onClick={() =>
            navigate(
              "/class-teacher/attendance"
            )
          }
        />


        <DashboardCard
          title="Timetable"
          description="View the timetable and teaching schedule for your assigned class."
          icon={<MdEventNote />}
          color="bg-orange-600"
          onClick={() =>
            navigate(
              "/timetable"
            )
          }
        />


        <DashboardCard
          title="Class Communication"
          description="Access communication related to your assigned class and students."
          icon={<MdGroups />}
          color="bg-orange-600"
          onClick={() =>
            navigate(
              "/communication"
            )
          }
        />


        <DashboardCard
          title="Add Student"
          description={`Register a new student directly into ${classSummary}. The selected class is restricted to your Class Teacher assignment.`}
          icon={<MdAdd />}
          color="bg-green-700"
          onClick={() =>
            navigate(
              "/students/add"
            )
          }
        />

      </div>


      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

        <div className="flex items-center justify-between gap-4 mb-5">

          <div>

            <h2 className="text-xl font-bold text-gray-800">
              My Subjects
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Subjects assigned to teachers for your class.
            </p>

          </div>

          <div className="bg-cyan-50 text-cyan-700 px-3 py-2 rounded-lg text-sm font-semibold">

            {mySubjects.length} subject
            {mySubjects.length !== 1
              ? "s"
              : ""}

          </div>

        </div>


        {mySubjects.length === 0 ? (

          <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
            No subject assignments have been found for your class.
          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

            {mySubjects.map(
              (subject) => (

                <div
                  key={subject.id}
                  className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition"
                >

                  <div className="font-semibold text-gray-800">
                    {subject.subject_name}
                  </div>

                  {subject.subject_code && (

                    <div className="text-xs text-gray-500 mt-1">
                      Code: {subject.subject_code}
                    </div>

                  )}

                </div>

              )
            )}

          </div>

        )}

      </div>


      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

        <div className="flex items-center justify-between gap-4 mb-5">

          <div>

            <h2 className="text-xl font-bold text-gray-800">
              Subject Teachers
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Teachers assigned to teach subjects in your class.
            </p>

          </div>

          <div className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm font-semibold">

            {subjectTeachers.length} teacher
            {subjectTeachers.length !== 1
              ? "s"
              : ""}

          </div>

        </div>


        {subjectTeachers.length === 0 ? (

          <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
            No other subject teachers are currently assigned to your class.
          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {subjectTeachers.map(
              (teacher) => {

                const fullName = [
                  teacher.first_name,
                  teacher.middle_name,
                  teacher.last_name,
                ]
                  .filter(Boolean)
                  .join(" ");


                return (

                  <div
                    key={teacher.id}
                    className="border border-gray-100 rounded-xl p-4"
                  >

                    <div className="flex items-center gap-3">

                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl">

                        <MdPerson />

                      </div>

                      <div>

                        <p className="font-semibold text-gray-800">
                          {fullName ||
                            "Unnamed Teacher"}
                        </p>

                        {teacher.status && (

                          <p className="text-xs text-gray-500 mt-1">
                            {teacher.status}
                          </p>

                        )}

                      </div>

                    </div>

                  </div>

                );

              }
            )}

          </div>

        )}

      </div>


      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   ACCOUNTANT DASHBOARD
========================================================= */

function AccountantDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Finance Dashboard"
        subtitle="Financial management and school finance operations."
        role={primaryRole.role_name}
        icon={<MdAccountBalance />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="Finance"
          description="Open the school finance management module."
          icon={<MdAccountBalance />}
          color="bg-green-600"
          onClick={() => navigate("/finance")}
        />

        <DashboardCard
          title="Payments"
          description="Access available payment operations."
          icon={<MdPayments />}
          color="bg-blue-600"
          onClick={() => navigate("/finance/record-payment")}
        />

        <DashboardCard
          title="Financial Reports"
          description="Review available financial information."
          icon={<MdAssessment />}
          color="bg-purple-600"
          onClick={() => navigate("/finance/financial-statements")}
        />

      </div>

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   SECRETARY DASHBOARD
========================================================= */

function SecretaryDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Administration Dashboard"
        subtitle="School administration, records and communication."
        role={primaryRole.role_name}
        icon={<MdBusiness />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="Students"
          description="Access available student records."
          icon={<MdPeople />}
          color="bg-blue-600"
          onClick={() => navigate("/students")}
        />

        <DashboardCard
          title="Staff & Non-Staff"
          description="Access available staff and non-staff records."
          icon={<MdGroups />}
          color="bg-green-600"
          onClick={() => navigate("/teachers")}
        />

        <DashboardCard
          title="Classes"
          description="Review available school classes."
          icon={<MdClass />}
          color="bg-purple-600"
          onClick={() => navigate("/classes")}
        />

        <DashboardCard
          title="Communication"
          description="Access school communication."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() => navigate("/communication")}
        />

      </div>

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   SOCIAL WELFARE DASHBOARD
========================================================= */

function SocialWelfareDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Social Welfare Dashboard"
        subtitle="Social welfare, support and wellbeing management."
        role={primaryRole.role_name}
        icon={<MdChildCare />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="Social Welfare"
          description="Open the social welfare management module."
          icon={<MdChildCare />}
          color="bg-pink-600"
          onClick={() =>
            navigate("/social-welfare")
          }
        />

        <DashboardCard
          title="Communication"
          description="Access available school communication."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() =>
            navigate("/communication")
          }
        />

      </div>

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   TEACHER ON DUTY DASHBOARD
========================================================= */

function TeacherOnDutyDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Teacher on Duty Dashboard"
        subtitle="Manage daily duty responsibilities, school incidents and duty-related communication."
        role={primaryRole.role_name}
        icon={<MdSupervisorAccount />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <DashboardCard
          title="Communication"
          description="Access school communication, management messages and important duty-related information."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() =>
            navigate("/communication")
          }
        />

        <DashboardCard
          title="Teacher on Duty"
          description="Manage your daily duty schedule, duty reports, incidents, attendance concerns, student welfare issues, handover notes and duty history."
          icon={<MdSupervisorAccount />}
          color="bg-blue-600"
          onClick={() =>
            navigate("/teacher-on-duty")
          }
        />

      </div>


      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   MATRON DASHBOARD
========================================================= */

function MatronDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Matron Dashboard"
        subtitle="Manage student welfare, patron and matron responsibilities and school communication."
        role={primaryRole?.role_name || "Matron"}
        icon={<MdChildCare />}
      />


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* =================================================
            COMMUNICATION
        ================================================= */}

        <DashboardCard
          title="Communication"
          description="Access school communication, management messages and important welfare-related information."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() =>
            navigate("/communication")
          }
        />


        {/* =================================================
            PATRON & MATRON MANAGEMENT
        ================================================= */}

        <DashboardCard
          title="Patron & Matron Management"
          description="Manage patron and matron responsibilities, student welfare activities, supervision and related school duties."
          icon={<MdChildCare />}
          color="bg-pink-600"
          onClick={() =>
            navigate("/patron-matron")
          }
        />

      </div>


      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   PATRON DASHBOARD
========================================================= */

function PatronDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Patron Dashboard"
        subtitle="Manage student welfare, patron and matron responsibilities and school communication."
        role={primaryRole?.role_name || "Patron"}
        icon={<MdSupervisorAccount />}
      />


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* =================================================
            COMMUNICATION
        ================================================= */}

        <DashboardCard
          title="Communication"
          description="Access school communication, management messages and important welfare-related information."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() =>
            navigate("/communication")
          }
        />


        {/* =================================================
            PATRON & MATRON MANAGEMENT
        ================================================= */}

        <DashboardCard
          title="Patron & Matron Management"
          description="Manage patron and matron responsibilities, student welfare activities, supervision and related school duties."
          icon={<MdSupervisorAccount />}
          color="bg-blue-600"
          onClick={() =>
            navigate("/patron-matron")
          }
        />

      </div>


      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   GENERAL ROLE DASHBOARD
========================================================= */

function GeneralRoleDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="AfriCore ERP Dashboard"
        subtitle="Welcome to your school management dashboard."
        role={
          primaryRole?.role_name ||
          "User"
        }
        icon={<MdDashboard />}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

        <div className="flex items-center gap-4">

          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-3xl">

            <MdDashboard />

          </div>

          <div>

            <h2 className="text-xl font-bold text-gray-800">
              Welcome to AfriCore ERP
            </h2>

            <p className="text-gray-500 mt-1">
              Your account is active, but a dedicated dashboard
              for this role has not yet been configured.
            </p>

          </div>

        </div>

        <div className="mt-6">

          <button
            type="button"
            onClick={() =>
              navigate("/access-denied")
            }
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition"
          >

            <MdSecurity />

            View Access Information

          </button>

        </div>

      </div>

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


/* =========================================================
   ROLE INFORMATION
========================================================= */

function RoleInformation({
  activeRoles,
  primaryRole,
}) {

  if (
    !activeRoles ||
    activeRoles.length === 0
  ) {

    return null;

  }


  return (

    <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

      <div className="flex items-center gap-3 mb-4">

        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xl">

          <MdAdminPanelSettings />

        </div>

        <div>

          <h2 className="text-lg font-bold text-gray-800">
            Account Roles
          </h2>

          <p className="text-sm text-gray-500">
            Your selected role determines the dashboard shown here.
          </p>

        </div>

      </div>

      <div className="flex flex-wrap gap-2">

        {activeRoles.map(
          (role) => (

            <span
              key={
                role.profile_role_id ??
                role.role_id ??
                role.id
              }
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                role.is_primary
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >

              {role.role_name}

              {role.is_primary &&
                " • Primary"}

            </span>

          )
        )}

      </div>

    </div>

  );

}


export default Dashboard;