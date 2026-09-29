import { Routes, Route } from "react-router-dom";


// AUTH
import Login from "../pages/auth/Login";


// LAYOUT
import Layout from "../components/layout/Layout";


// DASHBOARD
import Dashboard from "../pages/dashboard/Dashboard";


// STUDENTS
import Students from "../pages/students/Students";
import AddStudent from "../pages/students/AddStudent";
import EditStudent from "../pages/students/EditStudent";
import StudentProfile from "../pages/students/StudentProfile";


// TEACHERS
import Teachers from "../pages/teachers/Teachers";
import AddTeacher from "../pages/teachers/AddTeacher";
import EditTeacher from "../pages/teachers/EditTeacher";
import TeacherProfile from "../pages/teachers/TeacherProfile";


// SUBJECTS
import Subjects from "../pages/subjects/Subjects";
import AddSubject from "../pages/subjects/AddSubject";
import EditSubject from "../pages/subjects/EditSubject";
import SubjectProfile from "../pages/subjects/SubjectProfile";


// CLASSES
import Classes from "../pages/classes/Classes";
import Addclass from "../pages/classes/Addclass";
import EditClass from "../pages/classes/EditClass";
import ClassProfile from "../pages/classes/ClassProfile";


// ACADEMIC
import Academics from "../pages/academics/Academics";
import AcademicYears from "../pages/academic-years/AcademicYears";


// ASSIGNMENT
import TeacherAssignment from "../pages/teacher-assignment/TeacherAssignment";
import AssignmentForm from "../pages/teacher-assignment/AssignmentForm";
import EditAssignment from "../pages/teacher-assignment/EditAssignment";
import AssignmentProfile from "../pages/teacher-assignment/AssignmentProfile";


// PERIOD
import Periods from "../pages/periods/Periods";


// TIMETABLE
import Timetable from "../pages/timetable/Timetable";
import AddTimetable from "../pages/timetable/AddTimetable";
import EditTimetable from "../pages/timetable/EditTimetable";
import TimetableSettings from "../pages/timetable/TimetableSettings";




// ===============================
// EXAMINATION MODULE
// ===============================

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





// FINANCE
import Finance from "../pages/finance/Finance";


// COMMUNICATION
import Communication from "../pages/communication/Communication";


// AI
import AI from "../pages/ai/AI";


// SETTINGS
import Settings from "../pages/settings/Settings";






function AppRoutes(){


return(


<Routes>





{/* LOGIN */}

<Route

path="/login"

element={<Login/>}

/>







<Route

path="/"

element={<Layout/>}

>





<Route

index

element={<Dashboard/>}

/>





<Route

path="dashboard"

element={<Dashboard/>}

/>








{/* ==========================
 STUDENTS
========================== */}


<Route path="students" element={<Students/>}/>

<Route path="students/add" element={<AddStudent/>}/>

<Route path="students/edit/:id" element={<EditStudent/>}/>

<Route path="students/profile/:id" element={<StudentProfile/>}/>







{/* ==========================
 TEACHERS
========================== */}



<Route path="teachers" element={<Teachers/>}/>

<Route path="teachers/add" element={<AddTeacher/>}/>

<Route path="teachers/edit/:id" element={<EditTeacher/>}/>

<Route path="teachers/profile/:id" element={<TeacherProfile/>}/>







{/* ==========================
 SUBJECTS
========================== */}



<Route path="subjects" element={<Subjects/>}/>

<Route path="subjects/add" element={<AddSubject/>}/>

<Route path="subjects/edit/:id" element={<EditSubject/>}/>

<Route path="subjects/profile/:id" element={<SubjectProfile/>}/>







{/* ==========================
 CLASSES
========================== */}



<Route path="classes" element={<Classes/>}/>

<Route path="classes/add" element={<Addclass/>}/>

<Route path="classes/edit/:id" element={<EditClass/>}/>

<Route path="classes/profile/:id" element={<ClassProfile/>}/>









{/* ==========================
 ACADEMIC
========================== */}



<Route path="academics" element={<Academics/>}/>

<Route path="academic-years" element={<AcademicYears/>}/>







{/* ==========================
 ASSIGNMENT
========================== */}



<Route path="teacher-assignment" element={<TeacherAssignment/>}/>

<Route path="teacher-assignment/add" element={<AssignmentForm/>}/>

<Route path="teacher-assignment/edit/:id" element={<EditAssignment/>}/>

<Route path="teacher-assignment/profile/:id" element={<AssignmentProfile/>}/>







{/* ==========================
 PERIODS
========================== */}


<Route path="periods" element={<Periods/>}/>







{/* ==========================
 TIMETABLE
========================== */}



<Route path="timetable" element={<Timetable/>}/>

<Route path="timetable/add" element={<AddTimetable/>}/>

<Route path="timetable/edit/:id" element={<EditTimetable/>}/>

<Route path="timetable/settings" element={<TimetableSettings/>}/>









// =====================================================
//                 EXAMINATION MODULE
// =====================================================




{/* MAIN DASHBOARD */}

<Route

path="examination"

element={<ExaminationDashboard/>}

/>





{/* LIST */}

<Route

path="examination/list"

element={<ExamList/>}

/>






{/* CREATE */}

<Route

path="examination/create"

element={<AddExam/>}

/>







{/* VIEW SINGLE EXAM */}

<Route

path="examination/:examId"

element={<ViewExam/>}

/>







{/* EDIT */}

<Route

path="examination/:examId/edit"

element={<EditExam/>}

/>







{/* SUBJECT MANAGEMENT */}

<Route

path="examination/:examId/subjects"

element={<ExamSubjects/>}

/>






<Route

path="examination/:examId/add-subject"

element={<AddExamSubject/>}

/>







{/* UPLOAD PAPER */}

<Route

path="examination/:examId/upload"

element={<ExamUpload/>}

/>







{/* AI ANALYSIS */}

<Route

path="examination/:examId/ai-analysis"

element={<AIAnalysisDashboard/>}

/>







{/* APPROVAL */}

<Route

path="examination/:examId/approval"

element={<ExamApproval/>}

/>







{/* MARKS */}

<Route

path="examination/:examId/marks"

element={<EnterMarks/>}

/>







{/* RESULTS */}

<Route

path="examination/:examId/results-analysis"

element={<ResultsAnalysis/>}

/>







{/* ==========================
 FINANCE
========================== */}


<Route

path="finance"

element={<Finance/>}

/>







{/* COMMUNICATION */}

<Route

path="communication"

element={<Communication/>}

/>







{/* AI */}

<Route

path="ai"

element={<AI/>}

/>







{/* SETTINGS */}

<Route

path="settings"

element={<Settings/>}

/>






</Route>





</Routes>


);


}



export default AppRoutes;