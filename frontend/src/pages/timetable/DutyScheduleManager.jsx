import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    supabase
} from "../../services/supabase";

import {
    FaPlus,
    FaEdit,
    FaTrash,
    FaTimes,
    FaSave,
    FaCalendarAlt,
    FaClock,
    FaUserTie,
    FaMapMarkerAlt,
    FaSyncAlt,
    FaPrint,
    FaRedo,
    FaCheckCircle
} from "react-icons/fa";


// =====================================================
// DUTY AREAS
// =====================================================

const DUTY_AREAS = [
    "General School Supervision",
    "Morning Assembly",
    "Classroom Supervision",
    "Break Time Supervision",
    "Lunch Supervision",
    "Games & Sports",
    "Gate Supervision",
    "Evening Supervision",
    "Dormitory Supervision",
    "Examination Supervision",
    "Other"
];


// =====================================================
// STATUS
// =====================================================

const STATUS_OPTIONS = [
    "scheduled",
    "completed",
    "cancelled"
];


// =====================================================
// DATE HELPERS
// =====================================================

const parseLocalDate = (value) => {

    if (!value) {
        return null;
    }

    const date = new Date(
        `${value}T00:00:00`
    );

    return Number.isNaN(date.getTime())
        ? null
        : date;
};


const formatInputDate = (date) => {

    if (!date) {
        return "";
    }

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};


const getDayName = (value) => {

    const date =
        parseLocalDate(value);

    if (!date) {
        return "";
    }

    return date.toLocaleDateString(
        "en-US",
        {
            weekday: "long"
        }
    );
};


const addDays = (
    date,
    number
) => {

    const result =
        new Date(date);

    result.setDate(
        result.getDate() + number
    );

    return result;
};


const getDatesBetween = (
    startDate,
    endDate
) => {

    const start =
        parseLocalDate(startDate);

    const end =
        parseLocalDate(endDate);

    if (!start || !end) {
        return [];
    }

    const dates = [];

    let current =
        new Date(start);

    while (current <= end) {

        dates.push(
            formatInputDate(current)
        );

        current =
            addDays(current, 1);
    }

    return dates;
};


const getInclusiveDayCount = (
    startDate,
    endDate
) => {

    const start =
        parseLocalDate(startDate);

    const end =
        parseLocalDate(endDate);

    if (!start || !end) {
        return 0;
    }

    const difference =
        Math.round(
            (
                end.getTime() -
                start.getTime()
            ) /
            (
                1000 *
                60 *
                60 *
                24
            )
        );

    return difference + 1;
};


const getDateDifference = (
    firstDate,
    secondDate
) => {

    const first =
        parseLocalDate(firstDate);

    const second =
        parseLocalDate(secondDate);

    if (!first || !second) {
        return null;
    }

    return Math.round(
        (
            second.getTime() -
            first.getTime()
        ) /
        (
            1000 *
            60 *
            60 *
            24
        )
    );
};


// =====================================================
// COMPONENT
// =====================================================

