import React from "react";
import {
    FaCheckCircle,
    FaComments,
    FaDatabase,
    FaGraduationCap,
    FaMoneyBillWave,
    FaRobot,
    FaServer,
    FaShieldAlt,
    FaTools,
    FaUsers,
} from "react-icons/fa";

const onboardingItems = [
    {
        en: "School profile setup, including the academic year and core school information.",
        sw: "Usanidi wa taarifa za shule, mwaka wa masomo na taarifa nyingine muhimu za shule.",
    },
    {
        en: "Configuration of classes, streams and subjects to match the school's structure.",
        sw: "Mpangilio wa madarasa, mikondo na masomo kulingana na muundo wa shule.",
    },
    {
        en: "Creation and configuration of staff accounts, roles and access permissions.",
        sw: "Kutengeneza akaunti za watumishi na kupanga majukumu pamoja na ruhusa za matumizi.",
    },
    {
        en: "Guidance seminar and practical orientation for school leaders and system users.",
        sw: "Semina elekezi na mafunzo ya vitendo kwa viongozi na watumiaji wa mfumo shuleni.",
    },
    {
        en: "Initial student registration/import for up to 10 students in each class.",
        sw: "Kuingiza taarifa za awali za wanafunzi wasiozidi 10 kwa kila darasa.",
    },
    {
        en: "Initial data checks, handover and support during the school's system launch.",
        sw: "Ukaguzi wa taarifa za mwanzo, makabidhiano na msaada wakati shule inaanza kutumia mfumo.",
    },
];

const operatingItems = [
    {
        icon: <FaComments />,
        en: "SMS notifications and communication-related service costs.",
        sw: "Gharama za SMS na huduma zinazohusiana na mawasiliano.",
    },
    {
        icon: <FaRobot />,
        en: "AI services, including examination analysis and related processing.",
        sw: "Huduma za AI, ikiwemo uchambuzi wa mitihani na uchakataji unaohusiana nazo.",
    },
    {
        icon: <FaServer />,
        en: "Cloud hosting, system availability and application infrastructure.",
        sw: "Hosting ya mtandaoni, upatikanaji wa mfumo na miundombinu ya programu.",
    },
    {
        icon: <FaDatabase />,
        en: "Database, data storage and routine backups.",
        sw: "Hifadhidata, utunzaji wa taarifa na nakala rudufu za mara kwa mara.",
    },
    {
        icon: <FaShieldAlt />,
        en: "Security maintenance, monitoring and system updates.",
        sw: "Matunzo ya usalama, ufuatiliaji na masasisho ya mfumo.",
    },
    {
        icon: <FaTools />,
        en: "Routine technical maintenance and operational support.",
        sw: "Matunzo ya kawaida ya kiufundi na msaada wa uendeshaji.",
    },
];

function BilingualLine({ en, sw }) {
    return (
        <div className="space-y-1">
            <p className="text-sm text-slate-700">{en}</p>
            <p className="text-sm text-slate-500">{sw}</p>
        </div>
    );
}

