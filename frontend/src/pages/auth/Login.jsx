import React, { useState } from "react";

import {
    Eye,
    EyeOff,
    Lock,
    Mail,
    LogIn,
    AlertCircle,
    Loader2,
} from "lucide-react";

import {
    useLocation,
    useNavigate,
} from "react-router-dom";

import { supabase } from "../../services/supabase";


const Login = () => {

    const navigate = useNavigate();
    const location = useLocation();


    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");


    /*
    ============================================================
    LOGIN
    ============================================================
    */

    const handleSubmit = async (event) => {

        event.preventDefault();

        setError("");


        const cleanEmail = email
            .trim()
            .toLowerCase();


        /*
        ========================================================
        VALIDATE EMAIL
        ========================================================
        */

        if (!cleanEmail) {

            setError(
                "Please enter your email address."
            );

            return;

        }


        /*
        ========================================================
        VALIDATE PASSWORD
        ========================================================
        */

        if (!password) {

            setError(
                "Please enter your password."
            );

            return;

        }


        setLoading(true);


        try {

            /*
            ====================================================
            SUPABASE LOGIN
            ====================================================
            */

            const {
                data,
                error: loginError,
            } = await supabase.auth.signInWithPassword({

                email: cleanEmail,

                password,

            });


            /*
            ====================================================
            LOGIN ERROR
            ====================================================
            */

            if (loginError) {

                throw loginError;

            }


            /*
            ====================================================
            MAKE SURE SESSION EXISTS
            ====================================================
            */

            if (!data?.session) {

                throw new Error(
                    "Login failed. No active session was created."
                );

            }


            console.log(
                "========================================"
            );

            console.log(
                "AFRICORE LOGIN SUCCESS"
            );

            console.log(
                "USER ID:",
                data?.user?.id
            );

            console.log(
                "EMAIL:",
                data?.user?.email
            );

            console.log(
                "SESSION EXISTS:",
                !!data?.session
            );

            console.log(
                "========================================"
            );


            /*
            ====================================================
            DESTINATION
            ====================================================

            If another protected page sent the user to login,
            return them there.

            Otherwise go to dashboard.
            */

            const destination =
                location.state?.from ||
                "/dashboard";


            navigate(
                destination,
                {
                    replace: true,
                }
            );


        } catch (loginError) {

            console.error(
                "========================================"
            );

            console.error(
                "AFRICORE LOGIN ERROR"
            );

            console.error(
                loginError
            );

            console.error(
                "========================================"
            );


            let message =
                "Unable to sign in. Please check your login details.";


            if (
                loginError?.message
            ) {

                message =
                    loginError.message;

            }


            /*
            ====================================================
            INVALID LOGIN
            ====================================================
            */

            const errorMessage =
                loginError?.message
                    ?.toLowerCase()
                    || "";


            if (
                errorMessage.includes(
                    "invalid login credentials"
                )
            ) {

                message =
                    "Invalid email or password.";

            }


            /*
            ====================================================
            EMAIL NOT CONFIRMED
            ====================================================
            */

            if (
                errorMessage.includes(
                    "email not confirmed"
                )
            ) {

                message =
                    "Your email address has not been confirmed.";

            }


            /*
            ====================================================
            TOO MANY REQUESTS
            ====================================================
            */

            if (
                errorMessage.includes(
                    "too many requests"
                )
            ) {

                message =
                    "Too many login attempts. Please try again later.";

            }


            setError(message);


        } finally {

            setLoading(false);

        }

    };


    /*
    ============================================================
    RETURN
    ============================================================
    */

    return (

        <div className="min-h-screen bg-slate-50">

            <div className="flex min-h-screen items-center justify-center px-4 py-10">

                <div className="w-full max-w-md">


                    {/* =================================================
                        BRAND
                    ================================================= */}

                    <div className="mb-8 text-center">

                        <div
                            className="
                                mx-auto
                                flex
                                h-16
                                w-16
                                items-center
                                justify-center
                                rounded-2xl
                                bg-indigo-600
                                text-white
                                shadow-lg
                            "
                        >

                            <LogIn className="h-8 w-8" />

                        </div>


                        <h1 className="
                            mt-5
                            text-2xl
                            font-bold
                            text-slate-900
                        ">
                            AfriCore ERP
                        </h1>


                        <p className="
                            mt-2
                            text-sm
                            text-slate-500
                        ">
                            Smart Education Management System
                        </p>

                    </div>



                    {/* =================================================
                        LOGIN CARD
                    ================================================= */}

                    <div className="
                        rounded-2xl
                        border
                        border-slate-200
                        bg-white
                        p-6
                        shadow-sm
                        sm:p-8
                    ">


                        <div className="mb-6">

                            <h2 className="
                                text-xl
                                font-bold
                                text-slate-900
                            ">
                                Welcome back
                            </h2>


                            <p className="
                                mt-1
                                text-sm
                                text-slate-500
                            ">
                                Sign in to access AfriCore ERP.
                            </p>

                        </div>



                        {/* =================================================
                            ERROR
                        ================================================= */}

                        {error && (

                            <div className="
                                mb-5
                                flex
                                items-start
                                gap-3
                                rounded-xl
                                border
                                border-red-200
                                bg-red-50
                                p-3
                            ">

                                <AlertCircle
                                    className="
                                        mt-0.5
                                        h-5
                                        w-5
                                        shrink-0
                                        text-red-600
                                    "
                                />


                                <p className="
                                    text-sm
                                    text-red-700
                                ">
                                    {error}
                                </p>

                            </div>

                        )}



                        {/* =================================================
                            FORM
                        ================================================= */}

                        <form
                            onSubmit={handleSubmit}
                            className="space-y-5"
                        >


                            {/* =============================================
                                EMAIL
                            ============================================= */}

                            <div>

                                <label
                                    htmlFor="email"
                                    className="
                                        mb-2
                                        block
                                        text-sm
                                        font-semibold
                                        text-slate-700
                                    "
                                >
                                    Email address
                                </label>


                                <div className="relative">

                                    <Mail
                                        className="
                                            absolute
                                            left-3
                                            top-1/2
                                            h-5
                                            w-5
                                            -translate-y-1/2
                                            text-slate-400
                                        "
                                    />


                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(event) => {

                                            setEmail(
                                                event.target.value
                                            );

                                            setError("");

                                        }}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        disabled={loading}
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-slate-200
                                            bg-slate-50
                                            py-3
                                            pl-11
                                            pr-4
                                            text-sm
                                            text-slate-900
                                            outline-none
                                            transition
                                            placeholder:text-slate-400
                                            focus:border-indigo-400
                                            focus:bg-white
                                            focus:ring-4
                                            focus:ring-indigo-100
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    />

                                </div>

                            </div>



                            {/* =============================================
                                PASSWORD
                            ============================================= */}

                            <div>

                                <label
                                    htmlFor="password"
                                    className="
                                        mb-2
                                        block
                                        text-sm
                                        font-semibold
                                        text-slate-700
                                    "
                                >
                                    Password
                                </label>


                                <div className="relative">

                                    <Lock
                                        className="
                                            absolute
                                            left-3
                                            top-1/2
                                            h-5
                                            w-5
                                            -translate-y-1/2
                                            text-slate-400
                                        "
                                    />


                                    <input
                                        id="password"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={password}
                                        onChange={(event) => {

                                            setPassword(
                                                event.target.value
                                            );

                                            setError("");

                                        }}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        disabled={loading}
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-slate-200
                                            bg-slate-50
                                            py-3
                                            pl-11
                                            pr-12
                                            text-sm
                                            text-slate-900
                                            outline-none
                                            transition
                                            placeholder:text-slate-400
                                            focus:border-indigo-400
                                            focus:bg-white
                                            focus:ring-4
                                            focus:ring-indigo-100
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    />


                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(
                                                (current) =>
                                                    !current
                                            )
                                        }
                                        disabled={loading}
                                        className="
                                            absolute
                                            right-2
                                            top-1/2
                                            -translate-y-1/2
                                            rounded-lg
                                            p-2
                                            text-slate-400
                                            hover:bg-slate-100
                                            hover:text-slate-600
                                            disabled:opacity-50
                                        "
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >

                                        {showPassword ? (

                                            <EyeOff className="h-5 w-5" />

                                        ) : (

                                            <Eye className="h-5 w-5" />

                                        )}

                                    </button>

                                </div>

                            </div>



                            {/* =============================================
                                SUBMIT
                            ============================================= */}

                            <button
                                type="submit"
                                disabled={loading}
                                className="
                                    flex
                                    w-full
                                    items-center
                                    justify-center
                                    gap-2
                                    rounded-xl
                                    bg-indigo-600
                                    px-4
                                    py-3
                                    text-sm
                                    font-bold
                                    text-white
                                    shadow-sm
                                    transition
                                    hover:bg-indigo-700
                                    focus:outline-none
                                    focus:ring-4
                                    focus:ring-indigo-100
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                "
                            >

                                {loading ? (

                                    <>

                                        <Loader2
                                            className="
                                                h-5
                                                w-5
                                                animate-spin
                                            "
                                        />

                                        Signing in...

                                    </>

                                ) : (

                                    <>

                                        <LogIn
                                            className="h-5 w-5"
                                        />

                                        Sign In

                                    </>

                                )}

                            </button>


                        </form>

                    </div>



                    {/* =================================================
                        FOOTER
                    ================================================= */}

                    <p className="
                        mt-6
                        text-center
                        text-xs
                        text-slate-400
                    ">
                        AfriCore ERP • Secure Education Management System
                    </p>


                </div>

            </div>

        </div>

    );

};


export default Login;