import React from "react";

import {
    Routes,
    Route,
    Outlet,
    Navigate
} from "react-router-dom";


// ===============================
// AUTH
// ===============================
import Login from "../pages/auth/Login";
import AuthTest from "../pages/AuthTest";
import AccessScopeTest from "../pages/AccessScopeTest";


// ===============================
// ACCESS / SECURITY
// ===============================
import AccessDenied from "../pages/access/AccessDenied";
import PermissionRoute from "../auth/PermissionRoute";
import { useRole } from "../context/RoleContext";


// ===============================
// LAYOUT
// ===============================
import Layout from "../components/layout/Layout";


// ===============================
// DASHBOARD
// ===============================
import Dashboard from "../pages/dashboard/Dashboard";


// ===============================
// STUDENTS
// ===============================
import Students from "../pages/students/Students";
import AddStudent from "../pages/students/AddStudent";
import EditStudent from "../pages/students/EditStudent";
import StudentProfile from "../pages/students/StudentProfile";


// ===============================
// TEACHERS
// ===============================
import Teachers from "../pages/teachers/Teachers";
import AddTeacher from "../pages/teachers/AddTeacher";
import EditTeacher from "../pages/teachers/EditTeacher";
import TeacherProfile from "../pages/teachers/TeacherProfile";


// ===============================
// SUBJECTS
// ===============================
import Subjects from "../pages/subjects/Subjects";
import AddSubject from "../pages/subjects/AddSubject";
import EditSubject from "../pages/subjects/EditSubject";
import SubjectProfile from "../pages/subjects/SubjectProfile";


// ===============================
// CLASSES
// ===============================
import Classes from "../pages/classes/Classes";
import Addclass from "../pages/classes/Addclass";
import EditClass from "../pages/classes/EditClass";
import ClassProfile from "../pages/classes/ClassProfile";


// ===============================
// ACADEMIC
// ===============================
import Academics from "../pages/academics/Academics";
import AcademicYears from "../pages/academic-years/AcademicYears";


// ===============================
// TEACHER ASSIGNMENT
// ===============================
import TeacherAssignment from "../pages/teacher-assignment/TeacherAssignment";
import AssignmentForm from "../pages/teacher-assignment/AssignmentForm";
import EditAssignment from "../pages/teacher-assignment/EditAssignment";
import AssignmentProfile from "../pages/teacher-assignment/AssignmentProfile";


// ===============================
// PERIODS
// ===============================
import Periods from "../pages/periods/Periods";


// ===============================
// TIMETABLE
// ===============================
import Timetable from "../pages/timetable/Timetable";
import AddTimetable from "../pages/timetable/AddTimetable";
import EditTimetable from "../pages/timetable/EditTimetable";
import TimetableSettings from "../pages/timetable/TimetableSettings";
import DutyScheduleManager from "../pages/timetable/DutyScheduleManager";


// =====================================================
// CLASS TEACHER
// =====================================================
import ClassTeacherAttendance
    from "../pages/class-teacher/ClassTeacherAttendance";

import ClassTeacherSubjectTeachers
    from "../pages/class-teacher/ClassTeacherSubjectTeachers";


// =====================================================
// EXAMINATION MODULE
// =====================================================
import ExaminationDashboard from "../pages/examination/ExaminationDashboard";
import AddExam from "../pages/examination/AddExam";
import EditExam from "../pages/examination/EditExam";
import ViewExam from "../pages/examination/ViewExam";
import ExamList from "../pages/examination/ExamList";
import ExamSubjects from "../pages/examination/ExamSubjects";
import AddExamSubject from "../pages/examination/AddExamSubject";
import ExamUpload from "../pages/examination/ExamUpload";
import AIAnalysisDashboard from "../pages/examination/AIAnalysisDashboard";
import ExamApproval from "../pages/examination/ExamApproval";
import EnterMarks from "../pages/examination/EnterMarks";
import ResultsAnalysis from "../pages/examination/ResultsAnalysis";
import ExaminationRoleDashboard from "../pages/examination/ExaminationRoleDashboard";
import SubjectTeacherExamUpload from "../pages/examination/SubjectTeacherExamUpload";
import ExamPrintingUnit from "../pages/examination/ExamPrintingUnit";


// =====================================================
// FINANCE MODULE
// =====================================================
import Finance from "../pages/finance/Finance";
import FinanceDashboard from "../pages/finance/FinanceDashboard";
import ChartOfAccounts from "../pages/finance/ChartOfAccounts";
import RecordPayment from "../pages/finance/RecordPayment";
import AddExpense from "../pages/finance/AddExpense";
import GeneralLedger from "../pages/finance/GeneralLedger";
import FinancialStatements from "../pages/finance/FinancialStatements";
import ClassFeeCollection from "../pages/finance/ClassFeeCollection";
import RecordReceivable from "../pages/finance/RecordReceivable";
import RecordPayable from "../pages/finance/RecordPayable";


