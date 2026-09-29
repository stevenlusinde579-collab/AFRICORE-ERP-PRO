import React, { useState } from "react";
import {
    FaLightbulb,
    FaPaperPlane,
    FaCheckCircle,
    FaExclamationCircle,
    FaSpinner,
} from "react-icons/fa";

import { supabase } from "../../services/supabase";


function SuggestionBox() {

    const [suggestion, setSuggestion] =
        useState("");

    const [category, setCategory] =
        useState("General");

    const [submitted, setSubmitted] =
        useState(false);

    const [error, setError] =
        useState("");

    const [loading, setLoading] =
        useState(false);


    /* =====================================================
       SUBMIT SUGGESTION
    ===================================================== */

    const handleSubmit = async (e) => {

        e.preventDefault();

        setError("");

        setSubmitted(false);


        /* -------------------------------------------------
           VALIDATION
        ------------------------------------------------- */

        if (!suggestion.trim()) {

            setError(
                "Please enter your suggestion before submitting."
            );

            return;

        }


        if (suggestion.trim().length < 5) {

            setError(
                "Please provide a little more detail in your suggestion."
            );

            return;

        }


        setLoading(true);


        try {

            /* =============================================
               CURRENT AUTHENTICATED USER
            ============================================= */

            const {
                data: {
                    user
                },
                error: userError
            } = await supabase.auth.getUser();


            if (userError) {

                throw userError;

            }


            if (!user) {

                throw new Error(
                    "Your session has expired. Please log in again."
                );

            }


            /* =============================================
               GET USER SCHOOL

               IMPORTANT:
               We use the user's profile only to identify
               the school.

               We DO NOT save user.id in the suggestion.
               This keeps the suggestion anonymous.
            ============================================= */

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .select(
                    "school_id"
                )
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();


            if (profileError) {

                throw profileError;

            }


            if (!profile?.school_id) {

                throw new Error(
                    "Your account is not linked to a school."
                );

            }


            /* =============================================
               INSERT ANONYMOUS SUGGESTION

               Notice:
               - NO user_id
               - NO profile_id
               - NO email
               - NO phone
               - NO full name

               Only school_id, category and suggestion.
            ============================================= */

            const {
                error: insertError
            } = await supabase
                .from("suggestions")
                .insert({

                    school_id:
                        profile.school_id,

                    category:
                        category,

                    suggestion:
                        suggestion.trim(),

                });


            if (insertError) {

                throw insertError;

            }


            /* =============================================
               SUCCESS
            ============================================= */

            setSuggestion("");

            setCategory("General");

            setSubmitted(true);


        } catch (err) {

            console.error(
                "Suggestion submission error:",
                err
            );


            setError(
                err?.message ||
                "Unable to submit your suggestion. Please try again."
            );


        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="min-h-screen bg-slate-50 p-6">

            <div className="max-w-5xl mx-auto">


                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="mb-6">

                    <div className="flex items-center gap-3">

                        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg">

                            <FaLightbulb className="text-xl" />

                        </div>


                        <div>

                            <h1 className="text-2xl font-bold text-slate-800">

                                Suggestion Box

                            </h1>


                            <p className="text-sm text-slate-500">

                                Share your ideas, suggestions and
                                recommendations to help improve
                                the school.

                            </p>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    SUCCESS MESSAGE
                ================================================= */}

                {submitted && (

                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-green-700">

                        <FaCheckCircle />


                        <div>

                            <p className="font-semibold">

                                Suggestion submitted successfully.

                            </p>


                            <p className="text-sm">

                                Your suggestion was submitted
                                anonymously. Thank you for helping
                                improve the school.

                            </p>

                        </div>

                    </div>

                )}


                {/* =================================================
                    ERROR MESSAGE
                ================================================= */}

                {error && (

                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">

                        <FaExclamationCircle />

                        <p className="text-sm font-medium">

                            {error}

                        </p>

                    </div>

                )}


                {/* =================================================
                    MAIN CARD
                ================================================= */}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">


                    {/* -------------------------------------------------
                        CARD HEADER
                    ------------------------------------------------- */}

                    <div className="px-6 py-5 border-b border-slate-200">

                        <h2 className="text-lg font-semibold text-slate-800">

                            Submit a Suggestion

                        </h2>


                        <p className="text-sm text-slate-500 mt-1">

                            Your suggestion will be submitted
                            anonymously to help the school
                            administration identify areas that
                            need improvement.

                        </p>

                    </div>


                    {/* -------------------------------------------------
                        FORM
                    ------------------------------------------------- */}

                    <form
                        onSubmit={handleSubmit}
                        className="p-6"
                    >


                        {/* =================================================
                            CATEGORY
                        ================================================= */}

                        <div className="mb-5">

                            <label className="block text-sm font-semibold text-slate-700 mb-2">

                                Suggestion Category

                            </label>


                            <select

                                value={category}

                                onChange={(e) =>
                                    setCategory(
                                        e.target.value
                                    )
                                }

                                disabled={loading}

                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:cursor-not-allowed"

                            >

                                <option value="General">
                                    General
                                </option>

                                <option value="Academic">
                                    Academic
                                </option>

                                <option value="Students">
                                    Students
                                </option>

                                <option value="Staff">
                                    Staff
                                </option>

                                <option value="Finance">
                                    Finance
                                </option>

                                <option value="Communication">
                                    Communication
                                </option>

                                <option value="Facilities">
                                    Facilities
                                </option>

                                <option value="Technology">
                                    Technology
                                </option>

                                <option value="Other">
                                    Other
                                </option>

                            </select>

                        </div>


                        {/* =================================================
                            SUGGESTION
                        ================================================= */}

                        <div className="mb-6">

                            <label className="block text-sm font-semibold text-slate-700 mb-2">

                                Your Suggestion

                            </label>


                            <textarea

                                value={suggestion}

                                onChange={(e) =>
                                    setSuggestion(
                                        e.target.value
                                    )
                                }

                                disabled={loading}

                                rows={8}

                                placeholder="Write your suggestion here..."

                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:cursor-not-allowed"

                            />

                        </div>


                        {/* =================================================
                            ANONYMOUS NOTICE
                        ================================================= */}

                        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">

                            <div className="flex gap-3">

                                <FaLightbulb className="mt-1 text-blue-600" />

                                <div>

                                    <p className="text-sm font-semibold text-blue-800">

                                        Anonymous Suggestion

                                    </p>


                                    <p className="text-sm text-blue-700 mt-1">

                                        Your name, email address,
                                        phone number and user ID are
                                        not included in the suggestion
                                        sent to the school.

                                    </p>

                                </div>

                            </div>

                        </div>


                        {/* =================================================
                            SUBMIT BUTTON
                        ================================================= */}

                        <div className="flex justify-end">

                            <button

                                type="submit"

                                disabled={loading}

                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-blue-600"

                            >

                                {loading ? (

                                    <>
                                        <FaSpinner className="animate-spin" />

                                        Submitting...

                                    </>

                                ) : (

                                    <>
                                        <FaPaperPlane />

                                        Submit Suggestion

                                    </>

                                )}

                            </button>

                        </div>

                    </form>

                </div>


                {/* =================================================
                    INFORMATION
                ================================================= */}

                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">

                    <div className="flex gap-3">

                        <FaLightbulb className="mt-1 text-blue-600" />


                        <div>

                            <p className="text-sm font-semibold text-blue-800">

                                Help improve AfriCore school management

                            </p>


                            <p className="text-sm text-blue-700 mt-1">

                                Use this section to share practical
                                ideas, problems you have identified,
                                or improvements that could make school
                                operations better.

                            </p>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}


export default SuggestionBox;