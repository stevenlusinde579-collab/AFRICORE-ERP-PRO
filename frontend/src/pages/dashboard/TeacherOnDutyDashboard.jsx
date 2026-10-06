import React from "react";
import { useNavigate } from "react-router-dom";
import {
  MdSupervisorAccount,
  MdSchedule,
  MdAccessTime,
  MdReportProblem,
  MdAssignment,
  MdSwapHoriz,
  MdGroups,
  MdArrowForward,
  MdSecurity,
  MdCheckCircle,
} from "react-icons/md";

import { useRole } from "../../context/RoleContext";

/* =========================================================
   TEACHER ON DUTY DASHBOARD
   AFRICORE ERP PRO
========================================================= */

function TeacherOnDutyDashboard() {
  const navigate = useNavigate();

  const roleContext = useRole() || {};

  const {
    selectedRoleName = "",
    selectedRole = null,
    roles = [],
  } = roleContext;

  const activeRoles = Array.isArray(roles) ? roles : [];

  const primaryRole =
    selectedRole ||
    activeRoles.find(
      (role) =>
        role?.is_primary === true ||
        role?.isPrimary === true
    ) ||
    activeRoles[0] ||
    null;

  const roleName =
    primaryRole?.role_name ||
    primaryRole?.name ||
    selectedRoleName ||
    "Teacher on Duty";

  const dutyModules = [
    {
      title: "Duty Schedule",
      description:
        "View and manage your assigned daily duty schedule.",
      icon: MdSchedule,
      iconClass:
        "bg-blue-500/10 text-blue-400 border-blue-500/20",
      path: "/teacher-on-duty",
    },
    {
      title: "Student Supervision",
      description:
        "Monitor students and maintain proper supervision during duty.",
      icon: MdSupervisorAccount,
      iconClass:
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      path: "/teacher-on-duty",
    },
    {
      title: "Attendance & Latecomers",
      description:
        "Monitor attendance concerns and follow up latecomers.",
      icon: MdAccessTime,
      iconClass:
        "bg-amber-500/10 text-amber-400 border-amber-500/20",
      path: "/teacher-on-duty",
    },
    {
      title: "Incidents & Discipline",
      description:
        "Record and follow up incidents and discipline matters.",
      icon: MdReportProblem,
      iconClass:
        "bg-red-500/10 text-red-400 border-red-500/20",
      path: "/teacher-on-duty",
    },
    {
      title: "Duty Report",
      description:
        "Prepare and review the daily teacher-on-duty report.",
      icon: MdAssignment,
      iconClass:
        "bg-purple-500/10 text-purple-400 border-purple-500/20",
      path: "/teacher-on-duty",
    },
    {
      title: "Duty Handover",
      description:
        "Pass important duty information to the next responsible staff.",
      icon: MdSwapHoriz,
      iconClass:
        "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      path: "/teacher-on-duty",
    },
    {
      title: "Communication",
      description:
        "Access school communication and important duty messages.",
      icon: MdGroups,
      iconClass:
        "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      path: "/communication",
    },
  ];

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="p-4 sm:p-6 lg:p-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950 shadow-2xl">

          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative p-6 sm:p-8">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-4">

                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-400">

                  <MdSupervisorAccount size={36} />

                </div>

                <div>

                  <div className="mb-2 flex flex-wrap items-center gap-2">

                    <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-300">
                      AfriCore ERP
                    </span>

                    <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Duty Active
                    </span>

                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Teacher on Duty Dashboard
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                    Daily duty management, student supervision,
                    attendance monitoring and school safety.
                  </p>

                </div>
              </div>

              {/* ACTIVE ROLE */}

              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-5 py-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <MdSecurity size={22} />
                  </div>

                  <div>

                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Active Role
                    </p>

                    <p className="mt-1 text-sm font-semibold text-white">
                      {roleName}
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            SECTION TITLE
        ================================================= */}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Duty Management
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select a duty function to continue.
            </p>

          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MdCheckCircle
              size={17}
              className="text-emerald-400"
            />
            <span>School supervision tools</span>
          </div>

        </div>

        {/* =================================================
            DUTY MODULES
        ================================================= */}

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

          {dutyModules.map((module) => {

            const Icon = module.icon;

            return (
              <button
                key={module.title}
                type="button"
                onClick={() => navigate(module.path)}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-left shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-900 hover:shadow-2xl"
              >

                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/5 blur-2xl transition-all group-hover:bg-blue-500/10" />

                <div className="relative">

                  <div className="flex items-start justify-between gap-4">

                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl border ${module.iconClass}`}
                    >
                      <Icon size={25} />
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-600 transition-all group-hover:border-blue-500/30 group-hover:bg-blue-500/10 group-hover:text-blue-400">
                      <MdArrowForward size={20} />
                    </div>

                  </div>

                  <h3 className="mt-5 text-base font-bold text-white">
                    {module.title}
                  </h3>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">
                    {module.description}
                  </p>

                  <div className="mt-5 border-t border-slate-800 pt-4">

                    <span className="text-xs font-semibold text-slate-600 transition-colors group-hover:text-blue-400">
                      Open Module
                    </span>

                  </div>

                </div>

              </button>
            );
          })}

        </div>

        {/* =================================================
            ROLE INFORMATION
        ================================================= */}

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">

          <div className="flex items-start gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <MdSecurity size={23} />
            </div>

            <div className="min-w-0 flex-1">

              <h3 className="font-bold text-white">
                Role & Access
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Your current active role determines the
                Teacher on Duty functions available to you.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">

                {activeRoles.length > 0 ? (
                  activeRoles.map((role, index) => {

                    const name =
                      role?.role_name ||
                      role?.name ||
                      "Role";

                    const isPrimary =
                      role?.is_primary === true ||
                      role?.isPrimary === true;

                    return (
                      <span
                        key={
                          role?.id ||
                          role?.role_id ||
                          `${name}-${index}`
                        }
                        className={
                          isPrimary
                            ? "rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300"
                            : "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-500"
                        }
                      >
                        {name}

                        {isPrimary && (
                          <span className="ml-2 text-blue-400">
                            Primary
                          </span>
                        )}
                      </span>
                    );
                  })
                ) : (
                  <span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300">
                    {roleName}
                  </span>
                )}

              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export default TeacherOnDutyDashboard;