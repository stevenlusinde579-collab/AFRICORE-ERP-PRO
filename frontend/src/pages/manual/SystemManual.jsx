import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaArrowLeft, FaBookOpen, FaGraduationCap, FaUsers,
    FaChalkboardTeacher, FaCalendarAlt, FaClipboardCheck,
    FaMoneyBillWave, FaComments, FaChartLine, FaRobot,
    FaShieldAlt, FaUserCog, FaCheckCircle, FaExclamationCircle,
    FaLanguage, FaPrint, FaCog, FaSearch, FaUserTie,
    FaFileAlt, FaUniversity, FaBell, FaHome, FaUserFriends
} from "react-icons/fa";

const text = (en, sw) => ({ en, sw });

const moduleGuides = [
    {
        id: "students", icon: "students",
        title: text("Student Management", "Usimamizi wa Wanafunzi"),
        intro: text(
            "This module is the school's central record for learners. Use it to register learners, maintain profiles, organise class placement and review student lists. Only authorised staff should create or change official student records.",
            "Hii ndiyo sehemu kuu ya kutunza taarifa za wanafunzi. Inatumika kusajili mwanafunzi, kuhifadhi wasifu, kupanga darasa na kukagua orodha za wanafunzi. Wafanyakazi walioidhinishwa pekee ndio wanapaswa kuongeza au kubadilisha taarifa rasmi."
        ),
        purpose: text("Maintain accurate, searchable and school-specific student records.", "Kuweka taarifa sahihi za wanafunzi zinazoweza kutafutwa na zinazohusu shule husika pekee."),
        steps: text([
            "Open Students / Student Management and confirm that the correct school is selected.",
            "Choose Add Student / Register Student to open the registration form.",
            "Enter the admission number first. Check that it is correct and is not already used for another learner.",
            "Enter the learner's names, sex, date of birth and admission date.",
            "Select the correct academic year, class and stream where the form provides them.",
            "Complete parent or guardian contact details and other required profile information.",
            "Record special learning needs or disability information only when supplied and relevant.",
            "Review every field, save the record, then search for the learner to confirm the profile and class placement."
        ], [
            "Fungua Students / Student Management na uhakikishe shule iliyochaguliwa ni sahihi.",
            "Chagua Add Student / Register Student ili kufungua fomu ya usajili.",
            "Weka admission number kwanza. Hakikisha imeandikwa vizuri na haijatumika kwa mwanafunzi mwingine.",
            "Jaza majina ya mwanafunzi, jinsia, tarehe ya kuzaliwa na tarehe ya kujiunga.",
            "Chagua academic year, darasa na stream sahihi pale fomu inapotoa sehemu hizo.",
            "Jaza taarifa za mzazi/mlezi na taarifa nyingine za lazima za wasifu.",
            "Rekodi mahitaji maalumu ya kujifunza au taarifa za ulemavu tu pale taarifa hizo zimetolewa na zinahusika.",
            "Kagua kila sehemu, hifadhi, kisha mtafute mwanafunzi kuthibitisha wasifu na darasa lake."
        ]),
        workflow: text(["Students", "Add Student", "Student Details", "Class Placement", "Save & Verify"], ["Students", "Add Student", "Taarifa za Mwanafunzi", "Panga Darasa", "Hifadhi & Hakiki"]),
        tips: text([
            "Use the admission number as the main identifier when searching for a learner.",
            "Do not create a second profile because a learner's name is spelled differently; check the existing record first.",
            "Use the Qualified, Unqualified, Leaving, With Disability and Search views only for their intended purpose.",
            "Before promotion or repeat updates, verify the learner's current class and the destination academic year."
        ], [
            "Tumia admission number kama kitambulisho kikuu wakati wa kumtafuta mwanafunzi.",
            "Usitengeneze wasifu wa pili kwa sababu tu tahajia ya jina imetofautiana; kagua rekodi iliyopo kwanza.",
            "Tumia sehemu za Qualified, Unqualified, Leaving, With Disability na Search kwa madhumuni yake.",
            "Kabla ya promotion au repeat update, hakiki darasa la sasa na mwaka wa masomo unaohusika."
        ]),
        note: text("Student records are tenant-scoped. Always verify the school context; never rely on a similar school name.", "Taarifa za wanafunzi hutenganishwa kwa shule. Hakiki shule iliyochaguliwa; usitegemee kufanana kwa majina ya shule.")
    },
    {
        id: "staff", icon: "teachers",
        title: text("Staff and Teacher Management", "Usimamizi wa Wafanyakazi na Walimu"),
        intro: text(
            "Staff Management stores employee profiles and links each person to the responsibilities and system roles they are authorised to perform. Teacher records may also be used for subject and class assignments.",
            "Staff Management huhifadhi wasifu wa wafanyakazi na kuunganisha kila mtu na majukumu pamoja na role alizoidhinishwa kutumia. Taarifa za walimu pia hutumika katika upangaji wa masomo na madarasa."
        ),
        purpose: text("Keep staff records current and give each person only the access needed for their work.", "Kuweka taarifa za wafanyakazi katika hali sahihi na kumpa kila mtu ruhusa zinazohitajika kwa kazi yake tu."),
        steps: text([
            "Open Staff / Teachers and choose Add Staff or the available registration action.",
            "Enter the employee's full name and the contact and employment details requested by the form.",
            "Use the employee's own email address where an email login is required; do not share one login among several people.",
            "Choose the appropriate staff category and assign the role or roles approved by the school administrator.",
            "Save the profile and follow the system's displayed instructions for account creation or credentials.",
            "For a teacher, ask the Academic Master to confirm the subject and class assignment.",
            "Give initial credentials privately and instruct the staff member to keep them confidential."
        ], [
            "Fungua Staff / Teachers na uchague Add Staff au kitendo cha usajili kinachoonekana.",
            "Jaza majina kamili ya mfanyakazi pamoja na mawasiliano na taarifa za ajira zinazoombwa.",
            "Tumia email yake binafsi ikiwa kuingia kunahitaji email; msitumie akaunti moja kwa watu wengi.",
            "Chagua kundi la mfanyakazi na mpe role au roles zilizoidhinishwa na msimamizi wa shule.",
            "Hifadhi wasifu na fuata maelekezo yanayoonyeshwa na mfumo kuhusu kufungua akaunti au credentials.",
            "Kwa mwalimu, mwombe Academic Master athibitishe upangaji wa somo na darasa.",
            "Mkabidhi credentials za mwanzo kwa faragha na umwelekeze azilinde."
        ]),
        workflow: text(["Staff", "Add Staff", "Profile & Contacts", "Assign Role", "Save / Account"], ["Staff", "Add Staff", "Wasifu & Mawasiliano", "Mpe Role", "Hifadhi / Akaunti"]),
        tips: text([
            "Use a separate account for every employee so activity can be traced to the correct person.",
            "Review role assignments when an employee changes position or leaves the school.",
            "A teacher may need a separate subject-and-class assignment before examination tasks become visible."
        ], [
            "Kila mfanyakazi awe na akaunti yake ili shughuli ziweze kufuatiliwa kwa mhusika sahihi.",
            "Kagua role mfanyakazi anapobadilishiwa nafasi au anapoondoka shuleni.",
            "Mwalimu anaweza kuhitaji kupangiwa somo na darasa kabla ya kuona kazi za mitihani."
        ])
    },
    {
        id: "academics", icon: "academics",
        title: text("Academic Years, Classes and Subjects", "Miaka ya Masomo, Madarasa na Masomo"),
        intro: text(
            "Academic setup defines the teaching structure used by the rest of the school system. The academic year, classes and subjects must be configured before dependent activities are started.",
            "Mipangilio ya kitaaluma huweka muundo wa ufundishaji unaotumiwa na sehemu nyingine za mfumo. Mwaka wa masomo, madarasa na masomo viwekwe kabla ya kuanza shughuli zinazovitegemea."
        ),
        purpose: text("Provide a consistent structure for student placement, teacher assignments, timetable and examinations.", "Kuweka muundo unaolingana kwa upangaji wa wanafunzi, walimu, ratiba na mitihani."),
        steps: text([
            "Open Academic Years and review the school year currently marked active.",
            "If a new year is required, create it with the correct start and end dates and activate it according to school procedure.",
            "Open Classes and create or review the classes and streams used by the school.",
            "Open Subjects and confirm that each subject is active and available for the correct education level and class.",
            "Check whether subjects or classes have been activated for the current school year before assigning learners or teachers.",
            "Return to the student and teacher records to confirm that the academic structure is available."
        ], [
            "Fungua Academic Years na kagua mwaka wa masomo uliooneshwa kuwa active.",
            "Ikiwa mwaka mpya unahitajika, uunde kwa tarehe sahihi za kuanza na kumaliza kisha uuweke active kwa utaratibu wa shule.",
            "Fungua Classes na tengeneza au kagua madarasa na streams zinazotumiwa na shule.",
            "Fungua Subjects na hakikisha kila somo liko active na linapatikana kwa ngazi ya elimu na darasa husika.",
            "Kabla ya kupanga wanafunzi au walimu, hakiki kuwa madarasa na masomo yamewezeshwa kwa mwaka husika.",
            "Rudi kwenye taarifa za wanafunzi na walimu kuthibitisha kuwa muundo wa kitaaluma unapatikana."
        ]),
        workflow: text(["Academic Year", "Classes", "Subjects", "Activate / Review", "Use in School"], ["Academic Year", "Classes", "Subjects", "Washa / Kagua", "Tumia Shuleni"]),
        tips: text([
            "A missing active academic year can prevent class creation or fee and examination setup.",
            "Do not create duplicate classes or subjects to work around a configuration problem.",
            "Check the education level and class structure before configuring assessments."
        ], [
            "Kukosekana kwa active academic year kunaweza kuzuia kuunda madarasa au kuweka ada na mitihani.",
            "Usitengeneze darasa au somo la pili ili kukwepa tatizo la mipangilio.",
            "Kagua ngazi ya elimu na muundo wa darasa kabla ya kuweka tathmini."
        ])
    },
    {
        id: "assignments", icon: "timetable",
        title: text("Teacher Assignments and Timetable", "Teacher Assignments na Ratiba"),
        intro: text(
            "Teacher Assignments links a teacher to the subject and class they teach. Timetable and period tools organise when lessons and assigned duties take place.",
            "Teacher Assignments humunganisha mwalimu na somo pamoja na darasa analofundisha. Zana za Timetable na Periods hupanga muda wa vipindi na majukumu yaliyopangwa."
        ),
        purpose: text("Make sure teachers see the correct classes and subjects and that school schedules are organised.", "Kuhakikisha walimu wanaona madarasa na masomo sahihi na ratiba za shule zimepangwa."),
        steps: text([
            "Open Teacher Assignment and select the correct academic year.",
            "Choose the teacher, class and subject combination that the teacher is responsible for.",
            "Review the selection carefully and save the assignment.",
            "If the teacher handles more than one class or subject, create each valid assignment separately.",
            "Open Timetable and Periods to review the available periods and schedule.",
            "Check the published timetable for clashes and confirm that the right teacher, class and subject appear together."
        ], [
            "Fungua Teacher Assignment na uchague academic year sahihi.",
            "Chagua mwalimu, darasa na somo analopaswa kufundisha.",
            "Kagua uchaguzi kwa makini na hifadhi assignment.",
            "Ikiwa mwalimu anafundisha madarasa au masomo zaidi ya moja, tengeneza kila assignment inayohusika kivyake.",
            "Fungua Timetable na Periods kukagua vipindi na ratiba zilizopo.",
            "Kagua ratiba ili kubaini migongano na kuthibitisha mwalimu, darasa na somo vimeunganishwa sawasawa."
        ]),
        workflow: text(["Select Year", "Choose Teacher", "Choose Class + Subject", "Save Assignment", "Review Timetable"], ["Chagua Mwaka", "Chagua Mwalimu", "Chagua Darasa + Somo", "Hifadhi Assignment", "Kagua Ratiba"]),
        tips: text([
            "If a teacher cannot see a subject in examination screens, first verify the assignment rather than creating a duplicate exam.",
            "Check for timetable clashes before publishing a schedule."
        ], [
            "Mwalimu asipoona somo kwenye sehemu ya mitihani, kagua assignment kwanza badala ya kuunda mtihani mwingine.",
            "Kagua migongano ya vipindi kabla ya kuchapisha ratiba."
        ])
    },
    {
        id: "exams", icon: "exams",
        title: text("Examinations, AI Analysis, Approval and Results", "Mitihani, AI Analysis, Approval na Matokeo"),
        intro: text(
            "The examination workflow takes an assessment from setup through paper review, approval, mark entry and result analysis. The subject teacher, academic reviewers and authorised school leaders each complete their part of the process.",
            "Mchakato wa mitihani huanzia kwenye mipangilio ya mtihani, ukaguzi wa karatasi, uidhinishaji, uingizaji wa alama hadi uchambuzi wa matokeo. Mwalimu wa somo, wakaguzi wa kitaaluma na viongozi walioidhinishwa hukamilisha hatua zao."
        ),
        purpose: text("Maintain a traceable examination process and accurate results for the correct class, subject and year.", "Kuweka mchakato wa mtihani unaofuatilika na matokeo sahihi kwa darasa, somo na mwaka unaohusika."),
        steps: text([
            "Create the exam and enter its title, type, term, academic year, class, subject, dates and marks structure where requested.",
            "Upload the correct examination paper in the supported file format.",
            "Run AI Analysis if available to extract or classify questions, topics, difficulty and marks.",
            "Compare every AI-generated item with the actual paper. Correct question text, marks and structure before submitting.",
            "Submit the paper through the configured approval chain and monitor its status. If it is returned, read the reason, correct the paper and resubmit.",
            "After approval, open Enter Marks for the same examination, class, subject and academic year.",
            "Enter each learner's marks within the maximum allowed for the question or assessment component. Save and review the marks preview.",
            "Open Results Analysis and verify totals, grades, pass/fail and class summaries against the approved marking scheme.",
            "Publish or release results only after the required checks and approvals. Confirm that released results are visible through the intended parent/student channel."
        ], [
            "Unda mtihani na jaza jina, aina, term, academic year, darasa, somo, tarehe na muundo wa alama pale vinapoombwa.",
            "Pakia karatasi sahihi ya mtihani kwa aina ya faili inayokubaliwa.",
            "Endesha AI Analysis ikiwa inapatikana ili kusaidia kutoa au kupanga maswali, mada, ugumu na alama.",
            "Linganisha kila kipengele kilichotolewa na AI na karatasi halisi. Sahihisha swali, alama na muundo kabla ya kuwasilisha.",
            "Wasilisha karatasi kwenye mlolongo wa approval uliowekwa na fuatilia hali yake. Ikirudishwa, soma sababu, rekebisha na wasilisha tena.",
            "Baada ya approval, fungua Enter Marks kwa mtihani, darasa, somo na mwaka uleule.",
            "Ingiza alama za kila mwanafunzi bila kuzidi kiwango cha juu cha swali au sehemu ya tathmini. Hifadhi na kagua preview.",
            "Fungua Results Analysis na hakiki jumla, madaraja, pass/fail na muhtasari wa darasa kwa kulinganisha na marking scheme iliyoidhinishwa.",
            "Chapisha au release matokeo baada ya ukaguzi na approval zinazohitajika. Thibitisha kuwa matokeo yameonekana kwenye njia iliyokusudiwa ya mzazi/mwanafunzi."
        ]),
        workflow: text(["Create Exam", "Upload Paper", "AI Review", "Approval", "Enter Marks", "Analyse & Publish"], ["Create Exam", "Pakia Paper", "Kagua AI", "Approval", "Enter Marks", "Chambua & Chapisha"]),
        tips: text([
            "AI output is an assistant, not the final authority. The teacher must verify it against the original paper.",
            "A blank mark is not automatically the same as a genuine zero mark. Follow the assessment entry rules.",
            "Do not enter marks against the wrong examination, class, subject or academic year.",
            "Keep the approved paper and marking scheme available when checking result calculations."
        ], [
            "Matokeo ya AI ni msaada, si mamlaka ya mwisho. Mwalimu lazima ayalinganishe na paper halisi.",
            "Alama iliyoachwa wazi si lazima iwe sawa na sifuri halisi. Fuata kanuni za uingizaji wa alama.",
            "Usiingize alama kwenye mtihani, darasa, somo au mwaka usio sahihi.",
            "Hifadhi paper na marking scheme iliyoidhinishwa wakati wa kukagua hesabu za matokeo."
        ]),
        note: text("Approval stages and mark-entry availability depend on the configured workflow and the user's permissions.", "Hatua za approval na ruhusa ya kuingiza alama hutegemea mchakato uliowekwa na ruhusa za mtumiaji.")
    },
    {
        id: "finance", icon: "finance",
        title: text("Finance: Fees, Payments and Accounting", "Finance: Ada, Malipo na Uhasibu"),
        intro: text(
            "Finance records school charges, payments and financial activity. The Accountant should verify the school, academic year, fee item and accounts before saving any transaction.",
            "Finance huhifadhi ada, malipo na shughuli za kifedha za shule. Accountant anapaswa kuthibitisha shule, mwaka wa masomo, aina ya ada na akaunti kabla ya kuhifadhi muamala."
        ),
        purpose: text("Keep student balances and school financial records accurate and auditable.", "Kuweka salio la mwanafunzi na kumbukumbu za fedha za shule katika hali sahihi na zinazoweza kukaguliwa."),
        steps: text([
            "Chart of Accounts: review the account structure and confirm the correct revenue, expense, asset and liability accounts.",
            "Bank/Cash: use an active, postable Asset account that permits manual posting for bank or cash transactions. Do not use Student Receivables as a bank/cash account.",
            "Payment Setup: choose the academic year, fee item, class or applicable group, amount and the correct revenue account. Confirm the fee item is active before saving.",
            "After saving a fee setup, inspect a learner's statement or outstanding balance to confirm the charge was applied to the intended learners.",
            "Record Payment: find the learner using the correct admission number, verify identity and year, enter the amount, payment date, method and reference, then select the correct receiving account.",
            "Save the payment and verify the receipt, payment history and updated outstanding balance.",
            "For expenses, payables or receivables, enter the correct date, amount, account and explanation and retain supporting evidence.",
            "Use General Ledger, statements and collection reports to reconcile balances and investigate differences.",
            "For a correction, identify the original transaction, document the reason and use the authorised correction process. Never silently delete a receipt or change a balance without an audit trail."
        ], [
            "Chart of Accounts: kagua muundo wa akaunti na uthibitishe akaunti sahihi za mapato, matumizi, mali na madeni.",
            "Bank/Cash: tumia Asset account iliyo active, postable na inayoruhusu manual posting kwa miamala ya benki au fedha taslimu. Usitumie Student Receivables kama akaunti ya benki/fedha.",
            "Payment Setup: chagua academic year, fee item, darasa au kundi husika, kiasi na revenue account sahihi. Hakikisha fee item iko active kabla ya kuhifadhi.",
            "Baada ya kuhifadhi fee setup, kagua statement au outstanding balance ya mwanafunzi kuthibitisha ada imewekwa kwa wanafunzi waliokusudiwa.",
            "Record Payment: mtafute mwanafunzi kwa admission number sahihi, thibitisha utambulisho na mwaka, jaza kiasi, tarehe, njia na reference, kisha chagua akaunti iliyopokea fedha.",
            "Hifadhi malipo na hakiki risiti, historia ya malipo na outstanding balance iliyosasishwa.",
            "Kwa expenses, payables au receivables, jaza tarehe, kiasi, akaunti na maelezo sahihi na hifadhi ushahidi.",
            "Tumia General Ledger, statements na collection reports kusawazisha salio na kuchunguza tofauti.",
            "Kwa correction, tambua muamala wa awali, andika sababu na tumia utaratibu ulioidhinishwa. Usifute risiti au kubadilisha salio kimyakimya bila audit trail."
        ]),
        workflow: text(["Chart of Accounts", "Payment Setup", "Record Payment", "Receipt", "Reconcile"], ["Chart of Accounts", "Payment Setup", "Record Payment", "Risiti", "Linganisha Salio"]),
        tips: text([
            "A fee item must be active and linked to the appropriate revenue account.",
            "Use school-specific accounts; do not select an account simply because its name looks similar.",
            "A sponsor assignment is not proof that money has been received. Record the actual payment in Finance.",
            "Review the student statement and Parent Portal after fee setup or correction."
        ], [
            "Fee item lazima iwe active na iunganishwe na revenue account inayofaa.",
            "Tumia akaunti za shule husika; usichague akaunti kwa sababu jina linafanana tu.",
            "Kumpangia mwanafunzi mfadhili si uthibitisho kuwa fedha zimepokelewa. Rekodi malipo halisi kwenye Finance.",
            "Kagua student statement na Parent Portal baada ya fee setup au correction."
        ]),
        note: text("Financial corrections affect official records. Use the approved correction centre or authorised adjustment workflow and retain the reason and evidence.", "Marekebisho ya fedha yanaathiri kumbukumbu rasmi. Tumia correction centre au utaratibu wa adjustment ulioidhinishwa na hifadhi sababu pamoja na ushahidi.")
    },
    {
        id: "parent", icon: "parents",
        title: text("Parent Portal", "Parent Portal"),
        intro: text(
            "The Parent Portal gives a parent or guardian access to the information the school has released for their learner. Parents should use only the account and school selection issued by the school.",
            "Parent Portal humpa mzazi au mlezi uwezo wa kuona taarifa ambazo shule imeruhusu kwa mwanafunzi wake. Mzazi atumie akaunti na uchaguzi wa shule aliopewa na shule."
        ),
        purpose: text("Give families a secure channel for school progress, finance and communication.", "Kuipa familia njia salama ya kufuatilia maendeleo, fedha na mawasiliano ya shule."),
        steps: text([
            "Open the Parent Portal address provided by the school.",
            "Select the correct school and choose the Parent login option when prompted.",
            "Enter the learner or parent credentials supplied by the school.",
            "If more than one learner is linked to the account, select the learner whose information you need.",
            "Open the available sections to review released results, attendance, fee information, notices and communication.",
            "If access fails, contact the school office to verify the account and request credential assistance. Never post your password in a group."
        ], [
            "Fungua anwani ya Parent Portal uliyopewa na shule.",
            "Chagua shule sahihi na uchague Parent login pale mfumo unapouliza.",
            "Weka credentials za mwanafunzi au mzazi ulizopewa na shule.",
            "Ikiwa akaunti imeunganishwa na wanafunzi zaidi ya mmoja, chagua mwanafunzi ambaye taarifa zake unahitaji.",
            "Fungua sehemu zinazopatikana kuona matokeo yaliyotolewa, mahudhurio, ada, matangazo na mawasiliano.",
            "Ikiwa huwezi kuingia, wasiliana na ofisi ya shule kuthibitisha akaunti na kuomba msaada wa credentials. Usitume password kwenye group."
        ]),
        workflow: text(["Open Portal", "Choose School", "Parent Login", "Select Learner", "View Information"], ["Fungua Portal", "Chagua Shule", "Parent Login", "Chagua Mwanafunzi", "Angalia Taarifa"]),
        tips: text([
            "Only results that have been released should be treated as official results.",
            "If a balance looks incorrect, contact the Accountant and provide the learner's admission number; do not share account passwords.",
            "A parent account should only show learners linked to that parent."
        ], [
            "Matokeo yaliyochapishwa/released pekee ndiyo yachukuliwe kuwa matokeo rasmi.",
            "Salio likionekana si sahihi, wasiliana na Accountant na toa admission number ya mwanafunzi; usitoe password ya akaunti.",
            "Akaunti ya mzazi inapaswa kuonyesha wanafunzi waliounganishwa na mzazi huyo pekee."
        ])
    },
    {
        id: "sponsor", icon: "sponsors",
        title: text("Sponsor Centres and Sponsor Portal", "Sponsor Centres na Sponsor Portal"),
        intro: text(
            "Sponsor management helps the school organise sponsor organisations or centres and link them to the learners they support. Sponsor access is limited to the learners assigned to that sponsor.",
            "Usimamizi wa wafadhili huisaidia shule kupanga taasisi au vituo vya wafadhili na kuwaunganisha na wanafunzi wanaowasaidia. Sponsor huona wanafunzi waliopangiwa kwake pekee."
        ),
        purpose: text("Give sponsors an appropriate view of assigned learners while keeping school records protected.", "Kumpa mfadhili mwonekano unaofaa wa wanafunzi aliopangiwa huku taarifa za shule zikilindwa."),
        steps: text([
            "Open Parent Portal Management and go to Sponsor Centres.",
            "Create a sponsor centre and enter the centre name, sponsor name, supervisor and available contact details.",
            "Save the centre, open its details and use the student assignment action to select the supported learners.",
            "Review the assigned learner list before saving.",
            "Create or activate the sponsor login using the options available to the authorised administrator.",
            "Share the username and temporary credentials privately with the supervisor.",
            "The sponsor opens Parent Portal, selects the school and Sponsor login mode, then signs in.",
            "The sponsor selects a learner from the assigned list and views only the information permitted by the portal."
        ], [
            "Fungua Parent Portal Management kisha uende Sponsor Centres.",
            "Tengeneza sponsor centre na ujaze jina la centre, jina la sponsor, supervisor na mawasiliano yanayopatikana.",
            "Hifadhi centre, fungua maelezo yake na tumia kitendo cha kuwapangia wanafunzi wanaosaidiwa.",
            "Kagua orodha ya wanafunzi waliopangiwa kabla ya kuhifadhi.",
            "Tengeneza au activate sponsor login kwa kutumia chaguo zilizopo kwa msimamizi aliyeidhinishwa.",
            "Mkabidhi supervisor username na credentials za muda kwa njia ya faragha.",
            "Sponsor afungue Parent Portal, achague shule na Sponsor login mode, kisha aingie.",
            "Sponsor achague mwanafunzi kwenye orodha aliyopangiwa na kuona taarifa zinazoruhusiwa tu."
        ]),
        workflow: text(["Sponsor Centres", "Create Centre", "Assign Learners", "Create Login", "Sponsor Portal"], ["Sponsor Centres", "Tengeneza Centre", "Pangia Wanafunzi", "Fungua Login", "Sponsor Portal"]),
        tips: text([
            "Use View to inspect the sponsor centre and its assigned learners.",
            "Use Resend Credentials when available if access details are lost; the process may issue a new password.",
            "Assigning a learner to a sponsor does not record a fee payment. The Accountant records money actually received.",
            "Check the supervisor's phone number before resending credentials."
        ], [
            "Tumia View kukagua sponsor centre na wanafunzi waliopangiwa.",
            "Tumia Resend Credentials inapopatikana ikiwa taarifa za kuingia zimepotea; mchakato unaweza kutoa password mpya.",
            "Kumpangia mfadhili mwanafunzi hakurekodi malipo ya ada. Accountant ndiye anayerekodi fedha zilizopokelewa.",
            "Kagua namba ya simu ya supervisor kabla ya kutuma credentials tena."
        ])
    },
    {
        id: "communication", icon: "communication",
        title: text("Communication and Parent Portal Management", "Mawasiliano na Parent Portal Management"),
        intro: text(
            "Communication tools support authorised messaging, announcements, notifications, meetings and parent-facing services. Parent Portal Management is also used to maintain parent and sponsor access where those functions are enabled.",
            "Zana za Communication husaidia ujumbe, matangazo, notifications, mikutano na huduma za wazazi kwa watumiaji walioidhinishwa. Parent Portal Management pia hutumika kusimamia upatikanaji wa wazazi na wafadhili pale huduma hizo zimewezeshwa."
        ),
        purpose: text("Send relevant information to the correct audience and maintain appropriate access to conversations.", "Kutuma taarifa zinazohusika kwa walengwa sahihi na kulinda ruhusa za mazungumzo."),
        steps: text([
            "Open Communication and choose the available function, such as chat, announcements, notifications, meetings or feedback.",
            "Confirm the intended audience, class or recipient before composing a message.",
            "Write a clear message and review the school name, learner details and attachments.",
            "Send or publish using the available action and check the resulting status.",
            "For parent access issues, open Parent Portal Management and locate the correct parent or learner record.",
            "Use the credential resend function only after verifying the recipient's contact details.",
            "Keep group membership restricted to the people who are meant to participate."
        ], [
            "Fungua Communication na uchague huduma inayopatikana kama chat, announcements, notifications, meetings au feedback.",
            "Thibitisha walengwa, darasa au mpokeaji kabla ya kuandika ujumbe.",
            "Andika ujumbe ulio wazi na kagua jina la shule, taarifa za mwanafunzi na viambatisho.",
            "Tuma au chapisha kwa kutumia kitendo kilichopo na kagua hali ya ujumbe.",
            "Kwa tatizo la parent access, fungua Parent Portal Management na tafuta rekodi sahihi ya mzazi au mwanafunzi.",
            "Tumia resend credentials baada tu ya kuthibitisha mawasiliano ya mpokeaji.",
            "Washiriki wa group wabaki wale tu wanaopaswa kushiriki."
        ]),
        workflow: text(["Choose Channel", "Verify Audience", "Prepare Message", "Send / Publish", "Check Status"], ["Chagua Njia", "Thibitisha Walengwa", "Andaa Ujumbe", "Tuma / Chapisha", "Kagua Hali"]),
        tips: text([
            "Do not send staff-only information to parent groups.",
            "Check whether a WhatsApp action opens a prefilled message that still requires the sender to press Send.",
            "Use the school identity in school communications and check delivery reports where available."
        ], [
            "Usitume taarifa za wafanyakazi kwenye group za wazazi.",
            "Kagua kama kitendo cha WhatsApp kinafungua ujumbe ulioandaliwa ambao bado unahitaji mtumaji kubonyeza Send.",
            "Tumia utambulisho wa shule kwenye mawasiliano na kagua delivery reports pale zinapopatikana."
        ])
    },
    {
        id: "welfare", icon: "welfare",
        title: text("Patron / Matron and Student Welfare", "Patron / Matron na Ustawi wa Wanafunzi"),
        intro: text(
            "Patron and Matron functions support boarding attendance and the recording of student welfare incidents. Entries should be factual, timely and visible only to authorised people.",
            "Huduma za Patron na Matron husaidia kurekodi mahudhurio ya bweni na matukio yanayohusu ustawi wa wanafunzi. Rekodi ziwe za ukweli, zifanywe kwa wakati na zionekane kwa watu walioidhinishwa pekee."
        ),
        purpose: text("Maintain a reliable record of boarding attendance and welfare follow-up.", "Kuweka kumbukumbu za kuaminika za mahudhurio ya bweni na ufuatiliaji wa ustawi."),
        steps: text([
            "Open Patron/Matron or the relevant welfare dashboard.",
            "For boarding attendance, select the date and the applicable session, such as Morning, Evening or Night.",
            "Review the correct boarding student list and set the appropriate status for each learner, such as Present, Absent, Late or Excused where offered.",
            "Check for learners without a status, save the attendance and review the session report.",
            "For an incident, select the learner, date and the category that best describes what happened.",
            "Write a factual description, record the action taken and update the incident status using the available fields.",
            "Escalate serious matters to the responsible school leader and follow the school's safeguarding procedure."
        ], [
            "Fungua Patron/Matron au dashboard husika ya ustawi.",
            "Kwa boarding attendance, chagua tarehe na session husika kama Morning, Evening au Night.",
            "Kagua orodha sahihi ya wanafunzi wa bweni na weka status ya kila mwanafunzi kama Present, Absent, Late au Excused pale zinapotolewa.",
            "Kagua wanafunzi ambao hawajawekewa status, hifadhi mahudhurio na kagua ripoti ya session.",
            "Kwa tukio, chagua mwanafunzi, tarehe na category inayoeleza vizuri kilichotokea.",
            "Andika maelezo ya ukweli, rekodi hatua iliyochukuliwa na sasisha hali ya tukio kwa kutumia sehemu zilizopo.",
            "Peleka matukio makubwa kwa kiongozi wa shule anayehusika na fuata utaratibu wa ulinzi wa wanafunzi."
        ]),
        workflow: text(["Select Session", "Mark Attendance", "Save Record", "Record Incident", "Follow Up"], ["Chagua Session", "Weka Mahudhurio", "Hifadhi", "Rekodi Tukio", "Fuatilia"]),
        tips: text([
            "Do not write assumptions or insulting language in an incident record.",
            "Health, discipline and safeguarding information is sensitive; share it only with authorised staff."
        ], [
            "Usiandike hisia au lugha ya kudhalilisha kwenye rekodi ya tukio.",
            "Taarifa za afya, nidhamu na ulinzi wa mwanafunzi ni nyeti; zishirikishwe na wafanyakazi walioidhinishwa pekee."
        ])
    },
    {
        id: "reports", icon: "reports",
        title: text("Dashboards and Reports", "Dashboards na Ripoti"),
        intro: text(
            "Dashboards and reports summarise information from the modules available to the user's role. A report is only meaningful when the filters, school and academic period are correct.",
            "Dashboards na ripoti huweka muhtasari wa taarifa kutoka kwenye moduli zinazopatikana kwa role ya mtumiaji. Ripoti ina maana pale filters, shule na kipindi cha masomo vimechaguliwa kwa usahihi."
        ),
        purpose: text("Support school monitoring and decisions using current, correctly filtered information.", "Kusaidia ufuatiliaji na maamuzi ya shule kwa kutumia taarifa za sasa zilizochujwa kwa usahihi."),
        steps: text([
            "Open the dashboard or Reports module available to your role.",
            "Select the correct academic year, term, class or date range where filters are provided.",
            "Review the summary cards and open the detailed report behind a figure when available.",
            "Compare totals with the source module, such as student records, attendance or Finance.",
            "Export or print only when the report is needed and you are authorised to handle its data."
        ], [
            "Fungua dashboard au Reports inayopatikana kwa role yako.",
            "Chagua academic year, term, darasa au tarehe sahihi pale filters zinapotolewa.",
            "Kagua summary cards na fungua ripoti ya kina inayohusiana na namba husika inapopatikana.",
            "Linganisha jumla na chanzo chake kama student records, attendance au Finance.",
            "Export au print pale ripoti inapohitajika na umeidhinishwa kushughulikia taarifa zake."
        ]),
        workflow: text(["Open Dashboard", "Set Filters", "Review Summary", "Open Detail", "Export / Print"], ["Fungua Dashboard", "Weka Filters", "Kagua Muhtasari", "Fungua Maelezo", "Export / Print"]),
        tips: text([
            "A blank or zero figure may mean no data has been recorded for the selected period; verify the source module.",
            "Do not compare reports from different academic years without accounting for the selected filters."
        ], [
            "Namba tupu au sifuri inaweza kumaanisha hakuna taarifa iliyorekodiwa kwa kipindi kilichochaguliwa; hakiki chanzo chake.",
            "Usilinganishe ripoti za miaka tofauti bila kuzingatia filters zilizochaguliwa."
        ])
    },
    {
        id: "settings", icon: "settings",
        title: text("Settings, Roles and School Security", "Settings, Roles na Usalama wa Shule"),
        intro: text(
            "Settings and administrative controls determine how the school account operates. Changes should be made only by users with the required permission and after checking the impact on other modules.",
            "Settings na udhibiti wa kiutawala huamua namna akaunti ya shule inavyofanya kazi. Mabadiliko yafanywe na watumiaji wenye ruhusa tu baada ya kukagua athari zake kwenye moduli nyingine."
        ),
        purpose: text("Protect school data and keep configuration consistent across the system.", "Kulinda taarifa za shule na kuweka mipangilio inayolingana kwenye mfumo."),
        steps: text([
            "Open the relevant settings page available to your role.",
            "Confirm which school and configuration area you are changing.",
            "Read the current values before editing and change only the fields required for the approved task.",
            "Save once, then verify the effect in the module that uses the setting.",
            "For access problems, ask the system administrator to review the user's role and permissions instead of sharing another user's login.",
            "Sign out after using a shared computer and report unexpected access to the administrator."
        ], [
            "Fungua ukurasa wa settings unaopatikana kwa role yako.",
            "Thibitisha shule na eneo la mipangilio unalotaka kubadilisha.",
            "Soma thamani zilizopo kabla ya kuhariri na badilisha sehemu zinazohitajika kwa kazi iliyoidhinishwa tu.",
            "Hifadhi mara moja, kisha hakiki athari yake kwenye moduli inayotumia mpangilio huo.",
            "Kwa tatizo la ruhusa, mwombe msimamizi akague role na permissions badala ya kutumia login ya mtu mwingine.",
            "Toka kwenye akaunti baada ya kutumia kompyuta ya pamoja na ripoti access isiyo ya kawaida."
        ]),
        workflow: text(["Check Permission", "Open Setting", "Review Value", "Save Change", "Verify Effect"], ["Kagua Ruhusa", "Fungua Setting", "Kagua Thamani", "Hifadhi", "Hakiki Athari"]),
        tips: text([
            "Do not share passwords, API keys or payment-provider secrets in manuals, screenshots or group messages.",
            "A user with multiple roles should select the role that matches the task before working."
        ], [
            "Usishirikishe password, API key au siri za payment provider kwenye manual, screenshot au group.",
            "Mtumiaji mwenye roles nyingi achague role inayolingana na kazi kabla ya kuendelea."
        ])
    }
];

