import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

function ClassStatistics() {
    const {
        schoolId,
        activeAcademicYearId,
        academicYearLoading,
    } = useSchool();

    const [stats, setStats] = useState({
        total: 0,
        primary: 0,
        secondary: 0,
        levels: 0,
    });

    const fetchStatistics = async () => {
        if (!schoolId || !activeAcademicYearId) {
            setStats({
                total: 0,
                primary: 0,
                secondary: 0,
                levels: 0,
            });

            return;
        }

        const { data, error } = await supabase
            .from("classes")
            .select("id, academic_level")
            .eq("school_id", schoolId)
            .eq("academic_year_id", activeAcademicYearId);

        if (error) {
            console.log(
                "CLASS STATISTICS ERROR:",
                error
            );

            return;
        }

        const classes = data || [];

        const total = classes.length;

        const primary = classes.filter(
            (item) =>
                item.academic_level
                    ?.toLowerCase()
                    .includes("primary")
        ).length;

        const secondary = classes.filter(
            (item) =>
                item.academic_level
                    ?.toLowerCase()
                    .includes("secondary")
        ).length;

        const uniqueLevels = [
            ...new Set(
                classes
                    .map(
                        (item) =>
                            item.academic_level
                    )
                    .filter(Boolean)
            ),
        ];

        setStats({
            total,
            primary,
            secondary,
            levels: uniqueLevels.length,
        });
    };

    useEffect(() => {
        if (
            schoolId &&
            activeAcademicYearId &&
            !academicYearLoading
        ) {
            fetchStatistics();
        }
    }, [
        schoolId,
        activeAcademicYearId,
        academicYearLoading,
    ]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">

            {/* TOTAL CLASSES */}
            <div className="bg-white shadow rounded-xl p-6">
                <p className="text-gray-500">
                    Total Classes
                </p>

                <h2 className="text-3xl font-bold text-blue-600 mt-2">
                    {stats.total}
                </h2>
            </div>

            {/* PRIMARY CLASSES */}
            <div className="bg-white shadow rounded-xl p-6">
                <p className="text-gray-500">
                    Primary Classes
                </p>

                <h2 className="text-3xl font-bold text-green-600 mt-2">
                    {stats.primary}
                </h2>
            </div>

            {/* SECONDARY CLASSES */}
            <div className="bg-white shadow rounded-xl p-6">
                <p className="text-gray-500">
                    Secondary Classes
                </p>

                <h2 className="text-3xl font-bold text-purple-600 mt-2">
                    {stats.secondary}
                </h2>
            </div>

            {/* ACADEMIC LEVELS */}
            <div className="bg-white shadow rounded-xl p-6">
                <p className="text-gray-500">
                    Academic Levels
                </p>

                <h2 className="text-3xl font-bold text-orange-600 mt-2">
                    {stats.levels}
                </h2>
            </div>

        </div>
    );
}

export default ClassStatistics;