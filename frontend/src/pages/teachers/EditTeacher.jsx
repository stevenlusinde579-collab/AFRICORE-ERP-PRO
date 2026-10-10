import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../services/supabase";
import { resolveSchoolPhotoUrl } from "../../utils/schoolPhotoUrl";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://africore-erp-pro.onrender.com/api";

function EditStaffNonStaff() {

    const { id } = useParams();

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);

    const [saving, setSaving] = useState(false);

    const [loadingRoles, setLoadingRoles] = useState(false);

    const [loadingSubjects, setLoadingSubjects] = useState(false);

    const [loadingClasses, setLoadingClasses] = useState(false);

    const [message, setMessage] = useState("");

    const [messageType, setMessageType] = useState("success");

    const [photoDisplayUrl, setPhotoDisplayUrl] = useState("");


    // =====================================================
    // STAFF & NON-STAFF
    // =====================================================

    const [teacher, setTeacher] = useState({

        staff_type: "Staff",

        employee_number: "",
        first_name: "",
        middle_name: "",
        last_name: "",
        gender: "",
        phone: "",
        email: "",
        employment_date: "",
        qualification: "",
        specialization: "",
        status: "Active",
        photo_url: "",
        school_id: null

    });


    // =====================================================
    // ROLES
    // =====================================================

    const [roles, setRoles] = useState([]);

    const [selectedRoleIds, setSelectedRoleIds] = useState([]);

    const [primaryRoleId, setPrimaryRoleId] = useState("");


    // =====================================================
    // SUBJECTS
    // =====================================================

    const [subjects, setSubjects] = useState([]);


    // =====================================================
    // CLASSES
    // =====================================================

    const [classes, setClasses] = useState([]);


    // =====================================================
    // ASSIGNMENTS
    // =====================================================

    const [assignments, setAssignments] = useState([]);

    const [assignmentSubjectId, setAssignmentSubjectId] =
        useState("");

    const [assignmentClassId, setAssignmentClassId] =
        useState("");

    /*
     * subject
     *    = Subject Teacher assignment
     *
     * class
     *    = Class Teacher assignment
     */

    const [assignmentType, setAssignmentType] =
        useState("subject");


    // =====================================================
    // ROLE HELPERS
    // =====================================================

    const getRoleByName = (name) => {

        return roles.find(
            role =>
                String(role.role_name || "")
                    .trim()
                    .toLowerCase() ===
                String(name)
                    .trim()
                    .toLowerCase()
        );

    };


    const hasRoleByName = (name) => {

        const role = getRoleByName(name);

        if (!role) {

            return false;

        }

        return selectedRoleIds.includes(
            Number(role.id)
        );

    };


    const hasSubjectTeacherRole =
        hasRoleByName("Subject Teacher");


    const hasClassTeacherRole =
        hasRoleByName("Class Teacher");


    /*
     * If both roles exist, user can choose
     * which type of assignment to add.
     *
     * If only Class Teacher exists:
     * automatically use class assignment.
     *
     * If only Subject Teacher exists:
     * automatically use subject assignment.
     */

    const effectiveAssignmentType =
        hasClassTeacherRole && !hasSubjectTeacherRole
            ? "class"
            : hasSubjectTeacherRole && !hasClassTeacherRole
                ? "subject"
                : assignmentType;


    // =====================================================
    // LOAD EVERYTHING
    // =====================================================

    useEffect(() => {

        loadTeacher();

        loadRoles();

        loadSubjects();

    }, [id]);


    useEffect(() => {

        if (teacher.school_id) {

            loadClasses();

        }

    }, [teacher.school_id]);


    // =====================================================
    // KEEP ASSIGNMENT TYPE IN SYNC WITH ROLES
    // =====================================================

    useEffect(() => {

        if (
            hasClassTeacherRole &&
            !hasSubjectTeacherRole
        ) {

            setAssignmentType("class");

            setAssignmentSubjectId("");

        }

        if (
            hasSubjectTeacherRole &&
            !hasClassTeacherRole
        ) {

            setAssignmentType("subject");

        }

    }, [
        selectedRoleIds,
        roles
    ]);


    // =====================================================
    // LOAD STAFF / NON-STAFF
    // =====================================================

    const loadTeacher = async () => {

        try {

            setLoading(true);

            setMessage("");


            const {
                data,
                error
            } = await supabase

                .from("teachers")

                .select("*")

                .eq("id", id)

                .single();


            if (error) {

                console.error(
                    "GET TEACHER ERROR:",
                    error
                );

                setMessage(
                    "Failed to load staff member: " +
                    error.message
                );

                setMessageType("error");

                setLoading(false);

                return;

            }


            // =================================================
            // LOAD PROFILE
            // =================================================

            const {
                data: profileData,
                error: profileError
            } = await supabase

                .from("profiles")

                .select(`
                    id,
                    role_id,
                    school_id,
                    teacher_id
                `)

                .eq(
                    "teacher_id",
                    data.id
                )

                .maybeSingle();


            if (profileError) {

                console.warn(
                    "PROFILE LOAD WARNING:",
                    profileError
                );

            }


            // =================================================
            // LOAD ALL PROFILE ROLES
            // =================================================

            let roleIds = [];

            let primaryId = "";


            if (profileData?.id) {

                const {
                    data: profileRoleData,
                    error: profileRoleError
                } = await supabase

                    .from("profile_roles")

                    .select(`
                        role_id,
                        is_primary,
                        is_active
                    `)

                    .eq(
                        "profile_id",
                        profileData.id
                    )

                    .eq(
                        "is_active",
                        true
                    );


                if (profileRoleError) {

                    console.warn(
                        "PROFILE ROLES LOAD WARNING:",
                        profileRoleError
                    );

                } else {

                    roleIds =
                        (profileRoleData || [])
                            .map(
                                item =>
                                    Number(item.role_id)
                            )
                            .filter(
                                item =>
                                    Number.isFinite(item)
                            );


                    const primaryRole =
                        (profileRoleData || [])
                            .find(
                                item =>
                                    item.is_primary === true
                            );


                    if (primaryRole?.role_id) {

                        primaryId =
                            String(
                                primaryRole.role_id
                            );

                    }

                }

            }


            // =================================================
            // FALLBACK TO profiles.role_id
            // =================================================

            if (
                roleIds.length === 0 &&
                profileData?.role_id
            ) {

                roleIds = [
                    Number(
                        profileData.role_id
                    )
                ];

            }


            if (
                !primaryId &&
                profileData?.role_id
            ) {

                primaryId =
                    String(
                        profileData.role_id
                    );

            }


            setSelectedRoleIds(
                roleIds
            );


            setPrimaryRoleId(
                primaryId
            );


            // =================================================
            // SET STAFF / NON-STAFF
            // =================================================

            setTeacher({

                staff_type:
                    data.staff_type === "Non-Staff"
                        ? "Non-Staff"
                        : "Staff",

                employee_number:
                    data.employee_number || "",

                first_name:
                    data.first_name || "",

                middle_name:
                    data.middle_name || "",

                last_name:
                    data.last_name || "",

                gender:
                    data.gender || "",

                phone:
                    data.phone || "",

                email:
                    data.email || "",

                employment_date:
                    data.employment_date || "",

                qualification:
                    data.qualification || "",

                specialization:
                    data.specialization || "",

                status:
                    data.status || "Active",

                photo_url:
                    data.photo_url || "",

            setPhotoDisplayUrl(
                data.photo_url
                    ? await resolveSchoolPhotoUrl("teacher-photos", data.photo_url)
                    : ""
            );

                school_id:
                    data.school_id ?? null

            });


            // =================================================
            // LOAD ASSIGNMENTS
            // =================================================

            const {
                data: assignmentData,
                error: assignmentError
            } = await supabase

                .from("teacher_assignments")

                .select(`
                    id,
                    school_id,
                    teacher_id,
                    subject_id,
                    class_id
                `)

                .eq(
                    "teacher_id",
                    data.id
                )

                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


            if (assignmentError) {

                console.warn(
                    "ASSIGNMENTS LOAD WARNING:",
                    assignmentError
                );

            } else {

                setAssignments(
                    assignmentData || []
                );

            }

        } catch (error) {

            console.error(
                "LOAD STAFF MEMBER ERROR:",
                error
            );

            setMessage(
                "Failed to load staff member."
            );

            setMessageType("error");

        } finally {

            setLoading(false);

        }

    };


    // =====================================================
    // LOAD ROLES
    // =====================================================

    const loadRoles = async () => {

        try {

            setLoadingRoles(true);


            const {
                data,
                error
            } = await supabase

                .from("roles")

                .select(`
                    id,
                    role_name,
                    description
                `)

                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


            if (error) {

                console.error(
                    "LOAD ROLES ERROR:",
                    error
                );

                setRoles([]);

                return;

            }


            setRoles(
                data || []
            );

        } catch (error) {

            console.error(
                "LOAD ROLES ERROR:",
                error
            );

            setRoles([]);

        } finally {

            setLoadingRoles(false);

        }

    };


    // =====================================================
    // LOAD SUBJECTS
    // =====================================================

    const loadSubjects = async () => {

        try {

            setLoadingSubjects(true);


            const {
                data,
                error
            } = await supabase

                .from("subjects")

                .select(`
                    id,
                    subject_name,
                    subject_code,
                    education_level,
                    is_active
                `)

                .eq(
                    "is_active",
                    true
                )

                .order(
                    "subject_name",
                    {
                        ascending: true
                    }
                );


            if (error) {

                console.error(
                    "LOAD SUBJECTS ERROR:",
                    error
                );

                return;

            }


            setSubjects(
                data || []
            );

        } catch (error) {

            console.error(
                "LOAD SUBJECTS ERROR:",
                error
            );

        } finally {

            setLoadingSubjects(false);

        }

    };


    // =====================================================
    // LOAD CLASSES
    // =====================================================

    const loadClasses = async () => {

        try {

            setLoadingClasses(true);


            const {
                data,
                error
            } = await supabase

                .from("classes")

                .select(`
                    id,
                    school_id,
                    academic_level,
                    class_name,
                    short_name,
                    academic_year_id
                `)

                .eq(
                    "school_id",
                    teacher.school_id
                )

                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


            if (error) {

                console.error(
                    "LOAD CLASSES ERROR:",
                    error
                );

                return;

            }


            setClasses(
                data || []
            );

        } catch (error) {

            console.error(
                "LOAD CLASSES ERROR:",
                error
            );

        } finally {

            setLoadingClasses(false);

        }

    };


    // =====================================================
    // HANDLE STAFF / NON-STAFF CHANGE
    // =====================================================

    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;


        setTeacher(
            previous => ({
                ...previous,
                [name]: value
            })
        );

    };


    // =====================================================
    // ROLE CHECKBOX
    // =====================================================

    const toggleRole = (roleId) => {

        const numericRoleId =
            Number(roleId);


        setSelectedRoleIds(
            previous => {

                const exists =
                    previous.includes(
                        numericRoleId
                    );


                if (exists) {

                    /*
                     * If removing the primary role,
                     * remove it as primary too.
                     */

                    if (
                        String(primaryRoleId) ===
                        String(numericRoleId)
                    ) {

                        setPrimaryRoleId("");

                    }


                    return previous.filter(
                        item =>
                            item !== numericRoleId
                    );

                }


                return [
                    ...previous,
                    numericRoleId
                ];

            }
        );

    };


    // =====================================================
    // PRIMARY ROLE
    // =====================================================

    const selectPrimaryRole = (roleId) => {

        const numericRoleId =
            Number(roleId);


        if (
            !selectedRoleIds.includes(
                numericRoleId
            )
        ) {

            setSelectedRoleIds(
                previous => [
                    ...previous,
                    numericRoleId
                ]
            );

        }


        setPrimaryRoleId(
            String(numericRoleId)
        );

    };


    // =====================================================
    // ASSIGNMENT TYPE
    // =====================================================

    const handleAssignmentTypeChange = (type) => {

        setAssignmentType(type);

        /*
         * Clear subject when switching to
         * Class Teacher assignment.
         */

        if (type === "class") {

            setAssignmentSubjectId("");

        }

    };


    // =====================================================
    // ADD ASSIGNMENT
    // =====================================================

    const addAssignment = () => {

        const type =
            effectiveAssignmentType;


        // =================================================
        // CLASS TEACHER ASSIGNMENT
        // =================================================

        if (type === "class") {

            if (!hasClassTeacherRole) {

                setMessage(
                    "Please select the Class Teacher role first."
                );

                setMessageType("error");

                return;

            }


            if (!assignmentClassId) {

                setMessage(
                    "Please select a class for the Class Teacher assignment."
                );

                setMessageType("error");

                return;

            }


            const classId =
                Number(assignmentClassId);


            const alreadyExists =
                assignments.some(
                    assignment =>

                        (
                            assignment.subject_id === null ||
                            assignment.subject_id === undefined ||
                            assignment.subject_id === ""
                        ) &&

                        Number(
                            assignment.class_id
                        ) === classId
                );


            if (alreadyExists) {

                setMessage(
                    "This class is already assigned as a Class Teacher."
                );

                setMessageType("error");

                return;

            }


            const selectedClass =
                classes.find(
                    item =>
                        Number(item.id) === classId
                );


            setAssignments(
                previous => [

                    ...previous,

                    {
                        id:
                            `new-${Date.now()}`,

                        school_id:
                            teacher.school_id,

                        teacher_id:
                            Number(id),

                        subject_id:
                            null,

                        class_id:
                            classId,

                        subject_name:
                            "",

                        subject_code:
                            "",

                        class_name:
                            selectedClass?.class_name || "",

                        academic_level:
                            selectedClass?.academic_level || "",

                        assignment_type:
                            "class_teacher",

                        is_new:
                            true

                    }

                ]
            );


            setAssignmentClassId("");

            setAssignmentSubjectId("");

            setMessage(
                "Class Teacher assignment added successfully."
            );

            setMessageType("success");

            return;

        }


        // =================================================
        // SUBJECT TEACHER ASSIGNMENT
        // =================================================

        if (!hasSubjectTeacherRole) {

            setMessage(
                "Please select the Subject Teacher role first."
            );

            setMessageType("error");

            return;

        }


        if (!assignmentSubjectId) {

            setMessage(
                "Please select a subject."
            );

            setMessageType("error");

            return;

        }


        if (!assignmentClassId) {

            setMessage(
                "Please select a class."
            );

            setMessageType("error");

            return;

        }


        const subjectId =
            Number(assignmentSubjectId);

        const classId =
            Number(assignmentClassId);


        /*
         * Subject Teacher duplicate:
         *
         * same subject + same class
         */

        const alreadyExists =
            assignments.some(
                assignment =>

                    assignment.subject_id !== null &&
                    assignment.subject_id !== undefined &&
                    Number(
                        assignment.subject_id
                    ) === subjectId &&

                    Number(
                        assignment.class_id
                    ) === classId
            );


        if (alreadyExists) {

            setMessage(
                "This subject and class assignment already exists."
            );

            setMessageType("error");

            return;

        }


        const subject =
            subjects.find(
                item =>
                    Number(item.id) === subjectId
            );


        const selectedClass =
            classes.find(
                item =>
                    Number(item.id) === classId
            );


        setAssignments(
            previous => [

                ...previous,

                {
                    id:
                        `new-${Date.now()}`,

                    school_id:
                        teacher.school_id,

                    teacher_id:
                        Number(id),

                    subject_id:
                        subjectId,

                    class_id:
                        classId,

                    subject_name:
                        subject?.subject_name || "",

                    subject_code:
                        subject?.subject_code || "",

                    class_name:
                        selectedClass?.class_name || "",

                    academic_level:
                        selectedClass?.academic_level || "",

                    assignment_type:
                        "subject_teacher",

                    is_new:
                        true

                }

            ]
        );


        setAssignmentSubjectId("");

        setAssignmentClassId("");

        setMessage(
            "Subject Teacher assignment added successfully."
        );

        setMessageType("success");

    };


    // =====================================================
    // REMOVE ASSIGNMENT
    // =====================================================

    const removeAssignment = (assignment) => {

        setAssignments(
            previous =>
                previous.filter(
                    item =>
                        item !== assignment
                )
        );

        setMessage(
            "Assignment removed from the update list."
        );

        setMessageType("success");

    };


    // =====================================================
    // PHOTO
    // =====================================================

    const handlePhoto = async (e) => {

        const file =
            e.target.files?.[0];


        if (!file) {

            return;

        }


        try {

            setMessage(
                "Uploading photo..."
            );

            setMessageType("success");


            const currentSchoolId = Number(teacher.school_id);

            if (!Number.isInteger(currentSchoolId) || currentSchoolId <= 0) {
                setMessage("School ownership could not be verified. Reload the teacher record and try again.");
                setMessageType("error");
                return;
            }

            const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
            if (!allowedTypes.includes(file.type)) {
                setMessage("Please upload a JPG, PNG or WEBP image.");
                setMessageType("error");
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                setMessage("Photo must not exceed 5MB.");
                setMessageType("error");
                return;
            }

            const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
            const fileName = `${currentSchoolId}/teachers/${Date.now()}-${crypto.randomUUID()}.${extension}`;

            const {
                error: uploadError
            } = await supabase.storage
                .from("teacher-photos")
                .upload(fileName, file, {
                    cacheControl: "3600",
                    upsert: false
                });


            if (uploadError) {

                console.error(
                    uploadError
                );

                setMessage(
                    "Photo upload failed: " +
                    uploadError.message
                );

                setMessageType("error");

                return;

            }


            const signedPhotoUrl = await resolveSchoolPhotoUrl(
                "teacher-photos",
                fileName
            );

            setTeacher(
                previous => ({
                    ...previous,
                    // Store the school-folder object path, never a public URL.
                    photo_url: fileName
                })
            );
            setPhotoDisplayUrl(signedPhotoUrl);


            setMessage(
                "Photo uploaded successfully âœ…"
            );

            setMessageType("success");

        } catch (error) {

            console.error(
                "PHOTO ERROR:",
                error
            );

            setMessage(
                "Photo upload failed."
            );

            setMessageType("error");

        }

    };


    // =====================================================
    // UPDATE STAFF / NON-STAFF
    // =====================================================

    const updateTeacher = async (e) => {

        e.preventDefault();


        if (!teacher.employee_number) {

            setMessage(
                "Employee Number is required."
            );

            setMessageType("error");

            return;

        }


        if (!teacher.first_name) {

            setMessage(
                "First Name is required."
            );

            setMessageType("error");

            return;

        }


        if (!teacher.last_name) {

            setMessage(
                "Last Name is required."
            );

            setMessageType("error");

            return;

        }


        if (selectedRoleIds.length === 0) {

            setMessage(
                "Please select at least one System Role."
            );

            setMessageType("error");

            return;

        }


        if (!primaryRoleId) {

            setMessage(
                "Please select a Primary Role."
            );

            setMessageType("error");

            return;

        }


        if (
            !selectedRoleIds.includes(
                Number(primaryRoleId)
            )
        ) {

            setMessage(
                "Primary Role must be one of the selected roles."
            );

            setMessageType("error");

            return;

        }


        // =================================================
        // ASSIGNMENT VALIDATION
        // =================================================

        /*
         * If Subject Teacher role is selected,
         * at least one subject assignment is required.
         */

        if (hasSubjectTeacherRole) {

            const subjectAssignments =
                assignments.filter(
                    assignment =>

                        assignment.subject_id !== null &&
                        assignment.subject_id !== undefined &&
                        assignment.subject_id !== ""
                );


            if (subjectAssignments.length === 0) {

                setMessage(
                    "Subject Teacher role requires at least one Subject + Class assignment."
                );

                setMessageType("error");

                return;

            }

        }


        /*
         * If Class Teacher role is selected,
         * at least one class-only assignment is required.
         */

        if (hasClassTeacherRole) {

            const classTeacherAssignments =
                assignments.filter(
                    assignment =>

                        (
                            assignment.subject_id === null ||
                            assignment.subject_id === undefined ||
                            assignment.subject_id === ""
                        )
                );


            if (classTeacherAssignments.length === 0) {

                setMessage(
                    "Class Teacher role requires at least one Class assignment."
                );

                setMessageType("error");

                return;

            }

        }


        try {

            setSaving(true);

            setMessage("");


            // =================================================
            // GET CURRENT SESSION
            // =================================================

            const {
                data: sessionData,
                error: sessionError
            } = await supabase.auth.getSession();


            if (
                sessionError ||
                !sessionData?.session?.access_token
            ) {

                setMessage(
                    "Your login session has expired. Please login again."
                );

                setMessageType("error");

                return;

            }


            const token =
                sessionData.session.access_token;


            // =================================================
            // PREPARE ASSIGNMENTS
            // =================================================

            const cleanAssignments =
                assignments.map(
                    assignment => ({

                        id:
                            typeof assignment.id === "number"
                                ? assignment.id
                                : null,

                        /*
                         * IMPORTANT:
                         *
                         * Class Teacher:
                         * subject_id = null
                         *
                         * Subject Teacher:
                         * subject_id = actual subject ID
                         */

                        subject_id:
                            (
                                assignment.subject_id === null ||
                                assignment.subject_id === undefined ||
                                assignment.subject_id === ""
                            )
                                ? null
                                : Number(
                                    assignment.subject_id
                                ),

                        class_id:
                            Number(
                                assignment.class_id
                            ),

                        school_id:
                            teacher.school_id

                    })
                );


            console.log(
                "UPDATE TEACHER ASSIGNMENTS:",
                cleanAssignments
            );


            // =================================================
            // UPDATE THROUGH BACKEND
            // =================================================

            const response =
                await axios.put(

                    `${API_URL}/teachers/${id}`,

                    {

                        teacher: {

                            staff_type:
                                teacher.staff_type === "Non-Staff"
                                    ? "Non-Staff"
                                    : "Staff",

                            employee_number:
                                teacher.employee_number,

                            first_name:
                                teacher.first_name,

                            middle_name:
                                teacher.middle_name,

                            last_name:
                                teacher.last_name,

                            gender:
                                teacher.gender,

                            phone:
                                teacher.phone,

                            email:
                                teacher.email,

                            employment_date:
                                teacher.employment_date ||
                                null,

                            qualification:
                                teacher.qualification,

                            specialization:
                                teacher.specialization,

                            status:
                                teacher.status,

                            photo_url:
                                teacher.photo_url,

                            school_id:
                                teacher.school_id

                        },


                        // =================================================
                        // MULTIPLE ROLES
                        // =================================================

                        role_ids:
                            selectedRoleIds.map(
                                roleId =>
                                    Number(roleId)
                            ),


                        // =================================================
                        // PRIMARY ROLE
                        // =================================================

                        primary_role_id:
                            Number(
                                primaryRoleId
                            ),


                        // =================================================
                        // ASSIGNMENTS
                        // =================================================

                        assignments:
                            cleanAssignments

                    },

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"

                        }

                    }

                );


            console.log(
                "UPDATE TEACHER RESPONSE:",
                response.data
            );


            setMessage(
                "Staff member updated successfully âœ…"
            );

            setMessageType("success");


            setTimeout(
                () => {

                    navigate("/teachers");

                },
                1200
            );


        } catch (error) {

            console.error(
                "UPDATE TEACHER ERROR:",
                error
            );


            const backendMessage =
                error?.response?.data?.message;


            setMessage(
                backendMessage ||
                error?.message ||
                "Failed to update staff member."
            );

            setMessageType("error");

        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (

            <div className="bg-white p-6 rounded-xl shadow">

                <div className="text-lg font-semibold">

                    Loading teacher...

                </div>

            </div>

        );

    }


    // =====================================================
    // RENDER
    // =====================================================

    return (

        <div className="space-y-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div>

                <h1 className="text-3xl font-bold text-gray-800">

                    Edit Staff & Non-Staff

                </h1>

                <p className="text-gray-600 mt-2">

                    Update staff/non-staff information, system roles
                    and teaching assignments where applicable.

                </p>

            </div>


            {/* =================================================
                MESSAGE
            ================================================= */}

            {message && (

                <div
                    className={
                        `p-4 rounded-lg border ${
                            messageType === "error"
                                ? "bg-red-50 border-red-200 text-red-700"
                                : "bg-green-50 border-green-200 text-green-700"
                        }`
                    }
                >

                    {message}

                </div>

            )}


            {/* =================================================
                FORM
            ================================================= */}

            <form
                onSubmit={updateTeacher}
                className="bg-white shadow rounded-xl p-6"
            >

                {/* =============================================
                    BASIC INFORMATION
                ============================================= */}

                <div className="mb-8">

                    <h2 className="text-xl font-bold text-gray-800 mb-4">

                        Staff & Non-Staff Information

                    </h2>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        <input
                            name="employee_number"
                            value={teacher.employee_number}
                            onChange={handleChange}
                            placeholder="Employee Number"
                            className="border p-3 rounded-lg"
                            required
                        />


                        <div>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">

                                Staff Type

                            </label>

                            <select
                                name="staff_type"
                                value={teacher.staff_type}
                                onChange={handleChange}
                                className="border p-3 rounded-lg w-full"
                                required
                            >

                                <option value="Staff">

                                    Staff (Teaching)

                                </option>

                                <option value="Non-Staff">

                                    Non-Staff (Non-Teaching)

                                </option>

                            </select>

                        </div>


                        <input
                            name="first_name"
                            value={teacher.first_name}
                            onChange={handleChange}
                            placeholder="First Name"
                            className="border p-3 rounded-lg"
                            required
                        />


                        <input
                            name="middle_name"
                            value={teacher.middle_name}
                            onChange={handleChange}
                            placeholder="Middle Name"
                            className="border p-3 rounded-lg"
                        />


                        <input
                            name="last_name"
                            value={teacher.last_name}
                            onChange={handleChange}
                            placeholder="Last Name"
                            className="border p-3 rounded-lg"
                            required
                        />


                        <select
                            name="gender"
                            value={teacher.gender}
                            onChange={handleChange}
                            className="border p-3 rounded-lg"
                        >

                            <option value="">

                                Select Gender

                            </option>

                            <option value="Male">

                                Male

                            </option>

                            <option value="Female">

                                Female

                            </option>

                        </select>


                        <input
                            name="phone"
                            value={teacher.phone}
                            onChange={handleChange}
                            placeholder="Phone"
                            className="border p-3 rounded-lg"
                        />


                        <input
                            type="email"
                            name="email"
                            value={teacher.email}
                            onChange={handleChange}
                            placeholder="Email"
                            className="border p-3 rounded-lg"
                        />


                        <input
                            type="date"
                            name="employment_date"
                            value={teacher.employment_date || ""}
                            onChange={handleChange}
                            className="border p-3 rounded-lg"
                        />


                        <input
                            name="qualification"
                            value={teacher.qualification}
                            onChange={handleChange}
                            placeholder="Qualification"
                            className="border p-3 rounded-lg"
                        />


                        <input
                            name="specialization"
                            value={teacher.specialization}
                            onChange={handleChange}
                            placeholder="Specialization"
                            className="border p-3 rounded-lg"
                        />


                        <select
                            name="status"
                            value={teacher.status}
                            onChange={handleChange}
                            className="border p-3 rounded-lg"
                        >

                            <option value="Active">

                                Active

                            </option>

                            <option value="Inactive">

                                Inactive

                            </option>

                        </select>


                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhoto}
                            className="border p-3 rounded-lg"
                        />

                    </div>


                    {/* PHOTO */}

                    {photoDisplayUrl && (

                        <div className="mt-5">

                            <p className="mb-2 font-semibold">

                                Current Photo

                            </p>


                            <img
                                src={photoDisplayUrl}
                                alt="Staff member"
                                className="w-32 h-32 rounded-full object-cover border"
                            />

                        </div>

                    )}

                </div>


                {/* =============================================
                    MULTIPLE SYSTEM ROLES
                ============================================= */}

                <div className="mb-8">

                    <h2 className="text-xl font-bold text-gray-800 mb-2">

                        System Roles

                    </h2>


                    <p className="text-sm text-gray-500 mb-5">

                        Select all roles this staff member should have.
                        Choose one selected role as the Primary Role.

                    </p>


                    {loadingRoles ? (

                        <div className="border rounded-xl p-5 text-gray-500">

                            Loading system roles...

                        </div>

                    ) : roles.length === 0 ? (

                        <div className="border border-red-200 bg-red-50 rounded-xl p-5 text-red-700">

                            No system roles were found.

                        </div>

                    ) : (

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                            {roles.map(role => {

                                const roleId =
                                    Number(role.id);

                                const checked =
                                    selectedRoleIds.includes(
                                        roleId
                                    );

                                const isPrimary =
                                    String(
                                        primaryRoleId
                                    ) ===
                                    String(roleId);


                                return (

                                    <div
                                        key={role.id}
                                        className={
                                            `rounded-xl border p-4 transition ${
                                                checked
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 bg-white"
                                            }`
                                        }
                                    >

                                        <div className="flex items-start gap-3">

                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    toggleRole(
                                                        roleId
                                                    )
                                                }
                                                className="mt-1 h-5 w-5"
                                            />


                                            <div className="flex-1">

                                                <div className="font-semibold text-gray-800">

                                                    {role.role_name}

                                                </div>


                                                {role.description && (

                                                    <div className="text-xs text-gray-500 mt-1">

                                                        {role.description}

                                                    </div>

                                                )}


                                                {checked && (

                                                    <label className="flex items-center gap-2 mt-3 text-sm font-medium text-blue-700 cursor-pointer">

                                                        <input
                                                            type="radio"
                                                            name="primaryRole"
                                                            checked={
                                                                isPrimary
                                                            }
                                                            onChange={() =>
                                                                selectPrimaryRole(
                                                                    roleId
                                                                )
                                                            }
                                                            className="h-4 w-4"
                                                        />

                                                        Primary Role

                                                    </label>

                                                )}

                                            </div>

                                        </div>

                                    </div>

                                );

                            })}

                        </div>

                    )}


                    {selectedRoleIds.length > 0 && (

                        <div className="mt-4 rounded-xl bg-slate-50 border p-4">

                            <p className="text-sm font-semibold text-gray-700">

                                Selected Roles:{" "}

                                {selectedRoleIds.length}

                            </p>


                            <p className="text-sm text-gray-500 mt-1">

                                Primary Role:{" "}

                                {
                                    roles.find(
                                        role =>
                                            Number(role.id) ===
                                            Number(primaryRoleId)
                                    )?.role_name ||
                                    "Not selected"
                                }

                            </p>

                        </div>

                    )}

                </div>


                {/* =============================================
                    TEACHING ASSIGNMENTS
                    ONLY FOR TEACHING STAFF
                ============================================= */}

                {teacher.staff_type === "Staff" && (

                    <div className="mb-8">

                        {/* =========================================
                            HEADER
                        ========================================= */}

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">

                            <h2 className="text-xl font-bold text-gray-800">

                                Teaching Assignments

                            </h2>


                            <span className="text-sm text-gray-500">

                                {assignments.length} assignment
                                {assignments.length === 1 ? "" : "s"}

                            </span>

                        </div>


                        <p className="text-sm text-gray-500 mb-5">

                            Subject Teachers are assigned a Subject +
                            Class. Class Teachers are assigned a Class
                            only.

                        </p>


                        {/* =========================================
                            ROLE STATUS
                        ========================================= */}

                        {!hasSubjectTeacherRole &&
                            !hasClassTeacherRole && (

                                <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4 mb-5 text-yellow-800">

                                    Select the{" "}
                                    <strong>
                                        Subject Teacher
                                    </strong>{" "}
                                    or{" "}
                                    <strong>
                                        Class Teacher
                                    </strong>{" "}
                                    role above to add teaching
                                    assignments.

                                </div>

                            )}


                        {/* =========================================
                            ASSIGNMENT TYPE SWITCH
                            ONLY WHEN BOTH ROLES EXIST
                        ========================================= */}

                        {hasSubjectTeacherRole &&
                            hasClassTeacherRole && (

                                <div className="mb-5">

                                    <label className="block text-sm font-semibold text-gray-700 mb-2">

                                        Assignment Type

                                    </label>


                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleAssignmentTypeChange(
                                                    "subject"
                                                )
                                            }
                                            className={
                                                `text-left border rounded-xl p-4 transition ${
                                                    assignmentType === "subject"
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-gray-200 bg-white hover:border-blue-300"
                                                }`
                                            }
                                        >

                                            <div className="font-bold text-gray-800">

                                                Subject Teacher

                                            </div>

                                            <div className="text-sm text-gray-500 mt-1">

                                                Assign Subject + Class

                                            </div>

                                        </button>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleAssignmentTypeChange(
                                                    "class"
                                                )
                                            }
                                            className={
                                                `text-left border rounded-xl p-4 transition ${
                                                    assignmentType === "class"
                                                        ? "border-green-500 bg-green-50"
                                                        : "border-gray-200 bg-white hover:border-green-300"
                                                }`
                                            }
                                        >

                                            <div className="font-bold text-gray-800">

                                                Class Teacher

                                            </div>

                                            <div className="text-sm text-gray-500 mt-1">

                                                Assign Class Only

                                            </div>

                                        </button>

                                    </div>

                                </div>

                            )}


                        {/* =========================================
                            CLASS TEACHER ONLY
                        ========================================= */}

                        {effectiveAssignmentType === "class" &&
                            hasClassTeacherRole && (

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    <select
                                        value={assignmentClassId}
                                        onChange={e =>
                                            setAssignmentClassId(
                                                e.target.value
                                            )
                                        }
                                        className="border p-3 rounded-lg"
                                        disabled={loadingClasses}
                                    >

                                        <option value="">

                                            {loadingClasses
                                                ? "Loading classes..."
                                                : "Select Class"
                                            }

                                        </option>


                                        {classes.map(item => (

                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >

                                                {item.class_name}

                                                {item.academic_level
                                                    ? ` â€” ${item.academic_level}`
                                                    : ""
                                                }

                                            </option>

                                        ))}

                                    </select>


                                    <button
                                        type="button"
                                        onClick={addAssignment}
                                        className="bg-green-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-700"
                                    >

                                        + Assign Class Teacher

                                    </button>

                                </div>

                            )}


                        {/* =========================================
                            SUBJECT TEACHER
                        ========================================= */}

                        {effectiveAssignmentType === "subject" &&
                            hasSubjectTeacherRole && (

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                    <select
                                        value={assignmentSubjectId}
                                        onChange={e =>
                                            setAssignmentSubjectId(
                                                e.target.value
                                            )
                                        }
                                        className="border p-3 rounded-lg"
                                        disabled={loadingSubjects}
                                    >

                                        <option value="">

                                            {loadingSubjects
                                                ? "Loading subjects..."
                                                : "Select Subject"
                                            }

                                        </option>


                                        {subjects.map(subject => (

                                            <option
                                                key={subject.id}
                                                value={subject.id}
                                            >

                                                {subject.subject_name}

                                                {subject.subject_code
                                                    ? ` (${subject.subject_code})`
                                                    : ""
                                                }

                                            </option>

                                        ))}

                                    </select>


                                    <select
                                        value={assignmentClassId}
                                        onChange={e =>
                                            setAssignmentClassId(
                                                e.target.value
                                            )
                                        }
                                        className="border p-3 rounded-lg"
                                        disabled={loadingClasses}
                                    >

                                        <option value="">

                                            {loadingClasses
                                                ? "Loading classes..."
                                                : "Select Class"
                                            }

                                        </option>


                                        {classes.map(item => (

                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >

                                                {item.class_name}

                                                {item.academic_level
                                                    ? ` â€” ${item.academic_level}`
                                                    : ""
                                                }

                                            </option>

                                        ))}

                                    </select>


                                    <button
                                        type="button"
                                        onClick={addAssignment}
                                        className="bg-green-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-700"
                                    >

                                        + Add Subject Assignment

                                    </button>

                                </div>

                            )}


                        {/* =========================================
                            ASSIGNMENTS TABLE
                        ========================================= */}

                        <div className="mt-5 border rounded-xl overflow-hidden">

                            {assignments.length === 0 ? (

                                <div className="p-6 text-center text-gray-500">

                                    No teaching assignments have been
                                    added to this staff member.

                                </div>

                            ) : (

                                <div className="overflow-x-auto">

                                    <table className="w-full">

                                        <thead className="bg-gray-100">

                                            <tr>

                                                <th className="text-left p-3">

                                                    #

                                                </th>

                                                <th className="text-left p-3">

                                                    Assignment Type

                                                </th>

                                                <th className="text-left p-3">

                                                    Subject

                                                </th>

                                                <th className="text-left p-3">

                                                    Class

                                                </th>

                                                <th className="text-left p-3">

                                                    Action

                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {assignments.map(
                                                (assignment, index) => {

                                                    const isClassTeacherAssignment =
                                                        assignment.subject_id === null ||
                                                        assignment.subject_id === undefined ||
                                                        assignment.subject_id === "";


                                                    const subject =
                                                        subjects.find(
                                                            item =>
                                                                Number(item.id) ===
                                                                Number(
                                                                    assignment.subject_id
                                                                )
                                                        );


                                                    const selectedClass =
                                                        classes.find(
                                                            item =>
                                                                Number(item.id) ===
                                                                Number(
                                                                    assignment.class_id
                                                                )
                                                        );


                                                    const subjectName =
                                                        assignment.subject_name ||
                                                        subject?.subject_name ||
                                                        "";


                                                    const className =
                                                        assignment.class_name ||
                                                        selectedClass?.class_name ||
                                                        (
                                                            assignment.class_id
                                                                ? `Class #${assignment.class_id}`
                                                                : ""
                                                        );


                                                    return (

                                                        <tr
                                                            key={
                                                                assignment.id ||
                                                                `${assignment.subject_id}-${assignment.class_id}-${index}`
                                                            }
                                                            className="border-t"
                                                        >

                                                            <td className="p-3">

                                                                {index + 1}

                                                            </td>


                                                            <td className="p-3">

                                                                {isClassTeacherAssignment ? (

                                                                    <span className="inline-flex px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">

                                                                        Class Teacher

                                                                    </span>

                                                                ) : (

                                                                    <span className="inline-flex px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">

                                                                        Subject Teacher

                                                                    </span>

                                                                )}

                                                            </td>


                                                            <td className="p-3 font-medium">

                                                                {isClassTeacherAssignment
                                                                    ? (
                                                                        <span className="text-gray-400">

                                                                            â€”

                                                                        </span>
                                                                    )
                                                                    : subjectName
                                                                }

                                                            </td>


                                                            <td className="p-3">

                                                                {className}

                                                            </td>


                                                            <td className="p-3">

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        removeAssignment(
                                                                            assignment
                                                                        )
                                                                    }
                                                                    className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200"
                                                                >

                                                                    Remove

                                                                </button>

                                                            </td>

                                                        </tr>

                                                    );

                                                }
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                        </div>

                    </div>

                )}


                {/* =============================================
                    ACTIONS
                ============================================= */}

                <div className="flex flex-wrap gap-4 pt-5 border-t">

                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >

                        {saving
                            ? "Updating..."
                            : "Update Staff & Non-Staff"
                        }

                    </button>


                    <button
                        type="button"
                        onClick={() =>
                            navigate("/teachers")
                        }
                        className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700"
                    >

                        Cancel

                    </button>

                </div>

            </form>

        </div>

    );

}


export default EditStaffNonStaff;