const roleGuides = [
    {
        icon: "head", title: text("Headmaster", "Headmaster"),
        scope: text("School oversight, approvals and monitoring.", "Usimamizi wa shule, approvals na ufuatiliaji."),
        tasks: text([
            "Review the school dashboard and follow up unusual figures.",
            "Review and decide on examination or administrative approvals assigned to the role.",
            "Monitor student, staff, attendance and school performance information.",
            "Coordinate with the Accountant on financial reports; do not bypass the finance audit process."
        ], [
            "Kagua dashboard ya shule na fuatilia takwimu zisizo za kawaida.",
            "Kagua na kutoa uamuzi kwenye approvals za mitihani au shughuli za kiutawala ulizopangiwa.",
            "Fuatilia taarifa za wanafunzi, staff, mahudhurio na utendaji wa shule.",
            "Shirikiana na Accountant kwenye ripoti za fedha; usipite utaratibu wa ukaguzi wa fedha."
        ])
    },
    {
        icon: "finance", title: text("Accountant", "Accountant"),
        scope: text("Fees, receipts, accounts and financial reconciliation.", "Ada, risiti, akaunti na usawazishaji wa fedha."),
        tasks: text([
            "Maintain the chart of accounts and school bank/cash account links.",
            "Configure fee items and revenue accounts for the correct academic year.",
            "Record payments and issue receipts; verify the learner's balance after saving.",
            "Review expenses, payables, receivables, ledger and statements.",
            "Process corrections through the authorised correction workflow with a reason and supporting evidence."
        ], [
            "Simamia Chart of Accounts na viunganishi vya akaunti za benki/fedha za shule.",
            "Weka fee items na revenue accounts kwa academic year sahihi.",
            "Rekodi malipo na toa risiti; hakiki salio la mwanafunzi baada ya kuhifadhi.",
            "Kagua expenses, payables, receivables, ledger na statements.",
            "Fanya corrections kupitia utaratibu ulioidhinishwa ukiweka sababu na ushahidi."
        ])
    },
    {
        icon: "academic", title: text("Academic Master", "Academic Master"),
        scope: text("Academic structure, teacher assignments and examination coordination.", "Muundo wa kitaaluma, teacher assignments na uratibu wa mitihani."),
        tasks: text([
            "Confirm the active academic year, classes and subjects.",
            "Assign teachers to the correct class and subject combinations.",
            "Coordinate timetable and academic planning where permitted.",
            "Monitor examination preparation, approval progress and result readiness."
        ], [
            "Thibitisha active academic year, madarasa na masomo.",
            "Pangia walimu madarasa na masomo sahihi.",
            "Simamia ratiba na mipango ya kitaaluma pale ruhusa inapokuwepo.",
            "Fuatilia maandalizi ya mitihani, approval na utayari wa matokeo."
        ])
    },
    {
        icon: "teacher", title: text("Subject Teacher", "Subject Teacher"),
        scope: text("Assigned subject examinations, paper review and marks.", "Mitihani ya somo alilopangiwa, ukaguzi wa paper na alama."),
        tasks: text([
            "Confirm the assigned class and subject are visible.",
            "Create the examination and upload the correct paper.",
            "Review AI analysis and submit the paper through approval.",
            "Enter marks only for the approved examination and verify the result analysis."
        ], [
            "Thibitisha darasa na somo ulilopangiwa vinaonekana.",
            "Unda mtihani na pakia paper sahihi.",
            "Kagua AI Analysis na wasilisha paper kwenye approval.",
            "Ingiza alama kwa mtihani ulioidhinishwa tu na hakiki result analysis."
        ])
    },
    {
        icon: "secretary", title: text("Secretary", "Secretary"),
        scope: text("Office administration and authorised communication.", "Shughuli za ofisi na mawasiliano yaliyoidhinishwa."),
        tasks: text([
            "Use the office and communication functions made available to the account.",
            "Prepare or distribute approved notices and documents.",
            "Refer financial transactions to the Accountant and academic decisions to the responsible academic leader.",
            "Protect personal and student information."
        ], [
            "Tumia huduma za ofisi na mawasiliano zilizowezeshwa kwenye akaunti.",
            "Andaa au sambaza matangazo na nyaraka zilizoidhinishwa.",
            "Elekeza miamala ya fedha kwa Accountant na maamuzi ya kitaaluma kwa kiongozi wa taaluma.",
            "Linda taarifa binafsi na za wanafunzi."
        ])
    },
    {
        icon: "welfare", title: text("Patron / Matron", "Patron / Matron"),
        scope: text("Boarding attendance and learner welfare records.", "Mahudhurio ya bweni na kumbukumbu za ustawi wa wanafunzi."),
        tasks: text([
            "Record boarding attendance for the applicable session.",
            "Document welfare incidents factually and follow up actions.",
            "Escalate serious incidents through the school's safeguarding process."
        ], [
            "Rekodi mahudhurio ya bweni kwa session husika.",
            "Andika matukio ya ustawi kwa ukweli na fuatilia hatua zilizochukuliwa.",
            "Peleka matukio makubwa kupitia utaratibu wa ulinzi wa wanafunzi wa shule."
        ])
    },
    {
        icon: "parent", title: text("Parent", "Mzazi"),
        scope: text("View released information for linked learner(s).", "Kuona taarifa zilizotolewa kwa mwanafunzi/wanafunzi waliohusishwa."),
        tasks: text([
            "Sign in through Parent Portal using school-issued credentials.",
            "Select the correct learner and review released results, fees, attendance and notices.",
            "Contact the school through the approved channel if a record appears incorrect."
        ], [
            "Ingia Parent Portal kwa credentials ulizopewa na shule.",
            "Chagua mwanafunzi sahihi na kagua matokeo, ada, mahudhurio na matangazo yaliyotolewa.",
            "Wasiliana na shule kupitia njia iliyoidhinishwa ikiwa taarifa inaonekana si sahihi."
        ])
    },
    {
        icon: "sponsor", title: text("Sponsor", "Mfadhili"),
        scope: text("View learners assigned to the sponsor centre.", "Kuona wanafunzi waliopangiwa sponsor centre."),
        tasks: text([
            "Sign in using Sponsor login mode.",
            "Select a learner from the assigned list.",
            "Review the information made available to the sponsor and contact the school for clarification."
        ], [
            "Ingia kwa kutumia Sponsor login mode.",
            "Chagua mwanafunzi kwenye orodha ya waliopangiwa.",
            "Kagua taarifa zilizoidhinishwa kwa mfadhili na wasiliana na shule kwa ufafanuzi."
        ])
    }
];

