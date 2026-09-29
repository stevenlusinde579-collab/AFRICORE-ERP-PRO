import React, { useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaTimes,
  FaMoneyBillWave,
  FaUsers,
  FaCheckCircle,
  FaExclamationCircle,
  FaClock,
  FaCalendarAlt,
  FaArrowDown,
  FaArrowUp,
} from "react-icons/fa";

import { supabase } from "../../services/supabase";

const Contributions = () => {
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [eventMembers, setEventMembers] = useState([]);
  const [contributions, setContributions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingContribution, setEditingContribution] = useState(null);

  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    event_id: "",
    member_id: "",
    amount: "",
    contribution_date: new Date().toISOString().split("T")[0],
    payment_method: "Cash",
    reference_number: "",
  });

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        eventsResult,
        membersResult,
        eventMembersResult,
        contributionsResult,
      ] = await Promise.all([
        supabase
          .from("social_fund_events")
          .select(
            "id, school_id, event_name, event_type, description, target_amount, start_date, end_date, status, created_by, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("social_fund_members")
          .select(
            "id, school_id, member_type, staff_id, full_name, phone, monthly_contribution, join_date, status, created_at, member_number"
          )
          .order("full_name", { ascending: true }),

        supabase
          .from("social_fund_event_members")
          .select(
            "id, event_id, member_id, expected_amount, status, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("social_fund_contributions")
          .select(
            "id, member_id, contribution_date, amount, payment_method, financial_account_id, reference_number, status, journal_entry_id, created_at, event_id"
          )
          .order("contribution_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (eventsResult.error) {
        throw new Error(eventsResult.error.message);
      }

      if (membersResult.error) {
        throw new Error(membersResult.error.message);
      }

      if (eventMembersResult.error) {
        throw new Error(eventMembersResult.error.message);
      }

      if (contributionsResult.error) {
        throw new Error(contributionsResult.error.message);
      }

      setEvents(eventsResult.data || []);
      setMembers(membersResult.data || []);
      setEventMembers(eventMembersResult.data || []);
      setContributions(contributionsResult.data || []);
    } catch (error) {
      console.error("LOAD CONTRIBUTIONS ERROR:", error);
      alert(`Failed to load contributions.\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================
  // HELPERS
  // =========================================================

  const getEvent = (eventId) => {
    return events.find((event) => String(event.id) === String(eventId));
  };

  const getMember = (memberId) => {
    return members.find((member) => String(member.id) === String(memberId));
  };

  const getEventMember = (eventId, memberId) => {
    return eventMembers.find(
      (item) =>
        String(item.event_id) === String(eventId) &&
        String(item.member_id) === String(memberId)
    );
  };

  const getPaidAmount = (eventId, memberId, ignoreContributionId = null) => {
    return contributions
      .filter(
        (contribution) =>
          String(contribution.event_id) === String(eventId) &&
          String(contribution.member_id) === String(memberId) &&
          String(contribution.id) !== String(ignoreContributionId)
      )
      .reduce((total, contribution) => {
        return total + Number(contribution.amount || 0);
      }, 0);
  };

  const getTargetAmount = (eventId, memberId) => {
    const eventMember = getEventMember(eventId, memberId);

    if (eventMember) {
      return Number(eventMember.expected_amount || 0);
    }

    return 0;
  };

  const getPaymentStatus = (eventStatus, target, paid) => {
    const normalizedStatus = String(eventStatus || "").toLowerCase();

    if (normalizedStatus === "completed") {
      if (paid <= 0) return "Missing";
      if (paid < target) return "Partial";
      return "Paid";
    }

    if (paid <= 0) return "Pending";
    if (paid < target) return "Partial";
    return "Paid";
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("en-TZ", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("en-GB");
  };

  // =========================================================
  // PAYMENT ROWS
  // =========================================================

  const paymentRows = useMemo(() => {
    return eventMembers.map((eventMember) => {
      const event = getEvent(eventMember.event_id);
      const member = getMember(eventMember.member_id);

      const target = Number(eventMember.expected_amount || 0);

      const paid = getPaidAmount(
        eventMember.event_id,
        eventMember.member_id
      );

      const remaining = Math.max(target - paid, 0);

      const status = getPaymentStatus(
        event?.status,
        target,
        paid
      );

      return {
        ...eventMember,
        event,
        member,
        target,
        paid,
        remaining,
        paymentStatus: status,
      };
    });
  }, [eventMembers, events, members, contributions]);

  // =========================================================
  // FILTERED PAYMENT ROWS
  // =========================================================

  const filteredPaymentRows = useMemo(() => {
    return paymentRows.filter((row) => {
      const searchText = search.toLowerCase().trim();

      const matchesSearch =
        !searchText ||
        String(row.member?.full_name || "")
          .toLowerCase()
          .includes(searchText) ||
        String(row.member?.member_number || "")
          .toLowerCase()
          .includes(searchText) ||
        String(row.event?.event_name || "")
          .toLowerCase()
          .includes(searchText);

      const matchesEvent =
        eventFilter === "all" ||
        String(row.event_id) === String(eventFilter);

      const matchesStatus =
        statusFilter === "all" ||
        row.paymentStatus === statusFilter;

      return matchesSearch && matchesEvent && matchesStatus;
    });
  }, [
    paymentRows,
    search,
    eventFilter,
    statusFilter,
  ]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const summary = useMemo(() => {
    const totalTarget = paymentRows.reduce(
      (sum, row) => sum + row.target,
      0
    );

    const totalPaid = paymentRows.reduce(
      (sum, row) => sum + row.paid,
      0
    );

    const totalRemaining = paymentRows.reduce(
      (sum, row) => sum + row.remaining,
      0
    );

    const paidMembers = paymentRows.filter(
      (row) => row.paymentStatus === "Paid"
    ).length;

    const partialMembers = paymentRows.filter(
      (row) => row.paymentStatus === "Partial"
    ).length;

    const pendingMembers = paymentRows.filter(
      (row) => row.paymentStatus === "Pending"
    ).length;

    const missingMembers = paymentRows.filter(
      (row) => row.paymentStatus === "Missing"
    ).length;

    return {
      totalTarget,
      totalPaid,
      totalRemaining,
      paidMembers,
      partialMembers,
      pendingMembers,
      missingMembers,
    };
  }, [paymentRows]);

  // =========================================================
  // EVENT MEMBERS FOR SELECTED EVENT
  // =========================================================

  const selectedEventMembers = useMemo(() => {
    if (!form.event_id) return [];

    return eventMembers
      .filter(
        (item) =>
          String(item.event_id) === String(form.event_id)
      )
      .map((item) => {
        const member = getMember(item.member_id);

        const paidBeforeCurrent =
          getPaidAmount(
            form.event_id,
            item.member_id,
            editingContribution?.id || null
          );

        const target = Number(item.expected_amount || 0);

        return {
          ...item,
          member,
          target,
          paid: paidBeforeCurrent,
          remaining: Math.max(target - paidBeforeCurrent, 0),
        };
      })
      .filter((item) => item.member);
  }, [
    form.event_id,
    eventMembers,
    members,
    contributions,
    editingContribution,
  ]);

  const selectedMemberData = useMemo(() => {
    if (!form.event_id || !form.member_id) {
      return null;
    }

    return selectedEventMembers.find(
      (item) =>
        String(item.member_id) === String(form.member_id)
    );
  }, [
    form.event_id,
    form.member_id,
    selectedEventMembers,
  ]);

  // =========================================================
  // FORM
  // =========================================================

  const resetForm = () => {
    setForm({
      event_id: "",
      member_id: "",
      amount: "",
      contribution_date: new Date()
        .toISOString()
        .split("T")[0],
      payment_method: "Cash",
      reference_number: "",
    });

    setEditingContribution(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    resetForm();
  };

  const handleFormChange = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleEventChange = (eventId) => {
    setForm((previous) => ({
      ...previous,
      event_id: eventId,
      member_id: "",
      amount: "",
    }));
  };

  const handleMemberChange = (memberId) => {
    const selected = selectedEventMembers.find(
      (item) =>
        String(item.member_id) === String(memberId)
    );

    setForm((previous) => ({
      ...previous,
      member_id: memberId,
      amount:
        selected && selected.remaining > 0
          ? selected.remaining
          : "",
    }));
  };

  // =========================================================
  // ADD / EDIT CONTRIBUTION
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.event_id) {
      alert("Please select a welfare event.");
      return;
    }

    if (!form.member_id) {
      alert("Please select a member.");
      return;
    }

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      alert("Please enter a valid contribution amount.");
      return;
    }

    const selectedEvent = getEvent(form.event_id);

    if (!selectedEvent) {
      alert("Selected event was not found.");
      return;
    }

    const eventMember = getEventMember(
      form.event_id,
      form.member_id
    );

    if (!eventMember) {
      alert(
        "This member is not assigned to the selected event."
      );
      return;
    }

    const target = Number(
      eventMember.expected_amount || 0
    );

    const paidBeforeCurrent = getPaidAmount(
      form.event_id,
      form.member_id,
      editingContribution?.id || null
    );

    const remainingBeforeCurrent = Math.max(
      target - paidBeforeCurrent,
      0
    );

    if (amount > remainingBeforeCurrent) {
      alert(
        `Contribution exceeds the remaining amount.\n\n` +
          `Target: ${formatMoney(target)}\n` +
          `Already Paid: ${formatMoney(paidBeforeCurrent)}\n` +
          `Remaining: ${formatMoney(
            remainingBeforeCurrent
          )}`
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        event_id: form.event_id,
        member_id: Number(form.member_id),
        amount,
        contribution_date: form.contribution_date,
        payment_method: form.payment_method,
        reference_number:
          form.reference_number.trim() || null,
        status: "posted",
      };

      let result;

      if (editingContribution) {
        result = await supabase
          .from("social_fund_contributions")
          .update(payload)
          .eq("id", editingContribution.id);
      } else {
        result = await supabase
          .from("social_fund_contributions")
          .insert([payload]);
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      alert(
        editingContribution
          ? "Contribution updated successfully."
          : "Contribution recorded successfully."
      );

      setShowModal(false);
      resetForm();

      await loadData();
    } catch (error) {
      console.error("SAVE CONTRIBUTION ERROR:", error);

      alert(
        `Failed to save contribution.\n\n${error.message}`
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // EDIT CONTRIBUTION
  // =========================================================

  const handleEdit = (contribution) => {
    setEditingContribution(contribution);

    setForm({
      event_id: contribution.event_id || "",
      member_id: contribution.member_id
        ? String(contribution.member_id)
        : "",
      amount: contribution.amount || "",
      contribution_date:
        contribution.contribution_date ||
        new Date().toISOString().split("T")[0],
      payment_method:
        contribution.payment_method || "Cash",
      reference_number:
        contribution.reference_number || "",
    });

    setShowModal(true);
  };

  // =========================================================
  // DELETE CONTRIBUTION
  // =========================================================

  const handleDelete = async (contribution) => {
    const member = getMember(contribution.member_id);
    const event = getEvent(contribution.event_id);

    const confirmed = window.confirm(
      `Delete this contribution?\n\n` +
        `Member: ${member?.full_name || "Unknown"}\n` +
        `Event: ${event?.event_name || "Unknown"}\n` +
        `Amount: ${formatMoney(contribution.amount)}`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("social_fund_contributions")
        .delete()
        .eq("id", contribution.id);

      if (error) {
        throw new Error(error.message);
      }

      alert("Contribution deleted successfully.");

      await loadData();
    } catch (error) {
      console.error("DELETE CONTRIBUTION ERROR:", error);

      alert(
        `Failed to delete contribution.\n\n${error.message}`
      );
    }
  };

  // =========================================================
  // STATUS UI
  // =========================================================

  const getStatusClass = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";

      case "Partial":
        return "bg-yellow-100 text-yellow-700";

      case "Pending":
        return "bg-blue-100 text-blue-700";

      case "Missing":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getEventStatusClass = (status) => {
    switch (String(status || "").toLowerCase()) {
      case "active":
        return "bg-blue-100 text-blue-700";

      case "completed":
        return "bg-green-100 text-green-700";

      case "draft":
        return "bg-gray-100 text-gray-700";

      case "cancelled":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Welfare Contributions
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Track member targets, payments, balances and
            contribution history.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <FaPlus />
          Add Contribution
        </button>
      </div>

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total Target
              </p>

              <h2 className="mt-2 text-xl font-bold text-gray-800">
                {formatMoney(summary.totalTarget)}
              </h2>
            </div>

            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <FaArrowUp />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total Paid
              </p>

              <h2 className="mt-2 text-xl font-bold text-green-600">
                {formatMoney(summary.totalPaid)}
              </h2>
            </div>

            <div className="rounded-full bg-green-100 p-3 text-green-600">
              <FaMoneyBillWave />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Remaining
              </p>

              <h2 className="mt-2 text-xl font-bold text-orange-600">
                {formatMoney(summary.totalRemaining)}
              </h2>
            </div>

            <div className="rounded-full bg-orange-100 p-3 text-orange-600">
              <FaArrowDown />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Members Paid
              </p>

              <h2 className="mt-2 text-xl font-bold text-gray-800">
                {summary.paidMembers}
              </h2>
            </div>

            <div className="rounded-full bg-purple-100 p-3 text-purple-600">
              <FaUsers />
            </div>
          </div>
        </div>
      </div>

      {/* STATUS SUMMARY */}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <FaClock />
            <span className="text-sm font-medium">
              Pending
            </span>
          </div>

          <p className="mt-2 text-2xl font-bold text-blue-800">
            {summary.pendingMembers}
          </p>
        </div>

        <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
          <div className="flex items-center gap-2 text-yellow-700">
            <FaExclamationCircle />
            <span className="text-sm font-medium">
              Partial
            </span>
          </div>

          <p className="mt-2 text-2xl font-bold text-yellow-800">
            {summary.partialMembers}
          </p>
        </div>

        <div className="rounded-lg border border-green-100 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-700">
            <FaCheckCircle />
            <span className="text-sm font-medium">
              Paid
            </span>
          </div>

          <p className="mt-2 text-2xl font-bold text-green-800">
            {summary.paidMembers}
          </p>
        </div>

        <div className="rounded-lg border border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <FaExclamationCircle />
            <span className="text-sm font-medium">
              Missing
            </span>
          </div>

          <p className="mt-2 text-2xl font-bold text-red-800">
            {summary.missingMembers}
          </p>

          <p className="mt-1 text-xs text-red-600">
            Only after event completion
          </p>
        </div>
      </div>

      {/* FILTERS */}

      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member or event..."
              className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-3 outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={eventFilter}
            onChange={(e) =>
              setEventFilter(e.target.value)
            }
            className="rounded-lg border border-gray-200 px-3 py-3 outline-none focus:border-blue-500"
          >
            <option value="all">
              All Events
            </option>

            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.event_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="rounded-lg border border-gray-200 px-3 py-3 outline-none focus:border-blue-500"
          >
            <option value="all">
              All Payment Status
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Partial">
              Partial
            </option>

            <option value="Paid">
              Paid
            </option>

            <option value="Missing">
              Missing
            </option>
          </select>
        </div>
      </div>

      {/* MEMBER PAYMENT STATUS */}

      <div className="mb-8 overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            Member Payment Status
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Each member's expected amount, paid amount and
            remaining balance.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading contribution data...
          </div>
        ) : filteredPaymentRows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No member contribution records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-4">
                    Event
                  </th>

                  <th className="px-5 py-4">
                    Member
                  </th>

                  <th className="px-5 py-4 text-right">
                    Target
                  </th>

                  <th className="px-5 py-4 text-right">
                    Paid
                  </th>

                  <th className="px-5 py-4 text-right">
                    Remaining
                  </th>

                  <th className="px-5 py-4">
                    Event Status
                  </th>

                  <th className="px-5 py-4">
                    Payment Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredPaymentRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-800">
                        {row.event?.event_name || "-"}
                      </div>

                      <div className="text-xs text-gray-400">
                        {row.event?.event_type || "-"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-800">
                        {row.member?.full_name || "-"}
                      </div>

                      <div className="text-xs text-gray-400">
                        {row.member?.member_number || "-"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right font-medium">
                      {formatMoney(row.target)}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-green-600">
                      {formatMoney(row.paid)}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-orange-600">
                      {formatMoney(row.remaining)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getEventStatusClass(
                          row.event?.status
                        )}`}
                      >
                        {row.event?.status || "-"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                          row.paymentStatus
                        )}`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONTRIBUTION HISTORY */}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            Contribution History
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Individual contribution transactions.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading...
          </div>
        ) : contributions.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No contribution transactions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-4">
                    Date
                  </th>

                  <th className="px-5 py-4">
                    Member
                  </th>

                  <th className="px-5 py-4">
                    Event
                  </th>

                  <th className="px-5 py-4 text-right">
                    Amount
                  </th>

                  <th className="px-5 py-4">
                    Method
                  </th>

                  <th className="px-5 py-4">
                    Reference
                  </th>

                  <th className="px-5 py-4">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {contributions.map((contribution) => {
                  const member = getMember(
                    contribution.member_id
                  );

                  const event = getEvent(
                    contribution.event_id
                  );

                  return (
                    <tr
                      key={contribution.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-gray-400" />

                          {formatDate(
                            contribution.contribution_date
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-800">
                          {member?.full_name || "-"}
                        </div>

                        <div className="text-xs text-gray-400">
                          {member?.member_number || "-"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {event?.event_name || "-"}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-green-600">
                        {formatMoney(
                          contribution.amount
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {contribution.payment_method ||
                          "-"}
                      </td>

                      <td className="px-5 py-4">
                        {contribution.reference_number ||
                          "-"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          {contribution.status ||
                            "posted"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              handleEdit(contribution)
                            }
                            className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(contribution)
                            }
                            className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {editingContribution
                    ? "Edit Contribution"
                    : "Add Contribution"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Record payment against a specific welfare
                  event and member.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <FaTimes />
              </button>
            </div>

            {/* MODAL BODY */}

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {/* EVENT */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Welfare Event *
                </label>

                <select
                  value={form.event_id}
                  onChange={(e) =>
                    handleEventChange(e.target.value)
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">
                    Select Welfare Event
                  </option>

                  {events
                    .filter(
                      (event) =>
                        String(event.status).toLowerCase() !==
                        "cancelled"
                    )
                    .map((event) => (
                      <option
                        key={event.id}
                        value={event.id}
                      >
                        {event.event_name} —{" "}
                        {event.event_type}
                      </option>
                    ))}
                </select>
              </div>

              {/* MEMBER */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Member *
                </label>

                <select
                  value={form.member_id}
                  onChange={(e) =>
                    handleMemberChange(e.target.value)
                  }
                  disabled={
                    saving || !form.event_id
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {!form.event_id
                      ? "Select event first"
                      : selectedEventMembers.length === 0
                      ? "No members assigned to this event"
                      : "Select Member"}
                  </option>

                  {selectedEventMembers.map((item) => (
                    <option
                      key={item.id}
                      value={item.member_id}
                    >
                      {item.member?.full_name} — Target:{" "}
                      {formatMoney(item.target)}
                    </option>
                  ))}
                </select>
              </div>

              {/* MEMBER PAYMENT INFORMATION */}

              {selectedMemberData && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-xs font-medium text-blue-600">
                      Member Target
                    </p>

                    <p className="mt-1 text-lg font-bold text-blue-800">
                      {formatMoney(
                        selectedMemberData.target
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-green-50 p-4">
                    <p className="text-xs font-medium text-green-600">
                      Paid So Far
                    </p>

                    <p className="mt-1 text-lg font-bold text-green-800">
                      {formatMoney(
                        selectedMemberData.paid
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-orange-50 p-4">
                    <p className="text-xs font-medium text-orange-600">
                      Remaining
                    </p>

                    <p className="mt-1 text-lg font-bold text-orange-800">
                      {formatMoney(
                        selectedMemberData.remaining
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* AMOUNT */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Contribution Amount *
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    handleFormChange(
                      "amount",
                      e.target.value
                    )
                  }
                  disabled={saving}
                  placeholder="Enter amount"
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                />

                {selectedMemberData && (
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum allowed for this payment:{" "}
                    <strong>
                      {formatMoney(
                        selectedMemberData.remaining
                      )}
                    </strong>
                  </p>
                )}
              </div>

              {/* DATE */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Contribution Date *
                </label>

                <input
                  type="date"
                  value={form.contribution_date}
                  onChange={(e) =>
                    handleFormChange(
                      "contribution_date",
                      e.target.value
                    )
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* PAYMENT METHOD */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Payment Method
                </label>

                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    handleFormChange(
                      "payment_method",
                      e.target.value
                    )
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="Cash">
                    Cash
                  </option>

                  <option value="Bank">
                    Bank
                  </option>

                  <option value="Mobile Money">
                    Mobile Money
                  </option>

                  <option value="Cheque">
                    Cheque
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              {/* REFERENCE */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Reference Number
                </label>

                <input
                  type="text"
                  value={form.reference_number}
                  onChange={(e) =>
                    handleFormChange(
                      "reference_number",
                      e.target.value
                    )
                  }
                  disabled={saving}
                  placeholder="Receipt / transaction reference"
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* BUTTONS */}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaMoneyBillWave />

                  {saving
                    ? "Saving..."
                    : editingContribution
                    ? "Update Contribution"
                    : "Save Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contributions;