// =====================================================
// COMMUNICATION MODULE
// =====================================================
import Communication from "../pages/communication/Communication";
import CommunicationChat from "../pages/communication/CommunicationChat";
import CommunicationMeetings from "../pages/communication/CommunicationMeetings";
import CommunicationMeeting from "../pages/communication/CommunicationMeeting";
import CommunicationNotifications from "../pages/communication/CommunicationNotifications";
import CommunicationAnnouncements from "../pages/communication/CommunicationAnnouncements";
import SuggestionBox from "../pages/communication/SuggestionBox";


// =====================================================
// SOCIAL WELFARE MODULE
// =====================================================
import SocialWelfareDashboard from "../pages/social-welfare/SocialWelfareDashboard";


// =====================================================
// PATRON & MATRON MANAGEMENT
// =====================================================
import PatronMatron from "../pages/patron-matron/PatronMatron";


// ===============================
// REPORTS
// ===============================
import Report from "../pages/report/Report";


// ===============================
// AI
// ===============================
import AI from "../pages/ai/AI";


// ===============================
// SETTINGS
// ===============================
import Settings from "../pages/settings/Settings";


// =====================================================
// CURRENT ROLE / ROUTE ACCESS
// =====================================================

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


// =====================================================
// PERMISSION ROUTE
// =====================================================

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
                    ? {
                        permission
                    }
                    : {}
            )}

            {...(
                permissions
                    ? {
                        permissions
                    }
                    : {}
            )}

            requireAny={requireAny}
        />
    );
}


// =====================================================
// MODULE ROLE GATE
// =====================================================

function SuperAdminOrAllowedRoleRoute({
    allowedRoles = [],
}) {

    const {
        loading,
        roleId,
    } = useCurrentRoleCheck();

    if (loading) {
        return null;
    }

    const currentRoleId =
        Number(roleId);

    const allowed =
        allowedRoles
            .map(Number)
            .includes(
                currentRoleId
            );

    if (!allowed) {

        return (
            <Navigate
                to="/access-denied"
                replace
            />
        );
    }

    return <Outlet />;
}


// =====================================================
// APP ROUTES
// =====================================================

