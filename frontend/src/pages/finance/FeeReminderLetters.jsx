import React, { useMemo, useState, useEffect } from "react";
import { FaFileInvoiceDollar, FaPrint, FaSpinner } from "react-icons/fa";
import { supabase } from "../../services/supabase";
import api from "../../services/api";

function money(value) {
    return new Intl.NumberFormat("en-TZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function FeeReminderLetters({ school }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [rows, setRows] = useState([]);
    const [scope, setScope] = useState("student");
    const [classId, setClassId] = useState("");
    const [studentId, setStudentId] = useState("");
    const [studentLimit, setStudentLimit] = useState("");
    const [accountantName, setAccountantName] = useState("");
    const [cashAccounts, setCashAccounts] = useState([]);
    const [selectedCashAccountId, setSelectedCashAccountId] = useState("");
    const [accountantPhone, setAccountantPhone] = useState("");
    const [printing, setPrinting] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [publishNotice, setPublishNotice] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("bank");
    const [bankName, setBankName] = useState("");
    const [bankAccountName, setBankAccountName] = useState("");
    const [bankAccountNumber, setBankAccountNumber] = useState("");
    const [mobileNetwork, setMobileNetwork] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [mobileRecipientName, setMobileRecipientName] = useState("");
    const [paymentInstructions, setPaymentInstructions] = useState("Baada ya kufanya malipo, hifadhi risiti/ujumbe wa muamala na uwasilishe uthibitisho katika ofisi ya uhasibu ya shule. Tafadhali hakikisha jina la mwanafunzi na namba yake ya usajili vinaonekana kwenye kumbukumbu ya malipo.");

    async function loadDebtors() {
        setLoading(true);
        setError("");
        try {
            const { data: { user } = {}, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (!user?.id) throw new Error("Tafadhali ingia tena kwenye mfumo.");
            const { data: profile, error: profileError } = await supabase.from("profiles").select("school_id,full_name,phone").eq("id", user.id).single();
            if (profileError) throw profileError;
            if (!profile?.school_id) throw new Error("Akaunti hii haijaunganishwa na shule.");
            const scopedSchoolId = Number(profile.school_id);
            setAccountantName(profile.full_name || "");
            setAccountantPhone(profile.phone || "");
            const { data: accountRows, error: accountError } = await supabase.schema("finance").from("cash_accounts")
                .select("id,school_id,account_name,account_type,provider_name,account_number,is_active")
                .eq("school_id", scopedSchoolId).eq("is_active", true).in("account_type", ["bank", "mobile_money"]).order("account_name");
            if (accountError) throw accountError;
            setCashAccounts(accountRows || []);
            const normalizedAccounts = (accountRows || []).filter(account =>
                ["bank", "mobile_money"].includes(String(account.account_type || "").trim().toLowerCase())
            );
            setCashAccounts(normalizedAccounts);
            const preferredAccount = normalizedAccounts.find(account => account.account_type === "bank") || normalizedAccounts[0];
            if (preferredAccount) {
                setSelectedCashAccountId(String(preferredAccount.id));
                if (preferredAccount.account_type === "bank") {
                    setPaymentMethod("bank");
                    setBankName(preferredAccount.provider_name || "");
                    setBankAccountName(preferredAccount.account_name || "");
                    setBankAccountNumber(preferredAccount.account_number || "");
                    setMobileNetwork(""); setMobileNumber(""); setMobileRecipientName("");
                } else {
                    setPaymentMethod("mobile");
                    setMobileNetwork(preferredAccount.provider_name || "");
                    setMobileRecipientName(preferredAccount.account_name || "");
                    setMobileNumber(preferredAccount.account_number || "");
                    setBankName(""); setBankAccountName(""); setBankAccountNumber("");
                }
            } else {
                setSelectedCashAccountId("");
                setPaymentMethod("bank");
                setBankName(""); setBankAccountName(""); setBankAccountNumber("");
                setMobileNetwork(""); setMobileNumber(""); setMobileRecipientName("");
            }

            let charges = [];
            const pageSize = 1000;
            for (let offset = 0; ; offset += pageSize) {
                const { data, error: chargeError } = await supabase.schema("finance").from("student_charges")
                    .select("id,school_id,student_id,charge_date,academic_year_id,description,amount,paid_amount,balance,fee_item_id,due_date,invoice_number,status,term_number")
                    .eq("school_id", scopedSchoolId).gt("balance", 0)
                    .order("student_id", { ascending: true }).order("charge_date", { ascending: true })
                    .range(offset, offset + pageSize - 1);
                if (chargeError) throw chargeError;
                const page = data || [];
                charges = charges.concat(page);
                if (page.length < pageSize) break;
            }
            if (!charges.length) {
                setRows([]);
                setStudentId("");
                setClassId("");
                return;
            }

            const unique = values => [...new Set(values.filter(value => value !== null && value !== undefined && value !== "").map(String))];
            const studentIds = unique(charges.map(row => row.student_id));
            const yearIds = unique(charges.map(row => row.academic_year_id));
            const feeItemIds = unique(charges.map(row => row.fee_item_id));
            async function fetchChunks(queryFactory, ids) {
                const output = [];
                for (let index = 0; index < ids.length; index += 200) {
                    const chunk = ids.slice(index, index + 200);
                    if (!chunk.length) continue;
                    const { data, error: queryError } = await queryFactory(chunk);
                    if (queryError) throw queryError;
                    output.push(...(data || []));
                }
                return output;
            }

            const students = await fetchChunks(
                chunk => supabase.from("students").select("id,school_id,admission_number,admission_no,first_name,middle_name,last_name,current_class_id,guardian_name,parent_name").eq("school_id", scopedSchoolId).in("id", chunk),
                studentIds
            );
            const classIds = unique(students.map(student => student.current_class_id));
            const [classes, years, feeItems] = await Promise.all([
                fetchChunks(chunk => supabase.from("classes").select("id,school_id,class_name,academic_year_id").eq("school_id", scopedSchoolId).in("id", chunk), classIds),
                fetchChunks(chunk => supabase.from("academic_years").select("id,school_id,year_name,term").eq("school_id", scopedSchoolId).in("id", chunk), yearIds),
                fetchChunks(chunk => supabase.schema("finance").from("fee_items").select("id,school_id,item_name,item_code").eq("school_id", scopedSchoolId).in("id", chunk), feeItemIds)
            ]);

            const studentMap = new Map(students.map(row => [String(row.id), row]));
            const classMap = new Map(classes.map(row => [String(row.id), row]));
            const yearMap = new Map(years.map(row => [String(row.id), row]));
            const feeMap = new Map(feeItems.map(row => [String(row.id), row]));
            const enriched = charges.filter(charge => Number(charge.balance || 0) > 0).map(charge => {
                const student = studentMap.get(String(charge.student_id));
                if (!student) return null;
                const classRow = classMap.get(String(student.current_class_id));
                const year = yearMap.get(String(charge.academic_year_id));
                const fee = feeMap.get(String(charge.fee_item_id));
                return {
                    ...charge,
                    student,
                    studentName: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
                    admissionNumber: student.admission_number || student.admission_no || "-",
                    guardianName: student.guardian_name || student.parent_name || "",
                    classId: student.current_class_id ? String(student.current_class_id) : "",
                    className: classRow?.class_name || "Darasa halijabainishwa",
                    academicYearName: year?.year_name || "Mwaka haujabainishwa",
                    feeName: fee?.item_name || charge.description || "Deni la shule",
                    balance: Number(charge.balance || 0),
                    amount: Number(charge.amount || 0),
                    paidAmount: Number(charge.paid_amount || 0)
                };
            }).filter(Boolean);
            setRows(enriched);
            setStudentId(enriched[0]?.student_id ? String(enriched[0].student_id) : "");
            setClassId(enriched[0]?.classId || "");
        } catch (loadError) {
            console.error("Fee reminder letters load error:", loadError);
            setError(loadError?.message || "Imeshindikana kupata taarifa za madeni ya wanafunzi.");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }

    const accountsForPaymentType = useMemo(
        () => cashAccounts.filter(account => account.account_type === (paymentMethod === "bank" ? "bank" : "mobile_money")),
        [cashAccounts, paymentMethod]
    );

    const selectPaymentType = (type) => {
        const nextMethod = type === "bank" ? "bank" : "mobile";
        const nextAccounts = cashAccounts.filter(account => account.account_type === (nextMethod === "bank" ? "bank" : "mobile_money"));
        setPaymentMethod(nextMethod);
        const currentlySelected = nextAccounts.find(account => String(account.id) === String(selectedCashAccountId));
        const account = currentlySelected || nextAccounts[0];
        if (account) {
            selectCashAccount(account.id);
        } else {
            setSelectedCashAccountId("");
            setBankName(""); setBankAccountName(""); setBankAccountNumber("");
            setMobileNetwork(""); setMobileNumber(""); setMobileRecipientName("");
        }
    };

    const selectCashAccount = (accountId) => {
        const account = cashAccounts.find(item => String(item.id) === String(accountId));
        if (!account) {
            setSelectedCashAccountId("");
            return;
        }
        setSelectedCashAccountId(String(account.id));
        if (account.account_type === "bank") {
            setPaymentMethod("bank");
            setBankName(account.provider_name || "");
            setBankAccountName(account.account_name || "");
            setBankAccountNumber(account.account_number || "");
            setMobileNetwork(""); setMobileNumber(""); setMobileRecipientName("");
        } else if (account.account_type === "mobile_money") {
            setPaymentMethod("mobile");
            setMobileNetwork(account.provider_name || "");
            setMobileRecipientName(account.account_name || "");
            setMobileNumber(account.account_number || "");
            setBankName(""); setBankAccountName(""); setBankAccountNumber("");
        }
    };

    const students = useMemo(() => {
        const map = new Map();
        rows.forEach(row => {
            const key = String(row.student_id);
            if (!map.has(key)) map.set(key, { id: key, name: row.studentName, admissionNumber: row.admissionNumber, classId: row.classId, className: row.className });
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [rows]);

    const classes = useMemo(() => {
        const map = new Map();
        students.forEach(student => { if (student.classId) map.set(student.classId, student.className); });
        return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [students]);

    const letters = useMemo(() => {
        const allowed = new Set(students.filter(student => {
            if (scope === "student") return student.id === String(studentId);
            if (scope === "class") return student.classId === String(classId);
            return true;
        }).map(student => student.id));
        const grouped = new Map();
        rows.forEach(row => {
            const id = String(row.student_id);
            if (!allowed.has(id)) return;
            if (!grouped.has(id)) grouped.set(id, { studentId: id, studentName: row.studentName, admissionNumber: row.admissionNumber, guardianName: row.guardianName || "", className: row.className, charges: [], totalAmount: 0, totalPaid: 0, totalBalance: 0 });
            const letter = grouped.get(id);
            letter.charges.push(row);
            letter.totalAmount += row.amount;
            letter.totalPaid += row.paidAmount;
            letter.totalBalance += row.balance;
        });
        const sorted = [...grouped.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
        const limit = Number(studentLimit);
        return studentLimit !== "" && Number.isFinite(limit) && limit > 0
            ? sorted.slice(0, Math.floor(limit))
            : sorted;
    }, [rows, students, scope, studentId, classId, studentLimit]);

    async function publishLetters() {
        if (!letters.length) return;
        if (paymentMethod === "bank" && (!bankName.trim() || !bankAccountName.trim() || !bankAccountNumber.trim())) { setError("Jaza taarifa za benki kabla ya kuchapisha."); return; }
        if (paymentMethod === "mobile" && (!mobileNetwork.trim() || !mobileNumber.trim() || !mobileRecipientName.trim())) { setError("Jaza taarifa za malipo ya simu kabla ya kuchapisha."); return; }
        setPublishing(true); setError(""); setPublishNotice("");
        try {
            const entries = letters.map(letter => ({
                student_id: Number(letter.studentId),
                title: "Barua ya Makumbusho ya Ada",
                payload: {
                    student: { name: letter.studentName, admission_number: letter.admissionNumber, guardian_name: letter.guardianName || "Mzazi/Mlezi", class_name: letter.className },
                    school: { name: school?.school_name || "Shule", logo: school?.logo || null, address: school?.address || "", phone: school?.phone || "", email: school?.email || "" },
                    reference: "AFR/ADA/"+letter.admissionNumber+"/"+new Date().getFullYear(),
                    charges: letter.charges.map(x=>({fee_name:x.feeName,academic_year_name:x.academicYearName,amount:x.amount,paid_amount:x.paidAmount,balance:x.balance,term_number:x.term_number})),
                    total_amount:letter.totalAmount,total_paid:letter.totalPaid,total_balance:letter.totalBalance,
                    payment_method:paymentMethod,bank_name:bankName,bank_account_name:bankAccountName,bank_account_number:bankAccountNumber,
                    mobile_network:mobileNetwork,mobile_number:mobileNumber,mobile_recipient_name:mobileRecipientName,
                    payment_instructions:paymentInstructions,accountant_name:accountantName,accountant_phone:accountantPhone
                }
            }));
            const response=await api.post("/parent-portal/staff/letters/publish",{letter_type:"fee_reminder",letters:entries});
            setPublishNotice(response.data?.message || "Barua zimechapishwa kwenye Parent Portal.");
        } catch(e) { setError(e.response?.data?.message || "Imeshindikana kuchapisha barua kwenye Parent Portal."); }
        finally { setPublishing(false); }
    }

    function printLetters() {
        if (!letters.length) return;
        if (paymentMethod === "bank" && (!bankName.trim() || !bankAccountName.trim() || !bankAccountNumber.trim())) {
            setError("Jaza jina la benki, jina la akaunti na namba ya akaunti kabla ya kuchapisha.");
            return;
        }
        if (paymentMethod === "mobile" && (!mobileNetwork.trim() || !mobileNumber.trim() || !mobileRecipientName.trim())) {
            setError("Jaza mtandao, namba ya simu na jina la mpokeaji kabla ya kuchapisha.");
            return;
        }
        setError("");
        setPrinting(true);
        document.body.classList.add("afri-fee-reminder-printing");
        window.requestAnimationFrame(() => {
            document.querySelectorAll(".fee-reminder-print-page").forEach(page => {
                const content = page.querySelector(".fee-reminder-print-content");
                if (!content) return;
                content.style.transform = "none";
                content.style.width = "100%";
                const availableHeight = page.clientHeight;
                const naturalHeight = content.scrollHeight;
                const fitScale = naturalHeight > availableHeight ? availableHeight / naturalHeight : 1;
                content.style.width = `${100 / fitScale}%`;
                content.style.transform = `scale(${fitScale})`;
                content.style.transformOrigin = "top left";
            });
            window.setTimeout(() => window.print(), 150);
        });
    }

    useEffect(() => {
        if (!printing) return undefined;
        const afterPrint = () => {
            document.body.classList.remove("afri-fee-reminder-printing");
            document.querySelectorAll(".fee-reminder-print-content").forEach(content => {
                content.style.removeProperty("transform");
                content.style.removeProperty("width");
                content.style.removeProperty("transform-origin");
            });
            setPrinting(false);
        };
        window.addEventListener("afterprint", afterPrint);
        return () => window.removeEventListener("afterprint", afterPrint);
    }, [printing]);

    return (
        <div className="my-5">
            <div className="fee-reminder-screen">
                <button type="button" onClick={async () => { setOpen(true); await loadDebtors(); }} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700">
                    <FaFileInvoiceDollar /> Barua za Makumbusho ya Ada
                </button>
                {open ? (
                    <section className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900">Barua za Makumbusho ya Ada</h2>
                                <p className="mt-1 text-xs text-slate-600">Kila mwanafunzi atapata barua yake binafsi yenye taarifa halisi za deni.</p>
                            </div>
                            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">Funga</button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
                            <div>
                                <label className="mb-2 block text-xs font-bold text-slate-600">Wigo wa barua</label>
                                <select value={scope} onChange={event => setScope(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                                    <option value="student">Mwanafunzi mmoja</option>
                                    <option value="class">Darasa zima</option>
                                    <option value="school">Shule nzima</option>
                                </select>
                            </div>
                            {scope === "student" ? (
                                <div>
                                    <label className="mb-2 block text-xs font-bold text-slate-600">Chagua mwanafunzi</label>
                                    <select value={studentId} onChange={event => setStudentId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                                        {students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.admissionNumber}</option>)}
                                    </select>
                                </div>
                            ) : scope === "class" ? (
                                <div>
                                    <label className="mb-2 block text-xs font-bold text-slate-600">Chagua darasa</label>
                                    <select value={classId} onChange={event => setClassId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                                        {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="rounded-xl bg-slate-50 px-4 py-3">
                                    <p className="text-xs font-bold text-slate-500">Wanafunzi wenye madeni</p>
                                    <p className="mt-1 text-xl font-extrabold text-slate-900">{students.length}</p>
                                </div>
                            )}
                            <div>
                                <label className="mb-2 block text-xs font-bold text-slate-600">Idadi ya wanafunzi wa kuchapisha</label>
                                <input type="number" min="1" max={scope === "student" ? 1 : (scope === "class" ? students.filter(student => student.classId === String(classId)).length : students.length)} value={studentLimit} onChange={event => setStudentLimit(event.target.value)} placeholder="Wote (acha wazi)" disabled={scope === "student"} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100" />
                                <p className="mt-1 text-[11px] text-slate-500">Acha wazi kuchapisha wote; ukiweka namba, mfumo utachapisha idadi hiyo kuanzia mwanzo wa orodha.</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-xs font-bold text-slate-500">Barua zitakazochapishwa</p>
                                <p className="mt-1 text-xl font-extrabold text-slate-900">{letters.length}</p>
                                <p className="mt-1 text-xs text-slate-500">Jumla ya madeni: TZS {money(letters.reduce((sum, item) => sum + item.totalBalance, 0))}</p>
                            </div>
                        </div>
                        <div className="mx-5 mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                            <h3 className="text-sm font-extrabold text-slate-900">Mipangilio ya malipo itakayoonekana kwenye barua</h3>
                            <p className="mt-1 text-xs text-slate-600">Weka taarifa sahihi za akaunti ya shule. Taarifa hizi zitaonekana kwenye kila barua itakayochapishwa.</p>
                            <div className="mt-3">
                                {accountsForPaymentType.length > 1 ? (
                                    <label className="block text-xs font-bold text-slate-600">Chagua akaunti ya {paymentMethod === "bank" ? "benki" : "Mobile Money"} iliyosajiliwa kwenye Finance
                                        <select value={selectedCashAccountId} onChange={event => selectCashAccount(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                                            {accountsForPaymentType.map(account => <option key={account.id} value={account.id}>{account.provider_name || ""} · {account.account_name} · {account.account_number || "Namba haijawekwa"}</option>)}
                                        </select>
                                    </label>
                                ) : accountsForPaymentType.length === 1 ? (
                                    <p className="text-xs font-semibold text-emerald-700">Akaunti imechaguliwa moja kwa moja: {accountsForPaymentType[0].provider_name || ""} · {accountsForPaymentType[0].account_name} · {accountsForPaymentType[0].account_number || "Namba haijawekwa"}</p>
                                ) : (
                                    <p className="text-xs text-amber-700">Hakuna akaunti hai ya {paymentMethod === "bank" ? "Benki" : "Mobile Money"} iliyosajiliwa kwa shule hii kwenye Cash & Financial Accounts.</p>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" onClick={() => selectPaymentType("bank")} disabled={!cashAccounts.some(account => account.account_type === "bank")} className={`rounded-lg px-4 py-2 text-xs font-bold ${paymentMethod === "bank" ? "bg-indigo-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>Malipo kwa Benki</button>
                                <button type="button" onClick={() => selectPaymentType("mobile")} disabled={!cashAccounts.some(account => account.account_type === "mobile_money")} className={`rounded-lg px-4 py-2 text-xs font-bold ${paymentMethod === "mobile" ? "bg-indigo-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>Malipo kwa Simu</button>
                            </div>
                            {paymentMethod === "bank" ? (
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <label className="text-xs font-bold text-slate-600">Jina la benki<input value={bankName} readOnly={Boolean(selectedCashAccountId)} onChange={event => setBankName(event.target.value)} placeholder="Mf. CRDB / NMB" className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                                    <label className="text-xs font-bold text-slate-600">Jina la akaunti<input value={bankAccountName} readOnly={Boolean(selectedCashAccountId)} onChange={event => setBankAccountName(event.target.value)} placeholder="Jina la akaunti ya shule" className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                                    <label className="text-xs font-bold text-slate-600">Namba ya akaunti<input value={bankAccountNumber} readOnly={Boolean(selectedCashAccountId)} onChange={event => setBankAccountNumber(event.target.value)} placeholder="Namba ya akaunti" className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                                </div>
                            ) : (
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <label className="text-xs font-bold text-slate-600">Mtandao wa simu<input value={mobileNetwork} readOnly={Boolean(selectedCashAccountId)} onChange={event => setMobileNetwork(event.target.value)} placeholder="Mf. M-Pesa / Airtel Money / Tigo Pesa" className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                                    <label className="text-xs font-bold text-slate-600">Namba ya simu<input value={mobileNumber} readOnly={Boolean(selectedCashAccountId)} onChange={event => setMobileNumber(event.target.value)} placeholder="Namba ya kupokea malipo" className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                                    <label className="text-xs font-bold text-slate-600">Jina la mpokeaji<input value={mobileRecipientName} readOnly={Boolean(selectedCashAccountId)} onChange={event => setMobileRecipientName(event.target.value)} placeholder="Jina linaloonekana kwa mpokeaji" className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                                </div>
                            )}
                            <label className="mt-3 block text-xs font-bold text-slate-600">Namba ya simu ya muhasibu
                                <input type="tel" value={accountantPhone} onChange={event => setAccountantPhone(event.target.value)} placeholder="Namba ya simu ya akaunti ya Muhasibu" readOnly className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal" />
                            </label>
                            <label className="mt-3 block text-xs font-bold text-slate-600">Maelekezo ya malipo kwa mzazi/mlezi
                                <textarea value={paymentInstructions} onChange={event => setPaymentInstructions(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                            </label>
                        </div>
                        {loading ? (
                            <div className="flex items-center gap-3 px-5 pb-5 text-sm font-semibold text-slate-600"><FaSpinner className="animate-spin" /> Inakusanya madeni ya wanafunzi...</div>
                        ) : error ? (
                            <div className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                        ) : !rows.length ? (
                            <div className="mx-5 mb-5 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Hakuna mwanafunzi mwenye deni linalosalia kwa sasa.</div>
                        ) : (
                            <>
                                <div className="mx-5 mb-5 overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full min-w-[650px] text-left text-sm">
                                        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Mwanafunzi</th><th className="px-4 py-3">Darasa</th><th className="px-4 py-3 text-right">Salio la deni</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {letters.slice(0, 12).map(item => (
                                                <tr key={item.studentId}>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">{item.studentName}<span className="ml-2 text-xs font-normal text-slate-400">{item.admissionNumber}</span></td>
                                                    <td className="px-4 py-3 text-slate-600">{item.className}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-amber-700">TZS {money(item.totalBalance)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {letters.length > 12 ? <p className="px-4 py-2 text-xs text-slate-500">Inaonyesha wanafunzi 12 wa mwanzo; barua zitajumuisha wote {letters.length}.</p> : null}
                                </div>
                                <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-slate-500">Kila barua itachapishwa kwenye ukurasa wake bila kuchanganya taarifa.</p>{publishNotice && <p className="text-sm font-semibold text-emerald-700">{publishNotice}</p>}
                                    <button type="button" disabled={!letters.length || loading} onClick={printLetters} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                                        <FaPrint /> Chapisha barua {letters.length}
                                    </button><button type="button" disabled={!letters.length || loading || publishing} onClick={publishLetters} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{publishing ? "Inachapisha..." : "Publish to Parental Portal"}</button>
                                </div>
                            </>
                        )}
                    </section>
                ) : null}
            </div>

            <style>{`
                .fee-reminder-print-root { display: none; }
                /* Reserve the A4 margins ourselves so browser print-margin settings cannot stretch the letter to the paper edges. */
                @page { size: A4 portrait; margin: 0 !important; }
                @media print {
                    html, body { width: 210mm !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
                    body.afri-fee-reminder-printing * { visibility: hidden !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-root,
                    body.afri-fee-reminder-printing .fee-reminder-print-root * { visibility: visible !important; }
                    body.afri-fee-reminder-printing .fee-reminder-screen { display: none !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-root { display: block !important; position: static !important; box-sizing: border-box !important; width: 210mm !important; max-width: 210mm !important; margin: 0 !important; padding: 0 !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page { display: block !important; box-sizing: border-box !important; width: 180mm !important; max-width: 180mm !important; height: 267mm !important; min-height: 267mm !important; max-height: 267mm !important; overflow: hidden !important; margin: 15mm 0 15mm 15mm !important; padding: 0 !important; position: relative !important; left: auto !important; right: auto !important; transform: none !important; float: none !important; color: #000 !important; background: #fff !important; font-size: 10px !important; line-height: 1.28 !important; break-after: page; page-break-after: always; }
                    body.afri-fee-reminder-printing .fee-reminder-print-content { box-sizing: border-box !important; width: 100%; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page header { margin-bottom: 8px !important; padding-bottom: 7px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page p { margin-top: 0 !important; margin-bottom: 5px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page h2 { margin-top: 5px !important; margin-bottom: 7px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page h3 { margin-bottom: 5px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page table { margin-top: 5px !important; margin-bottom: 7px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page th,
                    body.afri-fee-reminder-printing .fee-reminder-print-page td { padding: 4px 5px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page section { margin-top: 5px !important; margin-bottom: 7px !important; padding: 7px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page .mt-10 { margin-top: 9px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page .mt-8 { margin-top: 6px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page .mt-5 { margin-top: 6px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page .mb-6 { margin-bottom: 7px !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page > * { max-width: 100% !important; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page p,
                    body.afri-fee-reminder-printing .fee-reminder-print-page td,
                    body.afri-fee-reminder-printing .fee-reminder-print-page th { overflow-wrap: break-word; }
                    body.afri-fee-reminder-printing .fee-reminder-print-page:last-child { break-after: auto; page-break-after: auto; }
                    body.afri-fee-reminder-printing table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
                    body.afri-fee-reminder-printing th,
                    body.afri-fee-reminder-printing td { padding: 7px 6px !important; }
                    body.afri-fee-reminder-printing tr { break-inside: avoid; page-break-inside: avoid; }
                    body.afri-fee-reminder-printing img { max-height: 20mm !important; }
                }
            `}</style>
            <div className="fee-reminder-print-root">
                {letters.map((letter, index) => (
                    <article key={letter.studentId} className="fee-reminder-print-page text-[13px] leading-relaxed text-black">
                        <div className="fee-reminder-print-content">
                        <header className="mb-8 flex items-center gap-4 border-b-2 border-black pb-4">
                            {school?.logo ? <img src={school.logo} alt="" className="h-20 w-20 object-contain" /> : null}
                            <div className="flex-1 text-center">
                                <h1 className="text-xl font-extrabold uppercase">{school?.school_name || "SHULE"}</h1>
                                {school?.registration_number ? <p className="text-[10px]">Usajili: {school.registration_number}</p> : null}
                                <p className="text-[10px]">{[school?.address, school?.phone, school?.email].filter(Boolean).join(" · ")}</p>
                            </div>
                        </header>
                        <div className="mb-5 flex justify-between gap-4">
                            <p><strong>Kumb. Na:</strong> AFR/ADA/{letter.admissionNumber}/{new Date().getFullYear()}</p>
                            <p><strong>Tarehe:</strong> {new Date().toLocaleDateString("sw-TZ", { day: "2-digit", month: "long", year: "numeric" })}</p>
                        </div>
                        <p className="mb-1">Kwa: <strong>{letter.guardianName || "Mzazi/Mlezi"}</strong></p>
                        <p className="mb-1">Mzazi/Mlezi wa: <strong>{letter.studentName}</strong></p>
                        <p className="mb-5">Darasa: <strong>{letter.className}</strong> · Namba ya mwanafunzi: <strong>{letter.admissionNumber}</strong></p>
                        <h2 className="mb-5 text-center text-sm font-extrabold underline">YAH: UKUMBUSHO WA MALIPO YA ADA NA MADENI YA SHULE</h2>
                        <p className="mb-4">Ndugu Mzazi/Mlezi,</p>
                        <p className="mb-4 text-justify">Uongozi wa {school?.school_name || "shule"} unapenda kukukumbusha kuwa mwanafunzi <strong>{letter.studentName}</strong> ana salio la deni la shule kama inavyooneshwa hapa chini. Tunaomba ulipie kiasi kilichobaki ili kuwezesha shughuli za utoaji wa huduma za elimu kuendelea vizuri.</p>
                        <table className="mb-4 w-full border-collapse text-[11px]">
                            <thead><tr><th className="border border-black px-2 py-2 text-left">Aina ya deni / Ada</th><th className="border border-black px-2 py-2 text-left">Mwaka</th><th className="border border-black px-2 py-2 text-right">Kiasi (TZS)</th><th className="border border-black px-2 py-2 text-right">Kilicholipwa</th><th className="border border-black px-2 py-2 text-right">Salio</th></tr></thead>
                            <tbody>
                                {letter.charges.map(charge => (
                                    <tr key={charge.id}>
                                        <td className="border border-black px-2 py-2">{charge.feeName}{charge.term_number ? " · Muhula " + charge.term_number : ""}</td>
                                        <td className="border border-black px-2 py-2">{charge.academicYearName}</td>
                                        <td className="border border-black px-2 py-2 text-right">{money(charge.amount)}</td>
                                        <td className="border border-black px-2 py-2 text-right">{money(charge.paidAmount)}</td>
                                        <td className="border border-black px-2 py-2 text-right font-bold">{money(charge.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot><tr><td colSpan="2" className="border border-black px-2 py-2 text-right font-extrabold">JUMLA</td><td className="border border-black px-2 py-2 text-right font-extrabold">{money(letter.totalAmount)}</td><td className="border border-black px-2 py-2 text-right font-extrabold">{money(letter.totalPaid)}</td><td className="border border-black px-2 py-2 text-right font-extrabold">{money(letter.totalBalance)}</td></tr></tfoot>
                        </table>
                        <p className="mb-3">Hivyo, kiasi kinachodaiwa kwa sasa ni <strong>TZS {money(letter.totalBalance)}</strong>. Tunaomba ufanye malipo kupitia utaratibu rasmi wa shule na kuwasilisha uthibitisho wa malipo katika ofisi ya uhasibu.</p>
                        <section className="mb-4 rounded border border-black p-3">
                            <h3 className="mb-2 text-[11px] font-extrabold uppercase">Taarifa za kufanya malipo</h3>
                            {paymentMethod === "bank" ? (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <p><strong>Benki:</strong> {bankName}</p>
                                    <p><strong>Jina la akaunti:</strong> {bankAccountName}</p>
                                    <p className="col-span-2"><strong>Namba ya akaunti:</strong> {bankAccountNumber}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <p><strong>Mtandao:</strong> {mobileNetwork}</p>
                                    <p><strong>Namba ya simu:</strong> {mobileNumber}</p>
                                    <p className="col-span-2"><strong>Jina la mpokeaji:</strong> {mobileRecipientName}</p>
                                </div>
                            )}
                            <p className="mt-2 whitespace-pre-line"><strong>Maelekezo:</strong> {paymentInstructions}</p>
                            <p className="mt-2 text-[10px] font-bold">Tafadhali tumia jina la mwanafunzi na namba yake ya usajili kama kumbukumbu ya malipo.</p>
                        </section>
                        <p className="mb-3">Taarifa za maendeleo ya mwanafunzi, mahudhurio, taarifa za fedha na matangazo ya shule zinapatikana pia kupitia Parent Portal. Mzazi/mlezi anashauriwa kuingia mara kwa mara kufuatilia taarifa hizo. Kwa msaada wa kuingia, wasiliana na ofisi ya shule.</p>
                        <p className="mb-6">Kwa ufafanuzi zaidi kuhusu deni hili, tafadhali wasiliana na ofisi ya uhasibu ya shule. Tunakushukuru kwa ushirikiano wako.</p>
                        <p className="mb-1">Wako katika huduma,</p>
                        <div className="mt-10 w-64 border-t border-black pt-2">
                            <p className="font-extrabold">{accountantName || "Muhasibu"}</p>
                            <p className="text-[10px] font-semibold uppercase">Muhasibu wa Shule</p>
                            {accountantPhone.trim() ? <p className="mt-1 text-[10px]"><strong>Simu:</strong> {accountantPhone.trim()}</p> : null}
                            <p className="mt-5 text-[10px]">Saini: __________________________</p>
                        </div>
                        <p className="mt-8 text-center text-[9px]">Barua hii imetengenezwa na mfumo wa AfriCore ERP PRO · {index + 1} / {letters.length}</p>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

export default FeeReminderLetters;
