import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const money = value => new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateText = value => value ? new Date(value).toLocaleString() : "—";
const statusLabel = value => String(value || "pending").replaceAll("_", " ");

export default function ParentStockOrders({ token, student }) {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const auth = useMemo(() => ({ headers: { Authorization: "Bearer " + token } }), [token]);
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const [catalog, history] = await Promise.all([
        api.get("/parent-portal/stock/catalog", auth),
        api.get("/parent-portal/stock/orders", auth),
      ]);
      setItems(catalog.data?.items || []);
      setOrders(history.data?.orders || []);
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia bidhaa na oda."); }
    finally { setLoading(false); }
  }, [token, auth]);

  useEffect(() => { load(); }, [load]);

  const addItem = () => {
    const item = items.find(row => String(row.id) === String(selectedItem));
    const qty = Number(quantity);
    if (!item || !Number.isFinite(qty) || qty <= 0 || qty > 1000) { setError("Chagua bidhaa na kiasi sahihi."); return; }
    setCart(current => {
      const found = current.find(row => String(row.item_id) === String(item.id));
      const nextQty = (found?.quantity || 0) + qty;
      if (nextQty > 1000) { setError("Idadi ya bidhaa haiwezi kuzidi 1,000."); return current; }
      return found
        ? current.map(row => row.item_id === item.id ? { ...row, quantity: nextQty } : row)
        : [...current, { item_id: item.id, quantity: qty, item }];
    });
    setSelectedItem(""); setQuantity("1"); setError("");
  };

  const submitOrder = async event => {
    event.preventDefault();
    if (!cart.length) { setError("Ongeza angalau bidhaa moja kwenye oda."); return; }
    setSaving(true); setError(""); setConfirmation(null);
    try {
      const response = await api.post("/parent-portal/stock/orders", {
        items: cart.map(row => ({ item_id: row.item_id, quantity: row.quantity })),
        notes,
      }, auth);
      setConfirmation({
        orderNumber: response.data?.order?.order_number,
        en: response.data?.message_en || "Your order has been received successfully by the school. You can track its progress through your Parent Portal.",
        sw: response.data?.message_sw || "Oda yako imepokelewa kikamilifu na shule. Unaweza kufuatilia maendeleo ya oda yako kupitia Parent Portal.",
      });
      setCart([]); setNotes(""); await load();
    } catch (e) { setError(e.response?.data?.message || "Oda haikufanikiwa kutumwa."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Inapakia bidhaa za shule...</div>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Uniform & School Items</p><h2 className="mt-1 text-xl font-black text-slate-900">Order for {student?.name || "your child"}</h2><p className="mt-1 text-sm text-slate-500">Chagua sare na vifaa vinavyouzwa na shule. Bidhaa zilizo kwenye oda zinahesabiwa kama reserved; stock hupungua baada ya shule kutoa bidhaa.</p></div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{items.length} bidhaa zinapatikana</span>
      </div>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {confirmation && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-bold">Order Received · Oda Imepokelewa {confirmation.orderNumber ? "· " + confirmation.orderNumber : ""}</p>
        <p className="mt-2">{confirmation.en}</p><p className="mt-1">{confirmation.sw}</p>
      </div>}
      <form onSubmit={submitOrder} className="mt-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_130px_auto]">
          <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" required>
            <option value="">Chagua bidhaa / Select item</option>
            {items.map(item => <option key={item.id} value={item.id}>{item.item_name}{item.variant_label ? " · " + item.variant_label : ""} — {money(item.selling_price)} · In stock: {item.quantity_on_hand} · Available: {item.available_quantity}</option>)}
          </select>
          <input type="number" min="0.001" max="1000" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" aria-label="Quantity" required />
          <button type="button" onClick={addItem} className="rounded-xl border border-blue-200 px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">Add item</button>
        </div>
        {cart.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Qty</th><th className="p-3">Unit price</th><th className="p-3">Subtotal</th><th className="p-3"></th></tr></thead><tbody className="divide-y">{cart.map(row => <tr key={row.item_id}><td className="p-3 font-semibold">{row.item.item_name} {row.item.variant_label || ""}</td><td className="p-3">{row.quantity} {row.item.unit_of_measure}{row.quantity > Number(row.item.available_quantity || 0) && <span className="ml-2 rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Shortage: {row.quantity - Number(row.item.available_quantity || 0)}</span>}</td><td className="p-3">{money(row.item.selling_price)}</td><td className="p-3 font-bold">{money(row.quantity * Number(row.item.selling_price || 0))}</td><td className="p-3"><button type="button" onClick={() => setCart(current => current.filter(x => x.item_id !== row.item_id))} className="text-xs font-semibold text-red-600">Remove</button></td></tr>)}</tbody></table></div>}
        <div><label className="mb-1 block text-xs font-semibold text-slate-600">Notes / Maelezo (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} rows={2} className="w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder="Size, colour or other details..."/></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-slate-600">Total: <b className="text-lg text-slate-900">{money(cart.reduce((sum,row)=>sum + row.quantity * Number(row.item.selling_price || 0),0))}</b></p><button disabled={saving || !cart.length} className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Sending..." : "Submit order / Tuma oda"}</button></div>
      </form>
      {!items.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Shule bado haijaweka sare au vifaa vinavyoweza kuagizwa kupitia Parent Portal.</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">My Orders · Oda Zangu</h3><p className="mt-1 text-xs text-slate-500">Track the progress of orders sent to the school.</p></div><button type="button" onClick={load} className="rounded-lg border px-3 py-2 text-xs font-semibold">Refresh</button></div>
      <div className="mt-4 space-y-3">{orders.map(order => <article key={order.id} className="rounded-xl border border-slate-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{order.order_number}</p><p className="mt-1 text-xs text-slate-500">{dateText(order.order_date)} · {money(order.total_amount)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{statusLabel(order.status)}</span></div>
        <div className="mt-3 space-y-2">{(order.stock_student_order_items || []).map(line => <div key={line.id} className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"><span>{line.stock_items?.item_name} {line.stock_items?.variant_label || ""}</span><span>{line.quantity_issued} / {line.quantity_ordered} {line.stock_items?.unit_of_measure || "pcs"} issued</span></div>)}</div>
      </article>)}</div>
      {!orders.length && <p className="py-8 text-center text-sm text-slate-500">Bado hujatuma oda yoyote.</p>}
    </section>
  </div>;
}
