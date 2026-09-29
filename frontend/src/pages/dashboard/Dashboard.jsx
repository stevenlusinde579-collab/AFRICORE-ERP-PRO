import { useEffect, useState } from "react";
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
import { useRole } from "../../context/RoleContext";
import { useSchool } from "../../context/SchoolContext";

import StudentAnalytics from "./StudentAnalytics";


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

    teachingStaff: 0,

    nonStaff: 0,

    totalStaff: 0,

    classes: 0,

  });


  const [recentStudents, setRecentStudents] =
    useState([]);


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


  /* =======================================================
     LOAD SUPER ADMIN DASHBOARD DATA
  ======================================================= */

  const loadDashboardData = async () => {

    try {

      /* ---------------------------------------------------
         STUDENTS
      --------------------------------------------------- */

      const {
        count: studentCount,
        error: studentError,
      } = await supabase
        .from("students")
        .select(
          "*",
          {
            count: "exact",
            head: true,
          }
        );

      if (studentError) {

        console.log(
          "Student Count Error:",
          studentError
        );

      }


      /* ---------------------------------------------------
         TEACHING STAFF
      --------------------------------------------------- */

      const {
        count: teachingStaffCount,
        error: teachingStaffError,
      } = await supabase
        .from("teachers")
        .select(
          "*",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "staff_type",
          "Staff"
        );

      if (teachingStaffError) {

        console.log(
          "Teaching Staff Count Error:",
          teachingStaffError
        );

      }


      /* ---------------------------------------------------
         NON-STAFF
      --------------------------------------------------- */

      const {
        count: nonStaffCount,
        error: nonStaffError,
      } = await supabase
        .from("teachers")
        .select(
          "*",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "staff_type",
          "Non-Staff"
        );

      if (nonStaffError) {

        console.log(
          "Non-Staff Count Error:",
          nonStaffError
        );

      }


      /* ---------------------------------------------------
         TOTAL STAFF + NON-STAFF
      --------------------------------------------------- */

      const {
        count: totalStaffCount,
        error: totalStaffError,
      } = await supabase
        .from("teachers")
        .select(
          "*",
          {
            count: "exact",
            head: true,
          }
        );

      if (totalStaffError) {

        console.log(
          "Total Staff Count Error:",
          totalStaffError
        );

      }


      /* ---------------------------------------------------
         CLASSES
      --------------------------------------------------- */

      const {
        count: classCount,
        error: classError,
      } = await supabase
        .from("classes")
        .select(
          "*",
          {
            count: "exact",
            head: true,
          }
        );

      if (classError) {

        console.log(
          "Class Count Error:",
          classError
        );

      }


      /* ---------------------------------------------------
         SET DASHBOARD STATS
      --------------------------------------------------- */

      setStats({

        students:
          studentCount || 0,

        teachingStaff:
          teachingStaffCount || 0,

        nonStaff:
          nonStaffCount || 0,

        totalStaff:
          totalStaffCount || 0,

        classes:
          classCount || 0,

      });


      /* ---------------------------------------------------
         RECENT STUDENTS
      --------------------------------------------------- */

      const {
        data: recent,
        error: recentError,
      } = await supabase
        .from("students")
        .select(
          "first_name,last_name,admission_number,created_at"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(5);

      if (recentError) {

        console.log(
          "Recent Students Error:",
          recentError
        );

      } else {

        setRecentStudents(
          recent || []
        );

      }

    } catch (error) {

      console.log(
        "Dashboard Data Error:",
        error
      );

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

    if (
      dashboardType ===
      "super_admin"
    ) {

      loadDashboardData();

    }

  }, [
    roleContextLoading,
    selectedRoleId,
    selectedProfileRoleId,
    selectedRoleName,
    currentRoleName,
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
        stats={stats}
        recentStudents={recentStudents}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
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

      <HeadmasterDashboard
        navigate={navigate}
        primaryRole={primaryRole}
        activeRoles={activeRoles}
        currentUser={currentUser}
      />

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
  stats,
  recentStudents,
  primaryRole,
  activeRoles,
}) {

  const cards = [

    {
      title: "Total Students",
      value: stats.students,
      icon: <MdPeople />,
      color: "bg-blue-600",
    },

    {
      title: "Teaching Staff",
      value: stats.teachingStaff,
      icon: <MdSchool />,
      color: "bg-green-600",
    },

    {
      title: "Non-Staff",
      value: stats.nonStaff,
      icon: <MdWork />,
      color: "bg-orange-600",
    },

    {
      title: "Total Staff & Non-Staff",
      value: stats.totalStaff,
      icon: <MdGroups />,
      color: "bg-cyan-600",
    },

    {
      title: "Total Classes",
      value: stats.classes,
      icon: <MdClass />,
      color: "bg-purple-600",
    },

    {
      title: "School Balance",
      value: "TZS 0",
      icon: <MdAccountBalance />,
      color: "bg-yellow-600",
    },

    {
      title: "Pending Results",
      value: "0",
      icon: <MdAssignment />,
      color: "bg-red-600",
    },

    {
      title: "AI Analysis",
      value: "Ready",
      icon: <MdPsychology />,
      color: "bg-indigo-600",
    },

  ];


  return (

    <div>

      <div className="mb-8">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <h1 className="text-3xl font-bold text-gray-800">
              AfriCore ERP PRO Dashboard
            </h1>

            <p className="text-gray-600 mt-2">
              Welcome back, Admin. Here's your school overview.
            </p>

          </div>

          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">

            {primaryRole?.role_name || "Super Admin"}

          </div>

        </div>

      </div>


      {/* STAFF SUMMARY */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

        <div className="bg-gradient-to-r from-green-600 to-green-500 text-white rounded-2xl shadow-lg p-6">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-green-100 text-sm font-medium">
                Teaching Staff
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {stats.teachingStaff}
              </h2>

              <p className="text-green-100 text-sm mt-2">
                Teachers / Teaching Personnel
              </p>

            </div>

            <div className="bg-white/20 p-4 rounded-2xl text-4xl">
              <MdSchool />
            </div>

          </div>

        </div>


        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-2xl shadow-lg p-6">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-orange-100 text-sm font-medium">
                Non-Staff
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {stats.nonStaff}
              </h2>

              <p className="text-orange-100 text-sm mt-2">
                Non-Teaching Personnel
              </p>

            </div>

            <div className="bg-white/20 p-4 rounded-2xl text-4xl">
              <MdWork />
            </div>

          </div>

        </div>


        <div className="bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-2xl shadow-lg p-6">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-cyan-100 text-sm font-medium">
                Total Staff & Non-Staff
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {stats.totalStaff}
              </h2>

              <p className="text-cyan-100 text-sm mt-2">
                All school personnel
              </p>

            </div>

            <div className="bg-white/20 p-4 rounded-2xl text-4xl">
              <MdGroups />
            </div>

          </div>

        </div>

      </div>


      {/* GENERAL STATS */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {cards.map(
          (card, index) => (

            <div
              key={index}
              className="bg-white rounded-xl shadow p-6 flex items-center justify-between"
            >

              <div>

                <p className="text-gray-500">
                  {card.title}
                </p>

                <h2 className="text-3xl font-bold mt-2">
                  {card.value}
                </h2>

              </div>

              <div
                className={`${card.color} text-white text-3xl p-4 rounded-full`}
              >

                {card.icon}

              </div>

            </div>

          )
        )}

      </div>


      {/* QUICK ACTIONS + RECENT ACTIVITIES */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">

        <div className="bg-white rounded-xl shadow p-6">

          <h2 className="text-xl font-semibold mb-4">
            Quick Actions
          </h2>

          <button
            onClick={() =>
              navigate("/students/add")
            }
            className="w-full flex items-center gap-2 bg-blue-600 text-white p-3 rounded-lg mb-3 hover:bg-blue-700 transition"
          >

            <MdAdd />

            Add Student

          </button>

          <button
            onClick={() =>
              navigate("/examination")
            }
            className="w-full flex items-center gap-2 bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition"
          >

            <MdUpload />

            Upload Exam

          </button>

        </div>


        <div className="bg-white rounded-xl shadow p-6">

          <h2 className="text-xl font-semibold">
            Recent Activities
          </h2>

          <div className="mt-4 space-y-3">

            {
              recentStudents.length === 0

                ?

                <p className="text-gray-500">
                  No recent activities.
                </p>

                :

                recentStudents.map(
                  (student, index) => (

                    <div
                      key={
                        student.admission_number ||
                        index
                      }
                      className="border-b pb-3"
                    >

                      <p className="font-semibold">
                        New student registered
                      </p>

                      <p>
                        {student.first_name}{" "}
                        {student.last_name}
                      </p>

                      <p className="text-sm text-gray-400">
                        Admission No:{" "}
                        {student.admission_number}
                      </p>

                    </div>

                  )
                )
            }

          </div>

        </div>

      </div>


      {/* MULTI ROLE INFORMATION */}

      {activeRoles.length > 1 && (

        <div className="mt-8 bg-white rounded-xl shadow p-6">

          <div className="flex items-center gap-3 mb-4">

            <MdAdminPanelSettings className="text-2xl text-blue-600" />

            <div>

              <h2 className="text-xl font-semibold text-gray-800">
                Your System Roles
              </h2>

              <p className="text-sm text-gray-500">
                Your selected role controls this dashboard.
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

      )}


      {/* STUDENT ANALYTICS */}

      <div className="mt-8">

        <StudentAnalytics />

      </div>

    </div>

  );

}


/* =========================================================
   HEADMASTER DASHBOARD
========================================================= */

function HeadmasterDashboard({
  navigate,
  primaryRole,
  activeRoles,
}) {

  return (

    <div>

      <DashboardHeader
        title="Headmaster Dashboard"
        subtitle="School leadership and overall institutional overview."
        role={primaryRole.role_name}
        icon={<MdSupervisorAccount />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <DashboardCard
          title="Students"
          description="View and manage student information."
          icon={<MdPeople />}
          color="bg-blue-600"
          onClick={() => navigate("/students")}
        />

        <DashboardCard
          title="Staff & Non-Staff"
          description="View teaching staff and non-staff information."
          icon={<MdGroups />}
          color="bg-green-600"
          onClick={() => navigate("/teachers")}
        />

        <DashboardCard
          title="Classes"
          description="Review school classes and academic structure."
          icon={<MdClass />}
          color="bg-purple-600"
          onClick={() => navigate("/classes")}
        />

        <DashboardCard
          title="Examination"
          description="Review examinations and examination progress."
          icon={<MdAssignment />}
          color="bg-red-600"
          onClick={() => navigate("/examination")}
        />

        <DashboardCard
          title="Communication"
          description="Access school communication and management messages."
          icon={<MdGroups />}
          color="bg-indigo-600"
          onClick={() => navigate("/communication")}
        />

        <DashboardCard
          title="AI Analysis"
          description="Access available academic intelligence tools."
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
          onClick={() => navigate("/finance")}
        />

        <DashboardCard
          title="Financial Reports"
          description="Review available financial information."
          icon={<MdAssessment />}
          color="bg-purple-600"
          onClick={() => navigate("/finance")}
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