import React, { Suspense } from "react";

import {
    Routes,
    Route,
    Outlet,
    Navigate
} from "react-router-dom";

const Login = React.lazy(() => import("../pages/auth/Login"));
const AuthTest = React.lazy(() => import("../pages/AuthTest"));
const AccessScopeTest = React.lazy(() => import("../pages/AccessScopeTest"));

const AccessDenied = React.lazy(() => import("../pages/access/AccessDenied"));
import PermissionRoute from "../auth/PermissionRoute";
import { useRole } from "../context/RoleContext";

const LandingPage = React.lazy(() => import("../pages/landing/LandingPage"));
const ParentPortal = React.lazy(() => import("../pages/ParentPortal"));
const ParentPortalManagement = React.lazy(() => import("../pages/ParentPortalManagement"));

const Layout = React.lazy(() => import("../components/layout/Layout"));

const Dashboard = React.lazy(() => import("../pages/dashboard/Dashboard"));
const HRManagerDashboard = React.lazy(() => import("../pages/hr/HRManagerDashboard"));
const HRDashboard = React.lazy(() => import("../pages/hr/HRDashboard"));
const EmployeeDigitalFile = React.lazy(() => import("../pages/hr/EmployeeDigitalFile"));
const PayrollManagement = React.lazy(() => import("../pages/finance/PayrollManagement"));
const SecretaryDocumentSigning = React.lazy(() => import("../pages/communication/SecretaryDocumentSigning"));
const TeacherOnDuty = React.lazy(() => import("../pages/teacher-on-duty/TeacherOnDuty"));

/* SCHOOL MANAGEMENT */
const SchoolManagement = React.lazy(() => import("../pages/school-management/SchoolManagement"));
const AIUsageMonitoring = React.lazy(() => import("../pages/school-management/AIUsageMonitoring"));
const SchoolOverview = React.lazy(() => import("../pages/school-management/SchoolOverview"));
const AddHeadmaster = React.lazy(() => import("../pages/school-management/AddHeadmaster"));
const HeadmasterProfile = React.lazy(() => import("../pages/school-management/HeadmasterProfile"));

const Students = React.lazy(() => import("../pages/students/Students"));
const AddStudent = React.lazy(() => import("../pages/students/AddStudent"));
const EditStudent = React.lazy(() => import("../pages/students/EditStudent"));
const StudentProfile = React.lazy(() => import("../pages/students/StudentProfile"));

const Teachers = React.lazy(() => import("../pages/teachers/Teachers"));
const AddTeacher = React.lazy(() => import("../pages/teachers/AddTeacher"));
const EditTeacher = React.lazy(() => import("../pages/teachers/EditTeacher"));
const TeacherProfile = React.lazy(() => import("../pages/teachers/TeacherProfile"));

const Subjects = React.lazy(() => import("../pages/subjects/Subjects"));
const AddSubject = React.lazy(() => import("../pages/subjects/AddSubject"));
const EditSubject = React.lazy(() => import("../pages/subjects/EditSubject"));
const SubjectProfile = React.lazy(() => import("../pages/subjects/SubjectProfile"));
const AdvancedCombinations = React.lazy(() => import("../pages/subjects/AdvancedCombinations"));

const Classes = React.lazy(() => import("../pages/classes/Classes"));
const Addclass = React.lazy(() => import("../pages/classes/Addclass"));
const EditClass = React.lazy(() => import("../pages/classes/EditClass"));
const ClassProfile = React.lazy(() => import("../pages/classes/ClassProfile"));

const Academics = React.lazy(() => import("../pages/academics/Academics"));
const AcademicYears = React.lazy(() => import("../pages/academic-years/AcademicYears"));

const TeacherAssignment = React.lazy(() => import("../pages/teacher-assignment/TeacherAssignment"));
const AssignmentForm = React.lazy(() => import("../pages/teacher-assignment/AssignmentForm"));
const EditAssignment = React.lazy(() => import("../pages/teacher-assignment/EditAssignment"));
const AssignmentProfile = React.lazy(() => import("../pages/teacher-assignment/AssignmentProfile"));

