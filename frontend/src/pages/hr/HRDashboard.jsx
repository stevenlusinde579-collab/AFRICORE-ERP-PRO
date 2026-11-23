import { Link } from "react-router-dom";
import { FaFingerprint, FaComments, FaArrowRight, FaUsersCog } from "react-icons/fa";

const modules = [
  {
    title: "HR Management",
    description: "Simamia taarifa za wafanyakazi, off days, leave, attendance, biometric devices, payroll review na staff records.",
    path: "/hr-management",
    icon: FaUsersCog,
    accent: "from-blue-600 to-indigo-600",
    iconTone: "bg-blue-50 text-blue-700",
    action: "Open HR Management",
  },
  {
    title: "Communication",
    description: "Wasiliana na watumishi na wanajumuiya wa shule, fuatilia ujumbe, matangazo, mikutano na notifications.",
    path: "/communication",
    icon: FaComments,
    accent: "from-emerald-600 to-teal-600",
    iconTone: "bg-emerald-50 text-emerald-700",
    action: "Open Communication",
  },
];

export default function HRDashboard() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Human Resources Workspace</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">HR Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          Karibu kwenye kituo cha HR. Chagua sehemu unayotaka kuendelea nayo.
        </p>
      </header>

      <section aria-labelledby="hr-modules-heading" className="space-y-4">
        <div>
          <h2 id="hr-modules-heading" className="text-xl font-bold text-slate-900">HR Workspace</h2>
          <p className="mt-1 text-sm text-slate-500">Modules zinazopatikana kwenye akaunti yako.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                to={module.path}
                className="group flex min-h-[245px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${module.iconTone}`}>
                    <Icon />
                  </span>
                  <span className={`rounded-full bg-gradient-to-r ${module.accent} px-3 py-1 text-xs font-semibold text-white`}>
                    Open module
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900">{module.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{module.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                  {module.action}
                  <FaArrowRight className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
