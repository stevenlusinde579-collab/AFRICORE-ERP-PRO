import { useMemo } from "react";
import { NavLink } from "react-router-dom";

import {
  FaTachometerAlt,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaBook,
  FaSchool,
  FaCalendarAlt,
  FaClipboardList,
  FaCog,
  FaMoneyBillWave,
  FaComments,
  FaRobot,
  FaHandHoldingHeart,
  FaUserShield,
  FaChartBar,
  FaPrint,
  FaBed,
  FaBuilding,
} from "react-icons/fa";

import { useRole } from "../../context/RoleContext";


/* =========================================================
   NORMALIZE ROLE
========================================================= */

const normalizeRole = (roleName) => {
  if (!roleName) {
    return "";
  }

  return String(roleName)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};


/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar() {
  const {
    loadingRoles = true,
    selectedRoleName = "",
    selectedRoleId = null,
    isSuperAdmin = false,
    selectedRoleIsSuperAdmin = false,
    roles: availableRoles = [],
  } = useRole();


  /* =======================================================
     CURRENT ROLE
  ======================================================= */

  const currentRole = normalizeRole(selectedRoleName);


  /* =======================================================
     SUPER ADMIN DETECTION
  ======================================================= */

  const superAdmin =
    Boolean(isSuperAdmin) ||
    Boolean(selectedRoleIsSuperAdmin) ||
    Number(selectedRoleId) === 1 ||
    currentRole === "super admin" ||
    currentRole === "super administrator";


  /* =======================================================
     ALL POSSIBLE MENU ITEMS
  ======================================================= */

  const allMenu = useMemo(() => [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <FaTachometerAlt />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher",
        "accountant",
        "secretary",
        "social welfare manager",
        "parent",
        "student",
        "class teacher",
        "teacher on duty",
        "matron",
        "patron",
        "security officer",
        "other employee"
      ]
    },

    /* SCHOOL MANAGEMENT — SUPER ADMIN ONLY */
    {
      name: "School Management",
      path: "/school-management",
      icon: <FaBuilding />,
      roles: ["super admin"],
      superAdminOnly: true
    },

    {
      name: "Staff & Non-Staff",
      path: "/teachers",
      icon: <FaChalkboardTeacher />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "secretary"
      ]
    },

    {
      name: "Students",
      path: "/students",
      icon: <FaUserGraduate />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher",
        "secretary"
      ]
    },

    {
      name: "Classes",
      path: "/classes",
      icon: <FaSchool />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher",
        "secretary"
      ]
    },

    {
      name: "Subjects",
      path: "/subjects",
      icon: <FaBook />,
      roles: [
        "super admin",
        "headmaster",
        "academic master",
        "subject teacher"
      ]
    },

    {
      name: "Timetable",
      path: "/timetable",
      icon: <FaCalendarAlt />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher"
      ]
    },

    {
      name: "Examination",
      path: "/examination",
      icon: <FaClipboardList />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher"
      ]
    },

    {
      name: "Printing Unit",
      path: "/examination/printing-unit",
      icon: <FaPrint />,
      roles: [
        "super admin",
        "headmaster",
        "academic master",
        "secretary"
      ]
    },

    {
      name: "Finance",
      path: "/finance",
      icon: <FaMoneyBillWave />,
      roles: [
        "super admin",
        "headmaster",
        "accountant"
      ]
    },

    {
      name: "Social Welfare",
      path: "/social-welfare",
      icon: <FaHandHoldingHeart />,
      roles: [
        "super admin",
        "headmaster",
        "social welfare manager"
      ]
    },

    {
      name: "Patron & Matron Management",
      path: "/patron-matron",
      icon: <FaBed />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "patron",
        "matron"
      ]
    },

    {
      name: "Teacher on Duty",
      path: "/teacher-on-duty",
      icon: <FaUserShield />,
      roles: [
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher",
        "class teacher",
        "teacher on duty"
      ]
    },

    {
      name: "Communication",
      path: "/communication",
      icon: <FaComments />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher",
        "accountant",
        "secretary",
        "social welfare manager",
        "parent",
        "student",
        "class teacher",
        "teacher on duty",
        "matron",
        "patron",
        "security officer",
        "other employee"
      ]
    },

    {
      name: "AI",
      path: "/ai",
      icon: <FaRobot />,
      roles: [
        "super admin",
        "headmaster",
        "academic master",
        "subject teacher"
      ]
    },

    {
      name: "Reports",
      path: "/reports",
      icon: <FaChartBar />,
      roles: [
        "super admin",
        "headmaster",
        "academic master",
        "accountant"
      ]
    },

    {
      name: "Settings",
      path: "/settings",
      icon: <FaCog />,
      roles: [
        "super admin",
        "headmaster",
        "deputy headmaster",
        "academic master",
        "subject teacher",
        "accountant",
        "secretary",
        "social welfare manager",
        "parent",
        "student",
        "class teacher",
        "teacher on duty",
        "matron",
        "patron",
        "security officer",
        "other employee"
      ]
    },

  ], []);


  /* =======================================================
     VISIBLE MENU
  ======================================================= */

  const visibleMenu = useMemo(() => {
    if (superAdmin) {
      return allMenu;
    }

    if (!currentRole) {
      return [];
    }

    return allMenu.filter((item) => {
      if (item.superAdminOnly) {
        return false;
      }

      return item.roles.includes(currentRole);
    });
  }, [
    allMenu,
    currentRole,
    superAdmin,
  ]);


  /* =======================================================
     LOADING
  ======================================================= */

  if (loadingRoles) {
    return (
      <aside className="w-64 min-h-screen bg-slate-900 text-white p-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            AfriCore ERP PRO
          </h1>

          <p className="text-sm text-gray-400">
            School Management System
          </p>
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-10 bg-slate-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </aside>
    );
  }


  /* =======================================================
     NO ROLE
  ======================================================= */

  if (!selectedRoleName && !superAdmin) {
    return (
      <aside className="w-64 min-h-screen bg-slate-900 text-white p-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            AfriCore ERP PRO
          </h1>

          <p className="text-sm text-gray-400">
            School Management System
          </p>
        </div>

        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <FaUserShield />

            <span className="font-semibold">
              No Role Assigned
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Your account does not have an active system role.
          </p>
        </div>
      </aside>
    );
  }


  /* =======================================================
     DISPLAY ROLE
  ======================================================= */

  const displayRole = superAdmin
    ? "Super Admin"
    : selectedRoleName;


  /* =======================================================
     RETURN SIDEBAR
  ======================================================= */

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white p-5">

      {/* BRAND */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          AfriCore ERP PRO
        </h1>

        <p className="text-sm text-gray-400">
          School Management System
        </p>
      </div>


      {/* CURRENT ROLE */}
      <div className="mb-6 bg-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <FaUserShield />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-gray-400">
              Current Role
            </p>

            <p className="text-sm font-semibold text-white truncate">
              {displayRole}
            </p>
          </div>
        </div>
      </div>


      {/* NAVIGATION */}
      <nav className="space-y-2">
        {visibleMenu.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3
              px-4 py-3
              rounded-lg
              transition-all
              duration-200
              ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-300 hover:bg-slate-800 hover:text-white"
              }
            `}
          >
            <span className="text-lg">
              {item.icon}
            </span>

            <span>
              {item.name}
            </span>
          </NavLink>
        ))}
      </nav>


      {/* MULTI ROLE */}
      {availableRoles.length > 1 && (
        <div className="mt-8 pt-5 border-t border-slate-800">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
            Active Roles
          </p>

          <div className="space-y-2">
            {availableRoles.map((role) => {
              const roleName =
                role.role_name ??
                role.name ??
                "";

              const isPrimary = role.is_primary === true;

              const profileRoleId =
                role.profileRoleId ??
                role.profile_role_id ??
                role.id ??
                role.role_id;

              return (
                <div
                  key={profileRoleId}
                  className={`
                    text-xs
                    px-3
                    py-2
                    rounded-lg
                    ${
                      isPrimary
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-slate-800 text-gray-400"
                    }
                  `}
                >
                  {roleName}

                  {isPrimary && " • Primary"}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </aside>
  );
}

export default Sidebar;