function PricingSection() {
    return (
        <section id="pricing" className="scroll-mt-24 py-28 bg-slate-950 text-white relative overflow-hidden">
            <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
            <div className="absolute -bottom-24 right-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                <div className="max-w-3xl mx-auto text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-300/20 text-cyan-200 text-xs font-bold uppercase tracking-wider mb-5">
                        <FaMoneyBillWave />
                        Pricing & School Onboarding / Bei na Usajili wa Shule
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                        Clear pricing. A supported start.
                    </h2>
                    <p className="mt-4 text-lg text-slate-300 leading-relaxed">
                        Transparent one-time onboarding and monthly operating costs for your school.
                    </p>
                    <p className="mt-2 text-base text-slate-400 leading-relaxed">
                        Gharama zilizo wazi za kuanza kutumia mfumo na gharama za uendeshaji wa kila mwezi.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-7 items-stretch">
                    <article className="rounded-3xl bg-white text-slate-900 p-7 md:p-9 shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl">
                                <FaGraduationCap />
                            </div>
                            <div>
                                <p className="text-sm font-bold uppercase tracking-wider text-blue-700">One-time initial cost</p>
                                <p className="text-sm text-slate-500">Gharama ya awali (mara moja)</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                            <span className="text-4xl md:text-5xl font-black tracking-tight">TSh 950,000</span>
                            <span className="text-sm font-semibold text-slate-500 pb-2">Once / Mara moja</span>
                        </div>
                        <p className="mt-3 text-slate-600 leading-relaxed">
                            Covers school setup, initial configuration, orientation and the first student data entry.
                        </p>
                        <p className="mt-1 text-slate-500 leading-relaxed">
                            Inajumuisha usanidi wa shule, maandalizi ya mfumo, semina elekezi na uingizaji wa awali wa taarifa za wanafunzi.
                        </p>

                        <div className="mt-7 pt-6 border-t border-slate-200">
                            <h3 className="font-extrabold text-lg">What is included / Vinavyojumuishwa</h3>
                            <div className="mt-5 space-y-5">
                                {onboardingItems.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <FaCheckCircle className="text-blue-600 mt-1 shrink-0" />
                                        <BilingualLine en={item.en} sw={item.sw} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </article>

                    <article className="rounded-3xl border border-cyan-300/25 bg-gradient-to-br from-blue-950 to-slate-900 p-7 md:p-9 shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 text-cyan-300 flex items-center justify-center text-xl">
                                <FaUsers />
                            </div>
                            <div>
                                <p className="text-sm font-bold uppercase tracking-wider text-cyan-200">Monthly operating cost</p>
                                <p className="text-sm text-slate-400">Gharama za uendeshaji kwa mwezi</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                <p className="text-sm text-slate-300">Per student / Kwa kila mwanafunzi</p>
                                <p className="mt-1 text-3xl font-black text-white">TSh 800 <span className="text-sm font-semibold text-slate-400">/ month · kwa mwezi</span></p>
                            </div>
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                <p className="text-sm text-slate-300">Per staff member / Kwa kila mtumishi</p>
                                <p className="mt-1 text-3xl font-black text-white">TSh 800 <span className="text-sm font-semibold text-slate-400">/ month · kwa mwezi</span></p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl bg-cyan-400/10 border border-cyan-300/20 p-5">
                            <p className="text-sm font-bold text-cyan-100">Monthly calculation / Namna ya kukokotoa</p>
                            <p className="mt-2 text-sm text-slate-200">TSh 800 × (number of students + number of staff)</p>
                            <p className="mt-1 text-sm text-slate-300">TSh 800 × (idadi ya wanafunzi + idadi ya watumishi)</p>
                        </div>

                        <div className="mt-7 pt-6 border-t border-white/10">
                            <h3 className="font-extrabold text-lg">What the monthly fee supports / Gharama hizi zinagharamia</h3>
                            <div className="mt-5 space-y-5">
                                {operatingItems.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <span className="mt-0.5 text-cyan-300 text-lg shrink-0">{item.icon}</span>
                                        <BilingualLine en={item.en} sw={item.sw} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <p className="mt-7 text-xs text-slate-400 leading-relaxed">
                            The monthly amount is calculated using the school's student and staff counts. SMS and AI services are operational costs and may depend on actual usage.
                        </p>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                            Gharama ya mwezi hukokotolewa kwa idadi ya wanafunzi na watumishi wa shule. Matumizi ya SMS na AI ni sehemu ya gharama za uendeshaji na yanaweza kutegemea kiwango halisi cha matumizi.
                        </p>
                    </article>
                </div>

                <div className="mt-10 text-center">
                    <p className="text-slate-300">
                        Need a school-specific quotation or onboarding discussion?
                    </p>
                    <p className="mt-1 text-slate-400">
                        Unahitaji makadirio ya gharama kulingana na shule yako au mazungumzo ya kuanza kutumia mfumo?
                    </p>
                    <a
                        href="#contact"
                        className="mt-6 inline-flex items-center justify-center gap-3 rounded-xl bg-cyan-400 px-7 py-3.5 font-extrabold text-slate-950 hover:bg-cyan-300 transition"
                    >
                        Contact AfriCore / Wasiliana na AfriCore
                    </a>
                </div>
            </div>
        </section>
    );
}

export default PricingSection;
