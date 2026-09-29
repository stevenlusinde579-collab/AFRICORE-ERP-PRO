import { useNavigate } from "react-router-dom";
import { useState } from "react";

import ClassTable from "./ClassTable";
import ClassSearch from "./ClassSearch";
import ClassStatistics from "./ClassStatistics";

import { useSchool } from "../../context/SchoolContext";

function Classes() {
    const navigate = useNavigate();

    // =====================================================
    // GLOBAL SCHOOL + ACADEMIC YEAR
    // =====================================================

    const {
        activeAcademicYear,
        activeAcademicYearId,
        academicYearLoading,
        academicYearError,
    } = useSchool();

    // =====================================================
    // FILTERS
    // =====================================================

    const [filters, setFilters] = useState({
        search: "",
    });

    // =====================================================
    // RENDER
    // =====================================================

    return (
        <div className="p-6">

            {/* =================================================
                PAGE HEADER
                ================================================= */}

            <div className="flex justify-between items-center mb-6">

                <div>

                    <h1 className="text-3xl font-bold text-gray-800">
                        Class Management
                    </h1>

                    <p className="text-gray-600 mt-2">
                        Manage all classes in AfriCore ERP PRO
                    </p>

                    {/* =========================================
                        ACTIVE ACADEMIC YEAR
                        ========================================= */}

                    {!academicYearLoading && (
                        <div className="mt-2 text-sm text-gray-500">

                            Academic Year:{" "}

                            <span className="font-semibold text-gray-700">
                                {activeAcademicYear?.year_name ||
                                    "Not configured"}
                            </span>

                            {activeAcademicYear?.term && (
                                <span className="ml-2">
                                    ({activeAcademicYear.term})
                                </span>
                            )}

                        </div>
                    )}

                </div>

                {/* =================================================
                    ADD CLASS
                    ================================================= */}

                <button
                    onClick={() => navigate("/classes/add")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
                >
                    + Add Class
                </button>

            </div>

            {/* =================================================
                ACADEMIC YEAR WARNING
                ================================================= */}

            {!academicYearLoading &&
                !activeAcademicYearId && (

                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">

                        <div className="font-semibold">
                            No Active Academic Year
                        </div>

                        <div className="mt-1 text-sm">
                            {academicYearError ||
                                "Please configure an active academic year in Settings before managing classes."}
                        </div>

                    </div>

                )}

            {/* =================================================
                SEARCH
                ================================================= */}

            <ClassSearch
                onSearch={setFilters}
            />

            {/* =================================================
                CLASS STATISTICS
                ================================================= */}

            <ClassStatistics />

            {/* =================================================
                CLASS TABLE
                ================================================= */}

            <ClassTable
                filters={filters}
            />

        </div>
    );
}

export default Classes;