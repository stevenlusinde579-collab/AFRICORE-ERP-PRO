import { useEffect, useRef, useState } from "react";
import {
    useNavigate,
    useParams
} from "react-router-dom";
import axios from "axios";
import { supabase } from "../../services/supabase";

import {
    FaArrowLeft,
    FaCloudUploadAlt,
    FaFilePdf,
    FaTimes,
    FaCheckCircle,
    FaSpinner
} from "react-icons/fa";


const API_URL =
    "https://africore-erp-pro.onrender.com/api";


function ExamUpload() {

    const navigate =
        useNavigate();

    const { examId } =
        useParams();

    const fileInputRef =
        useRef(null);

    const [examSubjects, setExamSubjects] =
        useState([]);

    const [selectedExamSubjectId, setSelectedExamSubjectId] =
        useState("");

    const [selectedFile, setSelectedFile] =
        useState(null);

    const [loadingSubjects, setLoadingSubjects] =
        useState(true);

    const [processing, setProcessing] =
        useState(false);

    const [error, setError] =
        useState("");

    const MAX_FILE_SIZE =
        20 * 1024 * 1024;


    // =====================================================
    // LOAD EXAM SUBJECTS
    // =====================================================

    useEffect(() => {

        if (!examId) {

            setError(
                "Exam ID haipo kwenye URL."
            );

            setLoadingSubjects(false);

            return;
        }

        loadExamSubjects();

    }, [examId]);


    const loadExamSubjects = async () => {

        try {

            setLoadingSubjects(true);
            setError("");

            const response =
                await axios.get(
                    `${API_URL}/exams/${examId}/subjects`
                );

            if (!response.data?.success) {

                throw new Error(
                    response.data?.message ||
                    "Failed to load examination subjects."
                );
            }

            const subjects =
                Array.isArray(
                    response.data.subjects
                )
                    ? response.data.subjects
                    : [];

            setExamSubjects(
                subjects
            );

        } catch (err) {

            console.error(
                "LOAD EXAM SUBJECTS ERROR:",
                err
            );

            setExamSubjects([]);

            setError(
                err.response?.data?.message ||
                err.message ||
                "Failed to load examination subjects."
            );

        } finally {

            setLoadingSubjects(false);

        }

    };


    // =====================================================
    // SUBJECT NAME
    // =====================================================

    const getSubjectName = item => {

        return (
            item?.subject?.subject_name ||
            item?.subject_name ||
            `Subject ${item?.subject_id || ""}`
        );

    };


    // =====================================================
    // CLASS NAME
    // =====================================================

    const getClassName = item => {

        return (
            item?.class?.class_name ||
            item?.class?.short_name ||
            item?.class_name ||
            item?.short_name ||
            `Class ${item?.class_id || ""}`
        );

    };


    // =====================================================
    // FILE VALIDATION
    // =====================================================

    const validateFile = file => {

        if (!file) {

            return {
                valid: false,
                message:
                    "Chagua PDF ya examination kwanza."
            };
        }

        if (
            file.type !==
            "application/pdf"
        ) {

            return {
                valid: false,
                message:
                    "Tafadhali chagua PDF file pekee."
            };
        }

        if (
            file.size >
            MAX_FILE_SIZE
        ) {

            return {
                valid: false,
                message:
                    "PDF imezidi ukubwa unaoruhusiwa wa 20MB."
            };
        }

        return {
            valid: true,
            message: ""
        };

    };


    // =====================================================
    // FILE CHANGE
    // =====================================================

    const handleFileChange = event => {

        const file =
            event.target.files?.[0];

        setError("");
        setSelectedFile(null);

        const validation =
            validateFile(file);

        if (!validation.valid) {

            setError(
                validation.message
            );

            return;
        }

        setSelectedFile(file);

    };


    // =====================================================
    // DROP
    // =====================================================

    const handleDrop = event => {

        event.preventDefault();

        if (processing) {
            return;
        }

        const file =
            event.dataTransfer.files?.[0];

        setError("");
        setSelectedFile(null);

        const validation =
            validateFile(file);

        if (!validation.valid) {

            setError(
                validation.message
            );

            return;
        }

        setSelectedFile(file);

    };


    const handleDragOver = event => {

        event.preventDefault();

    };


    // =====================================================
    // FILE PICKER
    // =====================================================

    const openFilePicker = () => {

        if (processing) {
            return;
        }

        fileInputRef.current?.click();

    };


    // =====================================================
    // REMOVE FILE
    // =====================================================

    const removeFile = () => {

        if (processing) {
            return;
        }

        setSelectedFile(null);
        setError("");

        if (fileInputRef.current) {

            fileInputRef.current.value =
                "";

        }

    };


    // =====================================================
    // FORMAT FILE SIZE
    // =====================================================

    const formatFileSize = bytes => {

        if (bytes < 1024) {

            return `${bytes} B`;

        }

        if (
            bytes <
            1024 * 1024
        ) {

            return `${(
                bytes / 1024
            ).toFixed(1)} KB`;

        }

        return `${(
            bytes /
            (1024 * 1024)
        ).toFixed(2)} MB`;

    };


    // =====================================================
    // UPLOAD PDF TO SUPABASE STORAGE
    // =====================================================

    const uploadPdfToStorage = async (file) => {

        if (!file) {
            throw new Error("PDF file haipo.");
        }

        if (!examId) {
            throw new Error("Exam ID haipo.");
        }

        if (!selectedExamSubjectId) {
            throw new Error("Exam Subject ID haipo.");
        }

        // Create the FINAL storage path here.
        // This exact path is passed to AI Analysis so Approval does not
        // need to guess where the PDF was stored.
        const originalName = String(
            file.name || "exam-paper.pdf"
        ).trim();

        const safeName = originalName
            .replace(/[^a-zA-Z0-9._-]+/g, "-")
            .replace(/-+/g, "-");

        const baseName = safeName
            .replace(/\.pdf$/i, "") || "exam-paper";

        const uniquePart =
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        const storagePath =
            `${examId}/${selectedExamSubjectId}/${uniquePart}-${baseName}.pdf`;

        console.log(
            "UPLOADING EXAM PDF TO SUPABASE STORAGE:",
            {
                bucket: "exam-papers",
                storagePath,
                fileName: originalName,
                fileSize: file.size,
                fileType: file.type
            }
        );

        const {
            data,
            error
        } = await supabase
            .storage
            .from("exam-papers")
            .upload(
                storagePath,
                file,
                {
                    cacheControl: "3600",
                    contentType: "application/pdf",
                    upsert: false
                }
            );

        if (error) {
            console.error(
                "SUPABASE STORAGE UPLOAD ERROR:",
                {
                    storagePath,
                    error
                }
            );

            throw new Error(
                error.message ||
                "PDF imeshindwa kupakiwa kwenye exam-papers Storage."
            );
        }

        const actualPath =
            data?.path || storagePath;

        if (!actualPath) {
            throw new Error(
                "Storage upload imefanikiwa lakini actual storage path haikurudi."
            );
        }

        console.log(
            "EXAM PDF UPLOAD SUCCESS:",
            {
                bucket: "exam-papers",
                storagePath: actualPath
            }
        );

        // Verify that the object is actually visible in Storage.
        const lastSlash = actualPath.lastIndexOf("/");
        const folder =
            lastSlash >= 0
                ? actualPath.slice(0, lastSlash)
                : "";

        const uploadedFileName =
            lastSlash >= 0
                ? actualPath.slice(lastSlash + 1)
                : actualPath;

        const {
            data: storageObjects,
            error: verifyError
        } = await supabase
            .storage
            .from("exam-papers")
            .list(
                folder,
                {
                    limit: 1000,
                    search: uploadedFileName
                }
            );

        if (verifyError) {
            console.warn(
                "STORAGE VERIFICATION WARNING:",
                {
                    actualPath,
                    verifyError
                }
            );
        } else {
            const found =
                Array.isArray(storageObjects) &&
                storageObjects.some(
                    object =>
                        String(object?.name || "").trim() ===
                        uploadedFileName
                );

            if (!found) {
                throw new Error(
                    `PDF upload haijathibitishwa kwenye exam-papers Storage: ${actualPath}`
                );
            }
        }

        return actualPath;
    };


    // =====================================================
    // CONTINUE
    // =====================================================

    const handleContinue = async () => {

        setError("");

        if (!examId) {

            setError(
                "Exam ID haipo kwenye URL."
            );

            return;
        }

        if (!selectedExamSubjectId) {

            setError(
                "Chagua Subject + Class ya examination kwanza."
            );

            return;
        }

        if (!selectedFile) {

            setError(
                "Chagua PDF ya examination kwanza."
            );

            return;
        }

        try {

            setProcessing(true);

            // FIRST: physically upload the PDF to Storage.
            const storagePath =
                await uploadPdfToStorage(
                    selectedFile
                );

            // SECOND: send THE SAME PDF to the AI analysis service.
            // The exact Storage path is also sent so the AI/backend can
            // associate the analysis with the physical Storage object.
            const formData = new FormData();

            formData.append(
                "paper",
                selectedFile,
                selectedFile.name
            );

            formData.append(
                "exam_id",
                String(examId)
            );

            formData.append(
                "exam_subject_id",
                String(selectedExamSubjectId)
            );

            formData.append(
                "storage_bucket",
                "exam-papers"
            );

            formData.append(
                "storage_path",
                storagePath
            );

            console.log(
                "SENDING SAME PDF TO AI ANALYSIS:",
                {
                    examId,
                    examSubjectId: selectedExamSubjectId,
                    storageBucket: "exam-papers",
                    storagePath,
                    fileName: selectedFile.name,
                    fileSize: selectedFile.size
                }
            );

            const aiResponse =
                await axios.post(
                    `${API_URL}/ai/analyze-paper`,
                    formData,
                    {
                        headers: {
                            "Content-Type":
                                "multipart/form-data"
                        },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                    }
                );

            if (!aiResponse.data?.success) {
                throw new Error(
                    aiResponse.data?.message ||
                    "PDF imehifadhiwa Storage lakini AI Analysis imeshindwa kuichambua."
                );
            }

            console.log(
                "AI ANALYSIS UPLOAD SUCCESS:",
                aiResponse.data
            );

            // THIRD: open AI Analysis dashboard with the exact Storage
            // location and the AI response already available in state.
            navigate(
                `/examination/${examId}/ai-analysis`,
                {
                    state: {
                        selectedFile,
                        examSubjectId:
                            selectedExamSubjectId,
                        storageBucket:
                            "exam-papers",
                        storagePath,
                        fileName:
                            selectedFile.name,
                        fileType:
                            "application/pdf",
                        aiAnalysisResponse:
                            aiResponse.data
                    }
                }
            );

        } catch (err) {

            console.error(
                "EXAM PDF UPLOAD / CONTINUE ERROR:",
                err
            );

            setProcessing(false);

            setError(
                err?.message ||
                "Imeshindikana kupakia PDF kwenye Storage."
            );

        }

    };


    // =====================================================
    // LOADING
    // =====================================================

    if (loadingSubjects) {

        return (

            <div className="min-h-screen bg-slate-50 flex items-center justify-center">

                <div className="flex items-center gap-3 text-blue-600">

                    <FaSpinner
                        className="animate-spin"
                    />

                    Loading examination subjects...

                </div>

            </div>

        );

    }


    // =====================================================
    // PAGE
    // =====================================================

    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            {/* HEADER */}

            <div className="mb-6 flex items-center gap-4">

                <button
                    type="button"
                    onClick={() =>
                        navigate(
                            `/examination/${examId}`
                        )
                    }
                    disabled={processing}
                    className="flex h-10 w-10 items-center justify-center rounded-xl
                    bg-white text-slate-600 shadow-sm ring-1 ring-slate-200
                    transition hover:bg-slate-50 disabled:opacity-50"
                >

                    <FaArrowLeft />

                </button>


                <div>

                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">

                        Examination Management

                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-slate-900">

                        Upload Examination Paper

                    </h1>

                    <p className="mt-1 text-sm text-slate-500">

                        Select the examination subject and upload
                        the official paper.

                    </p>

                </div>

            </div>


            {/* MAIN */}

            <div className="mx-auto max-w-4xl">

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1
                ring-slate-200 md:p-8">


                    {/* SUBJECT + CLASS */}

                    <div className="mb-7">

                        <label className="block text-sm font-semibold text-slate-700 mb-2">

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
                            disabled={processing}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        >

                            <option value="">

                                Select Subject + Class

                            </option>

                            {examSubjects.map(
                                item => (

                                    <option
                                        key={
                                            item.id
                                        }
                                        value={
                                            item.id
                                        }
                                    >

                                        {
                                            getSubjectName(
                                                item
                                            )
                                        }

                                        {" â€” "}

                                        {
                                            getClassName(
                                                item
                                            )
                                        }

                                    </option>

                                )
                            )}

                        </select>


                        {examSubjects.length === 0 && (

                            <p className="mt-2 text-sm text-red-600">

                                Hakuna Examination Subject
                                iliyoongezwa kwenye examination hii.
                                Add Subject + Class kwanza.

                            </p>

                        )}

                    </div>


                    {/* SELECTED INFO */}

                    {selectedExamSubjectId && (

                        <div className="mb-7 grid grid-cols-1 md:grid-cols-2 gap-4">

                            {(() => {

                                const selected =
                                    examSubjects.find(
                                        item =>
                                            String(
                                                item.id
                                            ) ===
                                            String(
                                                selectedExamSubjectId
                                            )
                                    );

                                if (!selected) {
                                    return null;
                                }

                                return (
                                    <>

                                        <div className="rounded-xl bg-blue-50 p-4">

                                            <p className="text-xs font-semibold text-blue-600">

                                                SUBJECT

                                            </p>

                                            <p className="mt-1 font-bold text-slate-900">

                                                {
                                                    getSubjectName(
                                                        selected
                                                    )
                                                }

                                            </p>

                                        </div>


                                        <div className="rounded-xl bg-purple-50 p-4">

                                            <p className="text-xs font-semibold text-purple-600">

                                                CLASS

                                            </p>

                                            <p className="mt-1 font-bold text-slate-900">

                                                {
                                                    getClassName(
                                                        selected
                                                    )
                                                }

                                            </p>

                                        </div>

                                    </>
                                );

                            })()}

                        </div>

                    )}


                    {/* FILE INPUT */}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={
                            handleFileChange
                        }
                        className="hidden"
                    />


                    {/* DROP ZONE */}

                    {!selectedFile && (

                        <button
                            type="button"
                            onClick={
                                openFilePicker
                            }
                            onDrop={
                                handleDrop
                            }
                            onDragOver={
                                handleDragOver
                            }
                            disabled={
                                processing ||
                                !selectedExamSubjectId
                            }
                            className="flex min-h-[300px] w-full flex-col items-center
                            justify-center rounded-2xl border-2 border-dashed
                            border-slate-300 bg-slate-50 px-6 text-center
                            transition hover:border-blue-400 hover:bg-blue-50
                            disabled:cursor-not-allowed disabled:opacity-50"
                        >

                            <div className="rounded-2xl bg-blue-100 p-5 text-blue-600">

                                <FaCloudUploadAlt
                                    size={42}
                                />

                            </div>

                            <h3 className="mt-5 text-lg font-bold text-slate-800">

                                Upload Examination Paper

                            </h3>

                            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">

                                Drag and drop your examination PDF here,
                                or click to browse files.

                            </p>

                            <span className="mt-5 rounded-xl bg-blue-600 px-5 py-3
                            text-sm font-semibold text-white">

                                Choose PDF File

                            </span>

                            <p className="mt-4 text-xs text-slate-400">

                                PDF only â€¢ Maximum size: 20MB

                            </p>

                        </button>

                    )}


                    {/* SELECTED FILE */}

                    {selectedFile && (

                        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">

                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                                <div className="flex items-center gap-4">

                                    <div className="rounded-xl bg-red-100 p-4 text-red-600">

                                        <FaFilePdf
                                            size={28}
                                        />

                                    </div>

                                    <div className="min-w-0">

                                        <p className="font-bold text-slate-800 break-all">

                                            {
                                                selectedFile.name
                                            }

                                        </p>

                                        <p className="mt-1 text-sm text-slate-500">

                                            {
                                                formatFileSize(
                                                    selectedFile.size
                                                )
                                            }

                                        </p>

                                    </div>

                                </div>

                                <div className="flex items-center gap-2">

                                    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-green-700">

                                        <FaCheckCircle />

                                        PDF Selected

                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            removeFile
                                        }
                                        disabled={
                                            processing
                                        }
                                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-slate-200 hover:bg-red-50 disabled:opacity-50"
                                    >

                                        <FaTimes />

                                    </button>

                                </div>

                            </div>

                        </div>

                    )}


                    {/* ERROR */}

                    {error && (

                        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">

                            {error}

                        </div>

                    )}


                    {/* GUIDELINES */}

                    <div className="mt-6 rounded-xl bg-slate-50 p-4">

                        <h3 className="text-sm font-bold text-slate-800">

                            Upload Guidelines

                        </h3>

                        <ul className="mt-2 space-y-1 text-sm text-slate-500">

                            <li>
                                â€¢ Chagua Subject + Class kwanza.
                            </li>

                            <li>
                                â€¢ File lazima iwe PDF.
                            </li>

                            <li>
                                â€¢ Maximum size ni 20MB.
                            </li>

                            <li>
                                â€¢ Tumia paper yenye maandishi yanayoonekana vizuri.
                            </li>

                        </ul>

                    </div>


                    {/* ACTIONS */}

                    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    `/examination/${examId}`
                                )
                            }
                            disabled={processing}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >

                            Cancel

                        </button>

                        <button
                            type="button"
                            disabled={
                                !selectedFile ||
                                !selectedExamSubjectId ||
                                processing
                            }
                            onClick={
                                handleContinue
                            }
                            className={`rounded-xl px-5 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 ${
                                selectedFile &&
                                selectedExamSubjectId &&
                                !processing
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : "bg-slate-300 cursor-not-allowed"
                            }`}
                        >

                            {processing ? (

                                <>
                                    <FaSpinner className="animate-spin" />
                                    Continuing...
                                </>

                            ) : (

                                "Continue"

                            )}

                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
}


export default ExamUpload;
