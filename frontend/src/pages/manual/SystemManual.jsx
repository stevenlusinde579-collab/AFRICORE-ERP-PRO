
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaArrowLeft,
    FaBookOpen,
    FaGraduationCap,
    FaUsers,
    FaChalkboardTeacher,
    FaCalendarAlt,
    FaClipboardCheck,
    FaMoneyBillWave,
    FaComments,
    FaChartLine,
    FaRobot,
    FaShieldAlt,
    FaUserCog,
    FaCheckCircle,
    FaExclamationCircle,
    FaLanguage,
    FaPrint,
    FaCog,
    FaSearch,
} from "react-icons/fa";

const manualContent = {
    en: {
        back: "Back to Home",
        title: "AfriCore ERP System Manual",
        subtitle:
            "A practical guide to navigating the system, understanding its modules and using available functions responsibly.",
        language: "Kiswahili",
        search: "Search this manual...",
        overviewTitle: "Getting Started",
        overview:
            "Sign in using your authorized account. After signing in, use the navigation menu to open the modules available to your account. The options you see depend on your assigned role, permissions and school configuration.",
        modulesTitle: "System Modules",
        modules: [
            {
                icon: "students",
                title: "Student Management",
                description:
                    "Use the available student screens to view student records, profiles and class-related information. Creating or editing records depends on your access permissions.",
            },
            {
                icon: "teachers",
                title: "Teachers and Staff",
                description:
                    "Use the available staff and teacher screens to access staff information and related responsibilities. Available actions depend on your assigned access.",
            },
            {
                icon: "academics",
                title: "Academic Management",
                description:
                    "Work with available academic structures, classes, subjects and academic-year settings. Check the selected academic year before working with records.",
            },
            {
                icon: "timetable",
                title: "Timetable and Scheduling",
                description:
                    "Use the timetable and scheduling screens available to your role. Some timetable management functions are restricted to authorized administrative and academic roles.",
            },
            {
                icon: "exams",
                title: "Examinations and Results",
                description:
                    "The examination workflow includes creating examinations, uploading papers, classifying questions, completing approvals, entering marks and reviewing results.",
            },
            {
                icon: "ai",
                title: "AI Examination Analysis",
                description:
                    "Where authorized, use the AI examination analysis tools to process examination papers and review the resulting analysis. Review AI-generated results carefully before relying on them.",
            },
            {
                icon: "finance",
                title: "Finance Management",
                description:
                    "Access available financial records and management screens according to your permissions. Financial information should only be viewed or changed by authorized users.",
            },
            {
                icon: "communication",
                title: "Communication",
                description:
                    "Use available communication screens for messages and other supported communication functions. Access to individual functions can differ by role and permission.",
            },
            {
                icon: "reports",
                title: "Reports and Analytics",
                description:
                    "Use available reports and analysis screens to review school information. The data shown depends on the selected filters and your access.",
            },
            {
                icon: "welfare",
                title: "Student Welfare",
                description:
                    "Use the welfare or Patron/Matron screens available to your account to work with the information and responsibilities supported by those modules.",
            },
            {
                icon: "printing",
                title: "Printing Documents",
                description:
                    "Use the available printing screens to prepare supported documents. Printing access may be limited to designated roles and permissions.",
            },
            {
                icon: "settings",
                title: "Settings",
                description:
                    "Open the available settings screens to review supported configuration options. Change settings only when you are authorized to do so.",
            },
        ],
        examTitle: "Examination Workflow",
        examSteps: [
            "Create an examination, if your account is authorized.",
            "Upload the examination paper.",
            "Classify questions and review the paper structure.",
            "Complete the required examination approval stages.",
            "Enter marks when the examination is eligible for mark entry.",
            "Review results and available analysis.",
        ],
        accessTitle: "Roles, Permissions and Security",
        accessIntro:
            "AfriCore ERP uses role-based access and permissions. Not every user can open every module or perform every action.",
        accessPoints: [
            "Super Admin access follows the system's configured administrative rules.",
            "Headmaster, Deputy Headmaster and Academic Master functions depend on the relevant route restrictions and permissions.",
            "Subject Teachers and Class Teachers can access only the functions permitted to their accounts.",
            "Other staff roles, including Secretary where applicable, may have access to selected functions.",
            "If a page or action is unavailable, confirm your assigned role and permissions with your system administrator.",
        ],
        tipsTitle: "Good Practice",
        tips: [
            "Confirm the school and academic year before entering or reviewing records.",
            "Check student, subject and examination details before saving changes.",
            "Follow the required approval process before entering examination marks.",
            "Keep your login credentials private and sign out when using a shared computer.",
            "Report unexpected errors to your system administrator instead of repeatedly submitting the same operation.",
            "Review AI-generated examination analysis before using it for academic decisions.",
        ],
        warningTitle: "Important",
        warning:
            "This manual explains the system's main areas and general workflows. Exact screens and actions can vary according to the deployed version, school configuration, role and permissions.",
        footer: "AfriCore ERP • System User Guide",
    },
    sw: {
        back: "Rudi Mwanzo",
        title: "Mwongozo wa Mfumo wa AfriCore ERP",
        subtitle:
            "Mwongozo wa kutumia mfumo, kuelewa moduli zake na kutumia huduma zinazopatikana kwa usahihi.",
        language: "English",
        search: "Tafuta kwenye mwongozo huu...",
        overviewTitle: "Jinsi ya Kuanza",
        overview:
            "Ingia kwa kutumia akaunti uliyoidhinishwa. Baada ya kuingia, tumia menyu kufungua moduli zinazopatikana kwa akaunti yako. Menyu na vitendo unavyoweza kufanya hutegemea jukumu, ruhusa na mipangilio ya shule yako.",
        modulesTitle: "Moduli za Mfumo",
        modules: [
            {
                icon: "students",
                title: "Usimamizi wa Wanafunzi",
                description:
                    "Tumia kurasa za wanafunzi zinazopatikana kuona taarifa, wasifu na taarifa zinazohusiana na madarasa. Kuongeza au kuhariri taarifa hutegemea ruhusa zako.",
            },
            {
                icon: "teachers",
                title: "Walimu na Watumishi",
                description:
                    "Tumia kurasa za walimu na watumishi kuona taarifa zao na majukumu yanayohusiana. Vitendo vinavyopatikana hutegemea ruhusa ulizopewa.",
            },
            {
                icon: "academics",
                title: "Usimamizi wa Taaluma",
                description:
                    "Fanya kazi na madarasa, masomo na mipangilio ya mwaka wa masomo inayopatikana. Hakikisha mwaka wa masomo uliochaguliwa ni sahihi kabla ya kushughulikia taarifa.",
            },
            {
                icon: "timetable",
                title: "Ratiba na Upangaji",
                description:
                    "Tumia kurasa za ratiba zinazopatikana kwa jukumu lako. Baadhi ya shughuli za usimamizi wa ratiba zimewekewa ruhusa maalumu.",
            },
            {
                icon: "exams",
                title: "Mitihani na Matokeo",
                description:
                    "Mchakato wa mitihani unajumuisha kuunda mtihani, kupakia karatasi, kupanga maswali, kukamilisha uidhinishaji, kuingiza alama na kukagua matokeo.",
            },
            {
                icon: "ai",
                title: "Uchambuzi wa Mitihani kwa AI",
                description:
                    "Ikiwa umeidhinishwa, tumia zana za AI kuchambua karatasi za mitihani na kukagua matokeo ya uchambuzi. Hakiki matokeo ya AI kabla ya kuyatumia.",
            },
            {
                icon: "finance",
                title: "Usimamizi wa Fedha",
                description:
                    "Fungua taarifa na kurasa za fedha zinazopatikana kulingana na ruhusa zako. Taarifa za kifedha zinapaswa kushughulikiwa na watumiaji walioidhinishwa pekee.",
            },
            {
                icon: "communication",
                title: "Mawasiliano",
                description:
                    "Tumia kurasa za mawasiliano zinazopatikana kwa ujumbe na huduma nyingine zinazoungwa mkono. Upatikanaji wa kila huduma unaweza kutofautiana kulingana na ruhusa.",
            },
            {
                icon: "reports",
                title: "Ripoti na Uchambuzi",
                description:
                    "Tumia kurasa za ripoti na uchambuzi zinazopatikana kukagua taarifa za shule. Taarifa zinazoonekana hutegemea vichujio na ruhusa zako.",
            },
            {
                icon: "welfare",
                title: "Ustawi wa Wanafunzi",
                description:
                    "Tumia kurasa za ustawi au Patron/Matron zinazopatikana kwa akaunti yako kushughulikia taarifa na majukumu yanayoungwa mkono na moduli hizo.",
            },
            {
                icon: "printing",
                title: "Uchapishaji wa Nyaraka",
                description:
                    "Tumia kurasa za uchapishaji zinazopatikana kuandaa nyaraka zinazoungwa mkono. Upatikanaji unaweza kuwekewa mipaka ya majukumu na ruhusa.",
            },
            {
                icon: "settings",
                title: "Mipangilio",
                description:
                    "Fungua mipangilio inayopatikana ili kukagua chaguo za usanidi zinazoungwa mkono. Badilisha mipangilio tu ikiwa umeidhinishwa.",
            },
        ],
        examTitle: "Mchakato wa Mitihani",
        examSteps: [
            "Unda mtihani ikiwa akaunti yako imeidhinishwa.",
            "Pakia karatasi ya mtihani.",
            "Panga maswali na kagua muundo wa karatasi.",
            "Kamilisha hatua zinazohitajika za uidhinishaji.",
            "Ingiza alama baada ya mtihani kuruhusiwa kuingiziwa alama.",
            "Kagua matokeo na uchambuzi unaopatikana.",
        ],
        accessTitle: "Majukumu, Ruhusa na Usalama",
        accessIntro:
            "AfriCore ERP hutumia majukumu na ruhusa kudhibiti upatikanaji. Si kila mtumiaji anaweza kufungua kila moduli au kufanya kila kitendo.",
        accessPoints: [
            "Upatikanaji wa Super Admin hufuata kanuni za kiutawala zilizowekwa kwenye mfumo.",
            "Huduma za Headmaster, Deputy Headmaster na Academic Master hutegemea vizuizi vya kurasa na ruhusa husika.",
            "Subject Teachers na Class Teachers wanaweza kutumia huduma zilizoidhinishwa kwa akaunti zao.",
            "Majukumu mengine ya watumishi, ikiwemo Secretary pale inapohusika, yanaweza kuwa na huduma maalumu.",
            "Ikiwa ukurasa au kitendo hakipatikani, thibitisha jukumu na ruhusa zako kwa msimamizi wa mfumo.",
        ],
        tipsTitle: "Mambo ya Kuzingatia",
        tips: [
            "Thibitisha shule na mwaka wa masomo kabla ya kuingiza au kukagua taarifa.",
            "Kagua taarifa za mwanafunzi, somo na mtihani kabla ya kuhifadhi mabadiliko.",
            "Fuata hatua za uidhinishaji kabla ya kuingiza alama za mitihani.",
            "Linda taarifa zako za kuingia na toka kwenye mfumo unapomaliza kutumia kompyuta ya pamoja.",
            "Ripoti hitilafu zisizotarajiwa kwa msimamizi badala ya kutuma operesheni ileile mara nyingi.",
            "Kagua uchambuzi wa mitihani uliotengenezwa na AI kabla ya kuutumia katika maamuzi ya kitaaluma.",
        ],
        warningTitle: "Muhimu",
        warning:
            "Mwongozo huu unaeleza maeneo makuu na taratibu za jumla za mfumo. Kurasa na vitendo halisi vinaweza kutofautiana kulingana na toleo lililowekwa, mipangilio ya shule, jukumu na ruhusa.",
        footer: "AfriCore ERP • Mwongozo wa Mtumiaji",
    },
};

