/**
 * Official curriculum source registry for Tanzania.
 *
 * This registry records provenance and education-level coverage only.
 * It deliberately does not reproduce TIE curriculum text. Topic catalogues
 * must be extracted/curated from permitted official materials and versioned
 * separately with teacher review.
 */
export const TANZANIA_CURRICULUM_SOURCES = Object.freeze({
    country: "Tanzania",
    authority: "Tanzania Institute of Education (TIE)",
    curriculumEdition: "2023",
    levels: Object.freeze({
        pre_primary: {
            aliases: ["pre-primary", "nursery", "baby class", "kindergarten", "early years"],
            title: "Curriculum and Syllabus for Pre-primary Education",
            year: 2023,
            officialUrl: "https://www.tie.go.tz/uploads/files/Curriculum%20and%20sylabus%20for%20Pre-primary%20Teacher%20Education%202.pdf",
            status: "official_source_registered",
        },
        primary: {
            aliases: ["primary", "standard i", "standard ii", "standard iii", "standard iv", "standard v", "standard vi"],
            title: "Curriculum for Primary Education, Standard I–VI",
            year: 2023,
            officialUrl: "https://www.tie.go.tz/uploads/files/Translated%20Primary%20School%20Curriculum.pdf",
            syllabusIndexUrl: "https://www.tie.go.tz/publications",
            status: "official_source_registered",
        },
        ordinary_secondary: {
            aliases: ["ordinary secondary", "o-level", "form i", "form ii", "form iii", "form iv"],
            title: "Curriculum for Ordinary Secondary Education, Form I–IV",
            year: 2023,
            officialUrl: "https://www.tie.go.tz/uploads/documents/en-1726825742-CURRICULUM%20FOR%20SECONDARY%20EDUCATION%20FORM%20I-IV.pdf",
            subjectSyllabusIndexUrl: "https://www.tie.go.tz/publications/syllabus-for-lower-secondary-academics",
            status: "official_source_registered",
        },
        advanced_secondary: {
            aliases: ["advanced secondary", "a-level", "form v", "form vi"],
            title: "Curriculum for Secondary Education, Form V–VI",
            year: 2023,
            officialUrl: "https://www.tie.go.tz/uploads/files/Curriculum%20For%20Secondary%20Education%20Form%20V%20-%20VI.pdf",
            status: "official_source_registered",
        },
    }),
});

export default TANZANIA_CURRICULUM_SOURCES;
