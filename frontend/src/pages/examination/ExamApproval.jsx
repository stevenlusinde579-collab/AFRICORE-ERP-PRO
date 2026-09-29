import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useLocation,
    useParams
} from "react-router-dom";

import axios from "axios";

import {
    supabase
} from "../../services/supabase";


const API_URL =
    "https://africore-erp-pro.onrender.com/api";

const BUCKET =
    "exam-papers";


const ExamApproval = () => {

    const { examId } = useParams();

    const location =
        useLocation();


    // =========================================================
    // STATE
    // =========================================================

    const [exam, setExam] =
        useState(null);

    const [examSubjects, setExamSubjects] =
        useState([]);

    const [subjects, setSubjects] =
        useState([]);

    const [selectedExamSubjectId, setSelectedExamSubjectId] =
        useState("");

    // =========================================================
    // SUBJECT-LEVEL APPROVAL STATE
    // =========================================================
    const [approvalStatus, setApprovalStatus] =
        useState(null);

    const [approvalLoading, setApprovalLoading] =
        useState(false);

    const [papers, setPapers] =
        useState([]);

    const [analysis, setAnalysis] =
        useState(null);

    const [role, setRole] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [papersLoading, setPapersLoading] =
        useState(false);

    const [analysisLoading, setAnalysisLoading] =
        useState(false);

    const [actionLoading, setActionLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    // =========================================================
    // PDF STATE
    // =========================================================

    const [selectedPaper, setSelectedPaper] =
        useState(null);

    const [pdfUrl, setPdfUrl] =
        useState("");

    const [pdfLoading, setPdfLoading] =
        useState(false);

    const [pdfError, setPdfError] =
        useState("");


    // =========================================================
    // REJECTION
    // =========================================================

    const [showRejectModal, setShowRejectModal] =
        useState(false);

    const [rejectionReason, setRejectionReason] =
        useState("");

    const [deletingPaperId, setDeletingPaperId] =
        useState(null);

    const [showNotificationPanel, setShowNotificationPanel] = useState(false);
    const [notificationType, setNotificationType] = useState("");
    const [notificationChannels, setNotificationChannels] = useState(["sms"]);
    const [notificationSending, setNotificationSending] = useState(false);
    const [notificationResult, setNotificationResult] = useState(null);
    const [notificationReason, setNotificationReason] = useState("");


    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {

        if (!examId) {

            setError("Exam ID haipo.");
            setLoading(false);

            return;
        }

        loadPage();

    }, [examId]);


    // =========================================================
    // LOAD PAGE
    // =========================================================

    const loadPage = async () => {

        try {

            setLoading(true);
            setError("");

            await loadUserRole();
            await loadExam();
            await loadExamSubjects();

        } catch (err) {

            console.error(
                "LOAD PAGE ERROR:",
                err
            );

            setError(
                err?.message ||
                "Imeshindikana kupakia Approval Page."
            );

        } finally {

            setLoading(false);

        }

    };


    // =========================================================
    // LOAD ROLE
    // =========================================================

    const loadUserRole = async () => {

        try {

            const {
                data: userData
            } =
                await supabase.auth.getUser();

            const user =
                userData?.user;

            if (!user?.id) {
                return;
            }

            const {
                data,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        roles (
                            role_name
                        )
                    `)
                    .eq("id", user.id)
                    .maybeSingle();

            if (profileError) {

                console.error(
                    "ROLE ERROR:",
                    profileError
                );

                return;
            }

            setRole(
                data?.roles?.role_name ||
                ""
            );

        } catch (err) {

            console.error(
                "LOAD ROLE ERROR:",
                err
            );

        }

    };


    // =========================================================
    // LOAD EXAM
    // =========================================================

    const loadExam = async () => {

        const {
            data,
            error: examError
        } =
            await supabase
                .from("exams")
                .select("*")
                .eq("id", examId)
                .maybeSingle();

        if (examError) {
            throw examError;
        }

        if (!data) {

            throw new Error(
                "Examination haikupatikana."
            );

        }

        setExam(data);

    };


    // =========================================================
    // LOAD SUBJECTS
    // =========================================================

    const loadExamSubjects = async () => {

        try {

            const {
                data: subjectRows,
                error: subjectError
            } =
                await supabase
                    .from("subjects")
                    .select("*");

            if (subjectError) {

                console.error(
                    "SUBJECTS ERROR:",
                    subjectError
                );

            }

            setSubjects(
                subjectRows || []
            );


            const {
                data: examSubjectRows,
                error: examSubjectError
            } =
                await supabase
                    .from("exam_subjects")
                    .select("*")
                    .eq("exam_id", examId);

            if (examSubjectError) {
                throw examSubjectError;
            }

            const rows =
                examSubjectRows || [];

            setExamSubjects(rows);


            const navigationState =
                location?.state || {};

            const stateSubject =
                navigationState.examSubjectId ||
                navigationState.exam_subject_id ||
                navigationState.subjectId;

            const savedSubject =
                sessionStorage.getItem(
                    `approval_subject_${examId}`
                );

            let initialSubject = "";


            if (
                stateSubject &&
                rows.some(
                    row =>
                        String(row.id) ===
                        String(stateSubject)
                )
            ) {

                initialSubject =
                    String(stateSubject);

            } else if (
                savedSubject &&
                rows.some(
                    row =>
                        String(row.id) ===
                        String(savedSubject)
                )
            ) {

                initialSubject =
                    String(savedSubject);

            } else if (
                rows.length > 0
            ) {

                initialSubject =
                    String(rows[0].id);

            }

            setSelectedExamSubjectId(
                initialSubject
            );

        } catch (err) {

            console.error(
                "LOAD EXAM SUBJECTS ERROR:",
                err
            );

            setExamSubjects([]);

        }

    };


    // =========================================================
    // LOAD SUBJECT-LEVEL APPROVAL STATUS
    // =========================================================
    // Approval belongs to the exact exam_subject (Subject + Class).
    // Never read approval from exams.
    const loadApprovalStatus = async (examSubjectId = selectedExamSubjectId) => {
        if (!examSubjectId) {
            setApprovalStatus(null);
            return null;
        }

        try {
            setApprovalLoading(true);

            const { data, error: approvalError } = await supabase
                .from("exam_subjects")
                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    approval_status,
                    approved_by_academic,
                    approved_by_deputy,
                    approved_by_headmaster,
                    approved_at,
                    rejection_reason,
                    rejected_by,
                    rejected_at
                `)
                .eq("id", Number(examSubjectId))
                .eq("exam_id", Number(examId))
                .maybeSingle();

            if (approvalError) throw approvalError;

            setApprovalStatus(data || null);
            return data || null;
        } catch (error) {
            console.error("LOAD SUBJECT APPROVAL STATUS ERROR:", error);
            setApprovalStatus(null);
            return null;
        } finally {
            setApprovalLoading(false);
        }
    };

    // =========================================================
    // SUBJECT CHANGE
    // =========================================================

    useEffect(() => {

        if (!selectedExamSubjectId) {

            setPapers([]);
            setAnalysis(null);
            setSelectedPaper(null);
            setPdfUrl("");
            setPdfError("");

            return;
        }

        sessionStorage.setItem(
            `approval_subject_${examId}`,
            String(selectedExamSubjectId)
        );

        setSelectedPaper(null);
        setPdfUrl("");
        setPdfError("");

        loadExamPapers(
            selectedExamSubjectId
        );

        loadAIAnalysis(
            selectedExamSubjectId
        );

        loadApprovalStatus(
            selectedExamSubjectId
        );

    }, [
        selectedExamSubjectId,
        examId
    ]);


    // =========================================================
    // SELECTED EXAM SUBJECT
    // =========================================================

    const selectedExamSubject =
        useMemo(() => {

            return examSubjects.find(
                item =>
                    String(item.id) ===
                    String(selectedExamSubjectId)
            ) || null;

        }, [
            examSubjects,
            selectedExamSubjectId
        ]);


    // =========================================================
    // SELECTED SUBJECT
    // =========================================================

    const selectedSubject =
        useMemo(() => {

            if (!selectedExamSubject) {
                return null;
            }

            return subjects.find(
                subject =>
                    String(subject.id) ===
                    String(
                        selectedExamSubject.subject_id
                    )
            ) || null;

        }, [
            subjects,
            selectedExamSubject
        ]);


    // =========================================================
    // SUBJECT NAME
    // =========================================================

    const subjectName =
        useMemo(() => {

            return (
                selectedSubject?.name ||
                selectedSubject?.subject_name ||
                selectedSubject?.title ||
                (
                    selectedExamSubject
                        ? `Subject ${selectedExamSubject.subject_id}`
                        : "No subject selected"
                )
            );

        }, [
            selectedSubject,
            selectedExamSubject
        ]);


    // =========================================================
    // LOAD EXAM PAPERS
    // =========================================================

    const loadExamPapers = async (
        subjectId = selectedExamSubjectId
    ) => {

        if (
            !examId ||
            !subjectId
        ) {

            setPapers([]);

            return [];

        }

        try {

            setPapersLoading(true);

            const {
                data,
                error: papersError
            } =
                await supabase
                    .from("exam_papers")
                    .select(`
                        id,
                        exam_id,
                        exam_subject_id,
                        file_name,
                        file_url,
                        file_hash,
                        file_type,
                        ai_status,
                        uploaded_by,
                        created_at
                    `)
                    .eq(
                        "exam_id",
                        examId
                    )
                    .eq(
                        "exam_subject_id",
                        subjectId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            if (papersError) {
                throw papersError;
            }

            const rows =
                data || [];

            console.log(
                "EXAM PAPERS:",
                rows
            );

            setPapers(rows);

            return rows;

        } catch (err) {

            console.error(
                "LOAD PAPERS ERROR:",
                err
            );

            setPapers([]);

            return [];

        } finally {

            setPapersLoading(false);

        }

    };


    // =========================================================
    // LOAD AI ANALYSIS
    // =========================================================

    const loadAIAnalysis = async (
        subjectId = selectedExamSubjectId
    ) => {

        if (
            !examId ||
            !subjectId
        ) {

            setAnalysis(null);

            return;

        }

        try {

            setAnalysisLoading(true);
            setAnalysis(null);

            const response =
                await axios.get(
                    `${API_URL}/ai/analysis/${examId}/${subjectId}`,
                    {
                        validateStatus:
                            status =>
                                status >= 200 &&
                                status < 500
                    }
                );

            console.log(
                "AI ANALYSIS RESPONSE:",
                response.data
            );

            const responseData =
                response.data || {};


            // =================================================
            // MERGE BACKEND PAPER
            // =================================================

            if (
                responseData?.paper?.id
            ) {

                const backendPaper =
                    responseData.paper;

                setPapers(
                    previous => {

                        const exists =
                            previous.some(
                                item =>
                                    String(item.id) ===
                                    String(
                                        backendPaper.id
                                    )
                            );

                        if (exists) {

                            return previous.map(
                                item =>
                                    String(item.id) ===
                                    String(
                                        backendPaper.id
                                    )
                                        ? {
                                            ...item,
                                            ...backendPaper
                                        }
                                        : item
                            );

                        }

                        return [
                            backendPaper,
                            ...previous
                        ];

                    }
                );

            }


            if (
                responseData?.paper?.pdf_url
            ) {

                const backendPdfUrl =
                    responseData.paper.pdf_url;

                setPapers(
                    previous =>
                        previous.map(
                            item =>
                                String(item.id) ===
                                String(
                                    responseData.paper.id
                                )
                                    ? {
                                        ...item,
                                        pdf_url:
                                            backendPdfUrl
                                    }
                                    : item
                        )
                );

            }


            if (
                responseData?.success ===
                false
            ) {

                setAnalysis(null);

                return;

            }


            const rawAnalysis =
                responseData?.analysis ??
                null;

            const analysisData =
                Array.isArray(rawAnalysis)
                    ? (
                        rawAnalysis.length > 0
                            ? rawAnalysis[
                                rawAnalysis.length - 1
                            ]
                            : null
                    )
                    : rawAnalysis;

            setAnalysis(
                analysisData
            );

        } catch (err) {

            console.error(
                "LOAD AI ANALYSIS ERROR:",
                err
            );

            setAnalysis(null);

        } finally {

            setAnalysisLoading(false);

        }

    };


    // =========================================================
    // PDF STORAGE RESOLVER
    // =========================================================

    const normalizePath = (value) => {

        if (
            !value ||
            typeof value !== "string"
        ) {
            return null;
        }

        return value
            .trim()
            .replace(
                /^["']|["']$/g,
                ""
            )
            .replace(
                /^\/+/,
                ""
            );

    };


    // =========================================================
    // GET STORAGE PATH
    // =========================================================

    const getStoragePath = (fileUrl) => {

        const value =
            normalizePath(fileUrl);

        if (!value) {
            return null;
        }


        // -----------------------------------------------------
        // RAW STORAGE PATH
        // -----------------------------------------------------

        if (
            !/^https?:\/\//i.test(
                value
            )
        ) {

            let path =
                value;

            path =
                path.replace(
                    /^(public|sign|authenticated)\//i,
                    ""
                );

            if (
                path
                    .toLowerCase()
                    .startsWith(
                        `${BUCKET.toLowerCase()}/`
                    )
            ) {

                path =
                    path.substring(
                        BUCKET.length + 1
                    );

            }

            return path || null;

        }


        // -----------------------------------------------------
        // SUPABASE STORAGE URL
        // -----------------------------------------------------

        try {

            const url =
                new URL(value);

            const pathname =
                decodeURIComponent(
                    url.pathname
                );

            const marker =
                "/storage/v1/object/";

            const markerIndex =
                pathname.indexOf(
                    marker
                );

            if (
                markerIndex === -1
            ) {
                return null;
            }

            let path =
                pathname.substring(
                    markerIndex +
                    marker.length
                );

            path =
                path.replace(
                    /^(public|sign|authenticated)\//i,
                    ""
                );

            if (
                path
                    .toLowerCase()
                    .startsWith(
                        `${BUCKET.toLowerCase()}/`
                    )
            ) {

                path =
                    path.substring(
                        BUCKET.length + 1
                    );

            }

            return path || null;

        } catch (err) {

            console.warn(
                "STORAGE URL PARSE FAILED:",
                err
            );

            return null;

        }

    };


    // =========================================================
    // GET FILE NAME
    // =========================================================

    const getPaperFileName = (paper) => {

        if (
            paper?.file_name &&
            typeof paper.file_name === "string"
        ) {

            return paper.file_name
                .trim()
                .split("/")
                .pop();

        }

        return null;

    };


    // =========================================================
    // GET FILE HASH
    // =========================================================

    const getPaperHash = (paper) => {

        if (
            !paper?.file_hash ||
            typeof paper.file_hash !== "string"
        ) {

            return null;

        }

        return paper.file_hash
            .trim()
            .split("/")
            .pop()
            .replace(
                /\.pdf$/i,
                ""
            );

    };


    // =========================================================
    // POSSIBLE STORAGE PATHS
    // =========================================================

    const getPossibleStoragePaths = (paper) => {

        const paths = [];


        // -----------------------------------------------------
        // EXISTING FILE URL
        // -----------------------------------------------------

        const fileUrlPath =
            getStoragePath(
                paper?.file_url
            );

        if (fileUrlPath) {
            paths.push(fileUrlPath);
        }


        // -----------------------------------------------------
        // EXISTING PDF URL
        // -----------------------------------------------------

        const pdfUrlPath =
            getStoragePath(
                paper?.pdf_url
            );

        if (pdfUrlPath) {
            paths.push(pdfUrlPath);
        }


        // -----------------------------------------------------
        // HASH PATH
        // -----------------------------------------------------

        const hash =
            getPaperHash(paper);

        if (
            hash &&
            examId &&
            paper?.exam_subject_id
        ) {

            paths.push(
                `${examId}/${paper.exam_subject_id}/${hash}.pdf`
            );

            paths.push(
                `${examId}/${paper.exam_subject_id}/${hash}`
            );

        }


        return [
            ...new Set(
                paths.filter(Boolean)
            )
        ];

    };


    // =========================================================
    // POSSIBLE STORAGE FOLDERS
    // =========================================================

    const getPossibleStorageFolders = (paper) => {

        const folders = [];


        const paths =
            getPossibleStoragePaths(
                paper
            );


        paths.forEach(path => {

            const cleanPath =
                String(path)
                    .replace(
                        /^\/+/,
                        ""
                    )
                    .trim();

            const parts =
                cleanPath.split("/");

            if (
                parts.length > 1
            ) {

                parts.pop();

                const folder =
                    parts.join("/");

                if (folder) {
                    folders.push(folder);
                }

            }

        });


        // -----------------------------------------------------
        // STANDARD FOLDER
        // -----------------------------------------------------

        if (
            examId &&
            paper?.exam_subject_id
        ) {

            folders.push(
                `${examId}/${paper.exam_subject_id}`
            );

        }


        return [
            ...new Set(
                folders.filter(Boolean)
            )
        ];

    };


    // =========================================================
    // LIST STORAGE FOLDER
    // =========================================================

    const listStorageFolder = async (
        folder
    ) => {

        if (!folder) {
            return [];
        }

        try {

            console.log(
                "SEARCHING STORAGE FOLDER:",
                folder
            );

            const {
                data,
                error
            } =
                await supabase
                    .storage
                    .from(BUCKET)
                    .list(
                        folder,
                        {
                            limit: 1000,
                            sortBy: {
                                column: "name",
                                order: "asc"
                            }
                        }
                    );

            if (error) {

                console.warn(
                    "STORAGE LIST FAILED:",
                    {
                        folder,
                        error
                    }
                );

                return [];

            }

            return Array.isArray(data)
                ? data
                : [];

        } catch (err) {

            console.warn(
                "STORAGE LIST ERROR:",
                {
                    folder,
                    err
                }
            );

            return [];

        }

    };


    // =========================================================
    // CREATE SIGNED URL
    // =========================================================

    const createStorageSignedUrl = async (
        storagePath
    ) => {

        if (!storagePath) {
            return null;
        }

        try {

            console.log(
                "TRYING SIGNED STORAGE PATH:",
                storagePath
            );

            const {
                data,
                error
            } =
                await supabase
                    .storage
                    .from(BUCKET)
                    .createSignedUrl(
                        storagePath,
                        60 * 60 * 24
                    );

            if (
                error ||
                !data?.signedUrl
            ) {

                console.warn(
                    "SIGNED URL FAILED:",
                    {
                        storagePath,
                        error
                    }
                );

                return null;

            }

            console.log(
                "SIGNED URL CREATED:",
                storagePath
            );

            return data.signedUrl;

        } catch (err) {

            console.warn(
                "CREATE SIGNED URL ERROR:",
                {
                    storagePath,
                    err
                }
            );

            return null;

        }

    };


    // =========================================================
    // FIND ACTUAL STORAGE OBJECT
    // =========================================================

    const findActualStoragePath = async (
        paper
    ) => {

        if (!paper) {
            return null;
        }


        // -----------------------------------------------------
        // FIRST: EXACT KNOWN PATHS
        // -----------------------------------------------------

        const exactPaths =
            getPossibleStoragePaths(
                paper
            );


        for (
            const path of exactPaths
        ) {

            const testUrl =
                await createStorageSignedUrl(
                    path
                );

            if (testUrl) {

                console.log(
                    "ACTUAL STORAGE OBJECT FOUND:",
                    path
                );

                return path;

            }

        }


        // -----------------------------------------------------
        // SEARCH NAME / HASH
        // -----------------------------------------------------

        const targetFileName =
            getPaperFileName(
                paper
            );

        const targetHash =
            getPaperHash(
                paper
            );


        const targetNames =
            new Set();


        if (targetFileName) {

            targetNames.add(
                targetFileName
                    .toLowerCase()
            );

        }


        if (targetHash) {

            targetNames.add(
                targetHash
                    .toLowerCase()
            );

            targetNames.add(
                `${targetHash}.pdf`
                    .toLowerCase()
            );

        }


        // -----------------------------------------------------
        // SEARCH FOLDERS
        // -----------------------------------------------------

        const folders =
            getPossibleStorageFolders(
                paper
            );


        for (
            const folder of folders
        ) {

            const objects =
                await listStorageFolder(
                    folder
                );


            if (!objects.length) {
                continue;
            }


            // -------------------------------------------------
            // EXACT NAME MATCH
            // -------------------------------------------------

            const exactObject =
                objects.find(
                    object => {

                        const name =
                            String(
                                object?.name ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        return targetNames.has(
                            name
                        );

                    }
                );


            if (
                exactObject?.name
            ) {

                const actualPath =
                    `${folder}/${exactObject.name}`;

                console.log(
                    "STORAGE FILE MATCHED:",
                    actualPath
                );

                const signedUrl =
                    await createStorageSignedUrl(
                        actualPath
                    );

                if (signedUrl) {
                    return actualPath;
                }

            }


            // -------------------------------------------------
            // SINGLE PDF FALLBACK
            // -------------------------------------------------

            const pdfObjects =
                objects.filter(
                    object =>
                        String(
                            object?.name ||
                            ""
                        )
                            .toLowerCase()
                            .endsWith(".pdf")
                );


            if (
                pdfObjects.length === 1
            ) {

                const actualPath =
                    `${folder}/${pdfObjects[0].name}`;

                console.log(
                    "SINGLE PDF FOUND IN FOLDER:",
                    actualPath
                );

                const signedUrl =
                    await createStorageSignedUrl(
                        actualPath
                    );

                if (signedUrl) {
                    return actualPath;
                }

            }

        }


        return null;

    };


    // =========================================================
    // SAVE PDF URL TO STATE
    // =========================================================

    const savePdfUrlToPaper = (
        paperId,
        url
    ) => {

        if (
            !paperId ||
            !url
        ) {
            return;
        }

        setPapers(
            previous =>
                previous.map(
                    item =>
                        String(item.id) ===
                        String(paperId)
                            ? {
                                ...item,
                                pdf_url: url
                            }
                            : item
                )
        );


        setSelectedPaper(
            previous =>
                previous &&
                String(previous.id) ===
                String(paperId)
                    ? {
                        ...previous,
                        pdf_url: url
                    }
                    : previous
        );

    };


    // =========================================================
    // GET PDF FROM BACKEND
    // =========================================================

    const getPdfFromBackend = async (
        paper
    ) => {

        if (
            !examId ||
            !paper?.exam_subject_id
        ) {
            return null;
        }


        try {

            console.log(
                "REQUESTING PDF FROM BACKEND:",
                {
                    examId,
                    examSubjectId:
                        paper.exam_subject_id,
                    paperId:
                        paper.id
                }
            );


            const response =
                await axios.get(
                    `${API_URL}/ai/analysis/${examId}/${paper.exam_subject_id}`,
                    {
                        validateStatus:
                            status =>
                                status >= 200 &&
                                status < 500
                    }
                );


            const data =
                response?.data || {};


            console.log(
                "BACKEND PDF RESPONSE:",
                data
            );


            const candidates = [

                data?.pdf_url,

                data?.paper?.pdf_url,

                data?.paper?.file_url

            ];


            for (
                const candidate of candidates
            ) {

                if (
                    typeof candidate !==
                    "string"
                ) {
                    continue;
                }


                const value =
                    candidate.trim();


                if (!value) {
                    continue;
                }


                // -------------------------------------------------
                // SUPABASE URL
                // -------------------------------------------------

                const storagePath =
                    getStoragePath(
                        value
                    );


                if (storagePath) {

                    const signedUrl =
                        await createStorageSignedUrl(
                            storagePath
                        );

                    if (signedUrl) {
                        return signedUrl;
                    }

                    continue;

                }


                // -------------------------------------------------
                // EXTERNAL URL
                // -------------------------------------------------

                if (
                    /^https?:\/\//i.test(
                        value
                    )
                ) {

                    return value;

                }

            }


            return null;

        } catch (err) {

            console.warn(
                "BACKEND PDF REQUEST ERROR:",
                err
            );

            return null;

        }

    };


    // =========================================================
    // STORAGE DOWNLOAD
    // =========================================================

    const downloadStoragePdf = async (
        storagePath
    ) => {

        if (!storagePath) {
            return null;
        }


        try {

            console.log(
                "DOWNLOADING STORAGE PDF:",
                storagePath
            );


            const {
                data,
                error
            } =
                await supabase
                    .storage
                    .from(BUCKET)
                    .download(
                        storagePath
                    );


            if (
                error ||
                !data
            ) {

                console.warn(
                    "STORAGE DOWNLOAD FAILED:",
                    {
                        storagePath,
                        error
                    }
                );

                return null;

            }


            const blob =
                data instanceof Blob
                    ? data
                    : new Blob(
                        [data],
                        {
                            type:
                                "application/pdf"
                        }
                    );


            if (
                blob.size <= 0
            ) {

                console.warn(
                    "PDF BLOB IS EMPTY:",
                    storagePath
                );

                return null;

            }


            const blobUrl =
                URL.createObjectURL(
                    blob
                );


            console.log(
                "PDF BLOB URL CREATED:",
                blobUrl
            );


            return blobUrl;

        } catch (err) {

            console.warn(
                "STORAGE DOWNLOAD ERROR:",
                {
                    storagePath,
                    err
                }
            );

            return null;

        }

    };


    // =========================================================
    // CREATE PDF URL
    // =========================================================

    const createPdfUrl = async (
        paper
    ) => {

        try {

            setPdfLoading(true);
            setPdfError("");
            setPdfUrl("");


            if (!paper) {

                throw new Error(
                    "Exam paper haipo."
                );

            }


            console.log(
                "OPENING PAPER:",
                paper
            );


            // =================================================
            // METHOD 1
            // EXTERNAL DIRECT URL
            // =================================================

            if (
                typeof paper.file_url ===
                "string" &&
                /^https?:\/\//i.test(
                    paper.file_url.trim()
                )
            ) {

                const directUrl =
                    paper.file_url.trim();

                const storagePath =
                    getStoragePath(
                        directUrl
                    );


                if (!storagePath) {

                    console.log(
                        "USING EXTERNAL DIRECT PDF URL"
                    );

                    setPdfUrl(
                        directUrl
                    );

                    return directUrl;

                }

            }


            // =================================================
            // METHOD 2
            // BACKEND RESOLVER
            // =================================================

            console.log(
                "TRYING BACKEND PDF RESOLUTION..."
            );


            const backendPdfUrl =
                await getPdfFromBackend(
                    paper
                );


            if (backendPdfUrl) {

                console.log(
                    "BACKEND PDF URL FOUND"
                );

                setPdfUrl(
                    backendPdfUrl
                );

                savePdfUrlToPaper(
                    paper.id,
                    backendPdfUrl
                );

                return backendPdfUrl;

            }


            // =================================================
            // METHOD 3
            // FIND REAL STORAGE OBJECT
            // =================================================

            console.log(
                "SEARCHING FOR ACTUAL STORAGE OBJECT..."
            );


            const actualStoragePath =
                await findActualStoragePath(
                    paper
                );


            if (actualStoragePath) {

                console.log(
                    "ACTUAL STORAGE PATH:",
                    actualStoragePath
                );


                // -------------------------------------------------
                // SIGNED URL
                // -------------------------------------------------

                const signedUrl =
                    await createStorageSignedUrl(
                        actualStoragePath
                    );


                if (signedUrl) {

                    setPdfUrl(
                        signedUrl
                    );

                    savePdfUrlToPaper(
                        paper.id,
                        signedUrl
                    );

                    return signedUrl;

                }


                // -------------------------------------------------
                // DOWNLOAD AS BLOB
                // -------------------------------------------------

                const blobUrl =
                    await downloadStoragePdf(
                        actualStoragePath
                    );


                if (blobUrl) {

                    setPdfUrl(
                        blobUrl
                    );

                    savePdfUrlToPaper(
                        paper.id,
                        blobUrl
                    );

                    return blobUrl;

                }

            }


            // =================================================
            // METHOD 4
            // TRY ALL KNOWN PATHS
            // =================================================

            const storagePaths =
                getPossibleStoragePaths(
                    paper
                );


            console.log(
                "PDF STORAGE PATH CANDIDATES:",
                storagePaths
            );


            for (
                const storagePath of
                storagePaths
            ) {

                const signedUrl =
                    await createStorageSignedUrl(
                        storagePath
                    );


                if (signedUrl) {

                    setPdfUrl(
                        signedUrl
                    );

                    savePdfUrlToPaper(
                        paper.id,
                        signedUrl
                    );

                    return signedUrl;

                }


                const blobUrl =
                    await downloadStoragePdf(
                        storagePath
                    );


                if (blobUrl) {

                    setPdfUrl(
                        blobUrl
                    );

                    savePdfUrlToPaper(
                        paper.id,
                        blobUrl
                    );

                    return blobUrl;

                }

            }


            // =================================================
            // NOTHING FOUND
            // =================================================

            throw new Error(
                "PDF record ipo kwenye examination, lakini PDF file halijaonekana kwenye exam-papers Storage."
            );


        } catch (err) {

            console.error(
                "CREATE PDF URL ERROR:",
                err
            );


            setPdfError(
                err?.message ||
                "Imeshindikana kufungua PDF."
            );


            return null;

        } finally {

            setPdfLoading(false);

        }

    };


    // =========================================================
    // PREVIEW PDF
    // =========================================================

    const previewPdf = async (
        paper
    ) => {

        if (!paper) {
            return;
        }


        setSelectedPaper(
            paper
        );

        setPdfUrl("");
        setPdfError("");
        setPdfLoading(true);


        await createPdfUrl(
            paper
        );

    };


    // =========================================================
    // OPEN PDF
    // =========================================================

    const openPdf = async (
        paper
    ) => {

        if (!paper) {
            return;
        }


        const newWindow =
            window.open(
                "",
                "_blank"
            );


        if (!newWindow) {

            alert(
                "Browser imezuia popup. Tafadhali ruhusu popup."
            );

            return;

        }


        try {

            newWindow.document.write(`
                <!DOCTYPE html>

                <html>

                    <head>

                        <title>
                            Examination PDF
                        </title>

                    </head>

                    <body
                        style="
                            margin:0;
                            background:#111827;
                            color:white;
                            font-family:Arial,sans-serif;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            height:100vh;
                        "
                    >

                        <div
                            style="
                                text-align:center;
                            "
                        >

                            <div
                                style="
                                    font-size:50px;
                                    margin-bottom:20px;
                                "
                            >
                                ðŸ“„
                            </div>

                            <div
                                style="
                                    font-size:18px;
                                    font-weight:bold;
                                "
                            >
                                Loading Examination PDF...
                            </div>

                        </div>

                    </body>

                </html>
            `);

            newWindow.document.close();


            const url =
                await createPdfUrl(
                    paper
                );


            if (!url) {

                newWindow.close();

                return;

            }


            newWindow.location.href =
                `${url}${url.includes("#") ? "&" : "#"}toolbar=1&navpanes=0&scrollbar=1`;


        } catch (err) {

            console.error(
                "OPEN PDF ERROR:",
                err
            );


            try {
                newWindow.close();
            } catch {
                // ignore
            }

        }

    };


    // =========================================================
    // RETRY PDF
    // =========================================================

    const retryPdf = async () => {

        if (!selectedPaper) {

            setPdfError(
                "Hakuna examination paper iliyochaguliwa."
            );

            return;

        }


        try {

            setPdfLoading(true);
            setPdfUrl("");
            setPdfError("");


            console.log(
                "RETRYING PDF:",
                selectedPaper
            );


            const {
                data,
                error: paperError
            } =
                await supabase
                    .from("exam_papers")
                    .select(`
                        id,
                        exam_id,
                        exam_subject_id,
                        file_name,
                        file_url,
                        file_hash,
                        file_type,
                        ai_status,
                        uploaded_by,
                        created_at
                    `)
                    .eq(
                        "id",
                        selectedPaper.id
                    )
                    .maybeSingle();


            if (paperError) {
                throw paperError;
            }


            const latestPaper =
                data ||
                selectedPaper;


            setSelectedPaper(
                latestPaper
            );


            const url =
                await createPdfUrl(
                    latestPaper
                );


            if (!url) {

                throw new Error(
                    "Retry imeshindwa kupata PDF."
                );

            }


            setPdfUrl(
                url
            );

            setPdfError("");


        } catch (err) {

            console.error(
                "RETRY PDF ERROR:",
                err
            );


            setPdfError(
                err?.message ||
                "Retry imeshindwa kupata PDF."
            );


        } finally {

            setPdfLoading(false);

        }

    };


    // =========================================================
    // CLOSE PDF
    // =========================================================

    const closePdf = () => {

        if (
            pdfUrl &&
            pdfUrl.startsWith("blob:")
        ) {

            try {

                URL.revokeObjectURL(
                    pdfUrl
                );

            } catch {
                // ignore
            }

        }


        setSelectedPaper(null);
        setPdfUrl("");
        setPdfError("");
        setPdfLoading(false);

    };


    // =========================================================
    // DELETE PAPER
    // =========================================================

    const deletePaper = async (
        paper
    ) => {

        if (!paper?.id) {
            return;
        }


        const confirmed =
            window.confirm(
                `Una uhakika unataka kufuta PDF "${paper.file_name || "Examination Paper"}"?`
            );


        if (!confirmed) {
            return;
        }


        try {

            setDeletingPaperId(
                paper.id
            );


            const response =
                await axios.delete(
                    `${API_URL}/exams/papers/${paper.id}`
                );


            if (
                response.data?.success ===
                false
            ) {

                throw new Error(
                    response.data?.message ||
                    "PDF haikufutwa."
                );

            }


            if (
                selectedPaper?.id ===
                paper.id
            ) {

                closePdf();

            }


            await loadExamPapers(
                selectedExamSubjectId
            );

            await loadAIAnalysis(
                selectedExamSubjectId
            );


            alert(
                "PDF imefutwa kwa mafanikio."
            );


        } catch (err) {

            console.error(
                "DELETE PAPER ERROR:",
                err
            );


            alert(
                err?.response?.data?.message ||
                err?.message ||
                "Imeshindikana kufuta PDF."
            );


        } finally {

            setDeletingPaperId(
                null
            );

        }

    };


    // =========================================================
    // POST-ACTION NOTIFICATION
    // =========================================================

    const toggleNotificationChannel = channel => {
        setNotificationChannels(previous =>
            previous.includes(channel)
                ? previous.filter(item => item !== channel)
                : [...previous, channel]
        );
    };

    const openNotificationPanel = (type, reason = "") => {
        setNotificationType(type);
        setNotificationReason(reason || "");
        setNotificationResult(null);
        setNotificationChannels(["sms"]);
        setShowNotificationPanel(true);
    };

    const closeNotificationPanel = () => {
        if (notificationSending) return;
        setShowNotificationPanel(false);
        setNotificationResult(null);
        setNotificationType("");
        setNotificationReason("");
        setNotificationChannels(["sms"]);
    };

    const sendExamSubjectNotification = async () => {
        if (!selectedExamSubjectId) {
            setNotificationResult({ success: false, message: "Examination subject haijachaguliwa." });
            return;
        }
        if (!notificationChannels.length) {
            setNotificationResult({ success: false, message: "Chagua angalau channel moja." });
            return;
        }
        try {
            setNotificationSending(true);
            setNotificationResult(null);
            const { data, error: invokeError } = await supabase.functions.invoke(
                "send-exam-subject-notification",
                {
                    body: {
                        type: notificationType,
                        exam_subject_id: selectedExamSubjectId,
                        channels: notificationChannels,
                        reason: notificationReason || undefined
                    }
                }
            );

            if (invokeError) {
                let serverMessage = "";

                try {
                    if (invokeError?.context?.json) {
                        const responseBody = await invokeError.context.json();
                        serverMessage =
                            responseBody?.message ||
                            responseBody?.error ||
                            responseBody?.details ||
                            "";
                    }
                } catch (responseReadError) {
                    console.warn(
                        "NOTIFICATION ERROR RESPONSE READ FAILED:",
                        responseReadError
                    );
                }

                const statusText =
                    invokeError?.context?.status
                        ? `HTTP ${invokeError.context.status}`
                        : "";

                throw new Error(
                    serverMessage ||
                    (statusText
                        ? `${statusText}: ${invokeError.message || "Edge Function imekataa request."}`
                        : invokeError.message || "Edge Function imeshindwa kutuma notification.")
                );
            }

            if (data?.success === false) {
                const failedChannels = Array.isArray(data?.results)
                    ? data.results
                        .filter(item => item?.status === "failed")
                        .map(item => `${item.channel || "channel"}: ${item.error || "failed"}`)
                        .join("; ")
                    : "";

                throw new Error(
                    data?.message ||
                    failedChannels ||
                    "Notification imeshindikana kutumwa."
                );
            }

            const resultMessage =
                data?.message ||
                (Array.isArray(data?.results)
                    ? data.results
                        .map(item => `${item.channel || "channel"}: ${item.status || "unknown"}`)
                        .join(" | ")
                    : "Notification request imekamilika.");

            setNotificationResult({
                success: true,
                message: resultMessage,
                data
            });
        } catch (err) {
            console.error("EXAM SUBJECT NOTIFICATION ERROR:", err);
            setNotificationResult({
                success: false,
                message:
                    err?.message ||
                    "Notification imeshindikana kutumwa."
            });
        } finally {
            setNotificationSending(false);
        }
    };


    // =========================================================
    // SUBJECT-LEVEL APPROVAL STATUS
    // =========================================================

    const hasApprovalUser = value => {
        if (value === true) return true;
        if (value === false || value === null || value === undefined) return false;

        const normalized = String(value).trim().toLowerCase();
        return (
            normalized !== "" &&
            normalized !== "false" &&
            normalized !== "null" &&
            normalized !== "undefined"
        );
    };

    const academicApproved = hasApprovalUser(
        approvalStatus?.approved_by_academic
    );

    const deputyApproved = hasApprovalUser(
        approvalStatus?.approved_by_deputy
    );

    const headmasterApproved = hasApprovalUser(
        approvalStatus?.approved_by_headmaster
    );

    const approvalCurrentStatus = String(
        approvalStatus?.approval_status || "Pending"
    ).trim();

    const isRejected =
        approvalCurrentStatus.toLowerCase() === "rejected";

    const isApproved =
        approvalCurrentStatus.toLowerCase() === "approved" &&
        academicApproved &&
        deputyApproved &&
        headmasterApproved;

    const hasPaper = papers.length > 0;
    const hasAnalysis = Boolean(analysis);

    const canAcademicApprove =
        hasPaper &&
        hasAnalysis &&
        !academicApproved &&
        !isRejected &&
        !isApproved;

    const canDeputyApprove =
        hasPaper &&
        hasAnalysis &&
        academicApproved &&
        !deputyApproved &&
        !isRejected &&
        !isApproved;

    const canHeadmasterApprove =
        hasPaper &&
        hasAnalysis &&
        academicApproved &&
        deputyApproved &&
        !headmasterApproved &&
        !isRejected &&
        !isApproved;

    // =========================================================
    // APPROVE SUBJECT
    // =========================================================

    const approveExam = async (
        type
    ) => {

        try {

            if (!selectedExamSubjectId) {
                alert("Chagua examination subject kwanza.");
                return;
            }

            if (!hasPaper) {
                alert("Huwezi ku-approve bila examination PDF.");
                return;
            }

            if (!hasAnalysis) {
                alert("AI Analysis lazima iwepo kabla ya approval.");
                return;
            }

            if (type === "deputy" && !academicApproved) {
                alert("Academic Approval lazima ifanyike kwanza.");
                return;
            }

            if (type === "headmaster" && !academicApproved) {
                alert("Academic Approval lazima ifanyike kwanza.");
                return;
            }

            if (type === "headmaster" && !deputyApproved) {
                alert("Deputy Headmaster Approval lazima ifanyike kwanza.");
                return;
            }

            const {
                data: userData,
                error: userError
            } = await supabase.auth.getUser();

            if (userError) throw userError;

            const user = userData?.user;

            if (!user?.id) {
                throw new Error("Mtumiaji hajalogin.");
            }

            setActionLoading(true);

            let update = {};

            if (type === "academic") {
                update = {
                    approved_by_academic: user.id
                };
            } else if (type === "deputy") {
                update = {
                    approved_by_deputy: user.id
                };
            } else if (type === "headmaster") {
                update = {
                    approved_by_headmaster: user.id,
                    approved_at: new Date().toISOString(),
                    approval_status: "Approved"
                };
            } else {
                throw new Error("Approval type haijulikani.");
            }

            const {
                error: updateError
            } = await supabase
                .from("exam_subjects")
                .update(update)
                .eq("id", Number(selectedExamSubjectId))
                .eq("exam_id", Number(examId));

            if (updateError) throw updateError;

            await loadApprovalStatus(selectedExamSubjectId);

            if (type === "academic") {
                alert("Academic Approval imekamilika.");
            } else if (type === "deputy") {
                alert("Deputy Headmaster Approval imekamilika.");
            } else {
                alert("Headmaster Final Approval imekamilika.");
                openNotificationPanel("approved");
            }

        } catch (err) {
            console.error("APPROVE SUBJECT ERROR:", err);
            alert(err?.message || "Approval imeshindikana.");
        } finally {
            setActionLoading(false);
        }
    };


    // =========================================================
    // REJECT MODAL
    // =========================================================

    const openRejectModal = () => {

        setRejectionReason("");

        setShowRejectModal(true);

    };


    const closeRejectModal = () => {

        if (actionLoading) {
            return;
        }

        setShowRejectModal(false);
        setRejectionReason("");

    };


    // =========================================================
    // REJECT SUBJECT
    // =========================================================

    const rejectExam = async () => {

        const reason = rejectionReason.trim();

        if (!selectedExamSubjectId) {
            alert("Chagua examination subject kwanza.");
            return;
        }

        if (!reason) {
            alert("Sababu ya rejection ni lazima.");
            return;
        }

        const confirmed = window.confirm(
            "Una uhakika unataka kukataa examination subject hii?"
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);

            const {
                data: userData,
                error: userError
            } = await supabase.auth.getUser();

            if (userError) throw userError;

            const user = userData?.user;

            if (!user?.id) {
                throw new Error("Mtumiaji hajalogin.");
            }

            const {
                error: rejectError
            } = await supabase
                .from("exam_subjects")
                .update({
                    approval_status: "Rejected",
                    rejection_reason: reason,
                    rejected_by: user.id,
                    rejected_at: new Date().toISOString(),
                    approved_by_academic: null,
                    approved_by_deputy: null,
                    approved_by_headmaster: null,
                    approved_at: null
                })
                .eq("id", Number(selectedExamSubjectId))
                .eq("exam_id", Number(examId));

            if (rejectError) throw rejectError;

            await loadApprovalStatus(selectedExamSubjectId);

            setShowRejectModal(false);
            setRejectionReason("");

            alert(
                "Examination subject imekataliwa na sababu imehifadhiwa."
            );

            openNotificationPanel("rejected", reason);

        } catch (err) {
            console.error("REJECT SUBJECT ERROR:", err);
            alert(
                err?.message ||
                "Rejection imeshindikana."
            );
        } finally {
            setActionLoading(false);
        }
    };


    // =========================================================
    // LOADING
    // =========================================================

    if (loading) {

        return (

            <div className="min-h-screen bg-gray-50 p-6">

                <div className="max-w-7xl mx-auto">

                    <div className="bg-white rounded-2xl shadow-sm p-8">

                        <div className="animate-pulse space-y-4">

                            <div className="h-8 bg-gray-200 rounded w-1/3" />

                            <div className="h-4 bg-gray-200 rounded w-1/2" />

                            <div className="h-32 bg-gray-200 rounded" />

                        </div>

                    </div>

                </div>

            </div>

        );

    }


    // =========================================================
    // MAIN
    // =========================================================

    return (

        <div className="min-h-screen bg-gray-50 p-4 md:p-6">

            <div className="max-w-7xl mx-auto space-y-6">


                {/* HEADER */}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                        <div>

                            <div className="flex flex-wrap items-center gap-3">

                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                                    Examination Approval
                                </h1>


                                {exam?.status && (

                                    <span
                                        className={
                                            exam.status === "Approved"

                                                ? "px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold"

                                                : exam.status === "Rejected"

                                                    ? "px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold"

                                                    : "px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold"
                                        }
                                    >
                                        {exam.status}
                                    </span>

                                )}

                            </div>


                            <p className="text-gray-500 mt-2">

                                {exam?.exam_name ||
                                    exam?.name ||
                                    "Examination"}

                            </p>

                        </div>


                        <div className="bg-gray-50 rounded-xl px-5 py-3">

                            <p className="text-xs text-gray-500">
                                Current Role
                            </p>

                            <p className="font-bold text-gray-800">
                                {role || "Unknown"}
                            </p>

                        </div>

                    </div>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">

                        <p className="font-bold text-red-700">
                            Error
                        </p>

                        <p className="text-sm text-red-600 mt-1">
                            {error}
                        </p>

                    </div>

                )}


                {/* SUBJECT */}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Examination Subject
                    </label>


                    <select
                        value={
                            selectedExamSubjectId
                        }
                        onChange={e =>
                            setSelectedExamSubjectId(
                                e.target.value
                            )
                        }
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >

                        <option value="">
                            Select examination subject
                        </option>


                        {examSubjects.map(
                            examSubject => {

                                const subject =
                                    subjects.find(
                                        item =>
                                            String(item.id) ===
                                            String(
                                                examSubject.subject_id
                                            )
                                    );

                                const name =
                                    subject?.name ||
                                    subject?.subject_name ||
                                    subject?.title ||
                                    `Subject ${examSubject.subject_id}`;

                                return (

                                    <option
                                        key={
                                            examSubject.id
                                        }
                                        value={
                                            examSubject.id
                                        }
                                    >
                                        {name}
                                    </option>

                                );

                            }
                        )}

                    </select>


                    {selectedExamSubject && (

                        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4">

                            <p className="text-xs text-blue-600 font-bold">
                                SELECTED SUBJECT
                            </p>

                            <p className="text-lg font-bold text-blue-800">
                                {subjectName}
                            </p>

                        </div>

                    )}

                </div>


                {/* SUBJECT APPROVAL STATUS */}
                {selectedExamSubjectId && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold">Subject Approval Status</h2>
                                <p className="text-sm text-gray-500 mt-1">Approval ya subject hii, si status ya examination nzima.</p>
                            </div>
                            <span className={`px-4 py-2 rounded-xl font-bold ${isRejected ? "bg-red-100 text-red-700" : isApproved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                {approvalLoading ? "Checking..." : approvalCurrentStatus}
                            </span>
                        </div>
                    </div>
                )}


                {/* PAPERS */}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>

                            <h2 className="text-xl font-bold text-gray-900">
                                Examination Papers
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                PDF zote za subject hii zinaonekana hapa.
                                PDF haitafutwa mpaka ufanye Delete manually.
                            </p>

                        </div>


                        <div className="bg-gray-100 rounded-xl px-5 py-3">

                            <p className="text-xs text-gray-500">
                                Total Papers
                            </p>

                            <p className="text-2xl font-bold">
                                {papers.length}
                            </p>

                        </div>

                    </div>


                    {!selectedExamSubjectId ? (

                        <div className="mt-5 bg-yellow-50 border border-yellow-200 rounded-xl p-5">

                            <p className="font-semibold text-yellow-800">
                                Chagua examination subject kwanza.
                            </p>

                        </div>

                    ) : papersLoading ? (

                        <div className="mt-5 bg-gray-50 rounded-xl p-6">

                            <p className="text-gray-500">
                                Loading PDFs...
                            </p>

                        </div>

                    ) : papers.length === 0 ? (

                        <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-6">

                            <p className="font-bold text-red-700">
                                Hakuna PDF kwa subject hii.
                            </p>

                            <p className="text-sm text-red-600 mt-1">
                                Upload examination paper kwanza.
                            </p>

                        </div>

                    ) : (

                        <div className="mt-5 space-y-4">

                            {papers.map(
                                paper => (

                                    <div
                                        key={
                                            paper.id
                                        }
                                        className="border border-gray-200 rounded-2xl p-5"
                                    >

                                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">

                                            <div className="flex items-start gap-4 min-w-0">

                                                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-2xl shrink-0">
                                                    ðŸ“„
                                                </div>


                                                <div className="min-w-0">

                                                    <p className="font-bold text-gray-900 truncate">
                                                        {paper.file_name ||
                                                            "Examination Paper"}
                                                    </p>


                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {paper.created_at
                                                            ? new Date(
                                                                paper.created_at
                                                            ).toLocaleString()
                                                            : "-"}
                                                    </p>


                                                    <div className="flex flex-wrap gap-2 mt-3">

                                                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                                                            {paper.file_type ||
                                                                "PDF"}
                                                        </span>


                                                        <span
                                                            className={
                                                                String(
                                                                    paper.ai_status ||
                                                                    ""
                                                                ).toLowerCase() ===
                                                                "completed"

                                                                    ? "px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold"

                                                                    : String(
                                                                        paper.ai_status ||
                                                                        ""
                                                                    ).toLowerCase() ===
                                                                    "failed"

                                                                        ? "px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold"

                                                                        : "px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold"
                                                            }
                                                        >
                                                            AI:{" "}
                                                            {paper.ai_status ||
                                                                "Pending"}
                                                        </span>


                                                        {paper.pdf_url && (

                                                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                                                âœ“ PDF Ready
                                                            </span>

                                                        )}

                                                    </div>

                                                </div>

                                            </div>


                                            <div className="flex flex-wrap gap-2">

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        previewPdf(
                                                            paper
                                                        )
                                                    }
                                                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                                >
                                                    Preview PDF
                                                </button>


                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openPdf(
                                                            paper
                                                        )
                                                    }
                                                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white font-semibold"
                                                >
                                                    Open PDF
                                                </button>


                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        deletePaper(
                                                            paper
                                                        )
                                                    }
                                                    disabled={
                                                        deletingPaperId ===
                                                        paper.id
                                                    }
                                                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:bg-gray-300"
                                                >
                                                    {deletingPaperId ===
                                                    paper.id
                                                        ? "Deleting..."
                                                        : "Delete PDF"}
                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                )
                            )}

                        </div>

                    )}

                </div>


                {/* PDF VIEWER */}

                {selectedPaper && (

                    <div className="rounded-2xl overflow-hidden border border-gray-700 bg-gray-900 shadow-2xl">

                        <div className="bg-gray-950 px-5 py-4 border-b border-gray-700">

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                                <div className="flex items-center gap-3 min-w-0">

                                    <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center text-white text-xl shrink-0">
                                        ðŸ“„
                                    </div>


                                    <div className="min-w-0">

                                        <h2 className="text-lg font-bold text-white">
                                            Examination Paper
                                        </h2>

                                        <p className="text-sm text-gray-400 truncate">
                                            {selectedPaper.file_name ||
                                                "Examination Paper"}
                                        </p>

                                    </div>

                                </div>


                                <div className="flex flex-wrap gap-2">

                                    {pdfUrl && (

                                        <button
                                            type="button"
                                            onClick={() =>
                                                window.open(
                                                    `${pdfUrl}${pdfUrl.includes("#") ? "&" : "#"}toolbar=1&navpanes=0&scrollbar=1`,
                                                    "_blank",
                                                    "noopener,noreferrer"
                                                )
                                            }
                                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                                        >
                                            â†— Open New Tab
                                        </button>

                                    )}


                                    <button
                                        type="button"
                                        onClick={closePdf}
                                        className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold"
                                    >
                                        âœ• Close
                                    </button>

                                </div>

                            </div>

                        </div>


                        <div className="bg-gray-800 p-3 md:p-5">

                            {pdfLoading && (

                                <div className="h-[700px] flex items-center justify-center">

                                    <div className="text-center">

                                        <div className="text-5xl mb-5">
                                            ðŸ“„
                                        </div>

                                        <p className="text-white font-bold text-lg">
                                            Preparing PDF...
                                        </p>

                                        <p className="text-gray-400 text-sm mt-2">
                                            Connecting to examination document storage...
                                        </p>

                                    </div>

                                </div>

                            )}


                            {pdfError && (

                                <div className="min-h-[500px] flex items-center justify-center">

                                    <div className="max-w-xl w-full bg-red-950 border border-red-800 rounded-2xl p-7">

                                        <div className="text-4xl mb-4">
                                            âš ï¸
                                        </div>


                                        <h3 className="text-xl font-bold text-red-300">
                                            PDF haikufunguka
                                        </h3>


                                        <p className="text-sm text-red-200 mt-3">
                                            {pdfError}
                                        </p>


                                        <div className="flex flex-wrap gap-3 mt-6">

                                            <button
                                                type="button"
                                                onClick={retryPdf}
                                                disabled={pdfLoading}
                                                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:bg-gray-600"
                                            >
                                                {pdfLoading
                                                    ? "Retrying..."
                                                    : "Retry"}
                                            </button>


                                            <button
                                                type="button"
                                                onClick={retryPdf}
                                                disabled={pdfLoading}
                                                className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold disabled:bg-gray-600"
                                            >
                                                Try Storage Again
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            )}


                            {!pdfLoading &&
                                !pdfError &&
                                pdfUrl && (

                                    <div className="rounded-xl overflow-hidden border border-gray-600 bg-black shadow-2xl">

                                        <iframe
                                            src={`${pdfUrl}${pdfUrl.includes("#") ? "&" : "#"}toolbar=1&navpanes=0&scrollbar=1`}
                                            title="Examination PDF"
                                            className="w-full"
                                            style={{
                                                height:
                                                    "850px",
                                                border:
                                                    "none"
                                            }}
                                            allow="fullscreen"
                                        />

                                    </div>

                                )}

                        </div>


                        <div className="bg-gray-950 px-5 py-3 border-t border-gray-700">

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

                                <p className="text-xs text-gray-400">
                                    {subjectName}
                                </p>

                                <p className="text-xs text-gray-500">
                                    Examination PDF â€¢ Supabase Storage
                                </p>

                            </div>

                        </div>

                    </div>

                )}


                {/* AI ANALYSIS */}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>

                            <h2 className="text-xl font-bold">
                                AI Analysis
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                {subjectName}
                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                loadAIAnalysis()
                            }
                            disabled={
                                analysisLoading ||
                                !selectedExamSubjectId
                            }
                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:bg-gray-300"
                        >
                            {analysisLoading
                                ? "Loading..."
                                : "Refresh Analysis"}
                        </button>

                    </div>


                    {analysisLoading && (

                        <div className="mt-5 bg-gray-50 rounded-xl p-6">

                            <p className="text-gray-500">
                                Loading AI analysis...
                            </p>

                        </div>

                    )}


                    {!analysisLoading &&
                        !analysis && (

                            <div className="mt-5 bg-yellow-50 border border-yellow-200 rounded-xl p-6">

                                <p className="font-semibold text-yellow-800">
                                    AI Analysis haipo kwa subject hii.
                                </p>

                                <p className="text-sm text-yellow-700 mt-1">
                                    Hakikisha PDF ime-uploadiwa na AI
                                    analysis imekamilika.
                                </p>

                            </div>

                        )}


                    {!analysisLoading &&
                        analysis && (

                            <div className="mt-5 space-y-5">

                                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

                                    <div className="bg-gray-50 rounded-xl p-5">

                                        <p className="text-sm text-gray-500">
                                            Questions
                                        </p>

                                        <p className="text-3xl font-bold mt-1">
                                            {analysis.total_questions ??
                                                0}
                                        </p>

                                    </div>


                                    <div className="bg-gray-50 rounded-xl p-5">

                                        <p className="text-sm text-gray-500">
                                            Total Marks
                                        </p>

                                        <p className="text-3xl font-bold mt-1">
                                            {analysis.total_marks ??
                                                0}
                                        </p>

                                    </div>


                                    <div className="bg-gray-50 rounded-xl p-5">

                                        <p className="text-sm text-gray-500">
                                            Difficulty
                                        </p>

                                        <p className="text-xl font-bold mt-2">
                                            {analysis.difficulty ||
                                                "-"}
                                        </p>

                                    </div>


                                    <div className="bg-gray-50 rounded-xl p-5">

                                        <p className="text-sm text-gray-500">
                                            Quality
                                        </p>

                                        <p className="text-3xl font-bold mt-1">

                                            {analysis.quality_score ??
                                                0}
                                            /100

                                        </p>

                                    </div>

                                </div>


                                <div className="border rounded-xl p-5">

                                    <h3 className="font-bold">
                                        AI Summary
                                    </h3>

                                    <p className="text-gray-700 mt-3 whitespace-pre-line">
                                        {analysis.ai_summary ||
                                            "No AI summary available."}
                                    </p>

                                </div>


                                <div className="border rounded-xl p-5">

                                    <h3 className="font-bold">
                                        Recommendations
                                    </h3>

                                    <p className="text-gray-700 mt-3 whitespace-pre-line">
                                        {analysis.recommendations ||
                                            "No recommendations available."}
                                    </p>

                                </div>


                                <div className="border rounded-xl p-5">

                                    <h3 className="font-bold">
                                        Topics Found
                                    </h3>


                                    {Array.isArray(
                                        analysis.topics_found
                                    ) &&
                                    analysis.topics_found.length >
                                        0 ? (

                                        <div className="flex flex-wrap gap-2 mt-3">

                                            {analysis.topics_found.map(
                                                (
                                                    topic,
                                                    index
                                                ) => (

                                                    <span
                                                        key={
                                                            index
                                                        }
                                                        className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm"
                                                    >
                                                        {typeof topic ===
                                                        "string"
                                                            ? topic
                                                            : JSON.stringify(
                                                                topic
                                                            )}
                                                    </span>

                                                )
                                            )}

                                        </div>

                                    ) : (

                                        <p className="text-gray-500 mt-2">
                                            No topics found.
                                        </p>

                                    )}

                                </div>

                            </div>

                        )}

                </div>


                {/* APPROVAL CHAIN */}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>

                            <h2 className="text-xl font-bold">
                                Approval Chain
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                Academic â†’ Deputy â†’ Headmaster
                            </p>

                        </div>


                        {!isRejected &&
                            !isApproved && (

                                <button
                                    type="button"
                                    onClick={openRejectModal}
                                    disabled={actionLoading}
                                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:bg-gray-300"
                                >
                                    Reject Examination
                                </button>

                            )}

                    </div>


                    {isRejected && (

                        <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-5">

                            <p className="font-bold text-red-700">
                                Examination Rejected
                            </p>

                            <p className="text-sm text-red-600 mt-2">
                                {approvalStatus?.rejection_reason ||
                                    "No rejection reason recorded."}
                            </p>

                        </div>

                    )}


                    {isApproved && (

                        <div className="mt-5 bg-green-50 border border-green-200 rounded-xl p-5">

                            <p className="font-bold text-green-700">
                                Examination Fully Approved
                            </p>

                            <p className="text-sm text-green-600 mt-1">
                                Headmaster final approval imekamilika.
                            </p>

                        </div>

                    )}


                    {/* ACADEMIC */}

                    <div className="mt-6 border-b pb-6">

                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                            <div className="flex items-start gap-4">

                                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                    1
                                </div>

                                <div>

                                    <p className="font-bold">
                                        Academic Approval
                                    </p>

                                    <p className="text-sm text-gray-500 mt-1">
                                        Review examination paper and AI analysis.
                                    </p>

                                </div>

                            </div>


                            {academicApproved ? (

                                <span className="px-4 py-2 rounded-xl bg-green-100 text-green-700 font-bold">
                                    âœ“ Approved
                                </span>

                            ) : (

                                <button
                                    type="button"
                                    onClick={() =>
                                        approveExam(
                                            "academic"
                                        )
                                    }
                                    disabled={
                                        actionLoading ||
                                        !canAcademicApprove
                                    }
                                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:bg-gray-300"
                                >
                                    {actionLoading
                                        ? "Processing..."
                                        : "Approve"}
                                </button>

                            )}

                        </div>

                    </div>


                    {/* DEPUTY */}

                    <div className="border-b py-6">

                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                            <div className="flex items-start gap-4">

                                <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                                    2
                                </div>

                                <div>

                                    <p className="font-bold">
                                        Deputy Headmaster Approval
                                    </p>

                                    <p className="text-sm text-gray-500 mt-1">
                                        Inapatikana baada ya Academic Approval.
                                    </p>

                                </div>

                            </div>


                            {deputyApproved ? (

                                <span className="px-4 py-2 rounded-xl bg-green-100 text-green-700 font-bold">
                                    âœ“ Approved
                                </span>

                            ) : (

                                <button
                                    type="button"
                                    onClick={() =>
                                        approveExam(
                                            "deputy"
                                        )
                                    }
                                    disabled={
                                        actionLoading ||
                                        !canDeputyApprove
                                    }
                                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold disabled:bg-gray-300"
                                >
                                    {actionLoading
                                        ? "Processing..."
                                        : "Approve"}
                                </button>

                            )}

                        </div>

                    </div>


                    {/* HEADMASTER */}

                    <div className="pt-6">

                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                            <div className="flex items-start gap-4">

                                <div className="w-11 h-11 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                                    3
                                </div>

                                <div>

                                    <p className="font-bold">
                                        Headmaster Final Approval
                                    </p>

                                    <p className="text-sm text-gray-500 mt-1">
                                        Inapatikana baada ya Academic na Deputy approval.
                                    </p>

                                </div>

                            </div>


                            {headmasterApproved ? (

                                <span className="px-4 py-2 rounded-xl bg-green-100 text-green-700 font-bold">
                                    âœ“ Final Approved
                                </span>

                            ) : (

                                <button
                                    type="button"
                                    onClick={() =>
                                        approveExam(
                                            "headmaster"
                                        )
                                    }
                                    disabled={
                                        actionLoading ||
                                        !canHeadmasterApprove
                                    }
                                    className="px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold disabled:bg-gray-300"
                                >
                                    {actionLoading
                                        ? "Processing..."
                                        : "Final Approve"}
                                </button>

                            )}

                        </div>

                    </div>

                </div>


                {/* POST-ACTION NOTIFICATION PANEL */}
                {showNotificationPanel && (
                    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {notificationType === "rejected" ? "Notify Teacher About Rejection" : "Notify Teacher About Final Approval"}
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {exam?.exam_name || exam?.name || "Examination"}
                                        </p>
                                    </div>
                                    <button type="button" onClick={closeNotificationPanel} disabled={notificationSending} className="text-3xl text-gray-500 disabled:opacity-50">Ã—</button>
                                </div>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className={notificationType === "rejected" ? "bg-red-50 border border-red-200 rounded-xl p-4" : "bg-green-50 border border-green-200 rounded-xl p-4"}>
                                    <p className={notificationType === "rejected" ? "font-bold text-red-700" : "font-bold text-green-700"}>
                                        {notificationType === "rejected" ? "Rejection imehifadhiwa." : "Headmaster Final Approval imekamilika."}
                                    </p>
                                    {notificationType === "rejected" && notificationReason && (
                                        <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">Reason: {notificationReason}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-700 mb-3">Notification Channels</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[["sms","ðŸ“±","SMS"],["whatsapp","ðŸ’¬","WhatsApp"],["email","âœ‰ï¸","Email"]].map(([value, icon, label]) => (
                                            <button key={value} type="button" onClick={() => toggleNotificationChannel(value)} disabled={notificationSending} className={notificationChannels.includes(value) ? "border-2 border-blue-600 bg-blue-50 text-blue-700 rounded-xl p-4 font-bold" : "border-2 border-gray-200 bg-white text-gray-700 rounded-xl p-4 font-semibold"}>
                                                <div className="text-2xl">{icon}</div>
                                                <div className="mt-1 text-sm">{label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {notificationResult && (
                                    <div className={notificationResult.success ? "bg-green-50 border border-green-200 rounded-xl p-4" : "bg-red-50 border border-red-200 rounded-xl p-4"}>
                                        <p className="font-semibold">{notificationResult.message}</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t flex justify-end gap-3">
                                <button type="button" onClick={closeNotificationPanel} disabled={notificationSending} className="px-5 py-2.5 rounded-xl bg-gray-200 font-semibold">Skip</button>
                                <button type="button" onClick={sendExamSubjectNotification} disabled={notificationSending || !notificationChannels.length} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold disabled:bg-gray-300">{notificationSending ? "Sending..." : "Send Notification"}</button>
                            </div>
                        </div>
                    </div>
                )}


                {/* REJECT MODAL */}

                {showRejectModal && (

                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">

                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl">

                            <div className="p-6 border-b">

                                <div className="flex items-center justify-between">

                                    <div>

                                        <h2 className="text-xl font-bold text-red-700">
                                            Reject Examination
                                        </h2>

                                        <p className="text-sm text-gray-500 mt-1">
                                            Sababu ya rejection ni lazima.
                                        </p>

                                    </div>


                                    <button
                                        type="button"
                                        onClick={closeRejectModal}
                                        className="text-3xl text-gray-500"
                                    >
                                        Ã—
                                    </button>

                                </div>

                            </div>


                            <div className="p-6">

                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5">

                                    <p className="text-sm text-yellow-800">
                                        PDF haitafutwa. Rejection itaweka
                                        examination subject kuwa Rejected na kuhifadhi
                                        sababu.
                                    </p>

                                </div>


                                <label className="block text-sm font-bold text-gray-700 mb-2">

                                    Reason for Rejection

                                    <span className="text-red-600">
                                        {" "}*
                                    </span>

                                </label>


                                <textarea
                                    value={
                                        rejectionReason
                                    }
                                    onChange={e =>
                                        setRejectionReason(
                                            e.target.value
                                        )
                                    }
                                    rows={6}
                                    disabled={
                                        actionLoading
                                    }
                                    placeholder="Andika sababu ya kukataa examination..."
                                    className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                                />


                                <p className="text-xs text-gray-500 mt-2">
                                    {rejectionReason.length} characters
                                </p>

                            </div>


                            <div className="p-6 border-t flex justify-end gap-3">

                                <button
                                    type="button"
                                    onClick={closeRejectModal}
                                    disabled={actionLoading}
                                    className="px-5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
                                >
                                    Cancel
                                </button>


                                <button
                                    type="button"
                                    onClick={rejectExam}
                                    disabled={
                                        actionLoading ||
                                        !rejectionReason.trim()
                                    }
                                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:bg-gray-300"
                                >
                                    {actionLoading
                                        ? "Rejecting..."
                                        : "Confirm Rejection"}
                                </button>

                            </div>

                        </div>

                    </div>

                )}

            </div>

        </div>

    );

};


export default ExamApproval;