const moduleIcons = {
    students: FaUsers,
    teachers: FaChalkboardTeacher,
    academics: FaGraduationCap,
    timetable: FaCalendarAlt,
    exams: FaClipboardCheck,
    ai: FaRobot,
    finance: FaMoneyBillWave,
    communication: FaComments,
    reports: FaChartLine,
    welfare: FaShieldAlt,
    printing: FaPrint,
    settings: FaCog,
};

export default function SystemManual() {
    const navigate = useNavigate();
    const [language, setLanguage] = useState("en");
    const [search, setSearch] = useState("");

    const content = manualContent[language];
    const normalizedSearch = search.trim().toLowerCase();

    const filteredModules = content.modules.filter((module) =>
        `${module.title} ${module.description}`
            .toLowerCase()
            .includes(normalizedSearch)
    );

    const filteredTips = content.tips.filter((tip) =>
        tip.toLowerCase().includes(normalizedSearch)
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950 text-white shadow-lg">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="flex items-center gap-3 rounded-xl text-left"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl">
                            <FaGraduationCap />
                        </span>
                        <span>
                            <span className="block font-extrabold">
                                AfriCore <span className="text-cyan-400">ERP</span>
                            </span>
                            <span className="block text-xs text-slate-400">
                                {content.footer}
                            </span>
                        </span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setLanguage((current) =>
                                    current === "en" ? "sw" : "en"
                                )
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                        >
                            <FaLanguage />
                            {content.language}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="hidden items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 sm:inline-flex"
                        >
                            <FaArrowLeft />
                            {content.back}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-7 text-white shadow-xl sm:p-10 lg:p-14">
                    <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="relative max-w-3xl">
                        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan-200">
                            <FaBookOpen />
                            {content.footer}
                        </span>

                        <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
                            {content.title}
                        </h1>

                        <p className="mt-5 max-w-2xl leading-7 text-slate-300">
                            {content.subtitle}
                        </p>

                        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() =>
                                    document
                                        .getElementById("manual-modules")
                                        ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                        })
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
                            >
                                <FaBookOpen />
                                {content.modulesTitle}
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate("/login")}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
                            >
                                {language === "en"
                                    ? "Go to Login"
                                    : "Nenda Kuingia"}
                            </button>
                        </div>
                    </div>
                </section>

                <section className="mt-8 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-700">
                            <FaBookOpen />
                        </span>
                        <div>
                            <h2 className="text-xl font-extrabold">
                                {content.overviewTitle}
                            </h2>
                            <p className="mt-3 leading-7 text-slate-600">
                                {content.overview}
                            </p>
                        </div>
                    </div>
                </section>

                <section id="manual-modules" className="mt-12 scroll-mt-24">
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
                                AfriCore ERP
                            </p>
                            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                                {content.modulesTitle}
                            </h2>
                        </div>

                        <label className="relative block w-full sm:max-w-sm">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={content.search}
                                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    </div>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredModules.map((module) => {
                            const Icon = moduleIcons[module.icon] || FaBookOpen;

                            return (
                                <article
                                    key={module.icon}
                                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
                                >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
                                        <Icon />
                                    </span>
                                    <h3 className="mt-5 text-lg font-extrabold">
                                        {module.title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                        {module.description}
                                    </p>
                                </article>
                            );
                        })}
                    </div>

                    {filteredModules.length === 0 && (
                        <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">
                            {language === "en"
                                ? "No matching module was found."
                                : "Hakuna moduli iliyopatikana kwa utafutaji huo."}
                        </p>
                    )}
                </section>

                <section className="mt-12 grid gap-6 lg:grid-cols-2">
                    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-700">
                            <FaClipboardCheck />
                        </span>
                        <h2 className="mt-5 text-2xl font-black">
                            {content.examTitle}
                        </h2>
                        <ol className="mt-5 space-y-4">
                            {content.examSteps.map((step, index) => (
                                <li key={step} className="flex gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-800">
                                        {index + 1}
                                    </span>
                                    <span className="pt-0.5 leading-6 text-slate-600">
                                        {step}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </article>

                    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-700">
                            <FaUserCog />
                        </span>
                        <h2 className="mt-5 text-2xl font-black">
                            {content.accessTitle}
                        </h2>
                        <p className="mt-3 leading-7 text-slate-600">
                            {content.accessIntro}
                        </p>
                        <ul className="mt-5 space-y-3">
                            {content.accessPoints.map((point) => (
                                <li key={point} className="flex gap-3">
                                    <FaCheckCircle className="mt-1 shrink-0 text-emerald-600" />
                                    <span className="text-sm leading-6 text-slate-600">
                                        {point}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </article>
                </section>

                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex items-center gap-3">
                        <FaShieldAlt className="text-xl text-blue-700" />
                        <h2 className="text-2xl font-black">
                            {content.tipsTitle}
                        </h2>
                    </div>

                    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                        {filteredTips.map((tip) => (
                            <li key={tip} className="flex gap-3">
                                <FaCheckCircle className="mt-1 shrink-0 text-emerald-600" />
                                <span className="leading-6 text-slate-600">
                                    {tip}
                                </span>
                            </li>
                        ))}
                    </ul>

                    {filteredTips.length === 0 && normalizedSearch && (
                        <p className="mt-4 text-sm text-slate-500">
                            {language === "en"
                                ? "No matching tips were found."
                                : "Hakuna ushauri uliopatikana kwa utafutaji huo."}
                        </p>
                    )}
                </section>

                <section className="mt-8 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
                    <FaExclamationCircle className="mt-1 shrink-0 text-xl text-amber-700" />
                    <div>
                        <h2 className="font-extrabold text-amber-950">
                            {content.warningTitle}
                        </h2>
                        <p className="mt-2 leading-7 text-amber-900">
                            {content.warning}
                        </p>
                    </div>
                </section>
            </main>

            <footer className="mt-12 bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">
                © {new Date().getFullYear()} {content.footer}
            </footer>

            <button
                type="button"
                onClick={() => navigate("/")}
                aria-label={content.back}
                className="fixed bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg hover:bg-blue-600 sm:hidden"
            >
                <FaArrowLeft />
            </button>
        </div>
    );
}