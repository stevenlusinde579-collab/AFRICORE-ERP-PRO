import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    FaSave,
    FaArrowLeft,
    FaSearch,
    FaUsers,
    FaBook,
    FaSchool,
    FaCheckCircle,
    FaExclamationTriangle,
    FaSpinner,
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";

const API_URL = "http://localhost:5000/api";

function EnterMarks() {
    const navigate = useNavigate();
    const { id: examId } = useParams();

    // =====================================================
    // STATES
    // =====================================================

    const [exam, setExam] = useState(null);

    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [examSubjects, setExamSubjects] = useState([]);

    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedExamSubjectId, setSelectedExamSubjectId] =
        useState("");

    const [search, setSearch] = useState("");

    const [loadingClasses, setLoadingClasses] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingExam, setLoadingExam] = useState(false);
    const [loadingSubjects, setLoadingSubjects] = useState(false);
    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // =====================================================
    // LOAD CLASSES
    // =====================================================

    const loadClasses = async () => {
        try {
            setLoadingClasses(true);
            setError("");

            const response = await axios.get(`${API_URL}/classes`, {
                timeout: 15000,
            });

            const data = response.data;

            if (Array.isArray(data)) {
                setClasses(data);
                return;
            }

            if (data?.success) {
                setClasses(
                    data.classes ||
                        data.data ||
                        []
                );
                return;
            }

            setError(
                data?.message ||
                    "Failed to load classes."
            );
        } catch (err) {
            console.error("LOAD CLASSES ERROR:", err);

            setError(
                err.response?.data?.message ||
                    "Failed to load classes. Make sure the backend server is running."
            );
        } finally {
            setLoadingClasses(false);
        }
    };

    // =====================================================
    // LOAD EXAM
    // =====================================================

    const loadExam = async () => {
        if (!examId) {
            return;
        }

        try {
            setLoadingExam(true);

            const response = await axios.get(
                `${API_URL}/exams/${examId}`,
                {
                    timeout: 15000,
                }
            );

            if (response.data?.success) {
                setExam(response.data.exam || null);
            } else if (response.data?.exam) {
                setExam(response.data.exam);
            }
        } catch (err) {
            console.error("LOAD EXAM ERROR:", err);

            // Do not block the whole page if exam fails.
            console.warn(
                "Exam information could not be loaded."
            );
        } finally {
            setLoadingExam(false);
        }
    };

    // =====================================================
    // LOAD EXAM SUBJECTS
    // =====================================================

    const loadExamSubjects = async () => {
        if (!examId) {
            return;
        }

        try {
            setLoadingSubjects(true);

            const response = await axios.get(
                `${API_URL}/exams/${examId}/subjects`,
                {
                    timeout: 15000,
                }
            );

            if (response.data?.success) {
                setExamSubjects(
                    response.data.subjects || []
                );
            } else if (
                Array.isArray(response.data)
            ) {
                setExamSubjects(response.data);
            } else {
                setExamSubjects([]);
            }
        } catch (err) {
            console.error(
                "LOAD EXAM SUBJECTS ERROR:",
                err
            );

            // Do not make the page hang.
            setExamSubjects([]);
        } finally {
            setLoadingSubjects(false);
        }
    };

    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {
        loadClasses();
        loadExam();
        loadExamSubjects();
    }, [examId]);

    // =====================================================
    // FIND CLASS NAME
    // =====================================================

    const selectedClass = useMemo(() => {
        return classes.find(
            (item) =>
                String(item.id) ===
                String(selectedClassId)
        );
    }, [classes, selectedClassId]);

    // =====================================================
    // SUBJECTS FOR SELECTED CLASS
    // =====================================================

    const subjectsForSelectedClass = useMemo(() => {
        if (!selectedClassId) {
            return [];
        }

        return examSubjects.filter((item) => {
            return (
                String(item.class_id) ===
                    String(selectedClassId) ||
                String(item.class?.id) ===
                    String(selectedClassId)
            );
        });
    }, [
        examSubjects,
        selectedClassId,
    ]);

    // =====================================================
    // SELECTED EXAM SUBJECT
    // =====================================================

    const selectedExamSubject = useMemo(() => {
        return examSubjects.find(
            (item) =>
                String(item.id) ===
                String(selectedExamSubjectId)
        );
    }, [
        examSubjects,
        selectedExamSubjectId,
    ]);

    // =====================================================
    // LOAD STUDENTS BY CLASS
    //
    // The first endpoint expected:
    // GET /classes/:classId/students
    //
    // If your backend uses:
    // GET /students?class_id=:classId
    // the fallback below handles it.
    // =====================================================

    const loadStudentsByClass = async (classId) => {
        if (!classId) {
            setStudents([]);
            return;
        }

        try {
            setLoadingStudents(true);
            setError("");

            let response;

            try {
                response = await axios.get(
                    `${API_URL}/classes/${classId}/students`,
                    {
                        timeout: 15000,
                    }
                );
            } catch (firstError) {
                console.warn(
                    "First student endpoint failed. Trying fallback endpoint..."
                );

                response = await axios.get(
                    `${API_URL}/students?class_id=${classId}`,
                    {
                        timeout: 15000,
                    }
                );
            }

            const data = response.data;

            let studentList = [];

            if (Array.isArray(data)) {
                studentList = data;
            } else if (data?.success) {
                studentList =
                    data.students ||
                    data.data ||
                    [];
            } else if (
                Array.isArray(data?.students)
            ) {
                studentList = data.students;
            }

            setStudents(
                studentList.map((student) => ({
                    ...student,
                    marks:
                        student.marks ??
                        student.mark ??
                        "",
                }))
            );
        } catch (err) {
            console.error(
                "LOAD STUDENTS BY CLASS ERROR:",
                err
            );

            setStudents([]);

            setError(
                err.response?.data?.message ||
                    "Failed to load students for this class."
            );
        } finally {
            setLoadingStudents(false);
        }
    };

    // =====================================================
    // CLASS CHANGE
    // =====================================================

    const handleClassChange = async (e) => {
        const classId = e.target.value;

        setSelectedClassId(classId);
        setSelectedExamSubjectId("");

        setStudents([]);
        setSearch("");
        setMessage("");
        setError("");

        if (!classId) {
            return;
        }

        await loadStudentsByClass(classId);
    };

    // =====================================================
    // SUBJECT CHANGE
    // =====================================================

    const handleSubjectChange = (e) => {
        const subjectId = e.target.value;

        setSelectedExamSubjectId(subjectId);

        setMessage("");
        setError("");
    };

    // =====================================================
    // UPDATE MARK
    // =====================================================

    const updateMark = (studentId, value) => {
        setStudents((currentStudents) =>
            currentStudents.map((student) =>
                Number(student.id) ===
                Number(studentId)
                    ? {
                          ...student,
                          marks: value,
                      }
                    : student
            )
        );
    };

    // =====================================================
    // SAVE MARKS
    // =====================================================

    const saveMarks = async () => {
        try {
            setSaving(true);
            setMessage("");
            setError("");

            if (!examId) {
                setError(
                    "Exam ID is missing."
                );
                return;
            }

            if (!selectedClassId) {
                setError(
                    "Please select a class first."
                );
                return;
            }

            if (!selectedExamSubject) {
                setError(
                    "Please select a subject first."
                );
                return;
            }

            if (
                !students ||
                students.length === 0
            ) {
                setError(
                    "There are no students in the selected class."
                );
                return;
            }

            const fullMarks = Number(
                selectedExamSubject.full_marks || 100
            );

            // ---------------------------------------------
            // VALIDATE MARKS
            // ---------------------------------------------

            for (const student of students) {
                const value = student.marks;

                if (
                    value === "" ||
                    value === null ||
                    value === undefined
                ) {
                    continue;
                }

                const numericMark =
                    Number(value);

                if (
                    Number.isNaN(
                        numericMark
                    )
                ) {
                    setError(
                        `Invalid marks for ${
                            student.first_name || ""
                        } ${
                            student.last_name || ""
                        }`
                    );
                    return;
                }

                if (
                    numericMark < 0 ||
                    numericMark > fullMarks
                ) {
                    setError(
                        `Marks for ${
                            student.first_name || ""
                        } must be between 0 and ${fullMarks}.`
                    );
                    return;
                }
            }

            // ---------------------------------------------
            // PAYLOAD
            // ---------------------------------------------

            const payload = {
                exam_id: Number(examId),

                subject_id: Number(
                    selectedExamSubject.subject_id
                ),

                class_id: Number(
                    selectedClassId
                ),

                marks: students.map(
                    (student) => ({
                        student_id:
                            Number(
                                student.id
                            ),

                        marks:
                            student.marks ===
                                "" ||
                            student.marks ===
                                null ||
                            student.marks ===
                                undefined
                                ? ""
                                : Number(
                                      student.marks
                                  ),
                    })
                ),
            };

            console.log(
                "SAVE MARKS PAYLOAD:",
                payload
            );

            const response =
                await axios.post(
                    `${API_URL}/exams/marks`,
                    payload,
                    {
                        timeout: 20000,
                    }
                );

            if (
                response.data?.success
            ) {
                setMessage(
                    "Marks saved successfully."
                );

                await loadStudentsByClass(
                    selectedClassId
                );
            } else {
                setError(
                    response.data?.message ||
                        "Failed to save marks."
                );
            }
        } catch (err) {
            console.error(
                "SAVE MARKS ERROR:",
                err
            );

            setError(
                err.response?.data?.message ||
                    "Failed to save marks."
            );
        } finally {
            setSaving(false);
        }
    };

    // =====================================================
    // SEARCH
    // =====================================================

    const filteredStudents = useMemo(() => {
        const keyword =
            search
                .trim()
                .toLowerCase();

        if (!keyword) {
            return students;
        }

        return students.filter(
            (student) => {
                const fullName = [
                    student.first_name,
                    student.middle_name,
                    student.last_name,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                const admission =
                    String(
                        student.admission_number ||
                            student.admission_no ||
                            ""
                    ).toLowerCase();

                return (
                    fullName.includes(
                        keyword
                    ) ||
                    admission.includes(
                        keyword
                    )
                );
            }
        );
    }, [students, search]);

    // =====================================================
    // ENTERED MARKS
    // =====================================================

    const enteredMarksCount =
        students.filter(
            (student) =>
                student.marks !== "" &&
                student.marks !== null &&
                student.marks !== undefined
        ).length;

    // =====================================================
    // PAGE
    // =====================================================

    return (
        <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                <div>
                    <button
                        onClick={() =>
                            navigate(-1)
                        }
                        className="flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-3"
                    >
                        <FaArrowLeft />
                        Back
                    </button>

                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                        Enter Marks
                    </h1>

                    <p className="text-gray-500 mt-1">
                        Select a class, view its
                        registered students and
                        enter examination marks.
                    </p>
                </div>

                {exam && (
                    <div className="bg-white border rounded-xl px-5 py-4 shadow-sm">

                        <p className="text-xs text-gray-500 uppercase">
                            Examination
                        </p>

                        <p className="font-bold text-gray-800">
                            {exam.exam_name ||
                                "-"}
                        </p>

                    </div>
                )}

            </div>

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3">

                    <FaExclamationTriangle className="mt-1" />

                    <div>
                        <p className="font-semibold">
                            Error
                        </p>

                        <p className="text-sm mt-1">
                            {error}
                        </p>
                    </div>

                </div>
            )}

            {/* =================================================
                SUCCESS
            ================================================= */}

            {message && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 flex items-start gap-3">

                    <FaCheckCircle className="mt-1" />

                    <div>
                        <p className="font-semibold">
                            Success
                        </p>

                        <p className="text-sm mt-1">
                            {message}
                        </p>
                    </div>

                </div>
            )}

            {/* =================================================
                CLASS SELECTION
            ================================================= */}

            <div className="bg-white rounded-2xl shadow-sm border p-5">

                <div className="flex items-center gap-3 mb-6">

                    <div className="bg-blue-100 text-blue-700 p-3 rounded-xl">
                        <FaSchool />
                    </div>

                    <div>
                        <h2 className="font-bold text-lg text-gray-800">
                            Select Class
                        </h2>

                        <p className="text-sm text-gray-500">
                            Select the class to display
                            students registered in that
                            class.
                        </p>
                    </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* CLASS */}

                    <div>

                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Class
                        </label>

                        <select
                            value={
                                selectedClassId
                            }
                            onChange={
                                handleClassChange
                            }
                            disabled={
                                loadingClasses
                            }
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                        >

                            <option value="">
                                {loadingClasses
                                    ? "Loading classes..."
                                    : "Select Class"}
                            </option>

                            {classes.map(
                                (classItem) => (
                                    <option
                                        key={
                                            classItem.id
                                        }
                                        value={
                                            classItem.id
                                        }
                                    >
                                        {
                                            classItem.class_name ||
                                            classItem.name ||
                                            classItem.className ||
                                            `Class ${classItem.id}`
                                        }
                                    </option>
                                )
                            )}

                        </select>

                        {loadingClasses && (
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                <FaSpinner className="animate-spin" />
                                Loading classes...
                            </div>
                        )}

                    </div>

                    {/* SUBJECT */}

                    <div>

                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Subject
                        </label>

                        <select
                            value={
                                selectedExamSubjectId
                            }
                            onChange={
                                handleSubjectChange
                            }
                            disabled={
                                !selectedClassId ||
                                loadingSubjects
                            }
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                        >

                            <option value="">
                                {!selectedClassId
                                    ? "Select class first"
                                    : loadingSubjects
                                    ? "Loading subjects..."
                                    : "Select Subject"}
                            </option>

                            {subjectsForSelectedClass.map(
                                (item) => (
                                    <option
                                        key={
                                            item.id
                                        }
                                        value={
                                            item.id
                                        }
                                    >
                                        {
                                            item.subject
                                                ?.subject_name ||
                                            item.subject_name ||
                                            "Unknown Subject"
                                        }
                                    </option>
                                )
                            )}

                        </select>

                    </div>

                </div>

                {/* SELECTED CLASS */}

                {selectedClass && (
                    <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4">

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            <div>
                                <p className="text-xs text-gray-500 uppercase">
                                    Selected Class
                                </p>

                                <p className="font-bold text-blue-800 mt-1">
                                    {
                                        selectedClass.class_name ||
                                        selectedClass.name ||
                                        selectedClass.className ||
                                        "-"
                                    }
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 uppercase">
                                    Students
                                </p>

                                <p className="font-bold text-blue-800 mt-1">
                                    {students.length}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 uppercase">
                                    Selected Subject
                                </p>

                                <p className="font-bold text-blue-800 mt-1">
                                    {selectedExamSubject
                                        ?.subject
                                        ?.subject_name ||
                                        "-"}
                                </p>
                            </div>

                        </div>

                    </div>
                )}

            </div>

            {/* =================================================
                STUDENTS
            ================================================= */}

            {selectedClassId && (
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">

                    {/* HEADER */}

                    <div className="p-5 border-b bg-gray-50">

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                            <div className="flex items-center gap-3">

                                <div className="bg-purple-100 text-purple-700 p-3 rounded-xl">
                                    <FaUsers />
                                </div>

                                <div>
                                    <h2 className="font-bold text-lg text-gray-800">
                                        Students in Class
                                    </h2>

                                    <p className="text-sm text-gray-500">
                                        {
                                            selectedClass
                                                ?.class_name ||
                                            selectedClass
                                                ?.name ||
                                            selectedClass
                                                ?.className ||
                                            "-"
                                        }
                                    </p>
                                </div>

                            </div>

                            <div className="flex items-center gap-3">

                                <div className="bg-white border rounded-xl px-4 py-2">

                                    <p className="text-xs text-gray-500">
                                        Students
                                    </p>

                                    <p className="font-bold text-gray-800">
                                        {
                                            students.length
                                        }
                                    </p>

                                </div>

                                <div className="bg-white border rounded-xl px-4 py-2">

                                    <p className="text-xs text-gray-500">
                                        Entered
                                    </p>

                                    <p className="font-bold text-green-700">
                                        {
                                            enteredMarksCount
                                        }
                                    </p>

                                </div>

                            </div>

                        </div>

                    </div>

                    {/* SEARCH */}

                    <div className="p-5 border-b">

                        <div className="relative">

                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

                            <input
                                type="text"
                                value={
                                    search
                                }
                                onChange={(e) =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Search student by name or admission number..."
                                className="w-full border border-gray-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                            />

                        </div>

                    </div>

                    {/* LOADING STUDENTS */}

                    {loadingStudents ? (
                        <div className="p-12 text-center">

                            <FaSpinner className="animate-spin text-blue-600 text-3xl mx-auto mb-4" />

                            <p className="font-semibold text-gray-700">
                                Loading students...
                            </p>

                            <p className="text-sm text-gray-500 mt-1">
                                Loading students registered
                                in the selected class.
                            </p>

                        </div>
                    ) : students.length === 0 ? (
                        <div className="p-12 text-center">

                            <FaUsers className="mx-auto text-5xl text-gray-300 mb-4" />

                            <p className="font-semibold text-gray-700">
                                No students found
                            </p>

                            <p className="text-sm text-gray-500 mt-1">
                                No students are registered
                                in this class.
                            </p>

                        </div>
                    ) : (
                        <>
                            {/* TABLE */}

                            <div className="overflow-x-auto">

                                <table className="w-full">

                                    <thead className="bg-gray-100">

                                        <tr>

                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                                #
                                            </th>

                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                                Admission No.
                                            </th>

                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                                Student Name
                                            </th>

                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                                Gender
                                            </th>

                                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                                                Marks
                                                {selectedExamSubject
                                                    ? ` / ${selectedExamSubject.full_marks}`
                                                    : ""}
                                            </th>

                                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                                                Status
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {filteredStudents.map(
                                            (
                                                student,
                                                index
                                            ) => {
                                                const mark =
                                                    student.marks;

                                                const hasMark =
                                                    mark !==
                                                        "" &&
                                                    mark !==
                                                        null &&
                                                    mark !==
                                                        undefined;

                                                const numericMark =
                                                    Number(
                                                        mark
                                                    );

                                                const passMarks =
                                                    Number(
                                                        selectedExamSubject?.pass_marks ||
                                                            0
                                                    );

                                                const passed =
                                                    hasMark &&
                                                    selectedExamSubject &&
                                                    numericMark >=
                                                        passMarks;

                                                const studentName =
                                                    [
                                                        student.first_name,
                                                        student.middle_name,
                                                        student.last_name,
                                                    ]
                                                        .filter(
                                                            Boolean
                                                        )
                                                        .join(
                                                            " "
                                                        );

                                                return (
                                                    <tr
                                                        key={
                                                            student.id
                                                        }
                                                        className="border-b hover:bg-gray-50"
                                                    >

                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {
                                                                index +
                                                                1
                                                            }
                                                        </td>

                                                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                                                            {
                                                                student.admission_number ||
                                                                student.admission_no ||
                                                                "-"
                                                            }
                                                        </td>

                                                        <td className="px-4 py-3">

                                                            <div className="font-semibold text-gray-800">
                                                                {
                                                                    studentName ||
                                                                    "-"
                                                                }
                                                            </div>

                                                        </td>

                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {
                                                                student.gender ||
                                                                "-"
                                                            }
                                                        </td>

                                                        <td className="px-4 py-3">

                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={
                                                                    selectedExamSubject?.full_marks ||
                                                                    100
                                                                }
                                                                step="0.01"
                                                                disabled={
                                                                    !selectedExamSubject
                                                                }
                                                                value={
                                                                    mark ??
                                                                    ""
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) =>
                                                                    updateMark(
                                                                        student.id,
                                                                        e
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className="w-28 mx-auto block border border-gray-300 rounded-lg px-3 py-2 text-center font-semibold outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                                                placeholder={
                                                                    selectedExamSubject
                                                                        ? "0"
                                                                        : "Select subject"
                                                                }
                                                            />

                                                        </td>

                                                        <td className="px-4 py-3 text-center">

                                                            {!hasMark ? (
                                                                <span className="text-xs text-gray-400">
                                                                    Not entered
                                                                </span>
                                                            ) : !selectedExamSubject ? (
                                                                <span className="text-xs text-gray-400">
                                                                    Select subject
                                                                </span>
                                                            ) : passed ? (
                                                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                                                                    <FaCheckCircle />
                                                                    Pass
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                                                                    <FaExclamationTriangle />
                                                                    Fail
                                                                </span>
                                                            )}

                                                        </td>

                                                    </tr>
                                                );
                                            }
                                        )}

                                    </tbody>

                                </table>

                            </div>

                            {/* SAVE */}

                            <div className="p-5 border-t bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                                <div>

                                    <p className="text-sm text-gray-600">
                                        {
                                            enteredMarksCount
                                        }{" "}
                                        of{" "}
                                        {
                                            students.length
                                        }{" "}
                                        students have marks.
                                    </p>

                                    <p className="text-xs text-gray-500 mt-1">
                                        Select a subject
                                        before saving
                                        marks.
                                    </p>

                                </div>

                                <button
                                    onClick={
                                        saveMarks
                                    }
                                    disabled={
                                        saving ||
                                        loadingStudents ||
                                        !selectedExamSubject
                                    }
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold"
                                >

                                    {saving ? (
                                        <FaSpinner className="animate-spin" />
                                    ) : (
                                        <FaSave />
                                    )}

                                    {saving
                                        ? "Saving..."
                                        : "Save Marks"}

                                </button>

                            </div>

                        </>
                    )}

                </div>
            )}

            {/* =================================================
                NO CLASS SELECTED
            ================================================= */}

            {!selectedClassId && (
                <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">

                    <FaSchool className="mx-auto text-5xl text-blue-200 mb-4" />

                    <h2 className="text-lg font-bold text-gray-700">
                        Select a Class
                    </h2>

                    <p className="text-sm text-gray-500 mt-2">
                        Select a class above to display
                        all students registered in that
                        class.
                    </p>

                </div>
            )}

        </div>
    );
}

export default EnterMarks;