const Periods = React.lazy(() => import("../pages/periods/Periods"));

const Timetable = React.lazy(() => import("../pages/timetable/Timetable"));
const AddTimetable = React.lazy(() => import("../pages/timetable/AddTimetable"));
const EditTimetable = React.lazy(() => import("../pages/timetable/EditTimetable"));
const TimetableSettings = React.lazy(() => import("../pages/timetable/TimetableSettings"));
const DutyScheduleManager = React.lazy(() => import("../pages/timetable/DutyScheduleManager"));

const ClassTeacherAttendance = React.lazy(() => import("../pages/class-teacher/ClassTeacherAttendance"));

const ClassTeacherSubjectTeachers = React.lazy(() => import("../pages/class-teacher/ClassTeacherSubjectTeachers"));

const ExaminationDashboard = React.lazy(() => import("../pages/examination/ExaminationDashboard"));
const AddExam = React.lazy(() => import("../pages/examination/AddExam"));
const EditExam = React.lazy(() => import("../pages/examination/EditExam"));
const ViewExam = React.lazy(() => import("../pages/examination/ViewExam"));
const ExamList = React.lazy(() => import("../pages/examination/ExamList"));
const ExamSubjects = React.lazy(() => import("../pages/examination/ExamSubjects"));
const AddExamSubject = React.lazy(() => import("../pages/examination/AddExamSubject"));
const ExamUpload = React.lazy(() => import("../pages/examination/ExamUpload"));
const AIAnalysisDashboard = React.lazy(() => import("../pages/examination/AIAnalysisDashboard"));
const ExamApproval = React.lazy(() => import("../pages/examination/ExamApproval"));
const EnterMarks = React.lazy(() => import("../pages/examination/EnterMarks"));
const ResultsAnalysis = React.lazy(() => import("../pages/examination/ResultsAnalysis"));
const ExaminationRoleDashboard = React.lazy(() => import("../pages/examination/ExaminationRoleDashboard"));
const SubjectTeacherExamUpload = React.lazy(() => import("../pages/examination/SubjectTeacherExamUpload"));
const ExamPrintingUnit = React.lazy(() => import("../pages/examination/ExamPrintingUnit"));

const Finance = React.lazy(() => import("../pages/finance/Finance"));
const TransportManagement = React.lazy(() => import("../pages/transport/TransportManagement"));
const StockManagement = React.lazy(() => import("../pages/stock/StockManagement"));
const FinanceDashboard = React.lazy(() => import("../pages/finance/FinanceDashboard"));
const IncomeExpensesSummary = React.lazy(() => import("../pages/finance/IncomeExpensesSummary"));
const ChartOfAccounts = React.lazy(() => import("../pages/finance/ChartOfAccounts"));
const CashAccounts = React.lazy(() => import("../pages/finance/CashAccounts"));
const PaymentProviderSetup = React.lazy(() => import("../pages/finance/PaymentProviderSetup"));
const RecordPayment = React.lazy(() => import("../pages/finance/RecordPayment"));
const AddExpense = React.lazy(() => import("../pages/finance/AddExpense"));
const GeneralLedger = React.lazy(() => import("../pages/finance/GeneralLedger"));
const FinancialStatements = React.lazy(() => import("../pages/finance/FinancialStatements"));
const ClassFeeCollection = React.lazy(() => import("../pages/finance/ClassFeeCollection"));
const FeeControlCorrectionCenter = React.lazy(() => import("../pages/finance/FeeControlCorrectionCenter"));
const RecordReceivable = React.lazy(() => import("../pages/finance/RecordReceivable"));
const RecordPayable = React.lazy(() => import("../pages/finance/RecordPayable"));