function DutyScheduleManager() {

    // =================================================
    // USER / SCHOOL
    // =================================================

    const [
        user,
        setUser
    ] = useState(null);

    const [
        schoolId,
        setSchoolId
    ] = useState(null);


    // =================================================
    // DATA
    // =================================================

    const [
        academicYears,
        setAcademicYears
    ] = useState([]);

    const [
        teachers,
        setTeachers
    ] = useState([]);

    const [
        dutySchedules,
        setDutySchedules
    ] = useState([]);


    // =================================================
    // UI
    // =================================================

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        saving,
        setSaving
    ] = useState(false);

    const [
        message,
        setMessage
    ] = useState("");

    const [
        messageType,
        setMessageType
    ] = useState("");

    const [
        showForm,
        setShowForm
    ] = useState(false);


    // =================================================
    // EDIT GROUP
    //
    // IMPORTANT:
    // This stores the ENTIRE existing duty plan.
    // Edit updates these exact IDs.
    // It does NOT create another plan.
    // =================================================

    const [
        editingGroup,
        setEditingGroup
    ] = useState(null);


    // =================================================
    // FORM
    // =================================================

    const [
        form,
        setForm
    ] = useState({
        academic_year_id: "",
        start_date: "",
        end_date: "",
        teacher_id: "",
        duty_areas: [],
        start_time: "",
        end_time: "",
        location: "",
        notes: "",
        status: "scheduled"
    });


    // =================================================
    // LOAD CURRENT USER
    // =================================================

    const loadCurrentUser = async () => {

        try {

            const {
                data: authData,
                error: authError
            } = await supabase.auth.getUser();

            if (authError) {
                throw authError;
            }

            const authUser =
                authData?.user;

            if (!authUser) {
                throw new Error(
                    "Authenticated user not found."
                );
            }

            setUser(authUser);

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .select(
                    "id,school_id"
                )
                .eq(
                    "id",
                    authUser.id
                )
                .single();

            if (profileError) {
                throw profileError;
            }

            if (!profile?.school_id) {
                throw new Error(
                    "School ID was not found for the current user."
                );
            }

            setSchoolId(
                Number(profile.school_id)
            );

            return {
                authUser,
                schoolId:
                    Number(
                        profile.school_id
                    )
            };

        } catch (error) {

            console.error(
                "LOAD CURRENT USER ERROR:",
                error
            );

            setMessage(
                error?.message ||
                "Failed to load current user."
            );

            setMessageType(
                "error"
            );

            throw error;
        }
    };


    // =================================================
    // LOAD ACADEMIC YEARS
    // =================================================

    const loadAcademicYears = async (
        currentSchoolId
    ) => {

        if (!currentSchoolId) {
            return;
        }

        const {
            data,
            error
        } = await supabase
            .from("academic_years")
            .select(
                `
                id,
                school_id,
                year_name,
                term,
                start_date,
                end_date,
                is_active,
                created_at
                `
            )
            .eq(
                "school_id",
                Number(currentSchoolId)
            )
            .order(
                "start_date",
                {
                    ascending: false
                }
            );

        if (error) {

            console.error(
                "LOAD ACADEMIC YEARS ERROR:",
                error
            );

            throw error;
        }

        setAcademicYears(
            data || []
        );
    };


    // =================================================
    // LOAD TEACHERS
    // =================================================

    const loadTeachers = async (
        currentSchoolId
    ) => {

        if (!currentSchoolId) {
            return;
        }

        const {
            data,
            error
        } = await supabase
            .from("teachers")
            .select(
                `
                id,
                school_id,
                employee_number,
                first_name,
                middle_name,
                last_name,
                phone,
                email,
                status,
                staff_type
                `
            )
            .eq(
                "school_id",
                Number(currentSchoolId)
            )
            .order(
                "first_name",
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                "LOAD TEACHERS ERROR:",
                error
            );

            throw error;
        }

        setTeachers(
            data || []
        );
    };


    // =================================================
    // LOAD DUTY SCHEDULES
    // =================================================

    const loadDutySchedules = async (
        currentSchoolId
    ) => {

        if (!currentSchoolId) {
            return;
        }

        const {
            data,
            error
        } = await supabase
            .from("duty_schedules")
            .select(
                `
                id,
                school_id,
                academic_year_id,
                duty_date,
                day_name,
                teacher_id,
                duty_area,
                start_time,
                end_time,
                location,
                notes,
                status,
                created_by,
                created_at,
                updated_at,
                academic_years (
                    id,
                    year_name,
                    term
                ),
                teachers (
                    id,
                    employee_number,
                    first_name,
                    middle_name,
                    last_name
                )
                `
            )
            .eq(
                "school_id",
                Number(currentSchoolId)
            )
            .order(
                "duty_date",
                {
                    ascending: true
                }
            )
            .order(
                "start_time",
                {
                    ascending: true,
                    nullsFirst: true
                }
            );

        if (error) {

            console.error(
                "LOAD DUTY SCHEDULES ERROR:",
                error
            );

            throw error;
        }

        setDutySchedules(
            data || []
        );
    };


    // =================================================
    // LOAD ALL
    // =================================================

    const loadAll = async () => {

        try {

            setLoading(true);

            setMessage("");
            setMessageType("");

            const current =
                await loadCurrentUser();

            const currentSchoolId =
                current.schoolId;

            await Promise.all([
                loadAcademicYears(
                    currentSchoolId
                ),
                loadTeachers(
                    currentSchoolId
                ),
                loadDutySchedules(
                    currentSchoolId
                )
            ]);

        } catch (error) {

            console.error(
                "LOAD ALL ERROR:",
                error
            );

            setMessage(
                error?.message ||
                "Failed to load duty schedule."
            );

            setMessageType(
                "error"
            );

        } finally {

            setLoading(false);
        }
    };


    // =================================================
    // INITIAL LOAD
    // =================================================

    useEffect(() => {

        loadAll();

    }, []);


    // =================================================
    // TEACHER NAME
    // =================================================

    const getTeacherName = (
        teacher
    ) => {

        if (!teacher) {
            return "-";
        }

        return [
            teacher.first_name,
            teacher.middle_name,
            teacher.last_name
        ]
            .filter(Boolean)
            .join(" ") || "-";
    };


    // =================================================
    // DISPLAY DATE
    // =================================================

    const formatDate = (
        value
    ) => {

        if (!value) {
            return "-";
        }

        const date =
            parseLocalDate(value);

        if (!date) {
            return value;
        }

        return date.toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    };


    // =================================================
    // RESET FORM
    // =================================================

    const resetForm = () => {

        const activeYear =
            academicYears.find(
                year =>
                    year.is_active === true
            ) ||
            academicYears[0] ||
            null;

        setEditingGroup(null);

        setForm({
            academic_year_id:
                activeYear
                    ? String(activeYear.id)
                    : "",
            start_date: "",
            end_date: "",
            teacher_id: "",
            duty_areas: [],
            start_time: "",
            end_time: "",
            location: "",
            notes: "",
            status: "scheduled"
        });
    };


    // =================================================
    // OPEN CREATE
    // =================================================

    const openCreate = () => {

        resetForm();

        setMessage("");
        setMessageType("");

        setShowForm(true);
    };


    // =================================================
    // OPEN EDIT
    //
    // IMPORTANT:
    // Receives the WHOLE GROUP.
    //
    // The existing IDs are retained.
    // =================================================

    const openEdit = (
        group
    ) => {

        if (
            !group ||
            !group.records ||
            !group.records.length
        ) {
            setMessage(
                "The selected duty plan has no records."
            );

            setMessageType(
                "error"
            );

            return;
        }

        const firstRecord =
            group.records[0];

        setEditingGroup(group);

        setForm({
            academic_year_id:
                group.academicYearId
                    ? String(
                        group.academicYearId
                    )
                    : "",

            start_date:
                group.startDate || "",

            end_date:
                group.endDate || "",

            teacher_id:
                group.teacherId
                    ? String(
                        group.teacherId
                    )
                    : "",

            duty_areas:
                [...group.areas],

            start_time:
                firstRecord.start_time
                    ? String(
                        firstRecord.start_time
                    ).slice(0, 5)
                    : "",

            end_time:
                firstRecord.end_time
                    ? String(
                        firstRecord.end_time
                    ).slice(0, 5)
                    : "",

            location:
                firstRecord.location ||
                "",

            notes:
                firstRecord.notes ||
                "",

            status:
                firstRecord.status ||
                "scheduled"
        });

        setMessage("");
        setMessageType("");

        setShowForm(true);
    };


    // =================================================
    // CLOSE FORM
    // =================================================

    const closeForm = () => {

        if (saving) {
            return;
        }

        setShowForm(false);

        resetForm();
    };


    // =================================================
    // HANDLE FORM CHANGE
    // =================================================

    const handleChange = (
        event
    ) => {

        const {
            name,
            value
        } = event.target;

        setForm(
            previous => ({
                ...previous,
                [name]: value
            })
        );
    };


    // =================================================
    // START DATE CHANGE
    // =================================================

    const handleStartDateChange = (
        event
    ) => {

        const value =
            event.target.value;

        setForm(
            previous => ({
                ...previous,
                start_date: value,
                end_date:
                    previous.end_date ||
                    value
            })
        );
    };


    // =================================================
    // DUTY AREA TOGGLE
    // =================================================

    const toggleDutyArea = (
        area
    ) => {

        if (editingGroup) {
            return;
        }

        setForm(
            previous => {

                const exists =
                    previous.duty_areas.includes(
                        area
                    );

                return {
                    ...previous,
                    duty_areas: exists
                        ? previous.duty_areas.filter(
                            item =>
                                item !== area
                        )
                        : [
                            ...previous.duty_areas,
                            area
                        ]
                };
            }
        );
    };


    // =================================================
    // SELECT ALL AREAS
    // =================================================

    const selectAllAreas = () => {

        if (editingGroup) {
            return;
        }

        setForm(
            previous => ({
                ...previous,
                duty_areas: [
                    ...DUTY_AREAS
                ]
            })
        );
    };


    // =================================================
    // CLEAR ALL AREAS
    // =================================================

    const clearAllAreas = () => {

        if (editingGroup) {
            return;
        }

        setForm(
            previous => ({
                ...previous,
                duty_areas: []
            })
        );
    };


    // =================================================
    // VALIDATE FORM
    // =================================================

    const validateForm = () => {

        if (!schoolId) {
            return "School ID is missing.";
        }

        if (!form.academic_year_id) {
            return "Please select academic year.";
        }

        if (!form.start_date) {
            return "Please select start date.";
        }

        if (!form.end_date) {
            return "Please select end date.";
        }

        if (
            form.end_date <
            form.start_date
        ) {
            return "End date cannot be before start date.";
        }

        if (!form.teacher_id) {
            return "Please select teacher.";
        }

        if (
            !form.duty_areas ||
            !form.duty_areas.length
        ) {
            return "Please select at least one duty area.";
        }

        if (
            form.start_time &&
            form.end_time &&
            form.end_time <=
            form.start_time
        ) {
            return "End time must be after start time.";
        }

        if (
            !STATUS_OPTIONS.includes(
                form.status
            )
        ) {
            return "Invalid duty schedule status.";
        }

        return "";
    };


    // =================================================
    // CHECK EXISTING RECORDS
    //
    // excludeIds:
    // During EDIT, the existing records are excluded.
    // This allows us to update the same records.
    // =================================================

    const checkExistingRecords = async ({
        dates,
        areas,
        teacherId,
        academicYearId,
        excludeIds = []
    }) => {

        if (
            !schoolId ||
            !dates.length ||
            !areas.length
        ) {
            return [];
        }

        const startDate =
            dates[0];

        const endDate =
            dates[dates.length - 1];

        const {
            data,
            error
        } = await supabase
            .from("duty_schedules")
            .select(
                `
                id,
                duty_date,
                teacher_id,
                duty_area,
                academic_year_id
                `
            )
            .eq(
                "school_id",
                Number(schoolId)
            )
            .eq(
                "academic_year_id",
                Number(academicYearId)
            )
            .eq(
                "teacher_id",
                Number(teacherId)
            )
            .gte(
                "duty_date",
                startDate
            )
            .lte(
                "duty_date",
                endDate
            )
            .in(
                "duty_area",
                areas
            );

        if (error) {

            console.error(
                "CHECK EXISTING DUTY RECORDS ERROR:",
                error
            );

            throw error;
        }

        const excluded =
            new Set(
                excludeIds.map(
                    id => String(id)
                )
            );

        return (
            data || []
        ).filter(
            record =>
                !excluded.has(
                    String(record.id)
                )
        );
    };


    // =================================================
    // BUILD GENERATED RECORDS
    //
    // CREATE ONLY.
    //
    // EDIT DOES NOT USE THIS FUNCTION.
    // =================================================

    const buildGeneratedRecords = (
        dates
    ) => {

        return dates.flatMap(
            date => {

                return form.duty_areas.map(
                    area => ({

                        school_id:
                            Number(schoolId),

                        academic_year_id:
                            Number(
                                form.academic_year_id
                            ),

                        duty_date:
                            date,

                        day_name:
                            getDayName(
                                date
                            ),

                        teacher_id:
                            Number(
                                form.teacher_id
                            ),

                        duty_area:
                            area,

                        start_time:
                            form.start_time ||
                            null,

                        end_time:
                            form.end_time ||
                            null,

                        location:
                            form.location.trim() ||
                            null,

                        notes:
                            form.notes.trim() ||
                            null,

                        status:
                            form.status,

                        created_by:
                            user?.id ||
                            null

                    })
                );
            }
        );
    };


    // =================================================
    // HANDLE SUBMIT
    //
    // CREATE:
    //   INSERT new records.
    //
    // EDIT:
    //   UPDATE existing records by their IDs.
    //   NEVER INSERT.
    // =================================================

    const handleSubmit = async (
        event
    ) => {

        event.preventDefault();

        setMessage("");
        setMessageType("");

        const validationError =
            validateForm();

        if (validationError) {

            setMessage(
                validationError
            );

            setMessageType(
                "error"
            );

            return;
        }

        try {

            setSaving(true);

            // =========================================
            // EDIT EXISTING DUTY PLAN
            // =========================================

            if (editingGroup) {

                const existingRecords =
                    editingGroup.records || [];

                const existingIds =
                    existingRecords
                        .map(
                            record =>
                                record.id
                        )
                        .filter(Boolean);

                if (!existingIds.length) {
                    throw new Error(
                        "No existing duty schedule records were found for this plan."
                    );
                }

                // -------------------------------------
                // Check conflicts excluding SAME IDs
                // -------------------------------------

                const dates =
                    getDatesBetween(
                        form.start_date,
                        form.end_date
                    );

                const existingConflicts =
                    await checkExistingRecords({
                        dates,
                        areas:
                            form.duty_areas,
                        teacherId:
                            form.teacher_id,
                        academicYearId:
                            form.academic_year_id,
                        excludeIds:
                            existingIds
                    });

                if (
                    existingConflicts.length
                ) {

                    const conflictText =
                        existingConflicts
                            .map(
                                item =>
                                    `${formatDate(
                                        item.duty_date
                                    )} - ${item.duty_area}`
                            )
                            .join(", ");

                    throw new Error(
                        `Cannot update this duty plan because another duty schedule already exists: ${conflictText}`
                    );
                }

                // -------------------------------------
                // UPDATE SAME RECORDS
                //
                // IMPORTANT:
                // .in("id", existingIds)
                // means these exact DB records
                // are updated.
                //
                // NO INSERT HERE.
                // -------------------------------------

                const updatePayload = {

                    school_id:
                        Number(schoolId),

                    academic_year_id:
                        Number(
                            form.academic_year_id
                        ),

                    teacher_id:
                        Number(
                            form.teacher_id
                        ),

                    start_time:
                        form.start_time ||
                        null,

                    end_time:
                        form.end_time ||
                        null,

                    location:
                        form.location.trim() ||
                        null,

                    notes:
                        form.notes.trim() ||
                        null,

                    status:
                        form.status,

                    updated_at:
                        new Date().toISOString()

                };

                const {
                    data: updatedRows,
                    error: updateError
                } = await supabase
                    .from("duty_schedules")
                    .update(
                        updatePayload
                    )
                    .eq(
                        "school_id",
                        Number(schoolId)
                    )
                    .in(
                        "id",
                        existingIds
                    )
                    .select(
                        "id"
                    );

                if (updateError) {

                    console.error(
                        "UPDATE DUTY PLAN ERROR:",
                        updateError
                    );

                    throw updateError;
                }

                // -------------------------------------
                // Make sure Supabase actually updated
                // the expected rows.
                // -------------------------------------

                if (
                    !updatedRows ||
                    updatedRows.length !==
                    existingIds.length
                ) {

                    console.error(
                        "DUTY UPDATE ROW COUNT MISMATCH:",
                        {
                            expected:
                                existingIds.length,
                            updated:
                                updatedRows
                                    ?.length || 0,
                            existingIds
                        }
                    );

                    throw new Error(
                        `Only ${
                            updatedRows?.length || 0
                        } of ${
                            existingIds.length
                        } duty records were updated.`
                    );
                }

                // -------------------------------------
                // Reload exact database state
                // -------------------------------------

                await loadDutySchedules(
                    Number(schoolId)
                );

                setMessage(
                    `Duty plan updated successfully. ${existingIds.length} existing record(s) were updated. No new record was created.`
                );

                setMessageType(
                    "success"
                );

                setShowForm(false);

                resetForm();

                return;
            }


            // =========================================
            // CREATE NEW DUTY PLAN
            // =========================================

            const dates =
                getDatesBetween(
                    form.start_date,
                    form.end_date
                );

            if (!dates.length) {
                throw new Error(
                    "No valid dates were generated."
                );
            }

            // -----------------------------------------
            // Check conflicts
            // -----------------------------------------

            const existingRecords =
                await checkExistingRecords({
                    dates,
                    areas:
                        form.duty_areas,
                    teacherId:
                        form.teacher_id,
                    academicYearId:
                        form.academic_year_id,
                    excludeIds: []
                });

            if (
                existingRecords.length
            ) {

                const conflictText =
                    existingRecords
                        .slice(0, 10)
                        .map(
                            item =>
                                `${formatDate(
                                    item.duty_date
                                )} - ${item.duty_area}`
                        )
                        .join(", ");

                const more =
                    existingRecords.length >
                    10
                        ? ` and ${
                            existingRecords.length -
                            10
                        } more`
                        : "";

                throw new Error(
                    `Duty schedule already exists for: ${conflictText}${more}`
                );
            }

            // -----------------------------------------
            // Build rows
            // -----------------------------------------

            const generatedRecords =
                buildGeneratedRecords(
                    dates
                );

            if (
                !generatedRecords.length
            ) {
                throw new Error(
                    "No duty schedule records were generated."
                );
            }

            // -----------------------------------------
            // INSERT
            // -----------------------------------------

            const {
                data: insertedRows,
                error: insertError
            } = await supabase
                .from("duty_schedules")
                .insert(
                    generatedRecords
                )
                .select(
                    "id"
                );

            if (insertError) {

                console.error(
                    "CREATE DUTY PLAN ERROR:",
                    insertError
                );

                throw insertError;
            }

            await loadDutySchedules(
                Number(schoolId)
            );

            setMessage(
                `Duty schedule created successfully. ${insertedRows?.length || generatedRecords.length} record(s) created.`
            );

            setMessageType(
                "success"
            );

            setShowForm(false);

            resetForm();

        } catch (error) {

            console.error(
                "SAVE DUTY SCHEDULE ERROR:",
                error
            );

            setMessage(
                error?.message ||
                "Failed to save duty schedule."
            );

            setMessageType(
                "error"
            );

        } finally {

            setSaving(false);
        }
    };


    // =================================================
    // DELETE ENTIRE DUTY PLAN
    //
    // IMPORTANT:
    // Deletes ALL records belonging to the group.
    //
    // It does NOT use firstRecord.id only.
    // =================================================

    const handleDeleteGroup = async (
        group
    ) => {

        if (
            !group ||
            !group.records ||
            !group.records.length
        ) {

            setMessage(
                "No duty schedule records were found to delete."
            );

            setMessageType(
                "error"
            );

            return;
        }

        const ids =
            group.records
                .map(
                    record =>
                        record.id
                )
                .filter(Boolean);

        if (!ids.length) {

            setMessage(
                "No valid duty schedule IDs were found."
            );

            setMessageType(
                "error"
            );

            return;
        }

        const teacherName =
            getTeacherName(
                group.records[0]?.teachers
            );

        const confirmed =
            window.confirm(
                `DELETE ENTIRE DUTY PLAN?\n\n` +
                `Teacher: ${teacherName}\n` +
                `Start Date: ${formatDate(
                    group.startDate
                )}\n` +
                `End Date: ${formatDate(
                    group.endDate
                )}\n` +
                `Duty Areas: ${group.areas.join(
                    ", "
                )}\n` +
                `Records: ${ids.length}\n\n` +
                `All records belonging to this duty plan will be deleted.\n\n` +
                `This action cannot be undone.`
            );

        if (!confirmed) {
            return;
        }

        try {

            setLoading(true);

            setMessage("");
            setMessageType("");

            const numericSchoolId =
                Number(schoolId);

            if (!numericSchoolId) {
                throw new Error(
                    "School ID is missing."
                );
            }

            // -----------------------------------------
            // DELETE ALL GROUP RECORDS
            // -----------------------------------------

            const {
                data: deletedRows,
                error: deleteError
            } = await supabase
                .from("duty_schedules")
                .delete()
                .eq(
                    "school_id",
                    numericSchoolId
                )
                .in(
                    "id",
                    ids
                )
                .select(
                    "id"
                );

            if (deleteError) {

                console.error(
                    "DELETE DUTY PLAN ERROR:",
                    deleteError
                );

                throw deleteError;
            }

            // -----------------------------------------
            // Verify delete
            // -----------------------------------------

            const deletedCount =
                deletedRows?.length || 0;

            if (
                deletedCount !==
                ids.length
            ) {

                console.error(
                    "DELETE ROW COUNT MISMATCH:",
                    {
                        expected:
                            ids.length,
                        deleted:
                            deletedCount,
                        ids
                    }
                );

                throw new Error(
                    `Only ${deletedCount} of ${ids.length} duty records were deleted.`
                );
            }

            // -----------------------------------------
            // Immediately remove from UI
            // -----------------------------------------

            const idSet =
                new Set(
                    ids.map(
                        id =>
                            String(id)
                    )
                );

            setDutySchedules(
                previous =>
                    previous.filter(
                        record =>
                            !idSet.has(
                                String(
                                    record.id
                                )
                            )
                    )
            );

            // -----------------------------------------
            // Reload from DB
            // -----------------------------------------

            await loadDutySchedules(
                numericSchoolId
            );

            setMessage(
                `Duty plan deleted successfully. ${deletedCount} record(s) were removed.`
            );

            setMessageType(
                "success"
            );

        } catch (error) {

            console.error(
                "DUTY PLAN DELETE FAILED:",
                error
            );

            setMessage(
                error?.message ||
                "Failed to delete duty plan."
            );

            setMessageType(
                "error"
            );

        } finally {

            setLoading(false);
        }
    };


    // =================================================
    // RENEW DUTY PLAN
    //
    // IMPORTANT:
    // Renew intentionally CREATES a new period.
    // This is different from EDIT.
    // =================================================

    const renewDutyGroup = async (
        group
    ) => {

        if (
            !group ||
            !group.records ||
            !group.records.length
        ) {
            return;
        }

        const firstRecord =
            group.records[0];

        const oldStart =
            parseLocalDate(
                group.startDate
            );

        const oldEnd =
            parseLocalDate(
                group.endDate
            );

        if (!oldStart || !oldEnd) {

            setMessage(
                "Unable to determine the existing duty plan dates."
            );

            setMessageType(
                "error"
            );

            return;
        }

        const numberOfDays =
            getInclusiveDayCount(
                group.startDate,
                group.endDate
            );

        const newStartDate =
            addDays(
                oldEnd,
                1
            );

        const newEndDate =
            addDays(
                newStartDate,
                numberOfDays - 1
            );

        const confirmed =
            window.confirm(
                `Renew this duty plan?\n\n` +
                `Existing period: ${formatDate(
                    group.startDate
                )} - ${formatDate(
                    group.endDate
                )}\n` +
                `New period: ${formatDate(
                    formatInputDate(
                        newStartDate
                    )
                )} - ${formatDate(
                    formatInputDate(
                        newEndDate
                    )
                )}\n\n` +
                `A NEW duty period will be created. The old records will remain unchanged.`
            );

        if (!confirmed) {
            return;
        }

        try {

            setSaving(true);

            setMessage("");
            setMessageType("");

            const newStart =
                formatInputDate(
                    newStartDate
                );

            const newEnd =
                formatInputDate(
                    newEndDate
                );

            const dates =
                getDatesBetween(
                    newStart,
                    newEnd
                );

            const areas =
                group.areas || [];

            const teacherId =
                group.teacherId;

            const academicYearId =
                group.academicYearId;

            if (
                !areas.length ||
                !teacherId ||
                !academicYearId
            ) {
                throw new Error(
                    "Incomplete duty plan information."
                );
            }

            const conflicts =
                await checkExistingRecords({
                    dates,
                    areas,
                    teacherId,
                    academicYearId,
                    excludeIds: []
                });

            if (
                conflicts.length
            ) {

                const conflictText =
                    conflicts
                        .slice(0, 10)
                        .map(
                            item =>
                                `${formatDate(
                                    item.duty_date
                                )} - ${item.duty_area}`
                        )
                        .join(", ");

                throw new Error(
                    `Cannot renew because duty schedule already exists for: ${conflictText}`
                );
            }

            const generatedRecords =
                dates.flatMap(
                    date =>
                        areas.map(
                            area => ({

                                school_id:
                                    Number(
                                        schoolId
                                    ),

                                academic_year_id:
                                    Number(
                                        academicYearId
                                    ),

                                duty_date:
                                    date,

                                day_name:
                                    getDayName(
                                        date
                                    ),

                                teacher_id:
                                    Number(
                                        teacherId
                                    ),

                                duty_area:
                                    area,

                                start_time:
                                    firstRecord.start_time ||
                                    null,

                                end_time:
                                    firstRecord.end_time ||
                                    null,

                                location:
                                    firstRecord.location ||
                                    null,

                                notes:
                                    firstRecord.notes ||
                                    null,

                                status:
                                    "scheduled",

                                created_by:
                                    user?.id ||
                                    null

                            })
                        )
                );

            const {
                error: insertError
            } = await supabase
                .from("duty_schedules")
                .insert(
                    generatedRecords
                );

            if (insertError) {

                console.error(
                    "RENEW DUTY PLAN ERROR:",
                    insertError
                );

                throw insertError;
            }

            await loadDutySchedules(
                Number(schoolId)
            );

            setMessage(
                `Duty plan renewed successfully. ${generatedRecords.length} new record(s) created.`
            );

            setMessageType(
                "success"
            );

        } catch (error) {

            console.error(
                "RENEW DUTY GROUP ERROR:",
                error
            );

            setMessage(
                error?.message ||
                "Failed to renew duty plan."
            );

            setMessageType(
                "error"
            );

        } finally {

            setSaving(false);
        }
    };


    // =================================================
    // GROUP DUTY SCHEDULES
    //
    // IMPORTANT:
    // A group is made from the ACTUAL EXISTING DB rows.
    //
    // We split when:
    // 1. Dates are not consecutive.
    // 2. Duty areas change.
    // 3. Teacher/year/time/location/notes/status change.
    //
    // This prevents Delete from accidentally deleting
    // unrelated schedules.
    // =================================================

    const groupedSchedules =
        useMemo(() => {

            const baseGroups =
                new Map();

            dutySchedules.forEach(
                record => {

                    const baseKey =
                        [
                            record.academic_year_id,
                            record.teacher_id,
                            record.start_time || "",
                            record.end_time || "",
                            record.location || "",
                            record.notes || "",
                            record.status || ""
                        ].join("|");

                    if (
                        !baseGroups.has(
                            baseKey
                        )
                    ) {

                        baseGroups.set(
                            baseKey,
                            new Map()
                        );
                    }

                    const dateMap =
                        baseGroups.get(
                            baseKey
                        );

                    const date =
                        record.duty_date;

                    if (
                        !dateMap.has(
                            date
                        )
                    ) {

                        dateMap.set(
                            date,
                            []
                        );
                    }

                    dateMap
                        .get(date)
                        .push(
                            record
                        );
                }
            );

            const result = [];

            baseGroups.forEach(
                (
                    dateMap,
                    baseKey
                ) => {

                    const sortedDates =
                        Array.from(
                            dateMap.keys()
                        ).sort();

                    let currentChunk = [];

                    let previousDate =
                        null;

                    let previousSignature =
                        null;

                    const flushChunk = () => {

                        if (
                            !currentChunk.length
                        ) {
                            return;
                        }

                        const records =
                            currentChunk
                                .flatMap(
                                    item =>
                                        item.records
                                )
                                .sort(
                                    (a, b) =>
                                        String(
                                            a.duty_date
                                        ).localeCompare(
                                            String(
                                                b.duty_date
                                            )
                                        ) ||
                                        String(
                                            a.duty_area
                                        ).localeCompare(
                                            String(
                                                b.duty_area
                                            )
                                        )
                                );

                        const first =
                            records[0];

                        const startDate =
                            currentChunk[0]
                                .date;

                        const endDate =
                            currentChunk[
                                currentChunk.length - 1
                            ].date;

                        const areas =
                            Array.from(
                                new Set(
                                    records.map(
                                        item =>
                                            item.duty_area
                                    )
                                )
                            ).sort();

                        result.push({

                            key:
                                `${baseKey}|${startDate}|${endDate}|${areas.join(
                                    "||"
                                )}`,

                            records,

                            academicYearId:
                                first.academic_year_id,

                            teacherId:
                                first.teacher_id,

                            teacher:
                                first.teachers,

                            academicYear:
                                first.academic_years,

                            startDate,

                            endDate,

                            areas,

                            startTime:
                                first.start_time,

                            endTime:
                                first.end_time,

                            location:
                                first.location,

                            notes:
                                first.notes,

                            status:
                                first.status,

                            dayCount:
                                getInclusiveDayCount(
                                    startDate,
                                    endDate
                                )
                        });

                        currentChunk = [];
                    };


                    sortedDates.forEach(
                        date => {

                            const dateRecords =
                                (
                                    dateMap.get(
                                        date
                                    ) || []
                                )
                                    .slice()
                                    .sort(
                                        (a, b) =>
                                            String(
                                                a.duty_area
                                            ).localeCompare(
                                                String(
                                                    b.duty_area
                                                )
                                            )
                                    );

                            const signature =
                                dateRecords
                                    .map(
                                        record =>
                                            record.duty_area
                                    )
                                    .filter(Boolean)
                                    .sort()
                                    .join(
                                        "||"
                                    );

                            const isConsecutive =
                                previousDate &&
                                getDateDifference(
                                    previousDate,
                                    date
                                ) === 1;

                            const sameAreas =
                                previousSignature ===
                                signature;

                            if (
                                currentChunk.length &&
                                (
                                    !isConsecutive ||
                                    !sameAreas
                                )
                            ) {
                                flushChunk();
                            }

                            currentChunk.push({
                                date,
                                records:
                                    dateRecords
                            });

                            previousDate =
                                date;

                            previousSignature =
                                signature;
                        }
                    );

                    flushChunk();
                }
            );

            return result.sort(
                (a, b) =>
                    String(
                        a.startDate
                    ).localeCompare(
                        String(
                            b.startDate
                        )
                    )
            );

        }, [
            dutySchedules
        ]);


    // =================================================
    // SUMMARY
    // =================================================

    const summary =
        useMemo(() => {

            const total =
                dutySchedules.length;

            const scheduled =
                dutySchedules.filter(
                    record =>
                        String(
                            record.status
                        ).toLowerCase() ===
                        "scheduled"
                ).length;

            const completed =
                dutySchedules.filter(
                    record =>
                        String(
                            record.status
                        ).toLowerCase() ===
                        "completed"
                ).length;

            const cancelled =
                dutySchedules.filter(
                    record =>
                        String(
                            record.status
                        ).toLowerCase() ===
                        "cancelled"
                ).length;

            const teachersCount =
                new Set(
                    dutySchedules
                        .map(
                            record =>
                                record.teacher_id
                        )
                        .filter(Boolean)
                ).size;

            return {
                total,
                scheduled,
                completed,
                cancelled,
                teachersCount
            };

        }, [
            dutySchedules
        ]);


    // =================================================
    // PRINT
    // =================================================

    const handlePrint = () => {

        const rows =
            groupedSchedules
                .map(
                    group => {

                        const teacher =
                            getTeacherName(
                                group.teacher
                            );

                        const areas =
                            group.areas.join(
                                ", "
                            );

                        const academicYear =
                            group.academicYear
                                ?.year_name ||
                            "-";

                        const term =
                            group.academicYear
                                ?.term ||
                            "";

                        return `
                            <tr>
                                <td>${teacher}</td>
                                <td>${areas}</td>
                                <td>${formatDate(
                                    group.startDate
                                )}</td>
                                <td>${formatDate(
                                    group.endDate
                                )}</td>
                                <td>${group.dayCount}</td>
                                <td>${
                                    group.startTime &&
                                    group.endTime
                                        ? `${group.startTime} - ${group.endTime}`
                                        : "-"
                                }</td>
                                <td>${
                                    group.location ||
                                    "-"
                                }</td>
                                <td>${academicYear}${
                                    term
                                        ? ` - ${term}`
                                        : ""
                                }</td>
                                <td>${
                                    group.status ||
                                    "-"
                                }</td>
                            </tr>
                        `;
                    }
                )
                .join("");


        const printWindow =
            window.open(
                "",
                "_blank",
                "width=1200,height=800"
            );

        if (!printWindow) {

            setMessage(
                "Unable to open print window. Please allow pop-ups."
            );

            setMessageType(
                "error"
            );

            return;
        }


        printWindow.document.write(
            `
            <!DOCTYPE html>

            <html>

            <head>

                <title>
                    Duty Schedule
                </title>

                <style>

                    body {
                        font-family:
                            Arial,
                            sans-serif;
                        padding: 30px;
                        color: #111827;
                    }

                    h1 {
                        margin-bottom: 5px;
                    }

                    p {
                        margin-top: 0;
                        color: #6b7280;
                    }

                    table {
                        width: 100%;
                        border-collapse:
                            collapse;
                        margin-top: 25px;
                    }

                    th,
                    td {
                        border:
                            1px solid #d1d5db;
                        padding: 8px;
                        font-size: 12px;
                        vertical-align:
                            top;
                    }

                    th {
                        background:
                            #f3f4f6;
                        font-weight:
                            700;
                    }

                    .footer {
                        margin-top: 30px;
                        font-size: 11px;
                        color: #6b7280;
                    }

                </style>

            </head>

            <body>

                <h1>
                    Duty Schedule
                </h1>

                <p>
                    School Duty Management
                </p>

                <table>

                    <thead>

                        <tr>

                            <th>
                                Teacher
                            </th>

                            <th>
                                Duty Areas
                            </th>

                            <th>
                                Start Date
                            </th>

                            <th>
                                End Date
                            </th>

                            <th>
                                Days
                            </th>

                            <th>
                                Time
                            </th>

                            <th>
                                Location
                            </th>

                            <th>
                                Academic Year
                            </th>

                            <th>
                                Status
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rows}

                    </tbody>

                </table>

                <div class="footer">
                    Generated from AfriCore ERP PRO
                </div>

            </body>

            </html>
            `
        );

        printWindow.document.close();

        printWindow.focus();

        setTimeout(
            () => {

                printWindow.print();

            },
            300
        );
    };


    // =================================================
    // RENDER
    // =================================================

    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>

                    <div className="flex items-center gap-3">

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">

                            <FaCalendarAlt />

                        </div>

                        <div>

                            <h1 className="text-2xl font-black text-slate-900 md:text-3xl">

                                Duty Schedule

                            </h1>

                            <p className="mt-1 text-sm text-slate-500">

                                Manage school supervision and teacher duty schedules

                            </p>

                        </div>

                    </div>

                </div>


                <div className="flex flex-wrap gap-3">

                    <button
                        type="button"
                        onClick={loadAll}
                        disabled={loading || saving}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >

                        <FaSyncAlt />

                        Refresh

                    </button>


                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={
                            loading ||
                            !groupedSchedules.length
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >

                        <FaPrint />

                        Print

                    </button>


                    <button
                        type="button"
                        onClick={openCreate}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >

                        <FaPlus />

                        Add Duty Schedule

                    </button>

                </div>

            </div>


            {/* =================================================
                MESSAGE
            ================================================= */}

            {message && (

                <div
                    className={`
                        mb-6 rounded-xl border px-4 py-4 text-sm font-semibold
                        ${
                            messageType === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-red-200 bg-red-50 text-red-800"
                        }
                    `}
                >

                    {message}

                </div>

            )}


            {/* =================================================
                SUMMARY
            ================================================= */}

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Total Records
                    </div>

                    <div className="mt-2 text-3xl font-black text-slate-900">
                        {summary.total}
                    </div>

                </div>


                <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">

                    <div className="text-xs font-bold uppercase tracking-wide text-blue-600">
                        Scheduled
                    </div>

                    <div className="mt-2 text-3xl font-black text-blue-700">
                        {summary.scheduled}
                    </div>

                </div>


                <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">

                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                        Completed
                    </div>

                    <div className="mt-2 text-3xl font-black text-emerald-700">
                        {summary.completed}
                    </div>

                </div>


                <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">

                    <div className="text-xs font-bold uppercase tracking-wide text-red-600">
                        Cancelled
                    </div>

                    <div className="mt-2 text-3xl font-black text-red-700">
                        {summary.cancelled}
                    </div>

                </div>


                <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">

                    <div className="text-xs font-bold uppercase tracking-wide text-purple-600">
                        Teachers
                    </div>

                    <div className="mt-2 text-3xl font-black text-purple-700">
                        {summary.teachersCount}
                    </div>

                </div>

            </div>


            {/* =================================================
                FORM
            ================================================= */}

            {showForm && (

                <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">

                    {/* FORM HEADER */}

                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">

                        <div>

                            <h2 className="text-lg font-black">

                                {editingGroup
                                    ? "Edit Duty Plan"
                                    : "Create Duty Schedule"}

                            </h2>

                            <p className="mt-1 text-xs text-slate-300">

                                {editingGroup
                                    ? "Update the existing duty plan. No new duty records will be created."
                                    : "Create one duty plan across the selected date range and duty areas."}

                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={closeForm}
                            disabled={saving}
                            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                        >

                            <FaTimes />

                        </button>

                    </div>


                    {/* EDIT WARNING */}

                    {editingGroup && (

                        <div className="border-b border-blue-200 bg-blue-50 px-5 py-4">

                            <div className="flex gap-3">

                                <FaCheckCircle className="mt-0.5 text-blue-600" />

                                <div>

                                    <p className="text-sm font-black text-blue-900">

                                        Editing Existing Duty Plan

                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-blue-800">

                                        The existing{" "}
                                        <strong>
                                            {editingGroup.records.length}
                                        </strong>{" "}
                                        database record(s) will be updated using their existing IDs.
                                        Dates and duty areas are preserved so Edit does not create another schedule.

                                    </p>

                                </div>

                            </div>

                        </div>

                    )}


                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="p-5"
                    >

                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                            {/* ACADEMIC YEAR */}

                            <div>

                                <label className="mb-2 block text-sm font-bold text-slate-700">

                                    Academic Year

                                </label>

                                <select
                                    name="academic_year_id"
                                    value={
                                        form.academic_year_id
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={saving}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                >

                                    <option value="">
                                        Select Academic Year
                                    </option>

                                    {academicYears.map(
                                        year => (

                                            <option
                                                key={
                                                    year.id
                                                }
                                                value={
                                                    year.id
                                                }
                                            >

                                                {year.year_name}

                                                {year.term
                                                    ? ` - ${year.term}`
                                                    : ""}

                                                {year.is_active
                                                    ? " (Active)"
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </div>


                            {/* TEACHER */}

                            <div>

                                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">

                                    <FaUserTie className="text-blue-600" />

                                    Teacher

                                </label>

                                <select
                                    name="teacher_id"
                                    value={
                                        form.teacher_id
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={saving}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                >

                                    <option value="">
                                        Select Teacher
                                    </option>

                                    {teachers.map(
                                        teacher => (

                                            <option
                                                key={
                                                    teacher.id
                                                }
                                                value={
                                                    teacher.id
                                                }
                                            >

                                                {
                                                    getTeacherName(
                                                        teacher
                                                    )
                                                }

                                                {teacher.employee_number
                                                    ? ` (${teacher.employee_number})`
                                                    : ""}

                                            </option>

                                        )
                                    )}

                                </select>

                            </div>


                            {/* START DATE */}

                            <div>

                                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">

                                    <FaCalendarAlt className="text-blue-600" />

                                    Start Date

                                </label>

                                <input
                                    type="date"
                                    name="start_date"
                                    value={
                                        form.start_date
                                    }
                                    onChange={
                                        handleStartDateChange
                                    }
                                    disabled={
                                        saving ||
                                        Boolean(
                                            editingGroup
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                />

                            </div>


                            {/* END DATE */}

                            <div>

                                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">

                                    <FaCalendarAlt className="text-blue-600" />

                                    End Date

                                </label>

                                <input
                                    type="date"
                                    name="end_date"
                                    value={
                                        form.end_date
                                    }
                                    min={
                                        form.start_date ||
                                        undefined
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={
                                        saving ||
                                        Boolean(
                                            editingGroup
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                />

                            </div>


                            {/* START TIME */}

                            <div>

                                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">

                                    <FaClock className="text-blue-600" />

                                    Start Time

                                </label>

                                <input
                                    type="time"
                                    name="start_time"
                                    value={
                                        form.start_time
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={saving}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />

                            </div>


                            {/* END TIME */}

                            <div>

                                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">

                                    <FaClock className="text-blue-600" />

                                    End Time

                                </label>

                                <input
                                    type="time"
                                    name="end_time"
                                    value={
                                        form.end_time
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={saving}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />

                            </div>


                            {/* LOCATION */}

                            <div>

                                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">

                                    <FaMapMarkerAlt className="text-blue-600" />

                                    Location

                                </label>

                                <input
                                    type="text"
                                    name="location"
                                    value={
                                        form.location
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={saving}
                                    placeholder="e.g. Main Gate, Assembly Ground"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />

                            </div>


                            {/* STATUS */}

                            <div>

                                <label className="mb-2 block text-sm font-bold text-slate-700">

                                    Status

                                </label>

                                <select
                                    name="status"
                                    value={
                                        form.status
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={saving}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                >

                                    {STATUS_OPTIONS.map(
                                        status => (

                                            <option
                                                key={
                                                    status
                                                }
                                                value={
                                                    status
                                                }
                                            >

                                                {
                                                    status
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                    status.slice(
                                                        1
                                                    )
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </div>

                        </div>


                        {/* =================================================
                            DUTY AREAS
                        ================================================= */}

                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">

                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                <div>

                                    <h3 className="text-sm font-black text-slate-900">

                                        Duty Areas

                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500">

                                        Select the supervision responsibilities.

                                    </p>

                                </div>


                                {!editingGroup && (

                                    <div className="flex gap-2">

                                        <button
                                            type="button"
                                            onClick={
                                                selectAllAreas
                                            }
                                            disabled={saving}
                                            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                                        >

                                            Select All

                                        </button>


                                        <button
                                            type="button"
                                            onClick={
                                                clearAllAreas
                                            }
                                            disabled={saving}
                                            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                                        >

                                            Clear All

                                        </button>

                                    </div>

                                )}

                            </div>


                            {editingGroup && (

                                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">

                                    Dates and duty areas are preserved during Edit so the same existing records can be updated without creating another schedule.

                                </div>

                            )}


                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

                                {DUTY_AREAS.map(
                                    area => {

                                        const selected =
                                            form.duty_areas.includes(
                                                area
                                            );

                                        return (

                                            <label
                                                key={
                                                    area
                                                }
                                                className={`
                                                    flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition
                                                    ${
                                                        selected
                                                            ? "border-blue-400 bg-blue-50"
                                                            : "border-slate-200 bg-white hover:border-blue-200"
                                                    }
                                                    ${
                                                        editingGroup
                                                            ? "cursor-not-allowed opacity-80"
                                                            : ""
                                                    }
                                                `}
                                            >

                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        selected
                                                    }
                                                    onChange={() =>
                                                        toggleDutyArea(
                                                            area
                                                        )
                                                    }
                                                    disabled={
                                                        saving ||
                                                        Boolean(
                                                            editingGroup
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />

                                                <span className="text-sm font-semibold text-slate-700">

                                                    {area}

                                                </span>

                                            </label>

                                        );
                                    }
                                )}

                            </div>

                        </div>


                        {/* =================================================
                            NOTES
                        ================================================= */}

                        <div className="mt-5">

                            <label className="mb-2 block text-sm font-bold text-slate-700">

                                Notes

                            </label>

                            <textarea
                                name="notes"
                                value={
                                    form.notes
                                }
                                onChange={
                                    handleChange
                                }
                                disabled={saving}
                                rows={4}
                                placeholder="Additional instructions or notes..."
                                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            />

                        </div>


                        {/* =================================================
                            PREVIEW
                        ================================================= */}

                        {!editingGroup &&
                            form.start_date &&
                            form.end_date &&
                            form.duty_areas.length > 0 && (

                                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">

                                    <div className="text-xs font-bold uppercase tracking-wide text-blue-600">

                                        Schedule Preview

                                    </div>

                                    <div className="mt-2 text-sm font-bold text-blue-900">

                                        {
                                            getInclusiveDayCount(
                                                form.start_date,
                                                form.end_date
                                            )
                                        }{" "}
                                        day(s) ×{" "}
                                        {
                                            form.duty_areas.length
                                        }{" "}
                                        duty area(s)

                                    </div>

                                    <div className="mt-1 text-xs text-blue-700">

                                        Total records to create:{" "}
                                        <strong>
                                            {
                                                getInclusiveDayCount(
                                                    form.start_date,
                                                    form.end_date
                                                ) *
                                                form.duty_areas.length
                                            }
                                        </strong>

                                    </div>

                                </div>

                            )}


                        {/* =================================================
                            ACTIONS
                        ================================================= */}

                        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">

                            <button
                                type="button"
                                onClick={
                                    closeForm
                                }
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                                <FaTimes />

                                Cancel

                            </button>


                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                                {saving ? (

                                    <>
                                        <FaSyncAlt className="animate-spin" />

                                        {editingGroup
                                            ? "Updating..."
                                            : "Saving..."}
                                    </>

                                ) : (

                                    <>
                                        {editingGroup
                                            ? <FaSave />
                                            : <FaPlus />}

                                        {editingGroup
                                            ? "Save Changes"
                                            : "Create Duty Schedule"}

                                    </>

                                )}

                            </button>

                        </div>

                    </form>

                </div>

            )}


            {/* =================================================
                TABLE
            ================================================= */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-200 px-5 py-4">

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                            <h2 className="text-lg font-black text-slate-900">

                                Duty Plans

                            </h2>

                            <p className="mt-1 text-xs text-slate-500">

                                Each row represents one existing duty plan.

                            </p>

                        </div>

                        <div className="text-xs font-bold text-slate-500">

                            {groupedSchedules.length} plan(s)

                        </div>

                    </div>

                </div>


                {loading ? (

                    <div className="flex min-h-[300px] items-center justify-center">

                        <div className="text-center">

                            <FaSyncAlt className="mx-auto animate-spin text-3xl text-blue-600" />

                            <p className="mt-3 text-sm font-semibold text-slate-500">

                                Loading duty schedules...

                            </p>

                        </div>

                    </div>

                ) : groupedSchedules.length === 0 ? (

                    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">

                            <FaCalendarAlt className="text-2xl text-slate-400" />

                        </div>

                        <h3 className="mt-4 text-lg font-black text-slate-800">

                            No Duty Schedule Found

                        </h3>

                        <p className="mt-1 max-w-md text-sm text-slate-500">

                            Create a duty schedule to start managing school supervision duties.

                        </p>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                        >

                            <FaPlus />

                            Add Duty Schedule

                        </button>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="min-w-[1200px] w-full border-collapse">

                            <thead>

                                <tr className="bg-slate-50">

                                    <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">

                                        Teacher

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">

                                        Duty Areas

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">

                                        Start Date

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">

                                        End Date

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-center text-xs font-black uppercase tracking-wide text-slate-500">

                                        Days

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">

                                        Time

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">

                                        Location

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">

                                        Academic Year

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-center text-xs font-black uppercase tracking-wide text-slate-500">

                                        Status

                                    </th>

                                    <th className="border-b border-slate-200 px-4 py-4 text-center text-xs font-black uppercase tracking-wide text-slate-500">

                                        Actions

                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {groupedSchedules.map(
                                    group => (

                                        <tr
                                            key={
                                                group.key
                                            }
                                            className="hover:bg-slate-50"
                                        >

                                            {/* TEACHER */}

                                            <td className="border-b border-slate-100 px-4 py-4">

                                                <div className="flex items-center gap-3">

                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">

                                                        <FaUserTie />

                                                    </div>

                                                    <div>

                                                        <div className="font-bold text-slate-900">

                                                            {
                                                                getTeacherName(
                                                                    group.teacher
                                                                )
                                                            }

                                                        </div>

                                                        {group.teacher?.employee_number && (

                                                            <div className="mt-1 text-xs text-slate-500">

                                                                {
                                                                    group.teacher.employee_number
                                                                }

                                                            </div>

                                                        )}

                                                    </div>

                                                </div>

                                            </td>


                                            {/* AREAS */}

                                            <td className="border-b border-slate-100 px-4 py-4">

                                                <div className="flex max-w-[280px] flex-wrap gap-1.5">

                                                    {group.areas.map(
                                                        area => (

                                                            <span
                                                                key={
                                                                    area
                                                                }
                                                                className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700"
                                                            >

                                                                {area}

                                                            </span>

                                                        )
                                                    )}

                                                </div>

                                            </td>


                                            {/* START DATE */}

                                            <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">

                                                {
                                                    formatDate(
                                                        group.startDate
                                                    )
                                                }

                                            </td>


                                            {/* END DATE */}

                                            <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">

                                                {
                                                    formatDate(
                                                        group.endDate
                                                    )
                                                }

                                            </td>


                                            {/* DAYS */}

                                            <td className="border-b border-slate-100 px-4 py-4 text-center">

                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">

                                                    {
                                                        group.dayCount
                                                    }

                                                </span>

                                            </td>


                                            {/* TIME */}

                                            <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">

                                                {group.startTime &&
                                                group.endTime
                                                    ? (
                                                        <div className="flex items-center gap-2">

                                                            <FaClock className="text-slate-400" />

                                                            <span>
                                                                {
                                                                    group.startTime
                                                                }
                                                                {" - "}
                                                                {
                                                                    group.endTime
                                                                }
                                                            </span>

                                                        </div>
                                                    )
                                                    : "-"}

                                            </td>


                                            {/* LOCATION */}

                                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">

                                                {group.location ? (

                                                    <div className="flex items-center gap-2">

                                                        <FaMapMarkerAlt className="text-slate-400" />

                                                        <span>
                                                            {
                                                                group.location
                                                            }
                                                        </span>

                                                    </div>

                                                ) : (
                                                    "-"
                                                )}

                                            </td>


                                            {/* ACADEMIC YEAR */}

                                            <td className="border-b border-slate-100 px-4 py-4">

                                                <div className="text-sm font-bold text-slate-800">

                                                    {
                                                        group.academicYear?.year_name ||
                                                        "-"
                                                    }

                                                </div>

                                                {group.academicYear?.term && (

                                                    <div className="mt-1 text-xs text-slate-500">

                                                        {
                                                            group.academicYear.term
                                                        }

                                                    </div>

                                                )}

                                            </td>


                                            {/* STATUS */}

                                            <td className="border-b border-slate-100 px-4 py-4 text-center">

                                                <span
                                                    className={`
                                                        inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black
                                                        ${
                                                            group.status ===
                                                            "completed"
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : group.status ===
                                                                  "cancelled"
                                                                    ? "bg-red-100 text-red-700"
                                                                    : "bg-blue-100 text-blue-700"
                                                        }
                                                    `}
                                                >

                                                    {group.status ===
                                                        "completed" && (
                                                            <FaCheckCircle />
                                                        )}

                                                    {group.status
                                                        ?.charAt(
                                                            0
                                                        )
                                                        .toUpperCase() +
                                                        group.status?.slice(
                                                            1
                                                        )}

                                                </span>

                                            </td>


                                            {/* ACTIONS */}

                                            <td className="border-b border-slate-100 px-4 py-4">

                                                <div className="flex items-center justify-center gap-2">

                                                    {/* EDIT */}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEdit(
                                                                group
                                                            )
                                                        }
                                                        disabled={
                                                            saving ||
                                                            loading
                                                        }
                                                        title="Edit this existing duty plan"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >

                                                        <FaEdit />

                                                    </button>


                                                    {/* DELETE ENTIRE GROUP */}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDeleteGroup(
                                                                group
                                                            )
                                                        }
                                                        disabled={
                                                            saving ||
                                                            loading
                                                        }
                                                        title="Delete entire duty plan"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >

                                                        <FaTrash />

                                                    </button>


                                                    {/* RENEW */}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            renewDutyGroup(
                                                                group
                                                            )
                                                        }
                                                        disabled={
                                                            saving ||
                                                            loading
                                                        }
                                                        title="Renew duty plan with a new period"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >

                                                        <FaRedo />

                                                    </button>

                                                </div>

                                            </td>

                                        </tr>

                                    )
                                )}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>


            {/* =================================================
                LEGEND
            ================================================= */}

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs font-semibold text-slate-600">

                <div className="flex items-center gap-2">

                    <FaEdit className="text-blue-600" />

                    <span>
                        Edit = update the same existing records
                    </span>

                </div>


                <div className="flex items-center gap-2">

                    <FaTrash className="text-red-600" />

                    <span>
                        Delete = delete the entire duty plan
                    </span>

                </div>


                <div className="flex items-center gap-2">

                    <FaRedo className="text-emerald-600" />

                    <span>
                        Renew = create a new duty period
                    </span>

                </div>

            </div>

        </div>

    );
}


export default DutyScheduleManager;