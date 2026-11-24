import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useRole } from "../../context/RoleContext";

const tabs = ["Overview", "Vehicles", "Routes", "Crew", "Students", "Transport Finance", "HR Review"];
const blankVehicle = { registration_number: "", make: "", model: "", seating_capacity: 30, vehicle_type: "bus", status: "active", insurance_expiry: "", inspection_expiry: "" };
const blankRoute = { route_name: "", vehicle_id: "", start_location: "", end_location: "", departure_time: "", return_time: "", monthly_fee: 0, status: "active" };
const money = (value) => new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0));
const label = (row) => [row?.first_name, row?.middle_name, row?.last_name].filter(Boolean).join(" ") || "—";

function Panel({ title, children, action }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-800">{title}</h2>{action}</div>
    {children}
  </section>;
}
function Field({ label: title, children }) {
  return <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium">{title}</span>{children}</label>;
}
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50";

export default function TransportManagement() {
  const { selectedRoleName, selectedRoleId } = useRole();
  const canReview = Number(selectedRoleId) === 1 || String(selectedRoleName || "").trim().toLowerCase() === "hr manager";
  const currentRole = String(selectedRoleName || "").trim().toLowerCase();
  const canManage = Number(selectedRoleId) === 1 || currentRole === "secretary";
  const canSubmitFinance = Number(selectedRoleId) === 1 || currentRole === "accountant";
  const canViewFinance = canSubmitFinance || canReview;
  const [activeTab, setActiveTab] = useState("Overview");
  const [data, setData] = useState({ overview: {}, vehicles: [], routes: [], crew: [], students: [], employees: [], assignments: [], transactions: [], pending: [], options: { accounts: [], cashAccounts: [] } });
  const [vehicle, setVehicle] = useState(blankVehicle);
  const [route, setRoute] = useState(blankRoute);
  const [crew, setCrew] = useState({ vehicle_id: "", employee_id: "", crew_role: "driver" });
  const [assignment, setAssignment] = useState({ student_id: "", route_id: "", monthly_fee: 0 });
  const [transaction, setTransaction] = useState({ transaction_type: "income", category: "Student transport fee", description: "", amount: "", transaction_date: new Date().toISOString().slice(0,10), revenue_account_id: "", expense_account_id: "", cash_account_id: "", payment_method: "cash", payer_name: "", student_id: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState({});
  const [stopDrafts, setStopDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requests = await Promise.all([
        api.get("/transport/overview"), api.get("/transport/vehicles"), api.get("/transport/routes"),
        api.get("/transport/crew"), api.get("/transport/students"), api.get("/transport/employees"),
        api.get("/transport/assignments"), api.get("/transport/finance/transactions").catch(() => ({ data: { data: [] } })),
        api.get("/transport/finance/pending").catch(() => ({ data: { data: [] } })),
        api.get("/transport/finance/options").catch(() => ({ data: { data: { accounts: [], cashAccounts: [] } } }))
      ]);
      setData({
        overview: requests[0].data.data || {}, vehicles: requests[1].data.data || [], routes: requests[2].data.data || [],
        crew: requests[3].data.data || [], students: requests[4].data.data || [], employees: requests[5].data.data || [],
        assignments: requests[6].data.data || [], transactions: requests[7].data.data || [],
        pending: requests[8].data.data || [], options: requests[9].data.data || { accounts: [], cashAccounts: [] }
      });
    } catch (error) {
      setNotice(error?.response?.data?.message || "Imeshindikana kupakia taarifa za usafiri.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (url, body, success) => {
    setBusy(true); setNotice("");
    try { await api.post(url, body); setNotice(success); await load(); return true; }
    catch (error) { setNotice(error?.response?.data?.message || error.message || "Ombi halikufanikiwa."); return false; }
    finally { setBusy(false); }
  };

  const vehicleOptions = data.vehicles.filter(v => v.status === "active");
  const routeOptions = data.routes.filter(r => r.status === "active");
  const accounts = data.options.accounts || [];
  const incomeAccounts = accounts.filter(a => a.account_type === "revenue");
  const expenseAccounts = accounts.filter(a => a.account_type === "expense");
  const activeAssignments = useMemo(() => data.assignments.filter(a => a.is_active), [data.assignments]);

  const submitTransaction = async (event) => {
    event.preventDefault();
    const payload = { ...transaction, amount: Number(transaction.amount), student_id: transaction.student_id || null,
      revenue_account_id: transaction.transaction_type === "income" ? transaction.revenue_account_id : null,
      expense_account_id: transaction.transaction_type === "expense" ? transaction.expense_account_id : null };
    if (await save("/transport/finance/transactions", payload, "Muamala umetumwa kwa HR Manager kwa ajili ya mapitio.")) {
      setTransaction({ ...transaction, description: "", amount: "", payer_name: "", student_id: "" });
    }
  };

  return <div className="space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Operations</p><h1 className="text-2xl font-bold text-slate-900">Transport Management</h1><p className="mt-1 text-sm text-slate-500">Manage school vehicles, routes, crew, student allocations and transport finance.</p></div>
      <button onClick={load} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Refresh</button>
    </div>
    {notice && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</div>}
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
      {tabs.filter(tab => (tab !== "HR Review" || canReview) && (tab !== "Transport Finance" || canViewFinance)).map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{tab}</button>)}
    </div>
    {loading ? <div className="rounded-xl bg-white p-10 text-center text-slate-500">Loading transport records…</div> : <>
      {activeTab === "Overview" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Total vehicles", data.overview.vehicles], ["Active vehicles", data.overview.activeVehicles],
          ["Active routes", data.overview.routes], ["Students allocated", data.overview.assignedStudents],
          ["Pending finance reviews", data.overview.pendingTransactions], ["Pending amount", money(data.overview.pendingAmount)]
        ].map(([title, value]) => <div key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value ?? 0}</p></div>)}
        <div className="sm:col-span-2 xl:col-span-3"><Panel title="Transport workflow"><p className="text-sm leading-6 text-slate-600">Secretary manages vehicles, routes, crew and student allocations. Accountant submits income and expense transactions. HR Manager reviews submitted transactions. Approved entries will be posted into Finance and the General Journal after the secure posting workflow is completed.</p></Panel></div>
      </div>}
      {activeTab === "Vehicles" && <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        {canManage && <Panel title="Register a vehicle"><form className="space-y-3" onSubmit={async e => {e.preventDefault(); if(await save("/transport/vehicles",vehicle,"Vehicle saved successfully.")) setVehicle(blankVehicle);}}>
          <Field label="Registration number"><input className={inputClass} required value={vehicle.registration_number} onChange={e=>setVehicle({...vehicle,registration_number:e.target.value})} placeholder="T 123 ABC"/></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Make"><input className={inputClass} value={vehicle.make} onChange={e=>setVehicle({...vehicle,make:e.target.value})}/></Field><Field label="Model"><input className={inputClass} value={vehicle.model} onChange={e=>setVehicle({...vehicle,model:e.target.value})}/></Field></div>
          <Field label="Seating capacity"><input className={inputClass} type="number" min="1" required value={vehicle.seating_capacity} onChange={e=>setVehicle({...vehicle,seating_capacity:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Insurance expiry"><input className={inputClass} type="date" value={vehicle.insurance_expiry} onChange={e=>setVehicle({...vehicle,insurance_expiry:e.target.value})}/></Field><Field label="Inspection expiry"><input className={inputClass} type="date" value={vehicle.inspection_expiry} onChange={e=>setVehicle({...vehicle,inspection_expiry:e.target.value})}/></Field></div>
          <button className={buttonClass} disabled={busy}>Save vehicle</button>
        </form></Panel>}
        <Panel title="Registered vehicles"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Registration</th><th className="p-2">Vehicle</th><th className="p-2">Seats</th><th className="p-2">Status</th></tr></thead><tbody>{data.vehicles.map(v=><tr key={v.id} className="border-b last:border-0"><td className="p-2 font-semibold">{v.registration_number}</td><td className="p-2">{[v.make,v.model].filter(Boolean).join(" ") || v.vehicle_type}</td><td className="p-2">{v.seating_capacity}</td><td className="p-2 capitalize">{v.status}</td></tr>)}</tbody></table>{!data.vehicles.length && <p className="p-4 text-slate-500">No vehicles registered.</p>}</div></Panel>
      </div>}
      {activeTab === "Routes" && <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        {canManage && <Panel title="Create a route"><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(await save("/transport/routes",route,"Route saved successfully."))setRoute(blankRoute);}}>
          <Field label="Route name"><input className={inputClass} required value={route.route_name} onChange={e=>setRoute({...route,route_name:e.target.value})}/></Field>
          <Field label="Vehicle"><select className={inputClass} required value={route.vehicle_id} onChange={e=>setRoute({...route,vehicle_id:e.target.value})}><option value="">Select vehicle</option>{vehicleOptions.map(v=><option key={v.id} value={v.id}>{v.registration_number} — {v.seating_capacity} seats</option>)}</select></Field>
          <Field label="Starting location"><input className={inputClass} value={route.start_location} onChange={e=>setRoute({...route,start_location:e.target.value})}/></Field>
          <Field label="Destination"><input className={inputClass} value={route.end_location} onChange={e=>setRoute({...route,end_location:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Departure"><input className={inputClass} type="time" value={route.departure_time} onChange={e=>setRoute({...route,departure_time:e.target.value})}/></Field><Field label="Return"><input className={inputClass} type="time" value={route.return_time} onChange={e=>setRoute({...route,return_time:e.target.value})}/></Field></div>
          <Field label="Monthly fee (TZS)"><input className={inputClass} type="number" min="0" value={route.monthly_fee} onChange={e=>setRoute({...route,monthly_fee:e.target.value})}/></Field>
          <button className={buttonClass} disabled={busy}>Save route</button>
        </form></Panel>}
        <Panel title="Routes and stops"><div className="space-y-3">{data.routes.map(r=><div key={r.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-slate-800">{r.route_name}</p><p className="text-sm text-slate-500">{r.start_location || "Start"} → {r.end_location || "Destination"}</p></div><span className="text-sm font-semibold">{money(r.monthly_fee)}/month</span></div><p className="mt-2 text-xs text-slate-500">Vehicle: {data.vehicles.find(v=>v.id===r.vehicle_id)?.registration_number || "—"} · Stops: {r.stops?.map(s=>s.stop_name).join(", ") || "Not added"}</p><div className="mt-3 flex flex-wrap gap-2"><input className={inputClass+" max-w-xs"} placeholder="Add pickup/drop-off stop" value={stopDrafts[r.id]||""} onChange={e=>setStopDrafts({...stopDrafts,[r.id]:e.target.value})}/><button disabled={busy||!(stopDrafts[r.id]||"").trim()} onClick={async()=>{const name=(stopDrafts[r.id]||"").trim();if(!name)return;const ok=await save(`/transport/routes/${r.id}/stops`,{stop_name:name,stop_order:(r.stops||[]).length+1},"Route stop added.");if(ok)setStopDrafts({...stopDrafts,[r.id]:""});}} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Add stop</button></div></div>)}{!data.routes.length&&<p className="text-slate-500">No routes created.</p>}</div></Panel>
      </div>}
      {activeTab === "Crew" && <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        {canManage && <Panel title="Assign driver or conductor"><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(await save("/transport/crew",crew,"Crew member assigned successfully."))setCrew({vehicle_id:"",employee_id:"",crew_role:"driver"});}}>
          <Field label="Vehicle"><select className={inputClass} required value={crew.vehicle_id} onChange={e=>setCrew({...crew,vehicle_id:e.target.value})}><option value="">Select vehicle</option>{data.vehicles.map(v=><option key={v.id} value={v.id}>{v.registration_number}</option>)}</select></Field>
          <Field label="Employee"><select className={inputClass} required value={crew.employee_id} onChange={e=>setCrew({...crew,employee_id:e.target.value})}><option value="">Select employee</option>{data.employees.map(e=><option key={e.id} value={e.id}>{label(e)} — {e.employee_number}</option>)}</select></Field>
          <Field label="Role"><select className={inputClass} value={crew.crew_role} onChange={e=>setCrew({...crew,crew_role:e.target.value})}><option value="driver">Driver</option><option value="conductor">Conductor</option></select></Field>
          <button className={buttonClass} disabled={busy}>Assign crew</button>
        </form></Panel>}
        <Panel title="Vehicle crew"><div className="space-y-2">{data.crew.map(c=><div key={c.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200 p-3"><div><p className="font-semibold">{label(c.employee)}</p><p className="text-xs text-slate-500">{data.vehicles.find(v=>v.id===c.vehicle_id)?.registration_number || "Vehicle"} · {c.crew_role}</p></div><span className="text-xs capitalize text-slate-600">{c.is_active?"Active":"Ended"}</span></div>)}{!data.crew.length&&<p className="text-slate-500">No crew assignments.</p>}</div></Panel>
      </div>}
      {activeTab === "Students" && <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        {canManage && <Panel title="Allocate a student to a route"><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(await save("/transport/assignments",assignment,"Student allocated successfully."))setAssignment({student_id:"",route_id:"",monthly_fee:0});}}>
          <Field label="Student"><select className={inputClass} required value={assignment.student_id} onChange={e=>setAssignment({...assignment,student_id:e.target.value})}><option value="">Select student</option>{data.students.map(s=><option key={s.id} value={s.id}>{label(s)} — {s.admission_number || s.admission_no}</option>)}</select></Field>
          <Field label="Route"><select className={inputClass} required value={assignment.route_id} onChange={e=>setAssignment({...assignment,route_id:e.target.value})}><option value="">Select route</option>{routeOptions.map(r=><option key={r.id} value={r.id}>{r.route_name}</option>)}</select></Field>
          <Field label="Monthly fee (TZS)"><input className={inputClass} type="number" min="0" value={assignment.monthly_fee} onChange={e=>setAssignment({...assignment,monthly_fee:e.target.value})}/></Field>
          <button className={buttonClass} disabled={busy}>Allocate student</button>
        </form></Panel>}
        <Panel title={`Student allocations (${activeAssignments.length})`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Student</th><th className="p-2">Admission No.</th><th className="p-2">Route</th><th className="p-2">Monthly fee</th></tr></thead><tbody>{activeAssignments.map(a=><tr key={a.id} className="border-b"><td className="p-2">{label(a.student)}</td><td className="p-2">{a.student?.admission_number || a.student?.admission_no}</td><td className="p-2">{a.route?.route_name}</td><td className="p-2">{money(a.monthly_fee)}</td></tr>)}</tbody></table>{!activeAssignments.length&&<p className="p-4 text-slate-500">No students allocated.</p>}</div></Panel>
      </div>}
      {activeTab === "Transport Finance" && <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
        {canSubmitFinance && <Panel title="Submit income or expense"><form className="space-y-3" onSubmit={submitTransaction}>
          <Field label="Transaction type"><select className={inputClass} value={transaction.transaction_type} onChange={e=>setTransaction({...transaction,transaction_type:e.target.value,revenue_account_id:"",expense_account_id:""})}><option value="income">Income</option><option value="expense">Expense</option></select></Field>
          <Field label="Category"><input className={inputClass} required value={transaction.category} onChange={e=>setTransaction({...transaction,category:e.target.value})}/></Field>
          <Field label="Description"><textarea className={inputClass} required rows="2" value={transaction.description} onChange={e=>setTransaction({...transaction,description:e.target.value})}/></Field>
          <Field label="Amount (TZS)"><input className={inputClass} type="number" min="1" required value={transaction.amount} onChange={e=>setTransaction({...transaction,amount:e.target.value})}/></Field>
          <Field label={transaction.transaction_type==="income"?"Revenue account":"Expense account"}><select className={inputClass} required value={transaction.transaction_type==="income"?transaction.revenue_account_id:transaction.expense_account_id} onChange={e=>setTransaction({...transaction,[transaction.transaction_type==="income"?"revenue_account_id":"expense_account_id"]:e.target.value})}><option value="">Select Finance account</option>{(transaction.transaction_type==="income"?incomeAccounts:expenseAccounts).map(a=><option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</select></Field>
          <Field label="Cash / bank account"><select className={inputClass} required value={transaction.cash_account_id} onChange={e=>setTransaction({...transaction,cash_account_id:e.target.value})}><option value="">Select account</option>{data.options.cashAccounts.map(a=><option key={a.id} value={a.id}>{a.account_name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Date"><input className={inputClass} type="date" value={transaction.transaction_date} onChange={e=>setTransaction({...transaction,transaction_date:e.target.value})}/></Field><Field label="Payment method"><select className={inputClass} value={transaction.payment_method} onChange={e=>setTransaction({...transaction,payment_method:e.target.value})}><option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile_money">Mobile money</option>{transaction.transaction_type==="income"&&<><option value="cheque">Cheque</option><option value="other">Other</option></>}</select></Field></div>
          {transaction.transaction_type==="income"&&<><Field label="Payer name"><input className={inputClass} value={transaction.payer_name} onChange={e=>setTransaction({...transaction,payer_name:e.target.value})}/></Field><Field label="Student (optional)"><select className={inputClass} value={transaction.student_id} onChange={e=>setTransaction({...transaction,student_id:e.target.value})}><option value="">Not linked to a student</option>{data.students.map(s=><option key={s.id} value={s.id}>{label(s)}</option>)}</select></Field></>}
          <button className={buttonClass} disabled={busy}>Submit for HR review</button>
          <p className="text-xs text-slate-500">Submitted transactions remain pending and are not yet included in the General Journal.</p>
        </form></Panel>}
        <Panel title="Transport transactions"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Date / Ref</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead><tbody>{data.transactions.map(t=><tr key={t.id} className="border-b"><td className="p-2">{t.transaction_date}<br/><span className="text-xs text-slate-400">{t.transaction_number}</span></td><td className="p-2 capitalize">{t.transaction_type}</td><td className="p-2">{t.description}</td><td className="p-2">{money(t.amount)}</td><td className="p-2 capitalize">{t.status}</td></tr>)}</tbody></table>{!data.transactions.length&&<p className="p-4 text-slate-500">No transport transactions.</p>}</div></Panel>
      </div>}
      {activeTab === "HR Review" && <Panel title="Pending HR Manager review"><p className="mb-4 text-sm text-slate-600">HR Manager verifies each request. Approval posts the income or expense to Finance and the General Journal in one database transaction; duplicate approval is blocked.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Reference</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2">Amount</th><th className="p-2">Submitted</th>{canReview&&<th className="p-2">Action</th>}</tr></thead><tbody>{data.pending.map(t=><tr key={t.id} className="border-b align-top"><td className="p-2">{t.transaction_number}</td><td className="p-2 capitalize">{t.transaction_type}</td><td className="p-2">{t.description}</td><td className="p-2">{money(t.amount)}</td><td className="p-2">{new Date(t.submitted_at).toLocaleDateString()}</td>{canReview&&<td className="min-w-52 p-2"><div className="space-y-2"><button disabled={busy} onClick={async()=>{if(!window.confirm("Approve this transaction and post it to Finance and the General Journal?"))return;setBusy(true);setNotice("");try{await api.post(`/transport/finance/transactions/${t.id}/approve`);setNotice("Transaction approved and posted successfully.");await load();}catch(error){setNotice(error?.response?.data?.message||"Approval failed.");}finally{setBusy(false);}}} className={buttonClass}>Approve & Post</button><input className={inputClass} placeholder="Reason for rejection" value={rejectionReasons[t.id]||""} onChange={e=>setRejectionReasons({...rejectionReasons,[t.id]:e.target.value})}/><button disabled={busy||!(rejectionReasons[t.id]||"").trim()} onClick={async()=>{setBusy(true);setNotice("");try{await api.post(`/transport/finance/transactions/${t.id}/reject`,{reason:rejectionReasons[t.id]});setNotice("Transaction rejected.");await load();}catch(error){setNotice(error?.response?.data?.message||"Rejection failed.");}finally{setBusy(false);}}} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button></div></td>}</tr>)}</tbody></table>{!data.pending.length&&<p className="p-4 text-slate-500">No pending transactions.</p>}</div></Panel>}
    </>}
  </div>;
}
