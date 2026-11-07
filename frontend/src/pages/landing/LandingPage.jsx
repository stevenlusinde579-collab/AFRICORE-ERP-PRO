import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaArrowRight,
    FaBars,
    FaTimes,
    FaGraduationCap,
    FaUsers,
    FaChalkboardTeacher,
    FaBookOpen,
    FaClipboardCheck,
    FaMoneyBillWave,
    FaComments,
    FaChartLine,
    FaRobot,
    FaShieldAlt,
    FaUserLock,
    FaDatabase,
    FaCheckCircle,
    FaPhone,
    FaEnvelope,
    FaChevronRight,
    FaLayerGroup,
    FaLaptop,
} from "react-icons/fa";

function LandingPage() {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeShowcaseIndex, setActiveShowcaseIndex] = useState(0);
    const [showcasePaused, setShowcasePaused] = useState(false);

    // Real-world education photos illustrate the different AfriCore modules.
    // These are illustrative photos, not screenshots of live school records.
    const showcaseSlides = [
        {
            module: "Student Management",
            headline: "Every learner, organised.",
            description: "Student profiles, enrolment and class records in one place.",
            image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=85",
            alt: "Teacher supporting learners in a classroom",
        },
        {
            module: "Academic Management",
            headline: "Teaching made connected.",
            description: "Bring teachers, subjects, classes and academic planning together.",
            image: "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1400&q=85",
            alt: "Teacher working with students in a classroom",
        },
        {
            module: "Examination & Results",
            headline: "From assessment to insight.",
            description: "Manage examinations, marks, approval and performance analysis.",
            image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1400&q=85",
            alt: "Student writing during an assessment",
        },
        {
            module: "Finance Management",
            headline: "A clearer view of school finance.",
            description: "Keep financial activity and reporting organised.",
            image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1400&q=85",
            alt: "Person reviewing financial information at a desk",
        },
        {
            module: "Communication",
            headline: "Keep your school connected.",
            description: "Support communication between authorised school users.",
            image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=85",
            alt: "Colleagues collaborating around a table",
        },
        {
            module: "Analytics & Reports",
            headline: "Make informed decisions.",
            description: "Turn school information into useful management insights.",
            image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=85",
            alt: "Analytics dashboard displayed on a computer",
        },
    ];

    useEffect(() => {
        if (showcasePaused) return undefined;

        const timer = window.setInterval(() => {
            setActiveShowcaseIndex((current) => (current + 1) % showcaseSlides.length);
        }, 5200);

        return () => window.clearInterval(timer);
    }, [showcasePaused, showcaseSlides.length]);

    const scrollToSection = (id) => {
        const element = document.getElementById(id);

        if (element) {
            element.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }

        setMobileMenuOpen(false);
    };

    const handleLogin = () => {
        setMobileMenuOpen(false);
        navigate("/login");
    };

    // Open the System Manual page
    const handleSystemManual = () => {
        setMobileMenuOpen(false);
        navigate("/system-manual");
    };

    const features = [
        {
            icon: <FaUsers />,
            title: "Student Management",
            description:
                "Manage student registration, profiles, classes, records and essential student information from one centralized platform.",
        },
        {
            icon: <FaChalkboardTeacher />,
            title: "Teacher & Staff Management",
            description:
                "Manage teachers, staff, system roles, responsibilities and access permissions through an organized digital workflow.",
        },
        {
            icon: <FaBookOpen />,
            title: "Academic Management",
            description:
                "Organize classes, subjects, academic structures, teaching responsibilities and other core academic operations.",
        },
        {
            icon: <FaClipboardCheck />,
            title: "Examination & Results",
            description:
                "Create examinations, upload papers, classify questions, enter marks, analyze results and manage approval workflows.",
        },
        {
            icon: <FaMoneyBillWave />,
            title: "Finance Management",
            description:
                "Support school financial operations with organized records, financial information and management visibility.",
        },
        {
            icon: <FaComments />,
            title: "Communication",
            description:
                "Connect administrators, teachers, parents and other authorized users through centralized communication tools.",
        },
        {
            icon: <FaChartLine />,
            title: "Analytics & Reports",
            description:
                "Turn school data into meaningful insights with dashboards, analytics, reports and performance information.",
        },
        {
            icon: <FaRobot />,
            title: "AI-Powered Education",
            description:
                "Use intelligent technology to support examination analysis, academic insights and smarter education management.",
        },
    ];

    const securityFeatures = [
        "Role-Based Access Control",
        "Permission Management",
        "Secure Authentication",
        "Protected School Data",
        "Controlled Module Access",
        "Administrative Visibility",
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
            {/* NAVIGATION */}
            <header className="fixed top-0 left-0 right-0 z-50">
                <div className="bg-slate-950/90 backdrop-blur-xl border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="h-20 flex items-center justify-between">
                            {/* LOGO */}
                            <button
                                type="button"
                                onClick={() => scrollToSection("home")}
                                className="flex items-center gap-3 group"
                            >
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition">
                                    <FaGraduationCap className="text-white text-xl" />
                                </div>

                                <div className="text-left">
                                    <div className="font-extrabold text-xl tracking-tight">
                                        AfriCore
                                        <span className="text-cyan-400">
                                            ERP
                                        </span>
                                    </div>

                                    <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
                                        Smart Education Management
                                    </div>
                                </div>
                            </button>

                            {/* DESKTOP NAVIGATION */}
                            <nav className="hidden lg:flex items-center gap-6">
                                <button
                                    type="button"
                                    onClick={() => scrollToSection("home")}
                                    className="text-sm text-slate-300 hover:text-white transition"
                                >
                                    Home
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("features")}
                                    className="text-sm text-slate-300 hover:text-white transition"
                                >
                                    Features
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("about")}
                                    className="text-sm text-slate-300 hover:text-white transition"
                                >
                                    About
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("security")}
                                    className="text-sm text-slate-300 hover:text-white transition"
                                >
                                    Security
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("contact")}
                                    className="text-sm text-slate-300 hover:text-white transition"
                                >
                                    Contact
                                </button>

                                {/* SYSTEM MANUAL LINK */}
                                <button
                                    type="button"
                                    onClick={handleSystemManual}
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition"
                                >
                                    <FaBookOpen />
                                    System Manual
                                </button>
                            </nav>

                            {/* DESKTOP LOGIN */}
                            <div className="hidden lg:flex items-center">
                                <button
                                    type="button"
                                    onClick={handleLogin}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-950 text-sm font-bold hover:bg-cyan-50 transition shadow-lg"
                                >
                                    Login to AfriCore ERP
                                    <FaArrowRight className="text-xs" />
                                </button>
                            </div>

                            {/* MOBILE MENU BUTTON */}
                            <button
                                type="button"
                                aria-label={
                                    mobileMenuOpen
                                        ? "Close navigation menu"
                                        : "Open navigation menu"
                                }
                                aria-expanded={mobileMenuOpen}
                                onClick={() =>
                                    setMobileMenuOpen(!mobileMenuOpen)
                                }
                                className="lg:hidden w-11 h-11 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center"
                            >
                                {mobileMenuOpen ? <FaTimes /> : <FaBars />}
                            </button>
                        </div>
                    </div>

                    {/* MOBILE NAVIGATION */}
                    {mobileMenuOpen && (
                        <div className="lg:hidden border-t border-white/10 bg-slate-950">
                            <div className="px-6 py-6 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => scrollToSection("home")}
                                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5"
                                >
                                    Home
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("features")}
                                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5"
                                >
                                    Features
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("about")}
                                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5"
                                >
                                    About
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("security")}
                                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5"
                                >
                                    Security
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("contact")}
                                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5"
                                >
                                    Contact
                                </button>

                                {/* MOBILE SYSTEM MANUAL */}
                                <button
                                    type="button"
                                    onClick={handleSystemManual}
                                    className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/15 transition"
                                >
                                    <FaBookOpen />
                                    System Manual
                                    <FaArrowRight className="ml-auto text-xs" />
                                </button>

                                <button
                                    type="button"
                                    onClick={handleLogin}
                                    className="w-full mt-3 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold"
                                >
                                    Login to AfriCore ERP
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* HERO */}
            <section
                id="home"
                className="relative min-h-screen flex items-center pt-28 pb-16 overflow-hidden"
            >
                <div className="absolute inset-0">
                    <img
                        src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2000&q=85"
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/85" />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-blue-950/70" />
                </div>

                <div className="absolute top-40 right-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-20 left-10 w-72 h-72 bg-cyan-400/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
                    <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 text-sm font-semibold mb-7">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                Intelligent Education Management Platform
                            </div>

                            <h1 className="text-5xl md:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight">
                                Smart School Management.
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-sky-300">
                                    One Powerful Platform.
                                </span>
                            </h1>

                            <p className="mt-7 max-w-2xl text-lg md:text-xl text-slate-300 leading-relaxed">
                                AfriCore ERP is a modern, secure and intelligent
                                education management platform designed to bring
                                academic, administrative, financial,
                                communication and analytical operations together
                                in one integrated system.
                            </p>

                            <div className="mt-9 flex flex-col sm:flex-row flex-wrap gap-4">
                                <button
                                    type="button"
                                    onClick={handleLogin}
                                    className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 font-bold shadow-xl shadow-blue-600/20 transition"
                                >
                                    Login to AfriCore ERP
                                    <FaArrowRight />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection("features")}
                                    className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 font-bold transition"
                                >
                                    Explore Features
                                    <FaChevronRight className="text-sm" />
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSystemManual}
                                    className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 font-bold transition"
                                >
                                    <FaBookOpen />
                                    System Manual
                                    <FaArrowRight className="text-sm" />
                                </button>
                            </div>

                            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400">
                                <div className="flex items-center gap-2">
                                    <FaCheckCircle className="text-cyan-400" />
                                    Integrated Platform
                                </div>
                                <div className="flex items-center gap-2">
                                    <FaCheckCircle className="text-cyan-400" />
                                    Role-Based Security
                                </div>
                                <div className="flex items-center gap-2">
                                    <FaCheckCircle className="text-cyan-400" />
                                    Intelligent Analytics
                                </div>
                            </div>
                        </div>

                        {/* AUTOMATIC MODULE SHOWCASE */}
                        <div
                            className="relative mx-auto w-full max-w-xl"
                            onMouseEnter={() => setShowcasePaused(true)}
                            onMouseLeave={() => setShowcasePaused(false)}
                            onFocus={() => setShowcasePaused(true)}
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                    setShowcasePaused(false);
                                }
                            }}
                        >
                            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-indigo-500/20 blur-2xl" />
                            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-slate-900 shadow-2xl shadow-black/40">
                                <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
                                    {showcaseSlides.map((slide, index) => (
                                        <img
                                            key={slide.image}
                                            src={slide.image}
                                            alt={slide.alt}
                                            loading={index === 0 ? "eager" : "lazy"}
                                            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${index === activeShowcaseIndex ? "opacity-100" : "opacity-0"}`}
                                            aria-hidden={index !== activeShowcaseIndex}
                                        />
                                    ))}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-slate-950/5" />
                                    <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/60 px-3 py-2 text-xs font-bold text-white backdrop-blur-md">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                        AFRICORE IN ACTION
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                                            {showcaseSlides[activeShowcaseIndex].module}
                                        </div>
                                        <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white">
                                            {showcaseSlides[activeShowcaseIndex].headline}
                                        </h2>
                                        <p className="mt-2 max-w-md text-sm sm:text-base leading-relaxed text-slate-200">
                                            {showcaseSlides[activeShowcaseIndex].description}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4 bg-slate-950/95 px-5 py-4">
                                    <div className="text-xs text-slate-400">
                                        Module {activeShowcaseIndex + 1} of {showcaseSlides.length}
                                    </div>
                                    <div className="flex items-center gap-2" aria-label="Choose showcase slide">
                                        {showcaseSlides.map((slide, index) => (
                                            <button
                                                key={slide.module}
                                                type="button"
                                                onClick={() => setActiveShowcaseIndex(index)}
                                                aria-label={`Show ${slide.module}`}
                                                aria-current={index === activeShowcaseIndex ? "true" : undefined}
                                                className={`h-2.5 rounded-full transition-all duration-300 ${index === activeShowcaseIndex ? "w-8 bg-cyan-400" : "w-2.5 bg-white/35 hover:bg-white/70"}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowcasePaused((paused) => !paused)}
                                        className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                                        aria-label={showcasePaused ? "Play slideshow" : "Pause slideshow"}
                                    >
                                        {showcasePaused ? "Play" : "Pause"}
                                    </button>
                                </div>
                            </div>
                            <p className="relative mt-4 text-center text-xs text-slate-400">
                                A look at the people and everyday work behind modern school management.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* PLATFORM INTRO */}
            <section className="py-24 bg-white text-slate-900">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid lg:grid-cols-3 gap-8">
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200">
                            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl mb-6">
                                <FaLayerGroup />
                            </div>

                            <h3 className="text-xl font-bold mb-3">
                                One Integrated System
                            </h3>

                            <p className="text-slate-600 leading-relaxed">
                                Bring essential education management
                                operations together instead of managing
                                disconnected systems.
                            </p>
                        </div>

                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center text-xl mb-6">
                                <FaShieldAlt />
                            </div>

                            <h3 className="text-xl font-bold mb-3">
                                Secure by Design
                            </h3>

                            <p className="text-slate-600 leading-relaxed">
                                Control access to sensitive information with
                                authentication, roles and permissions.
                            </p>
                        </div>

                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl mb-6">
                                <FaRobot />
                            </div>

                            <h3 className="text-xl font-bold mb-3">
                                Intelligent Management
                            </h3>

                            <p className="text-slate-600 leading-relaxed">
                                Use analytics and AI-powered capabilities to
                                make education management smarter.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FEATURES */}
            <section id="features" className="py-28 bg-slate-100 text-slate-900">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="max-w-3xl mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-5">
                            <FaLaptop />
                            Platform Capabilities
                        </div>

                        <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                            Everything you need to manage education.
                        </h2>

                        <p className="mt-5 text-lg text-slate-600 leading-relaxed">
                            AfriCore ERP connects the major operations of
                            modern education management into one powerful
                            digital platform.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="group bg-white rounded-3xl p-7 border border-slate-200 hover:border-blue-300 hover:-translate-y-1 hover:shadow-xl transition duration-300"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-cyan-400 flex items-center justify-center text-xl mb-6 group-hover:bg-blue-600 group-hover:text-white transition">
                                    {feature.icon}
                                </div>

                                <h3 className="text-lg font-bold mb-3">
                                    {feature.title}
                                </h3>

                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {feature.description}
                                </p>

                                <div className="mt-6 flex items-center gap-2 text-xs font-bold text-blue-600">
                                    Learn more
                                    <FaArrowRight />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ABOUT */}
            <section id="about" className="py-28 bg-white text-slate-900">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-cyan-400/20 rounded-[2rem] blur-2xl" />

                            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl">
                                <img
                                    src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=85"
                                    alt="Education technology"
                                    className="w-full h-[500px] object-cover"
                                />

                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                                <div className="absolute bottom-6 left-6 right-6 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-white">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
                                            <FaGraduationCap />
                                        </div>

                                        <div>
                                            <div className="font-bold">
                                                AfriCore ERP
                                            </div>

                                            <div className="text-xs text-slate-300">
                                                Digital Education Management
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-5">
                                About AfriCore ERP
                            </div>

                            <h2 className="text-4xl md:text-5xl font-black leading-tight">
                                A smarter way to manage education.
                            </h2>

                            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                                AfriCore ERP is an integrated education
                                management platform created to simplify
                                complex school operations through modern
                                digital technology.
                            </p>

                            <p className="mt-5 text-slate-600 leading-relaxed">
                                Instead of relying on disconnected
                                processes, administrators and authorized
                                users can manage important education
                                operations through a centralized platform.
                            </p>

                            <div className="mt-8 space-y-4">
                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="mt-1 text-blue-600" />
                                    <span className="text-slate-700">
                                        Centralized education management
                                    </span>
                                </div>

                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="mt-1 text-blue-600" />
                                    <span className="text-slate-700">
                                        Flexible role and permission control
                                    </span>
                                </div>

                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="mt-1 text-blue-600" />
                                    <span className="text-slate-700">
                                        Data-driven analytics and reporting
                                    </span>
                                </div>

                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="mt-1 text-blue-600" />
                                    <span className="text-slate-700">
                                        Modern technology for modern education
                                    </span>
                                </div>
                            </div>

                            {/* SYSTEM MANUAL LINK */}
                            <button
                                type="button"
                                onClick={handleSystemManual}
                                className="mt-8 inline-flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-bold text-blue-700 hover:bg-blue-100 transition"
                            >
                                <FaBookOpen />
                                Read the System Manual
                                <FaArrowRight />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECURITY */}
            <section id="security" className="py-28 bg-slate-950 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />

                <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-5">
                                <FaShieldAlt />
                                Security & Control
                            </div>

                            <h2 className="text-4xl md:text-5xl font-black leading-tight">
                                Built with control and security in mind.
                            </h2>

                            <p className="mt-6 text-lg text-slate-400 leading-relaxed">
                                AfriCore ERP provides structured access
                                control so authorized users can access the
                                information and functionality appropriate
                                to their responsibilities.
                            </p>

                            <button
                                type="button"
                                onClick={handleLogin}
                                className="mt-8 inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold transition"
                            >
                                Access AfriCore ERP
                                <FaArrowRight />
                            </button>

                            <button
                                type="button"
                                onClick={handleSystemManual}
                                className="mt-4 sm:mt-8 sm:ml-3 inline-flex items-center gap-3 px-6 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 font-bold transition"
                            >
                                <FaBookOpen />
                                System Manual
                            </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                            {securityFeatures.map((item, index) => (
                                <div
                                    key={index}
                                    className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                                >
                                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-300 flex items-center justify-center mb-4">
                                        {index === 0 && <FaUserLock />}
                                        {index === 1 && <FaShieldAlt />}
                                        {index === 2 && <FaLockIcon />}
                                        {index === 3 && <FaDatabase />}
                                        {index === 4 && <FaLayerGroup />}
                                        {index === 5 && <FaUsers />}
                                    </div>

                                    <h3 className="font-bold text-white">
                                        {item}
                                    </h3>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600">
                <div className="max-w-5xl mx-auto px-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mx-auto mb-7">
                        <FaGraduationCap className="text-2xl" />
                    </div>

                    <h2 className="text-4xl md:text-5xl font-black">
                        Ready to transform education management?
                    </h2>

                    <p className="mt-5 text-lg text-blue-50 max-w-2xl mx-auto leading-relaxed">
                        Experience a modern platform that brings
                        administration, academics, examinations,
                        communication, analytics and more into one
                        integrated system.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
                        <button
                            type="button"
                            onClick={handleLogin}
                            className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white text-blue-700 font-black hover:bg-blue-50 transition shadow-xl"
                        >
                            Login to AfriCore ERP
                            <FaArrowRight />
                        </button>

                        <button
                            type="button"
                            onClick={handleSystemManual}
                            className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl border border-white/30 bg-white/10 text-white font-black hover:bg-white/20 transition"
                        >
                            <FaBookOpen />
                            Read System Manual
                            <FaArrowRight />
                        </button>
                    </div>
                </div>
            </section>

            {/* CONTACT */}
            <section id="contact" className="py-24 bg-white text-slate-900">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-5">
                                Get in Touch
                            </div>

                            <h2 className="text-4xl md:text-5xl font-black">
                                Talk to AfriCore.
                            </h2>

                            <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-xl">
                                For AfriCore ERP enquiries, support,
                                implementation and other platform
                                information, get in touch directly.
                            </p>

                            <div className="mt-9 space-y-5">
                                <a
                                    href="tel:0683058859"
                                    className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                        <FaPhone />
                                    </div>

                                    <div>
                                        <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                                            Phone
                                        </div>

                                        <div className="mt-1 font-bold text-slate-900">
                                            0683058859
                                        </div>
                                    </div>
                                </a>

                                <a
                                    href="mailto:stevenlusinde579@gmail.com"
                                    className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center">
                                        <FaEnvelope />
                                    </div>

                                    <div>
                                        <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                                            Email
                                        </div>

                                        <div className="mt-1 font-bold text-slate-900 break-all">
                                            stevenlusinde579@gmail.com
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>

                        {/* CONTACT CARD */}
                        <div className="rounded-[2rem] bg-slate-950 text-white p-8 md:p-10 shadow-2xl">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-7">
                                <FaGraduationCap className="text-xl" />
                            </div>

                            <h3 className="text-2xl font-black">
                                AfriCore ERP
                            </h3>

                            <p className="mt-3 text-slate-400 leading-relaxed">
                                Smart. Secure. Integrated. Intelligent.
                                A modern platform for managing education
                                operations digitally.
                            </p>

                            <div className="mt-8 pt-8 border-t border-white/10">
                                <div className="flex items-start gap-4 mb-6">
                                    <FaPhone className="mt-1 text-cyan-400" />

                                    <div>
                                        <div className="text-xs text-slate-500">
                                            Contact
                                        </div>

                                        <div className="font-semibold">
                                            0683058859
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <FaEnvelope className="mt-1 text-cyan-400" />

                                    <div>
                                        <div className="text-xs text-slate-500">
                                            Email
                                        </div>

                                        <div className="font-semibold break-all">
                                            stevenlusinde579@gmail.com
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleLogin}
                                className="w-full mt-9 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold flex items-center justify-center gap-3 transition"
                            >
                                Login to AfriCore ERP
                                <FaArrowRight />
                            </button>

                            <button
                                type="button"
                                onClick={handleSystemManual}
                                className="w-full mt-3 py-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 font-bold flex items-center justify-center gap-3 transition"
                            >
                                <FaBookOpen />
                                System Manual
                                <FaArrowRight />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-950 border-t border-white/10 text-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                                <FaGraduationCap />
                            </div>

                            <div>
                                <div className="font-bold">
                                    AfriCore
                                    <span className="text-cyan-400">
                                        ERP
                                    </span>
                                </div>

                                <div className="text-xs text-slate-500">
                                    Smart Education Management
                                </div>
                            </div>
                        </div>

                        <div className="text-sm text-slate-500 text-center">
                            © {new Date().getFullYear()} AfriCore ERP.
                            All rights reserved.
                        </div>

                        <div className="text-sm text-slate-500">
                            Powered by AfriCore Technologies
                        </div>
                    </div>

                    {/* FOOTER SYSTEM MANUAL LINK */}
                    <div className="mt-8 pt-6 border-t border-white/10 flex justify-center">
                        <button
                            type="button"
                            onClick={handleSystemManual}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition"
                        >
                            <FaBookOpen />
                            System Manual
                            <FaArrowRight className="text-xs" />
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}

/*
=============================================================
SMALL SECURITY ICON COMPONENT
=============================================================
*/
function FaLockIcon() {
    return (
        <span className="text-lg" aria-hidden="true">
            🔐
        </span>
    );
}

export default LandingPage;