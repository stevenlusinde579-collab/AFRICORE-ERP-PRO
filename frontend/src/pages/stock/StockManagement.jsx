import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { useRole } from "../../context/RoleContext";

const TABS = ["Overview", "Items", "Locations", "Movements", "Purchase Orders", "Student Uniform Orders", "Recommendations"];
const money = (n) => new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(n) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = { item_name: "", sku: "", category_id: "", default_location_id: "", variant_label: "", unit_of_measure: "pcs", reorder_level: "0", cost_price: "0", selling_price: "0", is_for_sale: false, track_expiry: false };

export default function StockManagement() {
  const { selectedSchoolId, selectedRoleId, selectedRoleName, isSuperAdmin } = useRole();
  const schoolId = selectedSchoolId;
  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [balances, setBalances] = useState([]);
  const [movements, setMovements] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentOrders, setStudentOrders] = useState([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationForm, setLocationForm] = useState({ name: "", description: "" });
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showStudentOrderForm, setShowStudentOrderForm] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [movementForm, setMovementForm] = useState({ item_id: "", location_id: "", movement_type: "receive", quantity: "", unit_cost: "0", movement_date: today(), expiry_date: "", batch_number: "", notes: "" });
  const [orderForm, setOrderForm] = useState({ supplier_id: "", expected_delivery_date: "", notes: "", item_id: "", quantity_ordered: "", unit_cost: "" });
  const [studentOrderForm, setStudentOrderForm] = useState({ student_id: "", item_id: "", quantity_ordered: "1", notes: "" });
  const [search, setSearch] = useState("");

  const isSuper = Boolean(isSuperAdmin) || Number(selectedRoleId) === 1;
  const role = String(selectedRoleName || "").trim().toLowerCase();
  const canManage = isSuper || role === "headmaster" || role === "accountant";
  const canApprove = isSuper || role === "headmaster";
  const canReceive = isSuper || role === "accountant";
  const canIssue = isSuper || role === "accountant" || role === "headmaster";

  const loadData = useCallback(async () => {
    if (!schoolId) { setItems([]); setCategories([]); setLocations([]); setBalances([]); setMovements([]); setPurchaseOrders([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      let itemQuery = supabase.from("stock_items").select("*, stock_categories(name)").order("item_name");
      let catQuery = supabase.from("stock_categories").select("*").eq("is_active", true).order("name");
      let locQuery = supabase.from("stock_locations").select("*").eq("is_active", true).order("name");
      let balanceQuery = supabase.from("stock_balances").select("*, stock_items(item_name,unit_of_measure,reorder_level,cost_price,is_for_sale), stock_locations(name)").order("updated_at", { ascending: false });
      let moveQuery = supabase.from("stock_movements").select("*, stock_items(item_name,unit_of_measure), stock_locations(name)").order("created_at", { ascending: false }).limit(100);
      let orderQuery = supabase.from("stock_purchase_orders").select("*, stock_purchase_order_items(id,item_id,quantity_ordered,quantity_received,unit_cost,stock_items(item_name))").order("created_at", { ascending: false }).limit(100);
      let supplierQuery = supabase.schema("finance").from("suppliers").select("id,supplier_name").eq("is_active", true).order("supplier_name");
      let studentQuery = supabase.from("students").select("id,first_name,middle_name,last_name,admission_number,admission_no").order("first_name");
      let studentOrderQuery = supabase.from("stock_student_orders").select("*, students(first_name,middle_name,last_name,admission_number,admission_no), stock_student_order_items(id,item_id,quantity_ordered,quantity_issued,unit_price,stock_items(item_name,variant_label))").order("created_at", { ascending: false }).limit(100);
      if (schoolId) {
        itemQuery = itemQuery.eq("school_id", schoolId);
        catQuery = catQuery.eq("school_id", schoolId);
        locQuery = locQuery.eq("school_id", schoolId);
        balanceQuery = balanceQuery.eq("school_id", schoolId);
        moveQuery = moveQuery.eq("school_id", schoolId);
        orderQuery = orderQuery.eq("school_id", schoolId);
        supplierQuery = supplierQuery.eq("school_id", schoolId);
        studentQuery = studentQuery.eq("school_id", schoolId);
        studentOrderQuery = studentOrderQuery.eq("school_id", schoolId);
      }
      const results = await Promise.all([itemQuery, catQuery, locQuery, balanceQuery, moveQuery, orderQuery, supplierQuery, studentQuery, studentOrderQuery]);
      for (const result of results) if (result.error) throw result.error;
      setItems(results[0].data || []); setCategories(results[1].data || []); setLocations(results[2].data || []);
      setBalances(results[3].data || []); setMovements(results[4].data || []); setPurchaseOrders(results[5].data || []);
      setSuppliers(results[6].data || []); setStudents(results[7].data || []); setStudentOrders(results[8].data || []);
    } catch (e) { setError(e.message || "Failed to load stock data."); }
    finally { setLoading(false); }
  }, [schoolId, isSuper]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalUnits = useMemo(() => balances.reduce((s, b) => s + Number(b.quantity_on_hand || 0), 0), [balances]);
  const stockValue = useMemo(() => balances.reduce((s, b) => s + Number(b.quantity_on_hand || 0) * Number(b.stock_items?.cost_price || 0), 0), [balances]);
  const lowStock = useMemo(() => {
    const totals = new Map();
    balances.forEach((b) => totals.set(b.item_id, (totals.get(b.item_id) || 0) + Number(b.quantity_on_hand || 0)));
    return items.filter((item) => (totals.get(item.id) || 0) <= Number(item.reorder_level || 0));
  }, [items, balances]);
  const pendingOrders = purchaseOrders.filter((o) => ["submitted", "approved", "partially_received"].includes(o.status));
  const expiringSoon = movements.filter((m) => m.expiry_date && new Date(m.expiry_date + "T00:00:00") >= new Date(today() + "T00:00:00") && new Date(m.expiry_date + "T00:00:00") <= new Date(Date.now() + 30 * 86400000));
  const filteredItems = items.filter((i) => [i.item_name, i.sku, i.stock_categories?.name].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase())));

  const createStore = async () => {
    const name = window.prompt("Enter store / warehouse name:", "Main Store");
    if (!name?.trim() || !schoolId) return;
    const { error: e } = await supabase.from("stock_locations").insert({ school_id: schoolId, name: name.trim(), created_by: (await supabase.auth.getUser()).data.user?.id });
    if (e) setError(e.message); else { setNotice("Store created."); await loadData(); }
  };
  const createCategory = async () => {
    const name = window.prompt("Enter stock category name (e.g. Food, Uniforms, Stationery):");
    if (!name?.trim() || !schoolId) return;
    const type = (window.prompt("Category type: food, uniform, stationery, equipment, cleaning, sports, general", "general") || "general").trim().toLowerCase();
    const allowed = ["food","uniform","stationery","equipment","cleaning","sports","general"];
    if (!allowed.includes(type)) { setError("Invalid category type."); return; }
    const { error: e } = await supabase.from("stock_categories").insert({ school_id: schoolId, name: name.trim(), category_type: type, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (e) setError(e.message); else { setNotice("Category created."); await loadData(); }
  };

  const saveLocation = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!schoolId) throw new Error("No active school selected.");
      if (!locationForm.name.trim()) throw new Error("Enter a store or location name.");
      const { error: e } = await supabase.from("stock_locations").insert({
        school_id: schoolId, name: locationForm.name.trim(),
        description: locationForm.description.trim() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id
      });
      if (e) throw e;
      setNotice("Store / location saved successfully.");
      setShowLocationForm(false); setLocationForm({ name: "", description: "" });
      await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const saveItem = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!schoolId) throw new Error("Chagua role yenye shule husika kwanza.");
      if (!itemForm.default_location_id) throw new Error("Select the store / location where this item will be kept.");
      const payload = { ...itemForm, school_id: schoolId, category_id: itemForm.category_id || null, default_location_id: Number(itemForm.default_location_id), sku: itemForm.sku || null, reorder_level: Number(itemForm.reorder_level), cost_price: Number(itemForm.cost_price), selling_price: Number(itemForm.selling_price), created_by: (await supabase.auth.getUser()).data.user?.id };
      const { error: e } = await supabase.from("stock_items").insert(payload);
      if (e) throw e;
      setNotice("Stock item added successfully."); setShowItemForm(false); setItemForm(emptyItem); await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const startOpeningStock = (item) => {
    if (!canReceive) { setError("Only the Accountant can record opening stock."); return; }
    if (!item.default_location_id) { setError("Set a default store/location for this item first."); return; }
    setError(""); setNotice("");
    setMovementForm({
      item_id: String(item.id), location_id: String(item.default_location_id),
      movement_type: "opening", quantity: "", unit_cost: String(item.cost_price || 0),
      movement_date: today(), expiry_date: "", batch_number: "",
      notes: "Initial opening stock balance"
    });
    setShowMovementForm(true);
  };

  const saveMovement = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!schoolId) throw new Error("No active school selected.");
      const qty = Number(movementForm.quantity);
      if (!(qty > 0)) throw new Error("Quantity must be greater than zero.");
      if (["receive", "opening", "return", "adjustment_in"].includes(movementForm.movement_type) && !canReceive) throw new Error("You do not have permission to receive stock.");
      if (["issue", "sale", "damaged", "expired", "adjustment_out"].includes(movementForm.movement_type) && !canIssue) throw new Error("You do not have permission to issue stock.");
      const { error: e } = await supabase.from("stock_movements").insert({ ...movementForm, school_id: schoolId, quantity: qty, unit_cost: Number(movementForm.unit_cost || 0), expiry_date: movementForm.expiry_date || null, batch_number: movementForm.batch_number || null, created_by: (await supabase.auth.getUser()).data.user?.id });
      if (e) throw e;
      setNotice("Stock movement recorded and balance updated."); setShowMovementForm(false);
      setMovementForm({ item_id: "", location_id: "", movement_type: "receive", quantity: "", unit_cost: "0", movement_date: today(), expiry_date: "", batch_number: "", notes: "" }); await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const createPurchaseOrder = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!schoolId) throw new Error("No active school selected.");
      if (!orderForm.item_id || !(Number(orderForm.quantity_ordered) > 0)) throw new Error("Choose an item and enter a valid quantity.");
      const number = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const user = (await supabase.auth.getUser()).data.user;
      const { data: order, error: orderError } = await supabase.from("stock_purchase_orders").insert({
        school_id: schoolId, supplier_id: orderForm.supplier_id || null, order_number: number,
        expected_delivery_date: orderForm.expected_delivery_date || null, notes: orderForm.notes,
        status: "draft", created_by: user?.id,
        total_amount: Number(orderForm.quantity_ordered) * Number(orderForm.unit_cost || 0)
      }).select("id").single();
      if (orderError) throw orderError;
      const { error: lineError } = await supabase.from("stock_purchase_order_items").insert({
        school_id: schoolId, purchase_order_id: order.id, item_id: Number(orderForm.item_id),
        quantity_ordered: Number(orderForm.quantity_ordered), unit_cost: Number(orderForm.unit_cost || 0)
      });
      if (lineError) throw lineError;
      setNotice(`Purchase order ${number} saved as draft. Submit it for approval through the order workflow.`);
      setShowOrderForm(false); setOrderForm({ supplier_id: "", expected_delivery_date: "", notes: "", item_id: "", quantity_ordered: "", unit_cost: "" }); await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const createStudentOrder = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!schoolId) throw new Error("No active school selected.");
      const quantity = Number(studentOrderForm.quantity_ordered);
      const item = items.find((i) => String(i.id) === String(studentOrderForm.item_id));
      if (!studentOrderForm.student_id || !item || !(quantity > 0)) throw new Error("Choose a student, item and valid quantity.");
      if (!item.is_for_sale) throw new Error("This item is not configured for sale to students.");
      const user = (await supabase.auth.getUser()).data.user;
      const orderNumber = `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const { data: order, error: orderError } = await supabase.from("stock_student_orders").insert({
        school_id: schoolId, student_id: Number(studentOrderForm.student_id), order_number: orderNumber,
        status: "pending", payment_status: "unpaid", total_amount: quantity * Number(item.selling_price || 0),
        notes: studentOrderForm.notes, created_by: user?.id
      }).select("id").single();
      if (orderError) throw orderError;
      const { error: lineError } = await supabase.from("stock_student_order_items").insert({
        school_id: schoolId, student_order_id: order.id, item_id: item.id,
        quantity_ordered: quantity, unit_price: Number(item.selling_price || 0)
      });
      if (lineError) throw lineError;
      setNotice(`Student order ${orderNumber} saved. It is pending fulfilment and payment recording.`);
      setShowStudentOrderForm(false); setStudentOrderForm({ student_id: "", item_id: "", quantity_ordered: "1", notes: "" }); await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const updateOrderStatus = async (order, status) => {
    setSaving(true); setError(""); setNotice("");
    try {
      const patch = { status };
      if (status === "approved") { patch.approved_at = new Date().toISOString(); patch.approved_by = (await supabase.auth.getUser()).data.user?.id; }
      const { error: e } = await supabase.from("stock_purchase_orders").update(patch).eq("id", order.id).eq("school_id", schoolId);
      if (e) throw e;
      setNotice(`Order ${order.order_number} updated to ${status}.`); await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const receiveOrderLine = async (order, line) => {
    const remaining = Number(line.quantity_ordered) - Number(line.quantity_received);
    const value = window.prompt(`Enter quantity received (remaining: ${remaining}):`, String(remaining));
    if (value === null) return;
    const qty = Number(value);
    if (!(qty > 0) || qty > remaining) { setError("Enter a valid quantity not greater than the outstanding order quantity."); return; }
    const locationId = locations[0]?.id;
    if (!locationId) { setError("Create a stock location before receiving goods."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: e } = await supabase.rpc("receive_stock_purchase_order_item", {
        p_order_item_id: line.id, p_quantity: qty, p_location_id: locationId
      });
      if (e) throw e;
      setNotice("Goods received. Stock balance and purchase order were updated together."); await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const fulfilStudentOrder = async (order, line) => {
    const locationId = locations[0]?.id;
    if (!locationId) { setError("Create a stock location before issuing uniform."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: e } = await supabase.rpc("fulfil_stock_student_order_item", {
        p_order_item_id: line.id, p_location_id: locationId
      });
      if (e) throw e;
      setNotice("Uniform issued and stock balance updated. Record/confirm payment through the school's approved Finance process."); await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading Stock Management…</div>;
  if (!schoolId) return <div className="p-8"><h1 className="text-2xl font-bold">Stock Management</h1><p className="mt-3 text-amber-700">No school is selected for this role. Switch to your Headmaster or Accountant role to access school stock.</p></div>;

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm text-slate-500">School Operations</p><h1 className="text-2xl md:text-3xl font-bold text-slate-900">Stock Management</h1><p className="mt-1 text-sm text-slate-500">Inventory, purchasing, store issues and replenishment recommendations</p></div>
      <div className="flex flex-wrap gap-2">
        {canManage && <button onClick={() => setShowLocationForm(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Add Store / Location</button>}
        {canManage && <button onClick={() => setShowItemForm(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Add Item</button>}
        {canManage && <button onClick={() => setShowOrderForm(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">New Purchase Order</button>}
        {(canReceive || canIssue) && <button onClick={() => setShowMovementForm(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Record Movement</button>}
      </div>
    </div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[["Stock Items", items.length],["Total Units", totalUnits.toLocaleString()],["Low / Reorder", lowStock.length],["Stock Value", money(stockValue)]].map(([label,value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}
    </div>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((name) => <button key={name} onClick={() => setTab(name)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === name ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{name}</button>)}
    </div>

    {tab === "Overview" && <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-slate-900">Stock Alerts</h2><p className="mt-1 text-sm text-slate-500">Items at or below their reorder level</p>{lowStock.length ? <div className="mt-4 divide-y">{lowStock.map((i) => <div key={i.id} className="flex justify-between gap-3 py-3"><div><p className="font-semibold">{i.item_name}</p><p className="text-xs text-slate-500">{i.stock_categories?.name || "Uncategorised"} · Reorder at {i.reorder_level} {i.unit_of_measure}</p></div><span className="h-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Low stock</span></div>)}</div> : <p className="py-6 text-sm text-emerald-700">No low-stock alerts.</p>}</section>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-slate-900">Expiry Alerts (next 30 days)</h2><p className="mt-1 text-sm text-slate-500">Stock receipts with recorded expiry dates</p>{expiringSoon.length ? <div className="mt-4 divide-y">{expiringSoon.map((m) => <div key={m.id} className="flex justify-between gap-3 py-3"><div><p className="font-semibold">{m.stock_items?.item_name}</p><p className="text-xs text-slate-500">Batch {m.batch_number || "—"} · {m.quantity} units</p></div><span className="text-xs font-semibold text-amber-700">{m.expiry_date}</span></div>)}</div> : <p className="py-6 text-sm text-emerald-700">No recorded expiry dates within 30 days.</p>}</section>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-slate-900">Purchase Orders Requiring Attention</h2><p className="mt-1 text-sm text-slate-500">{pendingOrders.length} open orders</p>{pendingOrders.length ? <div className="mt-4 divide-y">{pendingOrders.slice(0,8).map((o) => <div key={o.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{o.order_number}</p><p className="text-xs text-slate-500">{o.status.replaceAll("_"," ")} · {money(o.total_amount)}</p></div><button className="text-sm font-semibold text-blue-700" onClick={() => setTab("Purchase Orders")}>View</button></div>)}</div> : <p className="py-6 text-sm text-slate-500">No outstanding purchase orders.</p>}</section>
      <section className="rounded-xl border bg-white p-5 lg:col-span-2"><h2 className="font-bold text-slate-900">Recent Stock Activity</h2>{movements.slice(0,8).map((m) => <div key={m.id} className="flex flex-wrap justify-between gap-2 border-b py-3 last:border-0"><div><p className="font-medium">{m.stock_items?.item_name}</p><p className="text-xs text-slate-500">{m.movement_type.replaceAll("_"," ")} · {m.stock_locations?.name} · {m.movement_date}</p></div><p className="font-semibold tabular-nums">{m.quantity} {m.stock_items?.unit_of_measure}</p></div>)}{!movements.length && <p className="py-5 text-sm text-slate-500">No stock activity recorded yet.</p>}</section>
    </div>}

    {tab === "Locations" && <section className="rounded-xl border bg-white p-4 md:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Stores & Locations</h2><p className="text-sm text-slate-500">Manage school stores, kitchens, uniform rooms and other stock locations.</p></div>{canManage && <button onClick={()=>setShowLocationForm(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Add Location</button>}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{locations.map(l=><div key={l.id} className="rounded-lg border p-4"><p className="font-semibold">{l.name}</p><p className="mt-1 text-sm text-slate-500">{l.description || "No description"}</p><p className="mt-2 text-xs text-slate-500">{items.filter(i=>String(i.default_location_id)===String(l.id)).length} assigned item(s)</p></div>)}</div>{!locations.length && <p className="py-8 text-center text-sm text-slate-500">No stores or locations have been added yet.</p>}</section>}

    {tab === "Items" && <section className="rounded-xl border bg-white p-4 md:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Items & Categories</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item, SKU or category…" className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm"/></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Category</th><th className="p-3">Unit</th><th className="p-3">Default Location</th><th className="p-3">Balance</th><th className="p-3">Reorder level</th><th className="p-3">Cost</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y">{filteredItems.map((i) => { const qty = balances.filter((b) => b.item_id === i.id).reduce((s,b) => s + Number(b.quantity_on_hand || 0),0); return <tr key={i.id}><td className="p-3"><p className="font-semibold">{i.item_name}</p><p className="text-xs text-slate-500">{[i.variant_label,i.sku].filter(Boolean).join(" · ") || "No SKU"}</p></td><td className="p-3">{i.stock_categories?.name || "—"}</td><td className="p-3">{i.unit_of_measure}</td><td className="p-3">{locations.find(l=>String(l.id)===String(i.default_location_id))?.name || "—"}</td><td className="p-3 font-semibold">{qty}</td><td className="p-3">{i.reorder_level}</td><td className="p-3">{money(i.cost_price)}</td><td className="p-3">{canReceive && <button type="button" onClick={() => startOpeningStock(i)} className="whitespace-nowrap rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Set Opening Stock</button>}</td></tr>; })}</tbody></table></div>{!filteredItems.length && <p className="py-8 text-center text-sm text-slate-500">No stock items yet.</p>}</section>}

    {tab === "Movements" && <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-bold">Stock Movement Register</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Item</th><th className="p-3">Type</th><th className="p-3">Store</th><th className="p-3">Quantity</th><th className="p-3">Batch</th><th className="p-3">Expiry</th><th className="p-3">Reference</th></tr></thead><tbody className="divide-y">{movements.map((m) => <tr key={m.id}><td className="p-3">{m.movement_date}</td><td className="p-3">{m.stock_items?.item_name}</td><td className="p-3 capitalize">{m.movement_type.replaceAll("_"," ")}</td><td className="p-3">{m.stock_locations?.name}</td><td className="p-3 font-semibold">{m.quantity}</td><td className="p-3">{m.batch_number || "—"}</td><td className="p-3">{m.expiry_date || "—"}</td><td className="p-3">{m.reference_number || "—"}</td></tr>)}</tbody></table></div></section>}

    {tab === "Purchase Orders" && <section className="space-y-3">{purchaseOrders.map((o) => <div key={o.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{o.order_number}</p><p className="text-xs text-slate-500">{suppliers.find((s) => s.id === o.supplier_id)?.supplier_name || "No supplier"} · {o.order_date} · {money(o.total_amount)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{o.status.replaceAll("_"," ")}</span></div><div className="mt-3 space-y-2">{(o.stock_purchase_order_items || []).map((line) => <div key={line.id} className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"><span>{line.stock_items?.item_name}</span><span>{line.quantity_received} / {line.quantity_ordered} received</span>{canReceive && ["approved","partially_received"].includes(o.status) && Number(line.quantity_received) < Number(line.quantity_ordered) && <button onClick={() => receiveOrderLine(o,line)} className="font-semibold text-blue-700">Receive goods</button>}</div>)}</div><div className="mt-3 flex flex-wrap gap-2">{canManage && o.status === "draft" && <button disabled={saving} onClick={() => updateOrderStatus(o,"submitted")} className="rounded-lg border px-3 py-2 text-xs font-semibold">Submit for approval</button>}{canApprove && o.status === "submitted" && <button disabled={saving} onClick={() => updateOrderStatus(o,"approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Approve order</button>}{canApprove && ["draft","submitted"].includes(o.status) && <button disabled={saving} onClick={() => updateOrderStatus(o,"cancelled")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Cancel</button>}</div></div>)}{!purchaseOrders.length && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No purchase orders yet.</div>}</section>}

    {tab === "Student Uniform Orders" && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Student Uniform Orders</h2><p className="text-sm text-slate-500">Track student requests, issued items and outstanding fulfilment.</p></div>{canManage && <button onClick={() => setShowStudentOrderForm(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">New Student Order</button>}</div>{studentOrders.map((o) => <div key={o.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{o.order_number} · {[o.students?.first_name,o.students?.middle_name,o.students?.last_name].filter(Boolean).join(" ")}</p><p className="text-xs text-slate-500">Admission: {o.students?.admission_number || o.students?.admission_no || "—"} · {o.order_date} · {money(o.total_amount)}</p></div><div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">{o.status.replaceAll("_"," ")}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-xs capitalize">{o.payment_status}</span></div></div>{(o.stock_student_order_items || []).map((line) => <div key={line.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"><span>{line.stock_items?.item_name} {line.stock_items?.variant_label || ""}</span><span>{line.quantity_issued} / {line.quantity_ordered} issued</span>{canIssue && Number(line.quantity_issued) < Number(line.quantity_ordered) && o.status !== "cancelled" && <button disabled={saving} onClick={() => fulfilStudentOrder(o,line)} className="font-semibold text-blue-700">Issue uniform</button>}</div>)}</div>)}{!studentOrders.length && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No student uniform orders have been entered.</div>}<p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Issuing uniform updates stock. Payment status is not automatically marked as paid; use the existing Finance receipt workflow to record actual payments, avoiding duplicate receipts.</p></section>}

    {tab === "Recommendations" && <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Replenishment Recommendations</h2><p className="mt-1 text-sm text-slate-500">Based on recorded balances and configured reorder levels. Forecasting improves as the school records regular stock issues.</p><div className="mt-4 divide-y">{lowStock.map((i) => { const qty = balances.filter((b) => b.item_id === i.id).reduce((s,b) => s + Number(b.quantity_on_hand || 0),0); const target = Math.max(Number(i.reorder_level || 0) * 2, Number(i.reorder_level || 0) + 1); return <div key={i.id} className="py-3"><p className="font-semibold">{i.item_name}</p><p className="text-sm text-slate-600">Available: {qty} {i.unit_of_measure}. Reorder level: {i.reorder_level}. Suggested replenishment: {Math.max(0,target-qty)} {i.unit_of_measure}.</p></div>; })}{!lowStock.length && <p className="py-5 text-sm text-emerald-700">Current stock is above all configured reorder levels.</p>}</div><p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Recommendations are rule-based, not AI forecasts. The system does not invent daily consumption or supplier lead times when there is not enough recorded history.</p></section>}

    {showLocationForm && <Modal title="Add Store / Location" onClose={() => setShowLocationForm(false)}><form onSubmit={saveLocation} className="grid gap-3"><Field label="Store / location name" required><input required value={locationForm.name} onChange={(e)=>setLocationForm({...locationForm,name:e.target.value})} placeholder="e.g. Main Store, Kitchen Store, Uniform Room" className="control"/></Field><Field label="Description"><textarea rows="3" value={locationForm.description} onChange={(e)=>setLocationForm({...locationForm,description:e.target.value})} placeholder="Describe what is stored here" className="control"/></Field><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowLocationForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Location"}</button></div></form></Modal>}

    {showItemForm && <Modal title="Add Stock Item" onClose={() => setShowItemForm(false)}><form onSubmit={saveItem} className="grid gap-3 md:grid-cols-2"><Field label="Item name" required><input required value={itemForm.item_name} onChange={(e)=>setItemForm({...itemForm,item_name:e.target.value})} className="control"/></Field><Field label="SKU / Code"><input value={itemForm.sku} onChange={(e)=>setItemForm({...itemForm,sku:e.target.value})} className="control"/></Field><Field label="Default store / location" required><select required value={itemForm.default_location_id} onChange={(e)=>setItemForm({...itemForm,default_location_id:e.target.value})} className="control"><option value="">Select store / location</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>{!locations.length && <span className="mt-1 block text-xs text-amber-700">Create a store/location first using “Add Store / Location”.</span>}</Field><Field label="Category"><select value={itemForm.category_id} onChange={(e)=>setItemForm({...itemForm,category_id:e.target.value})} className="control"><option value="">Uncategorised</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Variant (size / colour / type)"><input value={itemForm.variant_label} onChange={(e)=>setItemForm({...itemForm,variant_label:e.target.value})} className="control"/></Field><Field label="Unit of measure"><input value={itemForm.unit_of_measure} onChange={(e)=>setItemForm({...itemForm,unit_of_measure:e.target.value})} className="control"/></Field><Field label="Reorder level"><input type="number" min="0" step="0.001" value={itemForm.reorder_level} onChange={(e)=>setItemForm({...itemForm,reorder_level:e.target.value})} className="control"/></Field><Field label="Cost price (TZS)"><input type="number" min="0" step="0.01" value={itemForm.cost_price} onChange={(e)=>setItemForm({...itemForm,cost_price:e.target.value})} className="control"/></Field><Field label="Selling price (TZS)"><input type="number" min="0" step="0.01" value={itemForm.selling_price} onChange={(e)=>setItemForm({...itemForm,selling_price:e.target.value})} className="control"/></Field><div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={itemForm.is_for_sale} onChange={(e)=>setItemForm({...itemForm,is_for_sale:e.target.checked})}/> Sold to students</label><label><input type="checkbox" checked={itemForm.track_expiry} onChange={(e)=>setItemForm({...itemForm,track_expiry:e.target.checked})}/> Track expiry</label></div><div className="md:col-span-2 flex justify-end gap-2"><button type="button" onClick={()=>setShowItemForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Item"}</button></div></form></Modal>}

    {showMovementForm && <Modal title={movementForm.movement_type === "opening" ? "Set Opening Stock" : "Record Stock Movement"} onClose={()=>setShowMovementForm(false)}><form onSubmit={saveMovement} className="grid gap-3"><Field label="Item" required><select required value={movementForm.item_id} onChange={(e)=>{const selected=items.find(i=>String(i.id)===e.target.value);setMovementForm({...movementForm,item_id:e.target.value,location_id:selected?.default_location_id ? String(selected.default_location_id) : movementForm.location_id});}} className="control"><option value="">Select item</option>{items.map(i=><option key={i.id} value={i.id}>{i.item_name}</option>)}</select></Field><Field label="Store / Location" required><select required value={movementForm.location_id} onChange={(e)=>setMovementForm({...movementForm,location_id:e.target.value})} className="control"><option value="">Select store</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><Field label="Movement type" required><select value={movementForm.movement_type} onChange={(e)=>setMovementForm({...movementForm,movement_type:e.target.value})} className="control">{["receive","opening","return","issue","sale","damaged","expired","adjustment_in","adjustment_out"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></Field><Field label="Quantity" required><input type="number" min="0.001" step="0.001" required value={movementForm.quantity} onChange={(e)=>setMovementForm({...movementForm,quantity:e.target.value})} className="control"/></Field><Field label="Unit cost (TZS)"><input type="number" min="0" step="0.01" value={movementForm.unit_cost} onChange={(e)=>setMovementForm({...movementForm,unit_cost:e.target.value})} className="control"/></Field><Field label="Date"><input type="date" value={movementForm.movement_date} onChange={(e)=>setMovementForm({...movementForm,movement_date:e.target.value})} className="control"/></Field><Field label="Batch number"><input value={movementForm.batch_number} onChange={(e)=>setMovementForm({...movementForm,batch_number:e.target.value})} className="control"/></Field><Field label="Expiry date (if applicable)"><input type="date" value={movementForm.expiry_date} onChange={(e)=>setMovementForm({...movementForm,expiry_date:e.target.value})} className="control"/></Field><Field label="Notes / reference"><input value={movementForm.notes} onChange={(e)=>setMovementForm({...movementForm,notes:e.target.value})} className="control"/></Field><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowMovementForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Record Movement"}</button></div></form></Modal>}

    {showStudentOrderForm && <Modal title="Create Student Uniform Order" onClose={() => setShowStudentOrderForm(false)}><form onSubmit={createStudentOrder} className="grid gap-3"><Field label="Student" required><select required value={studentOrderForm.student_id} onChange={(e)=>setStudentOrderForm({...studentOrderForm,student_id:e.target.value})} className="control"><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(" ")} · {s.admission_number || s.admission_no || s.id}</option>)}</select></Field><Field label="Uniform / item" required><select required value={studentOrderForm.item_id} onChange={(e)=>setStudentOrderForm({...studentOrderForm,item_id:e.target.value})} className="control"><option value="">Select sale item</option>{items.filter(i=>i.is_for_sale).map(i=><option key={i.id} value={i.id}>{i.item_name} {i.variant_label || ""} · {money(i.selling_price)}</option>)}</select></Field><Field label="Quantity" required><input type="number" min="1" step="1" required value={studentOrderForm.quantity_ordered} onChange={(e)=>setStudentOrderForm({...studentOrderForm,quantity_ordered:e.target.value})} className="control"/></Field><Field label="Notes"><textarea rows="2" value={studentOrderForm.notes} onChange={(e)=>setStudentOrderForm({...studentOrderForm,notes:e.target.value})} className="control"/></Field><p className="text-xs text-slate-500">The order will be saved as unpaid. Stock is deducted only when the item is issued. Record the actual payment separately through Finance.</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowStudentOrderForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Student Order"}</button></div></form></Modal>}

    {showOrderForm && <Modal title="Create Purchase Order" onClose={()=>setShowOrderForm(false)}><form onSubmit={createPurchaseOrder} className="grid gap-3"><Field label="Supplier"><select value={orderForm.supplier_id} onChange={(e)=>setOrderForm({...orderForm,supplier_id:e.target.value})} className="control"><option value="">Choose supplier (optional)</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.supplier_name}</option>)}</select></Field><Field label="Item" required><select required value={orderForm.item_id} onChange={(e)=>setOrderForm({...orderForm,item_id:e.target.value})} className="control"><option value="">Select item</option>{items.map(i=><option key={i.id} value={i.id}>{i.item_name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Quantity" required><input required type="number" min="0.001" step="0.001" value={orderForm.quantity_ordered} onChange={(e)=>setOrderForm({...orderForm,quantity_ordered:e.target.value})} className="control"/></Field><Field label="Unit cost (TZS)"><input type="number" min="0" step="0.01" value={orderForm.unit_cost} onChange={(e)=>setOrderForm({...orderForm,unit_cost:e.target.value})} className="control"/></Field></div><Field label="Expected delivery"><input type="date" value={orderForm.expected_delivery_date} onChange={(e)=>setOrderForm({...orderForm,expected_delivery_date:e.target.value})} className="control"/></Field><Field label="Notes"><textarea rows="2" value={orderForm.notes} onChange={(e)=>setOrderForm({...orderForm,notes:e.target.value})} className="control"/></Field><p className="text-xs text-slate-500">The order is saved as a draft. Submitting it does not create an expense or reduce cash. Receive goods separately when delivered.</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowOrderForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Draft"}</button></div></form></Modal>}
    <style>{`.control{width:100%;border:1px solid #cbd5e1;border-radius:.5rem;padding:.6rem .75rem;background:white;color:#0f172a}.control:focus{outline:2px solid #93c5fd;outline-offset:1px}`}</style>
  </main>;
}

function Field({ label, required, children }) { return <label className="block text-sm font-medium text-slate-700">{label}{required?" *":""}<div className="mt-1">{children}</div></label>; }
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Close</button></div>{children}</div></div>; }
