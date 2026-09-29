import React, { useMemo, useState } from "react";
import {
  FaPlus,
  FaSearch,
  FaFilter,
  FaEye,
  FaEdit,
  FaTrash,
  FaTimes,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaUserTie,
  FaUserFriends,
  FaMoneyBillWave,
  FaFileAlt,
  FaHandHoldingHeart,
} from "react-icons/fa";

const WelfareRequests = () => {
  const [requests, setRequests] = useState([
    {
      id: 1,
      requestNo: "WR-0001",
      memberName: "Sample Staff",
      memberType: "Staff",
      requestType: "Medical Support",
      amount: 150000,
      requestDate: "2026-09-05",
      status: "Pending",
      priority: "High",
      reason: "Medical assistance request.",
      description:
        "Member has requested financial assistance for medical expenses.",
      reviewedBy: "",
      notes: "",
    },
    {
      id: 2,
      requestNo: "WR-0002",
      memberName: "Sample Non-Staff",
      memberType: "Non-Staff",
      requestType: "Bereavement Support",
      amount: 200000,
      requestDate: "2026-09-06",
      status: "Approved",
      priority: "Medium",
      reason: "Bereavement support.",
      description:
        "Request for welfare support following a family bereavement.",
      reviewedBy: "Welfare Committee",
      notes: "Approved by welfare committee.",
    },
    {
      id: 3,
      requestNo: "WR-0003",
      memberName: "Sample Staff 2",
      memberType: "Staff",
      requestType: "Emergency Support",
      amount: 100000,
      requestDate: "2026-09-08",
      status: "Rejected",
      priority: "High",
      reason: "Emergency financial support.",
      description:
        "Emergency support request submitted by the member.",
      reviewedBy: "Welfare Committee",
      notes: "Request did not meet current welfare rules.",
    },
  ]);

  const [search, setSearch] = useState("");
  const [memberTypeFilter, setMemberTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [requestTypeFilter, setRequestTypeFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editingRequest, setEditingRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const emptyForm = {
    memberName: "",
    memberType: "Staff",
    requestType: "Medical Support",
    amount: "",
    requestDate: new Date().toISOString().split("T")[0],
    priority: "Medium",
    reason: "",
    description: "",
    status: "Pending",
    reviewedBy: "",
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);

  const requestTypes = [
    "Medical Support",
    "Bereavement Support",
    "Emergency Support",
    "Education Support",
    "Family Support",
    "Funeral Support",
    "Disaster Support",
    "Other",
  ];

  const money = (value) => {
    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency: "TZS",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchText = search.toLowerCase().trim();

      const matchesSearch =
        !searchText ||
        request.memberName.toLowerCase().includes(searchText) ||
        request.requestNo.toLowerCase().includes(searchText) ||
        request.requestType.toLowerCase().includes(searchText);

      const matchesMemberType =
        memberTypeFilter === "All" ||
        request.memberType === memberTypeFilter;

      const matchesStatus =
        statusFilter === "All" ||
        request.status === statusFilter;

      const matchesRequestType =
        requestTypeFilter === "All" ||
        request.requestType === requestTypeFilter;

      return (
        matchesSearch &&
        matchesMemberType &&
        matchesStatus &&
        matchesRequestType
      );
    });
  }, [
    requests,
    search,
    memberTypeFilter,
    statusFilter,
    requestTypeFilter,
  ]);

  const totalRequests = requests.length;

  const pendingRequests = requests.filter(
    (item) => item.status === "Pending"
  ).length;

  const approvedRequests = requests.filter(
    (item) => item.status === "Approved"
  ).length;

  const rejectedRequests = requests.filter(
    (item) => item.status === "Rejected"
  ).length;

  const totalRequestedAmount = requests.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const approvedAmount = requests
    .filter((item) => item.status === "Approved")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setEditingRequest(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (request) => {
    setEditingRequest(request);

    setForm({
      memberName: request.memberName || "",
      memberType: request.memberType || "Staff",
      requestType: request.requestType || "Medical Support",
      amount: request.amount || "",
      requestDate: request.requestDate || "",
      priority: request.priority || "Medium",
      reason: request.reason || "",
      description: request.description || "",
      status: request.status || "Pending",
      reviewedBy: request.reviewedBy || "",
      notes: request.notes || "",
    });

    setShowModal(true);
  };

  const openViewModal = (request) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.memberName.trim()) {
      alert("Please enter member name.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert("Please enter a valid requested amount.");
      return;
    }

    if (!form.reason.trim()) {
      alert("Please enter the reason for the request.");
      return;
    }

    if (editingRequest) {
      setRequests((previous) =>
        previous.map((item) =>
          item.id === editingRequest.id
            ? {
                ...item,
                ...form,
                amount: Number(form.amount),
              }
            : item
        )
      );
    } else {
      const newRequest = {
        id: Date.now(),
        requestNo: `WR-${String(requests.length + 1).padStart(4, "0")}`,
        ...form,
        amount: Number(form.amount),
      };

      setRequests((previous) => [newRequest, ...previous]);
    }

    setShowModal(false);
    setEditingRequest(null);
    setForm(emptyForm);
  };

  const handleDelete = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this welfare request?"
    );

    if (!confirmed) return;

    setRequests((previous) =>
      previous.filter((request) => request.id !== id)
    );
  };

  const updateStatus = (id, status) => {
    setRequests((previous) =>
      previous.map((request) =>
        request.id === id
          ? {
              ...request,
              status,
              reviewedBy:
                status === "Pending"
                  ? ""
                  : request.reviewedBy || "Welfare Committee",
            }
          : request
      )
    );

    if (selectedRequest?.id === id) {
      setSelectedRequest((previous) =>
        previous
          ? {
              ...previous,
              status,
              reviewedBy:
                status === "Pending"
                  ? ""
                  : previous.reviewedBy || "Welfare Committee",
            }
          : previous
      );
    }
  };

  const statusBadge = (status) => {
    if (status === "Approved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          <FaCheckCircle />
          Approved
        </span>
      );
    }

    if (status === "Rejected") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          <FaTimesCircle />
          Rejected
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
        <FaClock />
        Pending
      </span>
    );
  };

  const priorityBadge = (priority) => {
    if (priority === "High") {
      return (
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          High
        </span>
      );
    }

    if (priority === "Low") {
      return (
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
          Low
        </span>
      );
    }

    return (
      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
        Medium
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
              <FaHandHoldingHeart className="text-xl" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Welfare Requests
              </h1>

              <p className="text-sm text-slate-500">
                Manage welfare support requests for Staff and Non-Staff.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700"
        >
          <FaPlus />
          New Welfare Request
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
              <FaFileAlt />
            </div>

            <span className="text-xs font-semibold text-slate-400">
              REQUESTS
            </span>
          </div>

          <p className="text-2xl font-bold text-slate-800">
            {totalRequests}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Total Requests
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-xl bg-yellow-100 p-3 text-yellow-600">
              <FaClock />
            </div>

            <span className="text-xs font-semibold text-slate-400">
              PENDING
            </span>
          </div>

          <p className="text-2xl font-bold text-slate-800">
            {pendingRequests}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Awaiting Review
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-xl bg-green-100 p-3 text-green-600">
              <FaCheckCircle />
            </div>

            <span className="text-xs font-semibold text-slate-400">
              APPROVED
            </span>
          </div>

          <p className="text-2xl font-bold text-slate-800">
            {approvedRequests}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Approved Requests
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-xl bg-red-100 p-3 text-red-600">
              <FaTimesCircle />
            </div>

            <span className="text-xs font-semibold text-slate-400">
              REJECTED
            </span>
          </div>

          <p className="text-2xl font-bold text-slate-800">
            {rejectedRequests}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Rejected Requests
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
              <FaMoneyBillWave />
            </div>

            <span className="text-xs font-semibold text-slate-400">
              APPROVED VALUE
            </span>
          </div>

          <p className="text-lg font-bold text-slate-800">
            {money(approvedAmount)}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Requested: {money(totalRequestedAmount)}
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
          <FaFilter className="text-blue-600" />
          Search & Filters
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member, request no..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={memberTypeFilter}
            onChange={(e) => setMemberTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Member Types</option>
            <option value="Staff">Staff</option>
            <option value="Non-Staff">Non-Staff</option>
          </select>

          <select
            value={requestTypeFilter}
            onChange={(e) => setRequestTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Request Types</option>

            {requestTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Request
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Member
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Type
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Amount
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Date
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Priority
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <FaFileAlt className="text-xl" />
                    </div>

                    <p className="mt-4 font-semibold text-slate-700">
                      No welfare requests found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">
                        {request.requestNo}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {request.requestType}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          {request.memberType === "Staff" ? (
                            <FaUserTie />
                          ) : (
                            <FaUserFriends />
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-slate-800">
                            {request.memberName}
                          </p>

                          <p className="text-xs text-slate-500">
                            {request.memberType}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {request.requestType}
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {money(request.amount)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {request.requestDate}
                    </td>

                    <td className="px-5 py-4">
                      {priorityBadge(request.priority)}
                    </td>

                    <td className="px-5 py-4">
                      {statusBadge(request.status)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openViewModal(request)}
                          title="View"
                          className="rounded-lg bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                        >
                          <FaEye />
                        </button>

                        <button
                          onClick={() => openEditModal(request)}
                          title="Edit"
                          className="rounded-lg bg-yellow-50 p-2 text-yellow-600 transition hover:bg-yellow-100"
                        >
                          <FaEdit />
                        </button>

                        <button
                          onClick={() => handleDelete(request.id)}
                          title="Delete"
                          className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {editingRequest
                    ? "Edit Welfare Request"
                    : "New Welfare Request"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create and manage a welfare support request.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Member Name *
                  </label>

                  <input
                    type="text"
                    name="memberName"
                    value={form.memberName}
                    onChange={handleChange}
                    placeholder="Enter member name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Member Type *
                  </label>

                  <select
                    name="memberType"
                    value={form.memberType}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Non-Staff">Non-Staff</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Request Type *
                  </label>

                  <select
                    name="requestType"
                    value={form.requestType}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    {requestTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Requested Amount *
                  </label>

                  <input
                    type="number"
                    name="amount"
                    min="0"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="Enter amount"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Request Date *
                  </label>

                  <input
                    type="date"
                    name="requestDate"
                    value={form.requestDate}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Reviewed By
                  </label>

                  <input
                    type="text"
                    name="reviewedBy"
                    value={form.reviewedBy}
                    onChange={handleChange}
                    placeholder="Welfare Committee / Officer"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Reason *
                  </label>

                  <input
                    type="text"
                    name="reason"
                    value={form.reason}
                    onChange={handleChange}
                    placeholder="Brief reason for the request"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Provide detailed information about the request..."
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Internal welfare notes..."
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  {editingRequest
                    ? "Update Request"
                    : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {showViewModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Welfare Request Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedRequest.requestNo}
                </p>
              </div>

              <button
                onClick={() => setShowViewModal(false)}
                className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Member
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {selectedRequest.memberName}
                  </p>

                  <p className="text-sm text-slate-500">
                    {selectedRequest.memberType}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Request Type
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {selectedRequest.requestType}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Requested Amount
                  </p>

                  <p className="mt-1 text-lg font-bold text-blue-600">
                    {money(selectedRequest.amount)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Request Date
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {selectedRequest.requestDate}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Priority
                  </p>

                  <div className="mt-2">
                    {priorityBadge(selectedRequest.priority)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Status
                  </p>

                  <div className="mt-2">
                    {statusBadge(selectedRequest.status)}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-700">
                    Reason
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    {selectedRequest.reason || "No reason provided."}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-slate-700">
                    Description
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                    {selectedRequest.description ||
                      "No description provided."}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-slate-700">
                    Reviewed By
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    {selectedRequest.reviewedBy || "Not reviewed yet."}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-slate-700">
                    Notes
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                    {selectedRequest.notes || "No notes available."}
                  </div>
                </div>
              </div>

              {/* STATUS ACTIONS */}
              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="mb-3 text-sm font-bold text-slate-700">
                  Request Decision
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      updateStatus(selectedRequest.id, "Approved")
                    }
                    className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700"
                  >
                    <FaCheckCircle />
                    Approve
                  </button>

                  <button
                    onClick={() =>
                      updateStatus(selectedRequest.id, "Rejected")
                    }
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
                  >
                    <FaTimesCircle />
                    Reject
                  </button>

                  <button
                    onClick={() =>
                      updateStatus(selectedRequest.id, "Pending")
                    }
                    className="flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-white hover:bg-yellow-600"
                  >
                    <FaClock />
                    Set Pending
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="rounded-xl border border-slate-200 px-6 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WelfareRequests;