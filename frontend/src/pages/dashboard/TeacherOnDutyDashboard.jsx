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
        subtitle="Daily duty management and school supervision."
        role={primaryRole.role_name}
        icon={<MdSupervisorAccount />}
      />


      {/* =================================================
          DUTY RESPONSIBILITIES
      ================================================= */}

      <div className="mb-6">

        <h2 className="text-xl font-bold text-gray-800">
          Duty Responsibilities
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Manage and monitor your daily responsibilities while on duty.
        </p>

      </div>


      {/* =================================================
          DUTY MODULES
      ================================================= */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">


        {/* =================================================
            DUTY SCHEDULE
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/teacher-on-duty")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >

          <div className="flex items-start gap-4">

            <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center text-2xl shrink-0">

              <MdSchedule />

            </div>

            <div className="flex-1">

              <h3 className="text-lg font-bold text-gray-800">
                Duty Schedule
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                View daily duty schedule.
              </p>

            </div>

          </div>

        </button>


        {/* =================================================
            STUDENT SUPERVISION
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/teacher-on-duty")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >

          <div className="flex items-start gap-4">

            <div className="w-14 h-14 rounded-xl bg-green-600 text-white flex items-center justify-center text-2xl shrink-0">

              <MdSupervisorAccount />

            </div>

            <div className="flex-1">

              <h3 className="text-lg font-bold text-gray-800">
                Student Supervision
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Monitor students during duty.
              </p>

            </div>

          </div>

        </button>


        {/* =================================================
            ATTENDANCE & LATECOMERS
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/teacher-on-duty")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >

          <div className="flex items-start gap-4">

            <div className="w-14 h-14 rounded-xl bg-orange-500 text-white flex items-center justify-center text-2xl shrink-0">

              <MdAccessTime />

            </div>

            <div className="flex-1">

              <h3 className="text-lg font-bold text-gray-800">
                Attendance & Latecomers
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Follow up attendance issues and latecomers.
              </p>

            </div>

          </div>

        </button>


        {/* =================================================
            INCIDENTS & DISCIPLINE
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/teacher-on-duty")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >

          <div className="flex items-start gap-4">

            <div className="w-14 h-14 rounded-xl bg-red-600 text-white flex items-center justify-center text-2xl shrink-0">

              <MdReportProblem />

            </div>

            <div className="flex-1">

              <h3 className="text-lg font-bold text-gray-800">
                Incidents & Discipline
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Record and follow up incidents and discipline matters.
              </p>

            </div>

          </div>

        </button>


        {/* =================================================
            DUTY REPORT
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/teacher-on-duty")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >

          <div className="flex items-start gap-4">

            <div className="w-14 h-14 rounded-xl bg-purple-600 text-white flex items-center justify-center text-2xl shrink-0">

              <MdAssignment />

            </div>

            <div className="flex-1">

              <h3 className="text-lg font-bold text-gray-800">
                Duty Report
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Prepare daily duty report.
              </p>

            </div>

          </div>

        </button>


        {/* =================================================
            DUTY HANDOVER
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/teacher-on-duty")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >

          <div className="flex items-start gap-4">

            <div className="w-14 h-14 rounded-xl bg-teal-600 text-white flex items-center justify-center text-2xl shrink-0">

              <MdSwapHoriz />

            </div>

            <div className="flex-1">

              <h3 className="text-lg font-bold text-gray-800">
                Duty Handover
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Handover important duty information.
              </p>

            </div>

          </div>

        </button>


        {/* =================================================
            COMMUNICATION
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/communication")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >

          <div className="flex items-start gap-4">

            <div className="w-14 h-14 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl shrink-0">

              <MdGroups />

            </div>

            <div className="flex-1">

              <h3 className="text-lg font-bold text-gray-800">
                Communication
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Access school communication, management messages
                and important duty-related information.
              </p>

            </div>

          </div>

        </button>


      </div>


      {/* =================================================
          ROLE INFORMATION
      ================================================= */}

      <RoleInformation
        activeRoles={activeRoles}
        primaryRole={primaryRole}
      />

    </div>

  );

}


export default TeacherOnDutyDashboard;