export default function AppRoutes() {

    return (

        <Routes>

            {/* =====================================================
                LOGIN
            ===================================================== */}

            <Route
                path="/login"
                element={
                    <Login />
                }
            />


            {/* =====================================================
                ACCESS DENIED
            ===================================================== */}

            <Route
                path="/access-denied"
                element={
                    <AccessDenied />
                }
            />


            {/* =====================================================
                AUTH TEST
            ===================================================== */}

            <Route
                path="/auth-test"
                element={
                    <AuthTest />
                }
            />


            {/* =====================================================
                ACCESS SCOPE TEST
            ===================================================== */}

            <Route
                path="/access-scope-test"
                element={
                    <AccessScopeTest />
                }
            />


            {/* =====================================================
                MAIN APPLICATION
            ===================================================== */}

            <Route
                path="/"
                element={
                    <Layout />
                }
            >


                {/* =====================================================
                    DASHBOARD
                ===================================================== */}

                <Route
                    index
                    element={
                        <Dashboard />
                    }
                />

                <Route
                    path="dashboard"
                    element={
                        <Dashboard />
                    }
                />


                {/* =====================================================
                    CLASS TEACHER
                ===================================================== */}

                <Route
                    path="class-teacher/attendance"
                    element={
                        <ClassTeacherAttendance />
                    }
                />

                {/* -----------------------------------------------------
                    ATTENDANCE ALIAS

                    The existing Class Teacher dashboard may still
                    navigate to /attendance.

                    This route intentionally points to the same
                    ClassTeacherAttendance component.
                ----------------------------------------------------- */}

                <Route
                    path="attendance"
                    element={
                        <ClassTeacherAttendance />
                    }
                />

                <Route
                    path="class-teacher/subject-teachers"
                    element={
                        <ClassTeacherSubjectTeachers />
                    }
                />

                <Route
                    path="class-teacher/subjects"
                    element={
                        <ClassTeacherSubjectTeachers />
                    }
                />


                {/* =====================================================
                    STUDENTS - VIEW
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="view_students"
                        />
                    }
                >

                    <Route
                        path="students"
                        element={
                            <Students />
                        }
                    />

                    <Route
                        path="students/profile/:id"
                        element={
                            <StudentProfile />
                        }
                    />

                </Route>


                {/* =====================================================
                    STUDENTS - CREATE
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="create_students"
                        />
                    }
                >

                    <Route
                        path="students/add"
                        element={
                            <AddStudent />
                        }
                    />

                </Route>


                {/* =====================================================
                    STUDENTS - EDIT
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="edit_students"
                        />
                    }
                >

                    <Route
                        path="students/edit/:id"
                        element={
                            <EditStudent />
                        }
                    />

                </Route>


                {/* =====================================================
                    TEACHERS
                ===================================================== */}

                <Route
                    path="teachers"
                    element={
                        <Teachers />
                    }
                />

                <Route
                    path="teachers/add"
                    element={
                        <AddTeacher />
                    }
                />

                <Route
                    path="teachers/edit/:id"
                    element={
                        <EditTeacher />
                    }
                />

                <Route
                    path="teachers/profile/:id"
                    element={
                        <TeacherProfile />
                    }
                />


                {/* =====================================================
                    SUBJECTS
                ===================================================== */}

                <Route
                    path="subjects"
                    element={
                        <Subjects />
                    }
                />

                <Route
                    path="subjects/add"
                    element={
                        <AddSubject />
                    }
                />

                <Route
                    path="subjects/edit/:id"
                    element={
                        <EditSubject />
                    }
                />

                <Route
                    path="subjects/profile/:id"
                    element={
                        <SubjectProfile />
                    }
                />


                {/* =====================================================
                    CLASSES
                ===================================================== */}

                <Route
                    path="classes"
                    element={
                        <Classes />
                    }
                />

                <Route
                    path="classes/add"
                    element={
                        <Addclass />
                    }
                />

                <Route
                    path="classes/edit/:id"
                    element={
                        <EditClass />
                    }
                />

                <Route
                    path="classes/profile/:id"
                    element={
                        <ClassProfile />
                    }
                />


                {/* =====================================================
                    ACADEMIC
                ===================================================== */}

                <Route
                    path="academics"
                    element={
                        <Academics />
                    }
                />

                <Route
                    path="academic-years"
                    element={
                        <AcademicYears />
                    }
                />


                {/* =====================================================
                    TEACHER ASSIGNMENT
                ===================================================== */}

                <Route
                    path="teacher-assignment"
                    element={
                        <TeacherAssignment />
                    }
                />

                <Route
                    path="teacher-assignment/add"
                    element={
                        <AssignmentForm />
                    }
                />

                <Route
                    path="teacher-assignment/edit/:id"
                    element={
                        <EditAssignment />
                    }
                />

                <Route
                    path="teacher-assignment/profile/:id"
                    element={
                        <AssignmentProfile />
                    }
                />


                {/* =====================================================
                    PERIODS
                ===================================================== */}

                <Route
                    path="periods"
                    element={
                        <Periods />
                    }
                />


                {/* =====================================================
                    TIMETABLE
                ===================================================== */}

                <Route
                    path="timetable"
                    element={
                        <Timetable />
                    }
                />


                {/* =====================================================
                    TIMETABLE CREATE
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                3,
                                4
                            ]}
                        />
                    }
                >

                    <Route
                        path="timetable/add"
                        element={
                            <AddTimetable />
                        }
                    />

                </Route>


                {/* =====================================================
                    TIMETABLE EDIT
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                3,
                                4
                            ]}
                        />
                    }
                >

                    <Route
                        path="timetable/edit/:id"
                        element={
                            <EditTimetable />
                        }
                    />

                </Route>


                {/* =====================================================
                    TIMETABLE SETTINGS
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                3,
                                4
                            ]}
                        />
                    }
                >

                    <Route
                        path="timetable/settings"
                        element={
                            <TimetableSettings />
                        }
                    />

                </Route>


                {/* =====================================================
                    DUTY SCHEDULE
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                3,
                                4
                            ]}
                        />
                    }
                >

                    <Route
                        path="timetable/duty-schedule"
                        element={
                            <DutyScheduleManager />
                        }
                    />

                </Route>


                {/* =====================================================
                    EXAMINATION - ROLE DASHBOARD
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="EXAM_VIEW"
                        />
                    }
                >

                    <Route
                        path="examination"
                        element={
                            <ExaminationRoleDashboard />
                        }
                    />

                </Route>


                {/* =====================================================
                    EXAMINATION - LIST / VIEW
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                3,
                                4
                            ]}
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
                            element={
                                <ExamList />
                            }
                        />

                        <Route
                            path="examination/:examId"
                            element={
                                <ViewExam />
                            }
                        />

                        <Route
                            path="examination/:examId/subjects"
                            element={
                                <ExamSubjects />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    EXAMINATION - CREATE / EDIT
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                4
                            ]}
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
                            element={
                                <AddExam />
                            }
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
                            element={
                                <EditExam />
                            }
                        />

                        <Route
                            path="examination/:examId/add-subject"
                            element={
                                <AddExamSubject />
                            }
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
                            element={
                                <ExamUpload />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    EXAMINATION - AI ANALYSIS
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                3,
                                4,
                                5
                            ]}
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
                                requireAny={
                                    true
                                }
                            />
                        }
                    >

                        <Route
                            path="examination/:examId/ai-analysis"
                            element={
                                <AIAnalysisDashboard />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    EXAMINATION - APPROVAL
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                3,
                                4
                            ]}
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
                                requireAny={
                                    true
                                }
                            />
                        }
                    >

                        <Route
                            path="examination/:examId/approval"
                            element={
                                <ExamApproval />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    EXAMINATION - ENTER MARKS
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                4,
                                5
                            ]}
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
                            element={
                                <EnterMarks />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    EXAMINATION - RESULTS ANALYSIS
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                4
                            ]}
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
                            element={
                                <ResultsAnalysis />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    EXAMINATION - SUBJECT TEACHER UPLOAD
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                5
                            ]}
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
                            element={
                                <SubjectTeacherExamUpload />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    EXAMINATION - PRINTING UNIT
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrAllowedRoleRoute
                            allowedRoles={[
                                1,
                                2,
                                4,
                                7
                            ]}
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
                            element={
                                <ExamPrintingUnit />
                            }
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    FINANCE - VIEW
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="view_finance"
                        />
                    }
                >

                    <Route
                        path="finance"
                        element={
                            <Finance />
                        }
                    />

                    <Route
                        path="finance/dashboard"
                        element={
                            <FinanceDashboard />
                        }
                    />

                    <Route
                        path="finance/class-fee-collection"
                        element={
                            <ClassFeeCollection />
                        }
                    />

                </Route>


                {/* =====================================================
                    FINANCIAL STATEMENTS - READ ONLY
                ===================================================== */}

                <Route
                    path="finance/financial-statements"
                    element={
                        <FinancialStatements />
                    }
                />


                {/* =====================================================
                    FINANCE - MANAGEMENT
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="manage_finance"
                        />
                    }
                >

                    <Route
                        path="finance/chart-of-accounts"
                        element={
                            <ChartOfAccounts />
                        }
                    />

                    <Route
                        path="finance/record-payment"
                        element={
                            <RecordPayment />
                        }
                    />

                    <Route
                        path="finance/add-expense"
                        element={
                            <AddExpense />
                        }
                    />

                    <Route
                        path="finance/general-ledger"
                        element={
                            <GeneralLedger />
                        }
                    />

                    <Route
                        path="finance/record-receivable"
                        element={
                            <RecordReceivable />
                        }
                    />

                    <Route
                        path="finance/record-payable"
                        element={
                            <RecordPayable />
                        }
                    />

                </Route>


                {/* =====================================================
                    COMMUNICATION - GENERAL
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="send_messages"
                        />
                    }
                >

                    <Route
                        path="communication"
                        element={
                            <Communication />
                        }
                    />

                    <Route
                        path="communication/chat"
                        element={
                            <CommunicationChat />
                        }
                    />

                    <Route
                        path="communication/notifications"
                        element={
                            <CommunicationNotifications />
                        }
                    />

                    <Route
                        path="communication/announcements"
                        element={
                            <CommunicationAnnouncements />
                        }
                    />

                    <Route
                        path="communication/suggestions"
                        element={
                            <SuggestionBox />
                        }
                    />

                </Route>


                {/* =====================================================
                    COMMUNICATION - MEETINGS
                ===================================================== */}

                <Route
                    element={
                        <SuperAdminOrPermissionRoute
                            permission="create_meeting"
                        />
                    }
                >

                    <Route
                        path="communication/meetings"
                        element={
                            <CommunicationMeetings />
                        }
                    />

                </Route>


                {/* =====================================================
                    SHARED MEETING ROOM
                ===================================================== */}

                <Route
                    path="communication/meeting/:meetingId"
                    element={
                        <CommunicationMeeting />
                    }
                />


                {/* =====================================================
                    SOCIAL WELFARE
                ===================================================== */}

                <Route
                    path="social-welfare"
                    element={
                        <SocialWelfareDashboard />
                    }
                />


                {/* =====================================================
                    PATRON & MATRON MANAGEMENT
                ===================================================== */}

                <Route
                    path="patron-matron"
                    element={
                        <PatronMatron />
                    }
                />


                {/* =====================================================
                    REPORTS
                ===================================================== */}

                <Route
                    path="report"
                    element={
                        <Report />
                    }
                />

                <Route
                    path="reports"
                    element={
                        <Report />
                    }
                />


                {/* =====================================================
                    AI
                ===================================================== */}

                <Route
                    path="ai"
                    element={
                        <AI />
                    }
                />


                {/* =====================================================
                    SETTINGS
                ===================================================== */}

                <Route
                    path="settings"
                    element={
                        <Settings />
                    }
                />


                {/* =====================================================
                    FALLBACK
                ===================================================== */}

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
    );
}