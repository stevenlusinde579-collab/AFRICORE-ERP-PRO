import React from "react";
import { useNavigate } from "react-router-dom";
import {
    FaCalendarAlt,
    FaCog,
    FaPlus
} from "react-icons/fa";

import TimetableTable from "./TimetableTable";
import TimetableFilters from "./TimetableFilters";


function Timetable() {

    const navigate = useNavigate();


    return (

        <div className="space-y-6">

            {/* =====================================================
                HEADER
            ===================================================== */}

            <div className="
                flex
                flex-col
                lg:flex-row
                lg:items-center
                lg:justify-between
                gap-4
            ">

                <div>

                    <div className="flex items-center gap-3">

                        <div className="
                            w-12
                            h-12
                            rounded-2xl
                            bg-blue-600
                            text-white
                            flex
                            items-center
                            justify-center
                            shadow-lg
                        ">

                            <FaCalendarAlt
                                className="text-xl"
                            />

                        </div>


                        <div>

                            <h1 className="
                                text-3xl
                                font-extrabold
                                text-slate-800
                            ">

                                Timetable

                            </h1>


                            <p className="
                                text-slate-500
                                mt-1
                            ">

                                Manage and view the school subject timetable and duty schedule.

                            </p>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    MANAGEMENT ACTIONS
                    ================================================= */}

                <div className="flex flex-wrap gap-3">

                    {/* ---------------------------------------------
                        DUTY SCHEDULE
                    --------------------------------------------- */}

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/timetable/duty-schedule")
                        }
                        className="
                            inline-flex
                            items-center
                            gap-2
                            bg-indigo-600
                            hover:bg-indigo-700
                            text-white
                            px-5
                            py-3
                            rounded-xl
                            font-semibold
                            shadow-sm
                            transition
                        "
                    >

                        <FaCalendarAlt />

                        Duty Schedule

                    </button>


                    {/* ---------------------------------------------
                        TIMETABLE SETTINGS
                    --------------------------------------------- */}

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/timetable/settings")
                        }
                        className="
                            inline-flex
                            items-center
                            gap-2
                            bg-purple-600
                            hover:bg-purple-700
                            text-white
                            px-5
                            py-3
                            rounded-xl
                            font-semibold
                            shadow-sm
                            transition
                        "
                    >

                        <FaCog />

                        Timetable Settings

                    </button>


                    {/* ---------------------------------------------
                        ADD TIMETABLE
                    --------------------------------------------- */}

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/timetable/add")
                        }
                        className="
                            inline-flex
                            items-center
                            gap-2
                            bg-blue-600
                            hover:bg-blue-700
                            text-white
                            px-5
                            py-3
                            rounded-xl
                            font-semibold
                            shadow-sm
                            transition
                        "
                    >

                        <FaPlus />

                        Add Timetable

                    </button>

                </div>

            </div>


            {/* =====================================================
                FILTERS
            ===================================================== */}

            <TimetableFilters />


            {/* =====================================================
                TIMETABLE TABLE
            ===================================================== */}

            <TimetableTable />

        </div>

    );

}


export default Timetable;