const iconMap = {
    students: FaUsers, teachers: FaChalkboardTeacher, academics: FaGraduationCap,
    timetable: FaCalendarAlt, exams: FaClipboardCheck, finance: FaMoneyBillWave,
    communication: FaComments, reports: FaChartLine, welfare: FaShieldAlt,
    settings: FaCog, parents: FaUserFriends, sponsors: FaUniversity,
    head: FaUserTie, academic: FaGraduationCap, teacher: FaChalkboardTeacher,
    secretary: FaFileAlt, parent: FaUsers, sponsor: FaUniversity
};

function WorkflowDiagram({ steps, language }) {
    return (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-slate-50 to-blue-50 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-blue-800">
                <FaProjectDiagramFallback />
                {language === "en" ? "Illustrated workflow" : "Mtiririko kwa vielelezo"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {steps.map((step, index) => (
                    <React.Fragment key={step + index}>
                        <div className="flex min-h-[58px] min-w-[112px] flex-1 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-3 text-center text-xs font-bold leading-5 text-slate-700 shadow-sm">
                            <span className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[10px] text-white">{index + 1}</span>
                            {step}
                        </div>
                        {index < steps.length - 1 && <span className="hidden text-lg font-black text-blue-500 sm:inline">→</span>}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

function FaProjectDiagramFallback() {
    return <FaBookOpen className="text-blue-700" />;
}

function BulletList({ items }) {
    return (
        <ul className="mt-3 space-y-2">
            {items.map((item, index) => (
                <li key={index} className="flex gap-3 text-sm leading-6 text-slate-600">
                    <FaCheckCircle className="mt-1 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

export default function SystemManual() {
    const navigate = useNavigate();
    const [language, setLanguage] = useState("en");
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("modules");
    const lang = language;
    const isSw = lang === "sw";
    const copy = isSw ? {
        back: "Rudi Landing Page", title: "Mwongozo Kamili wa AfriCore ERP PRO",
        subtitle: "Mwongozo wa hatua kwa hatua wa kutumia moduli za mfumo, kuelewa majukumu na kufanya kazi kwa usahihi.",
        introTitle: "Kabla ya kuanza", intro: "Ingia kwa akaunti yako iliyoidhinishwa. Menyu unazoona hutegemea role, permissions na shule uliyounganishwa nayo. Hakikisha shule na academic year ni sahihi kabla ya kuhifadhi taarifa.",
        modules: "Moduli za Mfumo", roles: "Mwongozo kwa Kila Role", exam: "Mtiririko wa Mtihani", search: "Tafuta moduli, jukumu au hatua...",
        purpose: "Lengo la moduli", steps: "Hatua za matumizi", workflow: "Mchoro wa mtiririko", tips: "Vidokezo vya matumizi", note: "Tahadhari muhimu",
        accessTitle: "Majukumu na ruhusa", access: "Mfumo hutumia role-based access. Si kila mtumiaji anaweza kuona kila sehemu au kufanya kila kitendo. Ikiwa menyu haionekani, mwombe msimamizi akague role na ruhusa zako.",
        goodTitle: "Kanuni za usalama na matumizi bora", good: [
            "Tumia akaunti yako mwenyewe; usishirikiane password na mtu mwingine.",
            "Thibitisha shule, academic year, mwanafunzi, darasa na somo kabla ya kuhifadhi.",
            "Usirudie kubonyeza Save mara nyingi ikiwa mfumo unasubiri; kwanza kagua kama rekodi tayari imehifadhiwa.",
            "Usifute risiti au alama ili kuficha kosa. Tumia utaratibu rasmi wa correction wenye sababu.",
            "Usishirikishe taarifa za afya, fedha au taarifa binafsi za wanafunzi na watu wasiohusika.",
            "Toka kwenye mfumo (Logout) unapomaliza kutumia kompyuta ya pamoja."
        ],
        warningTitle: "Muhimu", warning: "Vielelezo vya mtiririko kwenye mwongozo huu ni michoro ya kufundishia, si screenshot za moja kwa moja za akaunti ya shule. Majina ya menyu na hatua zinaweza kutofautiana kidogo kulingana na role, ruhusa na mipangilio iliyowezeshwa.",
        examSteps: ["Unda mtihani", "Pakia karatasi", "Kagua AI Analysis", "Pata approvals", "Ingiza alama", "Chambua na toa matokeo"],
        empty: "Hakuna matokeo ya utafutaji."
    } : {
        back: "Back to Landing Page", title: "AfriCore ERP PRO – Complete System Manual",
        subtitle: "A practical step-by-step guide to using the system modules, understanding user roles and completing school workflows correctly.",
        introTitle: "Before you begin", intro: "Sign in with your authorised account. The menus available to you depend on your role, permissions and school assignment. Confirm the school and academic year before saving records.",
        modules: "System Modules", roles: "Guide by User Role", exam: "Examination Workflow", search: "Search modules, roles or steps...",
        purpose: "Module purpose", steps: "How to use this module", workflow: "Illustrated workflow", tips: "Practical tips", note: "Important note",
        accessTitle: "Roles and permissions", access: "The system uses role-based access. Not every user can view every section or perform every action. If a menu is missing, ask the administrator to review your role and permissions.",
        goodTitle: "Security and good practice", good: [
            "Use your own account; never share your password with another person.",
            "Confirm the school, academic year, learner, class and subject before saving.",
            "Do not repeatedly press Save while the system is processing; first check whether the record was saved.",
            "Do not delete receipts or marks to hide an error. Use the authorised correction process and record the reason.",
            "Do not share student health, financial or personal information with unauthorised people.",
            "Log out when you finish using a shared computer."
        ],
        warningTitle: "Important", warning: "The workflow illustrations in this manual are training diagrams, not live screenshots from a school's account. Menu names and steps may vary slightly according to enabled roles, permissions and configuration.",
        examSteps: ["Create exam", "Upload paper", "Review AI Analysis", "Complete approvals", "Enter marks", "Analyse and release results"],
        empty: "No matching results were found."
    };

    const visibleModules = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return moduleGuides;
        return moduleGuides.filter((m) => {
            const values = [
                m.title[lang], m.intro[lang], m.purpose[lang], m.note?.[lang] || "",
                ...m.steps[lang], ...m.tips[lang], ...m.workflow[lang]
            ];
            return values.join(" ").toLowerCase().includes(q);
        });
    }, [search, lang]);

    const visibleRoles = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return roleGuides;
        return roleGuides.filter((r) => [r.title[lang], r.scope[lang], ...r.tasks[lang]].join(" ").toLowerCase().includes(q));
    }, [search, lang]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950 text-white shadow-lg">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                    <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3 text-left">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl"><FaGraduationCap /></span>
                        <span><span className="block font-extrabold">AfriCore <span className="text-cyan-400">ERP PRO</span></span><span className="block text-xs text-slate-400">System User Manual</span></span>
                    </button>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setLanguage((v) => v === "en" ? "sw" : "en")} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10"><FaLanguage />{isSw ? "English" : "Kiswahili"}</button>
                        <button type="button" onClick={() => navigate("/")} className="hidden items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 sm:inline-flex"><FaArrowLeft />{copy.back}</button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-7 text-white shadow-xl sm:p-10 lg:p-14">
                    <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="relative max-w-4xl">
                        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan-200"><FaBookOpen />{isSw ? "Mwongozo wa mafunzo" : "Training and reference guide"}</span>
                        <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">{copy.title}</h1>
                        <p className="mt-5 max-w-3xl leading-7 text-slate-300">{copy.subtitle}</p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <button type="button" onClick={() => setActiveTab("modules")} className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300">{copy.modules}</button>
                            <button type="button" onClick={() => setActiveTab("roles")} className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-bold hover:bg-white/10">{copy.roles}</button>
                            <button type="button" onClick={() => navigate("/login")} className="rounded-xl border border-white/20 px-5 py-3 font-bold hover:bg-white/10">{isSw ? "Nenda Kuingia" : "Go to Login"}</button>
                        </div>
                    </div>
                </section>

                <section className="mt-7 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-700"><FaBookOpen /></span>
                        <div><h2 className="text-xl font-extrabold">{copy.introTitle}</h2><p className="mt-2 leading-7 text-slate-600">{copy.intro}</p></div>
                    </div>
                </section>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setActiveTab("modules")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === "modules" ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{copy.modules}</button>
                        <button type="button" onClick={() => setActiveTab("roles")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === "roles" ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{copy.roles}</button>
                    </div>
                    <label className="relative block w-full sm:max-w-md">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </label>
                </div>

                {activeTab === "modules" ? (
                    <section className="mt-6 space-y-6">
                        {visibleModules.map((module, index) => {
                            const Icon = iconMap[module.icon] || FaBookOpen;
                            return (
                                <article key={module.id} id={module.id} className="scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50 p-5 sm:flex-row sm:items-center sm:p-7">
                                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-800"><Icon /></span>
                                        <div className="flex-1"><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">{isSw ? `MODULI ${index + 1}` : `MODULE ${index + 1}`}</p><h2 className="mt-1 text-xl font-black sm:text-2xl">{module.title[lang]}</h2><p className="mt-2 leading-7 text-slate-600">{module.intro[lang]}</p></div>
                                    </div>
                                    <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
                                        <div>
                                            <h3 className="flex items-center gap-2 font-extrabold text-slate-900"><FaBullseyeFallback />{copy.purpose}</h3>
                                            <p className="mt-2 text-sm leading-6 text-slate-600">{module.purpose[lang]}</p>
                                            <h3 className="mt-6 flex items-center gap-2 font-extrabold text-slate-900"><FaClipboardCheck />{copy.steps}</h3>
                                            <ol className="mt-3 space-y-3">
                                                {module.steps[lang].map((step, i) => <li key={i} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-800">{i + 1}</span><span className="pt-0.5 text-sm leading-6 text-slate-600">{step}</span></li>)}
                                            </ol>
                                        </div>
                                        <div className="space-y-5">
                                            <WorkflowDiagram steps={module.workflow[lang]} language={lang} />
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                                <h3 className="flex items-center gap-2 font-extrabold text-emerald-900"><FaCheckCircle />{copy.tips}</h3>
                                                <BulletList items={module.tips[lang]} />
                                            </div>
                                            {module.note && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="flex items-center gap-2 font-extrabold text-amber-900"><FaExclamationCircle />{copy.note}</h3><p className="mt-2 text-sm leading-6 text-amber-900">{module.note[lang]}</p></div>}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                        {visibleModules.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-slate-500">{copy.empty}</p>}
                    </section>
                ) : (
                    <section className="mt-6 grid gap-5 md:grid-cols-2">
                        {visibleRoles.map((role) => {
                            const Icon = iconMap[role.icon] || FaUserCog;
                            return <article key={role.title.en} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-700"><Icon /></span><div><h2 className="text-xl font-black">{role.title[lang]}</h2><p className="mt-1 text-sm text-slate-500">{role.scope[lang]}</p></div></div>
                                <BulletList items={role.tasks[lang]} />
                            </article>;
                        })}
                        {visibleRoles.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-slate-500">{copy.empty}</p>}
                    </section>
                )}

                <section className="mt-10 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex items-center gap-3"><FaClipboardCheck className="text-xl text-indigo-700" /><h2 className="text-2xl font-black">{copy.exam}</h2></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {copy.examSteps.map((step, i) => <div key={step} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-sm font-black text-white">{i + 1}</span><span className="text-sm font-semibold text-slate-700">{step}</span></div>)}
                    </div>
                </section>

                <section className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
                    <div className="flex items-center gap-3"><FaShieldAlt className="text-xl text-blue-800" /><h2 className="text-2xl font-black">{copy.accessTitle}</h2></div>
                    <p className="mt-3 leading-7 text-slate-700">{copy.access}</p>
                </section>

                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex items-center gap-3"><FaCheckCircle className="text-xl text-emerald-700" /><h2 className="text-2xl font-black">{copy.goodTitle}</h2></div>
                    <BulletList items={copy.good} />
                </section>

                <section className="mt-8 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
                    <FaExclamationCircle className="mt-1 shrink-0 text-xl text-amber-700" />
                    <div><h2 className="font-extrabold text-amber-950">{copy.warningTitle}</h2><p className="mt-2 leading-7 text-amber-900">{copy.warning}</p></div>
                </section>
            </main>

            <footer className="mt-12 bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">© {new Date().getFullYear()} AfriCore ERP PRO • {isSw ? "Mwongozo wa Mtumiaji" : "System User Manual"}</footer>
            <button type="button" onClick={() => navigate("/")} aria-label={copy.back} className="fixed bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg hover:bg-blue-600 sm:hidden"><FaArrowLeft /></button>
        </div>
    );
}

function FaBullseyeFallback() {
    return <FaCheckCircle className="text-blue-700" />;
}