const Communication = React.lazy(() => import("../pages/communication/Communication"));
const DigitalMarketing = React.lazy(() => import("../pages/communication/DigitalMarketing"));
const CommunicationChat = React.lazy(() => import("../pages/communication/CommunicationChat"));
const CommunicationMeetings = React.lazy(() => import("../pages/communication/CommunicationMeetings"));
const CommunicationMeeting = React.lazy(() => import("../pages/communication/CommunicationMeeting"));
const CommunicationNotifications = React.lazy(() => import("../pages/communication/CommunicationNotifications"));
const CommunicationAnnouncements = React.lazy(() => import("../pages/communication/CommunicationAnnouncements"));
const SuggestionBox = React.lazy(() => import("../pages/communication/SuggestionBox"));

const SocialWelfareDashboard = React.lazy(() => import("../pages/social-welfare/SocialWelfareDashboard"));

const PatronMatron = React.lazy(() => import("../pages/patron-matron/PatronMatron"));

const Report = React.lazy(() => import("../pages/report/Report"));

const AI = React.lazy(() => import("../pages/ai/AI"));

const Settings = React.lazy(() => import("../pages/settings/Settings"));

const SystemManual = React.lazy(() => import("../pages/manual/SystemManual"));


/* ============================================================
   CURRENT ROLE CHECK
============================================================ */

function useCurrentRoleCheck() {
    const {
        loading: roleLoading,
        selectedRoleId,
        selectedProfileRoleId,
        selectedRoleName,
    } = useRole();

    return {
        loading: roleLoading,

        roleId:
            selectedRoleId === null ||
            selectedRoleId === undefined
                ? null
                : Number(selectedRoleId),

        profileRoleId: selectedProfileRoleId,

        roleName: selectedRoleName,
    };
}


/* ============================================================
   SUPER ADMIN OR PERMISSION ROUTE
============================================================ */

function SuperAdminOrPermissionRoute({
    permission,
    permissions,
    requireAny = false,
}) {
    const {
        loading,
        roleId
    } = useCurrentRoleCheck();

    if (loading) {
        return null;
    }

    if (Number(roleId) === 1) {
        return <Outlet />;
    }

    return (
        <PermissionRoute
            {...(
                permission
                    ? { permission }
                    : {}
            )}
            {...(
                permissions
                    ? { permissions }
                    : {}
            )}
            requireAny={requireAny}
        />
    );
}


/* ============================================================
   SUPER ADMIN OR ALLOWED ROLE ROUTE
============================================================ */

function SuperAdminOrAllowedRoleRoute({
    allowedRoles = [],
    allowedRoleNames = [],
}) {
    const {
        loading,
        roleId,
        roleName,
    } = useCurrentRoleCheck();

    if (loading) {
        return null;
    }

    const currentRoleId = Number(roleId);

    const currentRoleName = String(roleName || "")
        .trim()
        .toLowerCase();

    const allowedById = allowedRoles
        .map(Number)
        .includes(currentRoleId);

    const allowedByName = allowedRoleNames.some(
        (name) =>
            String(name || "")
                .trim()
                .toLowerCase() === currentRoleName
    );

    if (!allowedById && !allowedByName) {
        return (
            <Navigate
                to={currentRoleName === "hr manager" ? "/hr-dashboard" : "/dashboard"}
                replace
            />
        );
    }

    return <Outlet />;
}


/* ============================================================
   APP ROUTES
============================================================ */

