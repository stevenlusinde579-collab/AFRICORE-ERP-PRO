import { supabase } from "../services/supabase";

const DEFAULT_CLASSES = [
    { class_name: "Baby Class", short_name: "BABY", academic_level: "Nursery" },
    { class_name: "Pre Unit", short_name: "PRE", academic_level: "Nursery" },
    { class_name: "KG 1", short_name: "KG1", academic_level: "Nursery" },
    { class_name: "KG 2", short_name: "KG2", academic_level: "Nursery" },
    ...Array.from({ length: 7 }, (_, index) => ({
        class_name: `Standard ${index + 1}`,
        short_name: `STD${index + 1}`,
        academic_level: "Primary",
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
        class_name: `Form ${index + 1}`,
        short_name: `FORM${index + 1}`,
        academic_level: "Secondary",
    })),
    { class_name: "Form 5", short_name: "FORM5", academic_level: "Advanced" },
    { class_name: "Form 6", short_name: "FORM6", academic_level: "Advanced" },
];

/**
 * Ensure the standard class set exists for a specific school's academic year.
 * Safe to run repeatedly: existing class names are preserved and not duplicated.
 */
export async function ensureDefaultClasses(schoolId, academicYearId) {
    const numericSchoolId = Number(schoolId);
    const numericAcademicYearId = Number(academicYearId);

    if (
        !Number.isInteger(numericSchoolId) ||
        numericSchoolId <= 0 ||
        !Number.isInteger(numericAcademicYearId) ||
        numericAcademicYearId <= 0
    ) {
        throw new Error("A valid school and academic year are required to create default classes.");
    }

    const { data: existingClasses, error: existingError } = await supabase
        .from("classes")
        .select("class_name")
        .eq("school_id", numericSchoolId)
        .eq("academic_year_id", numericAcademicYearId);

    if (existingError) throw existingError;

    const existingNames = new Set(
        (existingClasses || []).map((item) =>
            String(item.class_name || "").trim().toLowerCase()
        )
    );

    const missingClasses = DEFAULT_CLASSES
        .filter((item) => !existingNames.has(item.class_name.toLowerCase()))
        .map((item) => ({
            ...item,
            school_id: numericSchoolId,
            academic_year_id: numericAcademicYearId,
        }));

    if (missingClasses.length === 0) {
        return { created: 0, total: DEFAULT_CLASSES.length };
    }

    const { data, error } = await supabase
        .from("classes")
        .insert(missingClasses)
        .select("id,class_name");

    if (error) throw error;

    return {
        created: (data || []).length,
        total: DEFAULT_CLASSES.length,
    };
}
