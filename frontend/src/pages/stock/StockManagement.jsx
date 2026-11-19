import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { useRole } from "../../context/RoleContext";
import { FaBoxes, FaCoins, FaTruck, FaWarehouse, FaExclamationTriangle, FaClipboardList, FaChartLine } from "react-icons/fa";

const TABS = ["Overview", "Items", "Locations", "Movements", "Purchase Orders", "Student Uniform Orders", "Finance Approvals", "Recommendations"];
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
  const [financeRequests, setFinanceRequests] = useState([]);
  const [financeAccounts, setFinanceAccounts] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [approvalSelections, setApprovalSelections] = useState({});
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
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ order_id: "", amount: "", payment_method: "cash", payment_date: today(), payment_reference: "", notes: "" });
  const [search, setSearch] = useState("");

  const isSuper = Boolean(isSuperAdmin) || Number(selectedRoleId) === 1;
  const role = String(selectedRoleName || "").trim().toLowerCase();
  const canManage = isSuper || role === "headmaster" || role === "accountant";
  const canApprove = isSuper || role === "headmaster";
  const canApproveFinance = role === "headmaster";
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
      let financeRequestQuery = supabase.from("stock_finance_approval_requests").select("*").order("created_at", { ascending: false });
       let financeAccountQuery = supabase.schema("finance").from("chart_of_accounts").select("id,account_code,account_name,account_type").eq("is_active", true).order("account_code");
       let cashAccountQuery = supabase.schema("finance").from("cash_accounts").select("id,account_name,account_type").eq("is_active", true).order("account_name");
       let studentOrderQuery = supabase.from("stock_student_orders").select("*, students(first_name,middle_name,last_name,parent_name,guardian_name,admission_number,admission_no), stock_student_order_items(id,item_id,quantity_ordered,quantity_issued,unit_price,stock_items(item_name,variant_label)), stock_student_order_payments(id,amount,payment_method,payment_reference,payment_date,notes,created_at)").order("created_at", { ascending: false }).limit(1000);
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
         financeRequestQuery = financeRequestQuery.eq("school_id", schoolId);
         financeAccountQuery = financeAccountQuery.eq("school_id", schoolId);
         cashAccountQuery = cashAccountQuery.eq("school_id", schoolId);
      }
      const results = await Promise.all([itemQuery, catQuery, locQuery, balanceQuery, moveQuery, orderQuery, supplierQuery, studentQuery, studentOrderQuery, financeRequestQuery.range(0, 999), financeAccountQuery, cashAccountQuery]);
      for (const result of results) if (result.error) throw result.error;
      setItems(results[0].data || []); setCategories(results[1].data || []); setLocations(results[2].data || []);
      setBalances(results[3].data || []); setMovements(results[4].data || []); setPurchaseOrders(results[5].data || []);
      setSuppliers(results[6].data || []); setStudents(results[7].data || []); setStudentOrders(results[8].data || []);
       let allFinanceRequests = results[9].data || [];
       for (let offset = 1000; allFinanceRequests.length >= offset; offset += 1000) {
         const { data: page, error: pageError } = await financeRequestQuery.range(offset, offset + 999);
         if (pageError) throw pageError;
         allFinanceRequests = allFinanceRequests.concat(page || []);
         if (!page || page.length < 1000) break;
       }
       setFinanceRequests(allFinanceRequests); setFinanceAccounts(results[10].data || []); setCashAccounts(results[11].data || []);
    } catch (e) { setError(e.message || "Failed to load stock data."); }
    finally { setLoading(false); }
  }, [schoolId, isSuper]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalUnits = useMemo(() => balances.reduce((s, b) => s + Number(b.quantity_on_hand || 0), 0), [balances]);
  const itemUnitBreakdown = useMemo(() => items.map((item) => ({
    id: item.id,
    name: item.item_name,
    quantity: balances.filter((balance) => String(balance.item_id) === String(item.id))
      .reduce((sum, balance) => sum + Number(balance.quantity_on_hand || 0), 0),
    unit: item.unit_of_measure || "units"
  })), [items, balances]);
  const stockValue = useMemo(() => balances.reduce((s, b) => s + Number(b.quantity_on_hand || 0) * Number(b.stock_items?.cost_price || 0), 0), [balances]);
  const itemStockValueBreakdown = useMemo(() => items.map((item) => {
    const quantity = balances.filter((balance) => String(balance.item_id) === String(item.id))
      .reduce((sum, balance) => sum + Number(balance.quantity_on_hand || 0), 0);
    const unitCost = Number(item.cost_price || 0);
    return { id: item.id, name: item.item_name, quantity, unit: item.unit_of_measure || "units", unitCost, value: quantity * unitCost };
  }), [items, balances]);
  const lowStock = useMemo(() => {
    const totals = new Map();
    balances.forEach((b) => totals.set(b.item_id, (totals.get(b.item_id) || 0) + Number(b.quantity_on_hand || 0)));
    return items.filter((item) => Number(item.reorder_level || 0) > 0 && (totals.get(item.id) || 0) < Number(item.reorder_level || 0));
  }, [items, balances]);
  const pendingOrders = purchaseOrders.filter((o) => ["submitted", "approved", "partially_received"].includes(o.status));
  // Show received/paid operational totals immediately, while keeping pending Finance
  // approvals transparent and excluding rejected requests from the totals.
  const salesFinanceRequests = useMemo(() => financeRequests
    .filter((request) => request.request_type === "student_order_payment" && request.status !== "rejected"), [financeRequests]);
  const goodsFinanceRequests = useMemo(() => financeRequests
    .filter((request) => request.request_type === "purchase_receipt" && request.status !== "rejected"), [financeRequests]);
  const approvedSalesIncome = useMemo(() => salesFinanceRequests
    .reduce((sum, request) => sum + Number(request.amount || 0), 0), [salesFinanceRequests]);
  const approvedReceivedGoodsCost = useMemo(() => goodsFinanceRequests
    .reduce((sum, request) => sum + Number(request.amount || 0), 0), [goodsFinanceRequests]);
  const pendingSalesIncome = useMemo(() => salesFinanceRequests
    .filter((request) => request.status === "pending")
    .reduce((sum, request) => sum + Number(request.amount || 0), 0), [salesFinanceRequests]);
  const pendingReceivedGoodsCost = useMemo(() => goodsFinanceRequests
    .filter((request) => request.status === "pending")
    .reduce((sum, request) => sum + Number(request.amount || 0), 0), [goodsFinanceRequests]);
  const pendingFinanceCount = useMemo(() => financeRequests.filter((request) => request.status === "pending").length, [financeRequests]);
  const expiringSoon = movements.filter((m) => m.expiry_date && new Date(m.expiry_date + "T00:00:00") >= new Date(today() + "T00:00:00") && new Date(m.expiry_date + "T00:00:00") <= new Date(Date.now() + 30 * 86400000));
  const filteredItems = items.filter((i) => [i.item_name, i.sku, i.stock_categories?.name].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase())));
  const studentOrderStockSummary = useMemo(() => {
    const reserved = new Map();
    for (const order of studentOrders) {
      if (!["pending", "partially_fulfilled"].includes(String(order.status))) continue;
      for (const line of order.stock_student_order_items || []) {
        const remaining = Math.max(0, Number(line.quantity_ordered || 0) - Number(line.quantity_issued || 0));
        reserved.set(Number(line.item_id), (reserved.get(Number(line.item_id)) || 0) + remaining);
      }
    }
    const rows = items.map((item) => {
      const onHand = balances.filter((balance) => Number(balance.item_id) === Number(item.id))
        .reduce((sum, balance) => sum + Number(balance.quantity_on_hand || 0), 0);
      const reservedQty = reserved.get(Number(item.id)) || 0;
      return { id: item.id, name: item.item_name, unit: item.unit_of_measure || "pcs", onHand, reserved: reservedQty, shortage: Math.max(0, reservedQty - onHand) };
    }).filter((row) => row.reserved > 0);
    return { rows, shortageRows: rows.filter((row) => row.shortage > 0), reservedUnits: rows.reduce((sum, row) => sum + row.reserved, 0) };
  }, [studentOrders, items, balances]);

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

  const startExpiredStock = (item) => {
    if (!canIssue) { setError("Only the Headmaster or Accountant can record expired stock."); return; }
    if (!item.default_location_id) { setError("Set a default store/location for this item first."); return; }
    setError(""); setNotice("");
    setMovementForm({
      item_id: String(item.id), location_id: String(item.default_location_id),
      movement_type: "expired", quantity: "", unit_cost: String(item.cost_price || 0),
      movement_date: today(), expiry_date: today(), batch_number: "",
      notes: "Expired stock removed from available balance"
    });
    setShowMovementForm(true);
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

  const openPaymentForm = (order) => {
    const paid = (order.stock_student_order_payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balance = Math.max(0, Number(order.total_amount || 0) - paid);
    if (balance <= 0) { setNotice("This order is already fully paid."); return; }
    setPaymentForm({ order_id: String(order.id), amount: balance.toFixed(2), payment_method: "cash", payment_date: today(), payment_reference: "", notes: "" });
    setError(""); setNotice(""); setShowPaymentForm(true);
  };

  const recordStudentOrderPayment = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const amount = Number(paymentForm.amount);
      if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Enter a valid payment amount.");
      const { data, error: paymentError } = await supabase.rpc("record_stock_student_order_payment", {
        p_order_id: Number(paymentForm.order_id),
        p_amount: amount,
        p_payment_method: paymentForm.payment_method,
        p_payment_date: paymentForm.payment_date || today(),
        p_payment_reference: paymentForm.payment_reference.trim() || null,
        p_notes: paymentForm.notes.trim() || null
      });
      if (paymentError) throw paymentError;
      setNotice(`Payment recorded successfully. Total paid: ${money(data?.amount_paid)} · Balance: ${money(data?.balance)} · Status: ${data?.payment_status}.`);
      setShowPaymentForm(false);
      await loadData();
    } catch (e) { setError(e.message || "Unable to record payment."); }
    finally { setSaving(false); }
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

  const submitStockFinanceRequest = async (type, sourceId) => {
    setSaving(true); setError(""); setNotice("");
    try { const { data, error: e } = await supabase.rpc("submit_stock_finance_approval_request", { p_request_type: type, p_source_id: sourceId }); if (e) throw e; setNotice(`Request #${data?.request_id || ""} sent to Headmaster for Finance approval.`); await loadData(); }
    catch (e) { setError(e.message || "Unable to submit Finance request."); } finally { setSaving(false); }
  };

  const approveFinanceRequest = async (request) => {
    const selection = approvalSelections[request.id] || {};
    if (!selection.account_id) { setError("Select the correct Finance account before approval."); return; }
    if (request.request_type === "student_order_payment" && !selection.cash_account_id) { setError("Select the cash/bank account that received this payment."); return; }
    setSaving(true); setError(""); setNotice("");
    try { const { error: e } = await supabase.rpc("approve_stock_finance_request", { p_request_id: request.id, p_finance_account_id: selection.account_id, p_cash_account_id: selection.cash_account_id || null }); if (e) throw e; setNotice(`Finance request #${request.id} approved and posted.`); await loadData(); }
    catch (e) { setError(e.message || "Unable to approve Finance request."); } finally { setSaving(false); }
  };

  const rejectFinanceRequest = async (request) => {
    const reason = window.prompt("Reason for rejecting this Finance request:"); if (reason === null) return;
    setSaving(true); setError(""); setNotice("");
    try { const { error: e } = await supabase.rpc("reject_stock_finance_request", { p_request_id: request.id, p_reason: reason }); if (e) throw e; setNotice(`Finance request #${request.id} rejected.`); await loadData(); }
    catch (e) { setError(e.message || "Unable to reject Finance request."); } finally { setSaving(false); }
  };

  const receiveOrderLine = async (order, line) => {
    const remaining = Number(line.quantity_ordered) - Number(line.quantity_received);
    const value = window.prompt(`Enter quantity received (remaining: ${remaining}):`, String(remaining));
    if (value === null) return;
    const qty = Number(value);
    if (!(qty > 0) || qty > remaining) { setError("Enter a valid quantity not greater than the outstanding order quantity."); return; }
    const orderedItem = items.find((item) => String(item.id) === String(line.item_id));
    const locationId = orderedItem?.default_location_id || locations[0]?.id;
    if (!locationId) { setError("Set a default location for this item or create a stock location first."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: e } = await supabase.rpc("receive_stock_purchase_order_item", {
        p_order_item_id: line.id, p_quantity: qty, p_location_id: locationId
      });
      if (e) throw e;
      setNotice("Goods received. Stock balance and purchase order were updated together. Submit the receipt to Finance when ready."); await loadData();
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
      setNotice("Uniform issued and stock balance updated. Record the actual parent payment, then send it to Finance for Headmaster approval."); await loadData();
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Stock & Finance Summary</h2><p className="mt-1 text-xs text-slate-500">Takwimu za shule hii · Mapato na gharama ni miamala iliyoidhinishwa na Finance pekee</p></div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{pendingFinanceCount} Finance request(s) pending</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Mapato ya mauzo</p><p className="mt-2 break-words text-xl font-extrabold tabular-nums text-slate-900 md:text-2xl">{money(approvedSalesIncome)}</p></div><span className="rounded-xl bg-emerald-50 p-3 text-xl text-emerald-700"><FaCoins /></span></div>
          <p className="mt-3 text-xs text-slate-500">Malipo yote yaliyorekodiwa, bila maombi yaliyokataliwa</p>
          {pendingSalesIncome > 0 && <p className="mt-1 text-xs font-semibold text-amber-700">{money(pendingSalesIncome)} yanasubiri idhini ya Finance</p>}
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-amber-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Gharama za mizigo</p><p className="mt-2 break-words text-xl font-extrabold tabular-nums text-slate-900 md:text-2xl">{money(approvedReceivedGoodsCost)}</p></div><span className="rounded-xl bg-amber-50 p-3 text-xl text-amber-700"><FaTruck /></span></div>
          <p className="mt-3 text-xs text-slate-500">Thamani ya mizigo iliyopokelewa, bila maombi yaliyokataliwa</p>
          {pendingReceivedGoodsCost > 0 && <p className="mt-1 text-xs font-semibold text-amber-700">{money(pendingReceivedGoodsCost)} yanasubiri idhini ya Finance</p>}
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-blue-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Thamani ya stock</p><p className="mt-2 break-words text-xl font-extrabold tabular-nums text-slate-900 md:text-2xl">{money(stockValue)}</p></div><span className="rounded-xl bg-blue-50 p-3 text-xl text-blue-700"><FaWarehouse /></span></div>
          <p className="mt-3 text-xs text-slate-500">Stock iliyopo sasa × gharama ya item</p>
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Bidhaa zilizosajiliwa</p><p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{items.length}</p></div><span className="rounded-xl bg-indigo-50 p-3 text-xl text-indigo-700"><FaBoxes /></span></div>
          <p className="mt-3 text-xs text-slate-500">Aina za items zilizosajiliwa kwenye shule</p>
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-sky-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-sky-500" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Jumla ya units</p><p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{totalUnits.toLocaleString()}</p></div><span className="rounded-xl bg-sky-50 p-3 text-xl text-sky-700"><FaChartLine /></span></div>
          <p className="mt-3 text-xs text-slate-500">Idadi ya units zilizopo kwenye store zote</p>
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-rose-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-rose-500" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Stock ndogo</p><p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{lowStock.length}</p></div><span className="rounded-xl bg-rose-50 p-3 text-xl text-rose-700"><FaExclamationTriangle /></span></div>
          <p className="mt-3 text-xs text-slate-500">Items zilizo chini ya kiwango cha reorder</p>
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-orange-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-orange-500" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Upungufu wa oda</p><p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{studentOrderStockSummary.shortageRows.length}</p></div><span className="rounded-xl bg-orange-50 p-3 text-xl text-orange-700"><FaClipboardList /></span></div>
          <p className="mt-3 text-xs text-slate-500">{studentOrderStockSummary.reservedUnits.toLocaleString()} units zimehifadhiwa kwenye oda zinazoendelea</p>
        </article>
      </div>
    </section>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((name) => <button key={name} onClick={() => setTab(name)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === name ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{name}</button>)}
    </div>

    {tab === "Overview" && <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Units kwa kila item</h2><p className="text-xs text-slate-500">Mgawanyo wa stock iliyopo</p></div><span className="rounded-lg bg-sky-50 p-2 text-sky-700"><FaBoxes /></span></div><div className="max-h-56 space-y-2 overflow-y-auto divide-y divide-slate-100">{itemUnitBreakdown.length ? itemUnitBreakdown.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-words text-slate-700">{item.name}</span><span className="shrink-0 font-semibold tabular-nums text-slate-900">{item.quantity.toLocaleString()} {item.unit}</span></div>) : <p className="py-5 text-xs text-slate-500">Hakuna items zilizosajiliwa.</p>}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Thamani ya stock kwa item</h2><p className="text-xs text-slate-500">Kiasi kilichopo × cost price</p></div><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><FaWarehouse /></span></div><div className="max-h-56 space-y-2 overflow-y-auto divide-y divide-slate-100">{itemStockValueBreakdown.length ? itemStockValueBreakdown.map((item) => <div key={item.id} className="py-2 text-xs"><div className="flex justify-between gap-2"><span className="min-w-0 break-words text-slate-700">{item.name}</span><span className="shrink-0 font-semibold tabular-nums text-slate-900">{money(item.value)}</span></div><p className="mt-1 text-slate-500">{item.quantity.toLocaleString()} {item.unit} × {money(item.unitCost)}</p></div>) : <p className="py-5 text-xs text-slate-500">Hakuna stock iliyosajiliwa.</p>}</div></section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-slate-900">Stock Alerts</h2><p className="mt-1 text-sm text-slate-500">Items at or below their reorder level</p>{lowStock.length ? <div className="mt-4 divide-y">{lowStock.map((i) => <div key={i.id} className="flex justify-between gap-3 py-3"><div><p className="font-semibold">{i.item_name}</p><p className="text-xs text-slate-500">{i.stock_categories?.name || "Uncategorised"} · Reorder at {i.reorder_level} {i.unit_of_measure}</p></div><span className="h-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Low stock</span></div>)}</div> : <p className="py-6 text-sm text-emerald-700">No low-stock alerts.</p>}</section>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-slate-900">Expiry Alerts (next 30 days)</h2><p className="mt-1 text-sm text-slate-500">Stock receipts with recorded expiry dates</p>{expiringSoon.length ? <div className="mt-4 divide-y">{expiringSoon.map((m) => <div key={m.id} className="flex justify-between gap-3 py-3"><div><p className="font-semibold">{m.stock_items?.item_name}</p><p className="text-xs text-slate-500">Batch {m.batch_number || "—"} · {m.quantity} units</p></div><span className="text-xs font-semibold text-amber-700">{m.expiry_date}</span></div>)}</div> : <p className="py-6 text-sm text-emerald-700">No recorded expiry dates within 30 days.</p>}</section>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-slate-900">Parent Order Stock Shortages</h2><p className="mt-1 text-sm text-slate-500">Outstanding parent orders compared with current physical stock</p>{studentOrderStockSummary.shortageRows.length ? <div className="mt-4 divide-y">{studentOrderStockSummary.shortageRows.map((row) => <div key={row.id} className="flex justify-between gap-3 py-3"><div><p className="font-semibold">{row.name}</p><p className="text-xs text-slate-500">On hand: {row.onHand} · Reserved: {row.reserved}</p></div><span className="h-fit rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">Short by {row.shortage} {row.unit}</span></div>)}</div> : <p className="py-6 text-sm text-emerald-700">No shortages against outstanding parent orders.</p>}</section>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-slate-900">Purchase Orders Requiring Attention</h2><p className="mt-1 text-sm text-slate-500">{pendingOrders.length} open orders</p>{pendingOrders.length ? <div className="mt-4 divide-y">{pendingOrders.slice(0,8).map((o) => <div key={o.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{o.order_number}</p><p className="text-xs text-slate-500">{o.status.replaceAll("_"," ")} · {money(o.total_amount)}</p></div><button className="text-sm font-semibold text-blue-700" onClick={() => setTab("Purchase Orders")}>View</button></div>)}</div> : <p className="py-6 text-sm text-slate-500">No outstanding purchase orders.</p>}</section>
      <section className="rounded-xl border bg-white p-5 lg:col-span-2"><h2 className="font-bold text-slate-900">Recent Stock Activity</h2>{movements.slice(0,8).map((m) => <div key={m.id} className="flex flex-wrap justify-between gap-2 border-b py-3 last:border-0"><div><p className="font-medium">{m.stock_items?.item_name}</p><p className="text-xs text-slate-500">{m.movement_type.replaceAll("_"," ")} · {m.stock_locations?.name} · {m.movement_date}</p></div><p className="font-semibold tabular-nums">{m.quantity} {m.stock_items?.unit_of_measure}</p></div>)}{!movements.length && <p className="py-5 text-sm text-slate-500">No stock activity recorded yet.</p>}</section>
      </div>
    </div>}

    {tab === "Locations" && <section className="rounded-xl border bg-white p-4 md:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Stores & Locations</h2><p className="text-sm text-slate-500">Manage school stores, kitchens, uniform rooms and other stock locations.</p></div>{canManage && <button onClick={()=>setShowLocationForm(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Add Location</button>}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{locations.map(l=><div key={l.id} className="rounded-lg border p-4"><p className="font-semibold">{l.name}</p><p className="mt-1 text-sm text-slate-500">{l.description || "No description"}</p><p className="mt-2 text-xs text-slate-500">{items.filter(i=>String(i.default_location_id)===String(l.id)).length} assigned item(s)</p></div>)}</div>{!locations.length && <p className="py-8 text-center text-sm text-slate-500">No stores or locations have been added yet.</p>}</section>}

    {tab === "Items" && <section className="rounded-xl border bg-white p-4 md:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Items & Categories</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item, SKU or category…" className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm"/></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Category</th><th className="p-3">Unit</th><th className="p-3">Default Location</th><th className="p-3">Balance</th><th className="p-3">Reorder level</th><th className="p-3">Cost</th><th className="p-3">Potential Sales</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y">{filteredItems.map((i) => { const qty = balances.filter((b) => b.item_id === i.id).reduce((s,b) => s + Number(b.quantity_on_hand || 0),0); return <tr key={i.id}><td className="p-3"><p className="font-semibold">{i.item_name}</p><p className="text-xs text-slate-500">{[i.variant_label,i.sku].filter(Boolean).join(" · ") || "No SKU"}</p></td><td className="p-3">{i.stock_categories?.name || "—"}</td><td className="p-3">{i.unit_of_measure}</td><td className="p-3">{locations.find(l=>String(l.id)===String(i.default_location_id))?.name || "—"}</td><td className="p-3 font-semibold">{qty}</td><td className="p-3">{i.reorder_level}</td><td className="p-3">{money(i.cost_price)}</td><td className="p-3 font-semibold text-emerald-700">{i.is_for_sale ? money(qty * Number(i.selling_price || 0)) : "Not for sale"}<p className="text-xs font-normal text-slate-500">{i.is_for_sale ? `${qty} × ${money(i.selling_price)} selling price` : "—"}</p></td><td className="p-3"><div className="flex flex-wrap gap-1">{canReceive && <button type="button" onClick={() => startOpeningStock(i)} className="whitespace-nowrap rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Set Opening Stock</button>}{canIssue && i.track_expiry && <button type="button" onClick={() => startExpiredStock(i)} className="whitespace-nowrap rounded-md border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50">Record Expired</button>}</div></td></tr>; })}</tbody></table></div>{!filteredItems.length && <p className="py-8 text-center text-sm text-slate-500">No stock items yet.</p>}</section>}

    {tab === "Movements" && <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-bold">Stock Movement Register</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Item</th><th className="p-3">Type</th><th className="p-3">Store</th><th className="p-3">Quantity</th><th className="p-3">Batch</th><th className="p-3">Expiry</th><th className="p-3">Reference</th></tr></thead><tbody className="divide-y">{movements.map((m) => <tr key={m.id}><td className="p-3">{m.movement_date}</td><td className="p-3">{m.stock_items?.item_name}</td><td className="p-3 capitalize">{m.movement_type.replaceAll("_"," ")}</td><td className="p-3">{m.stock_locations?.name}</td><td className="p-3 font-semibold">{m.quantity}</td><td className="p-3">{m.batch_number || "—"}</td><td className="p-3">{m.expiry_date || "—"}</td><td className="p-3">{m.reference_number || "—"}</td></tr>)}</tbody></table></div></section>}

    {tab === "Purchase Orders" && <section className="space-y-3">{purchaseOrders.map((o) => <div key={o.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{o.order_number}</p><p className="text-xs text-slate-500">{suppliers.find((s) => s.id === o.supplier_id)?.supplier_name || "No supplier"} · {o.order_date} · {money(o.total_amount)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{o.status.replaceAll("_"," ")}</span></div><div className="mt-3 space-y-2">{(o.stock_purchase_order_items || []).map((line) => <div key={line.id} className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"><span>{line.stock_items?.item_name}</span><span>{line.quantity_received} / {line.quantity_ordered} received</span>{canManage && movements.filter(m => m.movement_type === "receive" && String(m.item_id) === String(line.item_id) && String(m.reference_number) === String(o.order_number)).map(m => <button key={m.id} disabled={saving || financeRequests.some(r => String(r.source_movement_id) === String(m.id) && r.status !== "rejected")} onClick={() => submitStockFinanceRequest("purchase_receipt", m.id)} className="font-semibold text-emerald-700 disabled:text-slate-400">{financeRequests.some(r => String(r.source_movement_id) === String(m.id)) ? "Sent to Finance" : `Send receipt (${money(Number(m.quantity) * Number(m.unit_cost))})`}</button>)}{canReceive && ["approved","partially_received"].includes(o.status) && Number(line.quantity_received) < Number(line.quantity_ordered) && <button onClick={() => receiveOrderLine(o,line)} className="font-semibold text-blue-700">Receive goods</button>}</div>)}</div><div className="mt-3 flex flex-wrap gap-2">{canManage && o.status === "draft" && <button disabled={saving} onClick={() => updateOrderStatus(o,"submitted")} className="rounded-lg border px-3 py-2 text-xs font-semibold">Submit for approval</button>}{canApprove && o.status === "submitted" && <button disabled={saving} onClick={() => updateOrderStatus(o,"approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Approve order</button>}{canApprove && ["draft","submitted"].includes(o.status) && <button disabled={saving} onClick={() => updateOrderStatus(o,"cancelled")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Cancel</button>}</div></div>)}{!purchaseOrders.length && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No purchase orders yet.</div>}</section>}

    {tab === "Student Uniform Orders" && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Student Uniform Orders</h2><p className="text-sm text-slate-500">Track parent orders, payments received, Finance approval, balances and issued items.</p></div>{canManage && <button onClick={() => setShowStudentOrderForm(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">New Student Order</button>}</div>{studentOrders.map((o) => { const paid = (o.stock_student_order_payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0); const balance = Math.max(0, Number(o.total_amount || 0) - paid); return <div key={o.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{o.order_number} · {[o.students?.first_name,o.students?.middle_name,o.students?.last_name].filter(Boolean).join(" ")}</p><p className="text-xs text-slate-500">Mzazi/Mlezi: {o.students?.parent_name || o.students?.guardian_name || "—"} · Admission: {o.students?.admission_number || o.students?.admission_no || "—"} · {o.order_date} · Jumla: {money(o.total_amount)}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">{o.status.replaceAll("_"," ")}</span><span className={`rounded-full px-3 py-1 text-xs capitalize ${balance <= 0 ? "bg-emerald-100 text-emerald-800" : paid > 0 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>{balance <= 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid"}</span></div></div><div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3"><p>Paid: <b className="text-emerald-700">{money(paid)}</b></p><p>Balance: <b>{money(balance)}</b></p><p>Payment records: <b>{(o.stock_student_order_payments || []).length}</b></p></div>{(o.stock_student_order_payments || []).length > 0 && <div className="mt-3 space-y-1 border-t pt-2">{o.stock_student_order_payments.map(payment => <div key={payment.id} className="flex flex-wrap justify-between gap-2 text-xs text-slate-600"><span>{payment.payment_date} · {payment.payment_method.replaceAll("_"," ")}{payment.payment_reference ? " · Ref: "+payment.payment_reference : ""}</span><b>{money(payment.amount)}</b>{canManage && <button disabled={saving || financeRequests.some(r => String(r.source_payment_id) === String(payment.id) && r.status !== "rejected")} onClick={() => submitStockFinanceRequest("student_order_payment", payment.id)} className="font-semibold text-emerald-700 disabled:text-slate-400">{financeRequests.some(r => String(r.source_payment_id) === String(payment.id)) ? "Sent to Finance" : "Send to Finance"}</button>}</div>)}</div>}{(o.stock_student_order_items || []).map((line) => <div key={line.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"><span>{line.stock_items?.item_name} {line.stock_items?.variant_label || ""}</span><span>{line.quantity_issued} / {line.quantity_ordered} issued</span>{canIssue && Number(line.quantity_issued) < Number(line.quantity_ordered) && o.status !== "cancelled" && <button disabled={saving} onClick={() => fulfilStudentOrder(o,line)} className="font-semibold text-blue-700">Issue uniform</button>}</div>)}{canManage && balance > 0 && o.status !== "cancelled" && <div className="mt-3 border-t pt-3"><button disabled={saving} onClick={() => openPaymentForm(o)} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white">Record Payment</button></div>}</div>; })}{!studentOrders.length && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No student uniform orders have been entered.</div>}<p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Payment records are saved in an audit ledger. Send each payment to Finance; it becomes official income only after Headmaster approval. Recording payment does not deduct stock; stock is deducted only when items are issued.</p></section>}

    {tab === "Finance Approvals" && <section className="space-y-3"><div className="rounded-xl border bg-white p-4"><h2 className="font-bold">Stock Finance Approval Queue</h2><p className="mt-1 text-sm text-slate-500">Only Headmaster approval posts a purchase expense or payment receipt into official Finance reports. Each received batch/payment is submitted once.</p><div className="mt-4 space-y-3">{financeRequests.map(request => { const selection = approvalSelections[request.id] || {}; const isIncome = request.request_type === "student_order_payment"; const relevantAccounts = financeAccounts.filter(account => account.account_type === (isIncome ? "revenue" : "expense")); return <div key={request.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{request.description}</p><p className="text-xs text-slate-500">{request.reference_number || "—"} · {request.transaction_date} · {isIncome ? "Income" : "Expense"}</p><p className="mt-1 font-bold">{money(request.amount)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === "approved" ? "bg-emerald-100 text-emerald-800" : request.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{request.status}</span></div>{request.status === "pending" && canApproveFinance && <div className="mt-3 grid gap-2 md:grid-cols-3"><select value={selection.account_id || ""} onChange={e => setApprovalSelections(current => ({...current,[request.id]:{...current[request.id],account_id:e.target.value}}))} className="rounded-lg border px-3 py-2 text-sm"><option value="">Select {isIncome ? "income" : "expense"} account</option>{relevantAccounts.map(account => <option key={account.id} value={account.id}>{account.account_code} · {account.account_name}</option>)}</select>{isIncome && <select value={selection.cash_account_id || ""} onChange={e => setApprovalSelections(current => ({...current,[request.id]:{...current[request.id],cash_account_id:e.target.value}}))} className="rounded-lg border px-3 py-2 text-sm"><option value="">Select cash/bank account</option>{cashAccounts.map(account => <option key={account.id} value={account.id}>{account.account_name} · {account.account_type}</option>)}</select>}<div className="flex gap-2"><button disabled={saving} onClick={() => approveFinanceRequest(request)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Approve & Post</button><button disabled={saving} onClick={() => rejectFinanceRequest(request)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button></div></div>}{request.status === "approved" && <p className="mt-2 text-xs text-emerald-700">Posted to Finance · Journal: {request.journal_entry_id || "—"} · {request.receipt_id ? "Receipt created" : "Expense created"}</p>}{request.status === "rejected" && <p className="mt-2 text-xs text-rose-700">Rejected: {request.rejection_reason || "No reason supplied"}</p>}</div>; })}{!financeRequests.length && <p className="py-8 text-center text-sm text-slate-500">No stock Finance requests have been submitted yet.</p>}</div></div></section>}
    {tab === "Recommendations" && <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Replenishment Recommendations</h2><p className="mt-1 text-sm text-slate-500">Based on recorded balances and configured reorder levels. Forecasting improves as the school records regular stock issues.</p><div className="mt-4 divide-y">{lowStock.map((i) => { const qty = balances.filter((b) => b.item_id === i.id).reduce((s,b) => s + Number(b.quantity_on_hand || 0),0); const suggestedQty = Math.max(0, Number(i.reorder_level || 0) - qty); return <div key={i.id} className="py-3"><p className="font-semibold">{i.item_name}</p><p className="text-sm text-slate-600">Available: {qty} {i.unit_of_measure}. Reorder level: {i.reorder_level}. Suggested order: at least {suggestedQty} {i.unit_of_measure} to restore the minimum stock level.</p></div>; })}{!lowStock.length && <p className="py-5 text-sm text-emerald-700">Current stock is above all configured reorder levels.</p>}</div><p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Recommendations are rule-based, not AI forecasts. The system does not invent daily consumption or supplier lead times when there is not enough recorded history.</p></section>}

    {showLocationForm && <Modal title="Add Store / Location" onClose={() => setShowLocationForm(false)}><form onSubmit={saveLocation} className="grid gap-3"><Field label="Store / location name" required><input required value={locationForm.name} onChange={(e)=>setLocationForm({...locationForm,name:e.target.value})} placeholder="e.g. Main Store, Kitchen Store, Uniform Room" className="control"/></Field><Field label="Description"><textarea rows="3" value={locationForm.description} onChange={(e)=>setLocationForm({...locationForm,description:e.target.value})} placeholder="Describe what is stored here" className="control"/></Field><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowLocationForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Location"}</button></div></form></Modal>}

    {showItemForm && <Modal title="Add Stock Item" onClose={() => setShowItemForm(false)}><form onSubmit={saveItem} className="grid gap-3 md:grid-cols-2"><Field label="Item name" required><input required value={itemForm.item_name} onChange={(e)=>setItemForm({...itemForm,item_name:e.target.value})} className="control"/></Field><Field label="SKU / Code"><input value={itemForm.sku} onChange={(e)=>setItemForm({...itemForm,sku:e.target.value})} className="control"/></Field><Field label="Default store / location" required><select required value={itemForm.default_location_id} onChange={(e)=>setItemForm({...itemForm,default_location_id:e.target.value})} className="control"><option value="">Select store / location</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>{!locations.length && <span className="mt-1 block text-xs text-amber-700">Create a store/location first using “Add Store / Location”.</span>}</Field><Field label="Category"><select value={itemForm.category_id} onChange={(e)=>setItemForm({...itemForm,category_id:e.target.value})} className="control"><option value="">Uncategorised</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Variant (size / colour / type)"><input value={itemForm.variant_label} onChange={(e)=>setItemForm({...itemForm,variant_label:e.target.value})} className="control"/></Field><Field label="Unit of measure"><input value={itemForm.unit_of_measure} onChange={(e)=>setItemForm({...itemForm,unit_of_measure:e.target.value})} className="control"/></Field><Field label="Reorder level"><input type="number" min="0" step="0.001" value={itemForm.reorder_level} onChange={(e)=>setItemForm({...itemForm,reorder_level:e.target.value})} className="control"/></Field><Field label="Cost price (TZS)"><input type="number" min="0" step="0.01" value={itemForm.cost_price} onChange={(e)=>setItemForm({...itemForm,cost_price:e.target.value})} className="control"/></Field><Field label="Selling price (TZS)"><input type="number" min="0" step="0.01" value={itemForm.selling_price} onChange={(e)=>setItemForm({...itemForm,selling_price:e.target.value})} className="control"/></Field><div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={itemForm.is_for_sale} onChange={(e)=>setItemForm({...itemForm,is_for_sale:e.target.checked})}/> Sold to students</label><label><input type="checkbox" checked={itemForm.track_expiry} onChange={(e)=>setItemForm({...itemForm,track_expiry:e.target.checked})}/> Track expiry</label></div><div className="md:col-span-2 flex justify-end gap-2"><button type="button" onClick={()=>setShowItemForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Item"}</button></div></form></Modal>}

    {showMovementForm && <Modal title={movementForm.movement_type === "opening" ? "Set Opening Stock" : "Record Stock Movement"} onClose={()=>setShowMovementForm(false)}><form onSubmit={saveMovement} className="grid gap-3"><Field label="Item" required><select required value={movementForm.item_id} onChange={(e)=>{const selected=items.find(i=>String(i.id)===e.target.value);setMovementForm({...movementForm,item_id:e.target.value,location_id:selected?.default_location_id ? String(selected.default_location_id) : movementForm.location_id});}} className="control"><option value="">Select item</option>{items.map(i=><option key={i.id} value={i.id}>{i.item_name}</option>)}</select></Field><Field label="Store / Location" required><select required value={movementForm.location_id} onChange={(e)=>setMovementForm({...movementForm,location_id:e.target.value})} className="control"><option value="">Select store</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><Field label="Movement type" required><select value={movementForm.movement_type} onChange={(e)=>setMovementForm({...movementForm,movement_type:e.target.value})} className="control">{["receive","opening","return","issue","sale","damaged","expired","adjustment_in","adjustment_out"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></Field><Field label="Quantity" required><input type="number" min="0.001" step="0.001" required value={movementForm.quantity} onChange={(e)=>setMovementForm({...movementForm,quantity:e.target.value})} className="control"/></Field><Field label="Unit cost (TZS)"><input type="number" min="0" step="0.01" value={movementForm.unit_cost} onChange={(e)=>setMovementForm({...movementForm,unit_cost:e.target.value})} className="control"/></Field><Field label="Date"><input type="date" value={movementForm.movement_date} onChange={(e)=>setMovementForm({...movementForm,movement_date:e.target.value})} className="control"/></Field><Field label="Batch number"><input value={movementForm.batch_number} onChange={(e)=>setMovementForm({...movementForm,batch_number:e.target.value})} className="control"/></Field><Field label="Expiry date (if applicable)"><input type="date" value={movementForm.expiry_date} onChange={(e)=>setMovementForm({...movementForm,expiry_date:e.target.value})} className="control"/></Field><Field label="Notes / reference"><input value={movementForm.notes} onChange={(e)=>setMovementForm({...movementForm,notes:e.target.value})} className="control"/></Field><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowMovementForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Record Movement"}</button></div></form></Modal>}

    {showPaymentForm && <Modal title="Record Student Order Payment" onClose={() => setShowPaymentForm(false)}><form onSubmit={recordStudentOrderPayment} className="grid gap-3"><Field label="Amount received (TZS)" required><input required type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} className="control"/></Field><Field label="Payment method" required><select required value={paymentForm.payment_method} onChange={e=>setPaymentForm({...paymentForm,payment_method:e.target.value})} className="control"><option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></select></Field><Field label="Payment date" required><input required type="date" value={paymentForm.payment_date} onChange={e=>setPaymentForm({...paymentForm,payment_date:e.target.value})} className="control"/></Field><Field label="Receipt / transaction reference"><input maxLength="120" value={paymentForm.payment_reference} onChange={e=>setPaymentForm({...paymentForm,payment_reference:e.target.value})} className="control" placeholder="Receipt number or transaction ID"/></Field><Field label="Notes"><textarea rows="2" maxLength="1000" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm,notes:e.target.value})} className="control"/></Field><p className="text-xs text-slate-500">This records only the amount actually received. Send it to Finance for Headmaster approval before it appears as official income. It does not change stock balances.</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowPaymentForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Payment"}</button></div></form></Modal>}

    {showStudentOrderForm && <Modal title="Create Student Uniform Order" onClose={() => setShowStudentOrderForm(false)}><form onSubmit={createStudentOrder} className="grid gap-3"><Field label="Student" required><select required value={studentOrderForm.student_id} onChange={(e)=>setStudentOrderForm({...studentOrderForm,student_id:e.target.value})} className="control"><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(" ")} · {s.admission_number || s.admission_no || s.id}</option>)}</select></Field><Field label="Uniform / item" required><select required value={studentOrderForm.item_id} onChange={(e)=>setStudentOrderForm({...studentOrderForm,item_id:e.target.value})} className="control"><option value="">Select sale item</option>{items.filter(i=>i.is_for_sale).map(i=><option key={i.id} value={i.id}>{i.item_name} {i.variant_label || ""} · {money(i.selling_price)}</option>)}</select></Field><Field label="Quantity" required><input type="number" min="1" step="1" required value={studentOrderForm.quantity_ordered} onChange={(e)=>setStudentOrderForm({...studentOrderForm,quantity_ordered:e.target.value})} className="control"/></Field><Field label="Notes"><textarea rows="2" value={studentOrderForm.notes} onChange={(e)=>setStudentOrderForm({...studentOrderForm,notes:e.target.value})} className="control"/></Field><p className="text-xs text-slate-500">The order will be saved as unpaid. Stock is deducted only when the item is issued. Record the actual payment here, then send it to Finance for Headmaster approval.</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowStudentOrderForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Student Order"}</button></div></form></Modal>}

    {showOrderForm && <Modal title="Create Purchase Order" onClose={()=>setShowOrderForm(false)}><form onSubmit={createPurchaseOrder} className="grid gap-3"><Field label="Supplier"><select value={orderForm.supplier_id} onChange={(e)=>setOrderForm({...orderForm,supplier_id:e.target.value})} className="control"><option value="">Choose supplier (optional)</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.supplier_name}</option>)}</select></Field><Field label="Item" required><select required value={orderForm.item_id} onChange={(e)=>setOrderForm({...orderForm,item_id:e.target.value})} className="control"><option value="">Select item</option>{items.map(i=><option key={i.id} value={i.id}>{i.item_name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Quantity" required><input required type="number" min="0.001" step="0.001" value={orderForm.quantity_ordered} onChange={(e)=>setOrderForm({...orderForm,quantity_ordered:e.target.value})} className="control"/></Field><Field label="Unit cost (TZS)"><input type="number" min="0" step="0.01" value={orderForm.unit_cost} onChange={(e)=>setOrderForm({...orderForm,unit_cost:e.target.value})} className="control"/></Field></div><Field label="Expected delivery"><input type="date" value={orderForm.expected_delivery_date} onChange={(e)=>setOrderForm({...orderForm,expected_delivery_date:e.target.value})} className="control"/></Field><Field label="Notes"><textarea rows="2" value={orderForm.notes} onChange={(e)=>setOrderForm({...orderForm,notes:e.target.value})} className="control"/></Field><p className="text-xs text-slate-500">The order is saved as a draft. Submitting it does not create an expense or reduce cash. Receive goods separately when delivered.</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowOrderForm(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Saving…":"Save Draft"}</button></div></form></Modal>}
    <style>{`.control{width:100%;border:1px solid #cbd5e1;border-radius:.5rem;padding:.6rem .75rem;background:white;color:#0f172a}.control:focus{outline:2px solid #93c5fd;outline-offset:1px}`}</style>
  </main>;
}

function Field({ label, required, children }) { return <label className="block text-sm font-medium text-slate-700">{label}{required?" *":""}<div className="mt-1">{children}</div></label>; }
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Close</button></div>{children}</div></div>; }