export default function AppRoutes() {
    return (
        <Suspense fallback={(
            <div className="flex min-h-[60vh] w-full items-center justify-center" role="status" aria-live="polite">
                <div className="w-full max-w-5xl animate-pulse space-y-4 px-4">
                    <div className="h-8 w-56 rounded-lg bg-slate-200" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="h-28 rounded-2xl bg-slate-100" />
                        <div className="h-28 rounded-2xl bg-slate-100" />
                        <div className="h-28 rounded-2xl bg-slate-100" />
                    </div>
                </div>
            </div>
        )}>
        <Routes>

            {/* LANDING PAGE */}
            <Route
                path="/"
                element={<LandingPage />}
            />

            {/* LOGIN */}
            <Route
                path="/login"
                element={<Login />}
            />

            {/* PARENT PORTAL - SEPARATE PARENT AUTHENTICATION */}
            <Route
                path="/parent-portal"
                element={<ParentPortal />}
            />

            {/* ACCESS DENIED */}
            <Route
                path="/access-denied"
                element={<AccessDenied />}
            />

            {/* PUBLIC SYSTEM MANUAL */}
            <Route
                path="/system-manual"
                element={<SystemManual />}
            />

            {/* AUTH TEST */}
            <Route
                path="/auth-test"
                element={<AuthTest />}
            />

            {/* ACCESS SCOPE TEST */}
            <Route
                path="/access-scope-test"
                element={<AccessScopeTest />}
            />

            {/* MAIN APPLICATION */}
            <Route
                path="/"
                element={<Layout />}
            >

                {/* DASHBOARD */}
                <Route
                    path="dashboard"
                    element={<Dashboard />}
                />

                {/* HR MANAGER WORKSPACE */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1]}
                            allowedRoleNames={["HR Manager"]}
                        />
                    }
                >
                    <Route
                        path="hr-dashboard"
                        element={<HRDashboard />}
                    />
                    <Route
                        path="hr-management"
                        element={<HRManagerDashboard />}
                    />
                    <Route
                        path="hr-management/employees/:employeeId"
                        element={<EmployeeDigitalFile />}
                    />
                    <Route
                        path="hr-management/payroll"
                        element={<PayrollManagement />}
                    />
                </Route>

                {/* ACCOUNTANT PAYROLL WORKSPACE */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 6]}
                            allowedRoleNames={["Accountant"]}
                        />
                    }
                >
                    <Route
                        path="payroll-management"
                        element={<PayrollManagement />}
                    />
                </Route>

                {/* GLOBAL PAYMENT PROVIDERS — SUPER ADMIN ONLY */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1]}
                        />
                    }
                >
                    <Route
                        path="system/payment-providers"
                        element={<PaymentProviderSetup />}
                    />
                </Route>

                {/* SCHOOL MANAGEMENT — SUPER ADMIN ONLY */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1]}
                        />
                    }
                >
                    <Route
                        path="school-management/headmasters/add"
                        element={<AddHeadmaster />}
                    />
                    <Route
                        path="school-management/headmasters/:profileId"
                        element={<HeadmasterProfile />}
                    />
                    <Route
                        path="school-management/:id"
                        element={<SchoolOverview />}
                    />
                    <Route
                        path="school-management"
                        element={<SchoolManagement />}
                    />
                    <Route
                        path="system/ai-usage"
                        element={<AIUsageMonitoring />}
                    />
                </Route>

                {/* CLASS TEACHER */}
                <Route
                    path="class-teacher/attendance"
                    element={<ClassTeacherAttendance />}
                />

                <Route
                    path="attendance"
                    element={<ClassTeacherAttendance />}
                />

                <Route
                    path="class-teacher/subject-teachers"
                    element={<ClassTeacherSubjectTeachers />}
                />

                <Route
                    path="class-teacher/subjects"
                    element={<ClassTeacherSubjectTeachers />}
                />

                {/* PARENT PORTAL STAFF MANAGEMENT */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 3, 4, 7, 12]}
                            allowedRoleNames={["Accountant", "Class Teacher"]}
                        />
                    }
                >
                    <Route
                        path="parent-portal-management"
                        element={<ParentPortalManagement />}
                    />
                </Route>

                {/* STUDENTS VIEW */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="view_students"
                        />
                    }
                >
                    <Route
                        path="students"
                        element={<Students />}
                    />

                    <Route
                        path="students/profile/:id"
                        element={<StudentProfile />}
                    />
                </Route>

                {/* STUDENTS CREATE */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="create_students"
                        />
                    }
                >
                    <Route
                        path="students/add"
                        element={<AddStudent />}
                    />
                </Route>

                {/* STUDENTS EDIT */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="edit_students"
                        />
                    }
                >
                    <Route
                        path="students/edit/:id"
                        element={<EditStudent />}
                    />
                </Route>

                {/* TEACHERS */}
                <Route
                    path="teachers"
                    element={<Teachers />}
                />

                <Route
                    path="teachers/add"
                    element={<AddTeacher />}
                />

                <Route
                    path="teachers/edit/:id"
                    element={<EditTeacher />}
                />

                <Route
                    path="teachers/profile/:id"
                    element={<TeacherProfile />}
                />

                {/* SUBJECTS */}
                <Route
                    path="subjects"
                    element={<Subjects />}
                />

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 4]}
                        />
                    }
                >
                    <Route
                        path="subjects/add"
                        element={<AddSubject />}
                    />

                    <Route
                        path="subjects/edit/:id"
                        element={<EditSubject />}
                    />
                </Route>

                <Route
                    path="subjects/profile/:id"
                    element={<SubjectProfile />}
                />

                {/* ADVANCED SUBJECT COMBINATIONS */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 3, 4]}
                        />
                    }
                >
                    <Route
                        path="advanced-combinations"
                        element={<AdvancedCombinations />}
                    />
                </Route>

                {/* CLASSES */}
                <Route
                    path="classes"
                    element={<Classes />}
                />

                <Route
                    path="classes/add"
                    element={<Addclass />}
                />

                <Route
                    path="classes/edit/:id"
                    element={<EditClass />}
                />

                <Route
                    path="classes/profile/:id"
                    element={<ClassProfile />}
                />

                {/* ACADEMICS */}
                <Route
                    path="academics"
                    element={<Academics />}
                />

                <Route
                    path="academic-years"
                    element={<AcademicYears />}
                />

                {/* TEACHER ASSIGNMENT */}
                <Route
                    path="teacher-assignment"
                    element={<TeacherAssignment />}
                />

                <Route
                    path="teacher-assignment/add"
                    element={<AssignmentForm />}
                />

                <Route
                    path="teacher-assignment/edit/:id"
                    element={<EditAssignment />}
                />

                <Route
                    path="teacher-assignment/profile/:id"
                    element={<AssignmentProfile />}
                />

                {/* PERIODS */}
                <Route
                    path="periods"
                    element={<Periods />}
                />

                {/* TIMETABLE */}
                <Route
                    path="timetable"
                    element={<Timetable />}
                />

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 3, 4]}
                        />
                    }
                >
                    <Route
                        path="timetable/add"
                        element={<AddTimetable />}
                    />

                    <Route
                        path="timetable/edit/:id"
                        element={<EditTimetable />}
                    />

                    <Route
                        path="timetable/settings"
                        element={<TimetableSettings />}
                    />

                    <Route
                        path="timetable/duty-schedule"
                        element={<DutyScheduleManager />}
                    />
                </Route>

                {/* EXAMINATION DASHBOARD */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="EXAM_VIEW"
                        />
                    }
                >
                    <Route
                        path="examination"
                        element={<ExaminationRoleDashboard />}
                    />
                </Route>

                {/* EXAMINATION VIEW */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 3, 4]}
                        />
                    }
                >
                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="EXAM_VIEW"
                            />
                        }
                    >
                        <Route
                            path="examination/list"
                            element={<ExamList />}
                        />

                        <Route
                            path="examination/:examId"
                            element={<ViewExam />}
                        />

                        <Route
                            path="examination/:examId/subjects"
                            element={<ExamSubjects />}
                        />
                    </Route>
                </Route>

                {/* EXAMINATION CREATE / EDIT / UPLOAD */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 4]}
                        />
                    }
                >
                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="EXAM_CREATE"
                            />
                        }
                    >
                        <Route
                            path="examination/create"
                            element={<AddExam />}
                        />
                    </Route>

                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="EXAM_EDIT"
                            />
                        }
                    >
                        <Route
                            path="examination/:examId/edit"
                            element={<EditExam />}
                        />

                        <Route
                            path="examination/:examId/add-subject"
                            element={<AddExamSubject />}
                        />
                    </Route>

                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="EXAM_UPLOAD_PAPER"
                            />
                        }
                    >
                        <Route
                            path="examination/:examId/upload"
                            element={<ExamUpload />}
                        />
                    </Route>
                </Route>

                {/* AI EXAMINATION ANALYSIS */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 3, 4, 5]}
                        />
                    }
                >
                    <Route
                        element={
                            <PermissionRoute
                                permissions={[
                                    "EXAM_GENERATE_AI_ANALYSIS",
                                    "EXAM_VIEW_AI_REPORT"
                                ]}
                                requireAny={true}
                            />
                        }
                    >
                        <Route
                            path="examination/:examId/ai-analysis"
                            element={<AIAnalysisDashboard />}
                        />
                    </Route>
                </Route>

                {/* EXAMINATION APPROVAL */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 3, 4]}
                        />
                    }
                >
                    <Route
                        element={
                            <PermissionRoute
                                permissions={[
                                    "EXAM_APPROVE_ACADEMIC",
                                    "EXAM_APPROVE_SECOND_MASTER",
                                    "EXAM_APPROVE_HEADMASTER"
                                ]}
                                requireAny={true}
                            />
                        }
                    >
                        <Route
                            path="examination/:examId/approval"
                            element={<ExamApproval />}
                        />
                    </Route>
                </Route>

                {/* ENTER MARKS */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 4, 5]}
                        />
                    }
                >
                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="EXAM_ENTER_MARKS"
                            />
                        }
                    >
                        <Route
                            path="examination/:examId/marks"
                            element={<EnterMarks />}
                        />
                    </Route>
                </Route>

                {/* RESULTS ANALYSIS */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 4]}
                        />
                    }
                >
                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="EXAM_VIEW"
                            />
                        }
                    >
                        <Route
                            path="examination/:examId/results-analysis"
                            element={<ResultsAnalysis />}
                        />
                    </Route>
                </Route>

                {/* SUBJECT TEACHER UPLOAD */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[5]}
                        />
                    }
                >
                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="EXAM_UPLOAD_PAPER"
                            />
                        }
                    >
                        <Route
                            path="examination/:examId/subject-upload"
                            element={<SubjectTeacherExamUpload />}
                        />
                    </Route>
                </Route>

                {/* EXAM PRINTING UNIT */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 4, 7]}
                        />
                    }
                >
                    <Route
                        element={
                            <SuperAdminOrPermissionRoute
                                permission="print_documents"
                            />
                        }
                    >
                        <Route
                            path="examination/printing-unit"
                            element={<ExamPrintingUnit />}
                        />
                    </Route>
                </Route>

                {/* STOCK MANAGEMENT */}
                <Route
                    element={<SuperAdminOrPermissionRoute permission="view_stock" />}
                >
                    <Route path="stock" element={<StockManagement />} />
                </Route>

                {/* TRANSPORT MANAGEMENT */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="view_transport"
                        />
                    }
                >
                    <Route
                        path="transport"
                        element={<TransportManagement />}
                    />
                </Route>

                {/* FINANCE VIEW */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="view_finance"
                        />
                    }
                >
                    <Route
                        path="finance"
                        element={<Finance />}
                    />

                    <Route
                        path="finance/dashboard"
                        element={<FinanceDashboard />}
                    />

                    <Route
                        path="finance/income-expenses-summary"
                        element={<IncomeExpensesSummary />}
                    />

                    <Route
                        path="finance/class-fee-collection"
                        element={<ClassFeeCollection />}
                    />

                    <Route
                        path="finance/fee-control"
                        element={<FeeControlCorrectionCenter />}
                    />
                </Route>

                {/* FINANCIAL STATEMENTS */}
                <Route
                    path="finance/financial-statements"
                    element={<FinancialStatements />}
                />

                {/* FINANCE MANAGEMENT */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="manage_finance"
                        />
                    }
                >
                    <Route
                        path="finance/chart-of-accounts"
                        element={<ChartOfAccounts />}
                    />

                    <Route
                        path="finance/cash-accounts"
                        element={<CashAccounts />}
                    />

                    <Route
                        path="finance/record-payment"
                        element={<RecordPayment />}
                    />

                    <Route
                        path="finance/add-expense"
                        element={<AddExpense />}
                    />

                    <Route
                        path="finance/general-ledger"
                        element={<GeneralLedger />}
                    />

                    <Route
                        path="finance/record-receivable"
                        element={<RecordReceivable />}
                    />

                    <Route
                        path="finance/record-payable"
                        element={<RecordPayable />}
                    />
                </Route>

                {/* DOCUMENT SIGNING: Secretary coordinates; HR registers signatures */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1]}
                            allowedRoleNames={[
                                "Secretary", "HR Manager", "Headmaster", "Deputy Headmaster",
                                "Academic Master", "Subject Teacher", "Accountant",
                                "Class Teacher", "Social Welfare Manager", "Matron", "Patron",
                                "Security Officer", "Other Employee"
                            ]}
                        />
                    }
                >
                    <Route
                        path="document-signing"
                        element={<SecretaryDocumentSigning />}
                    />
                </Route>

                {/* DIGITAL MARKETING & PUBLICITY - APPROVED SCHOOL ROLES ONLY */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 4, 7, 18]}
                            allowedRoleNames={["Super Admin", "Headmaster", "Secretary", "HR Manager"]}
                        />
                    }
                >
                    <Route
                        path="digital-marketing"
                        element={<DigitalMarketing />}
                    />
                </Route>

                {/* COMMUNICATION */}
                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="send_messages"
                        />
                    }
                >
                    <Route
                        path="communication"
                        element={<Communication />}
                    />

                    <Route
                        path="communication/chat"
                        element={<CommunicationChat />}
                    />

                    <Route
                        path="communication/notifications"
                        element={<CommunicationNotifications />}
                    />

                    <Route
                        path="communication/announcements"
                        element={<CommunicationAnnouncements />}
                    />

                    <Route
                        path="communication/suggestions"
                        element={<SuggestionBox />}
                    />
                </Route>

                {/* COMMUNICATION MEETINGS */}
                <Route
                    path="communication/meetings"
                    element={<CommunicationMeetings />}
                />

                {/* SINGLE VIDEO MEETING ROOM */}
                <Route
                    path="communication/meeting/:meetingId"
                    element={<CommunicationMeeting />}
                />

                {/* SOCIAL WELFARE */}
                <Route
                    path="social-welfare"
                    element={<SocialWelfareDashboard />}
                />

                {/* PATRON / MATRON */}
                <Route
                    path="patron-matron"
                    element={<PatronMatron />}
                />

                {/* REPORTS */}
                <Route
                    path="report"
                    element={<Report />}
                />

                <Route
                    path="reports"
                    element={<Report />}
                />

                {/* AI */}
                <Route
                    path="ai"
                    element={<AI />}
                />

                {/* SETTINGS */}
                <Route
                    path="settings"
                    element={<Settings />}
                />

                {/* TEACHER ON DUTY */}
                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[1, 2, 3, 4, 5]}
                            allowedRoleNames={[
                                "Class Teacher"
                            ]}
                        />
                    }
                >
                    <Route
                        path="teacher-on-duty"
                        element={<TeacherOnDuty />}
                    />
                </Route>

                {/* UNKNOWN DASHBOARD ROUTES */}
                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/dashboard"
                            replace
                        />
                    }
                />

            </Route>
        </Routes>
        </Suspense>
    );
}