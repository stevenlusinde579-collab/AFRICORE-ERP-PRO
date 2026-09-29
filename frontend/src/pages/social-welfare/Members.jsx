import React, { useEffect, useMemo, useState } from "react";
import {
    FaPlus,
    FaSearch,
    FaSyncAlt,
    FaUsers,
    FaUserCheck,
    FaUserTimes,
    FaSave,
    FaTimes,
    FaUserPlus,
    FaIdBadge,
    FaPhone,
    FaSchool,
} from "react-icons/fa";
import { supabase } from "../../services/supabase";

const normalizeText = (value) => String(value || "").trim();

const buildFullName = (person) =>
    [person?.first_name, person?.middle_name, person?.last_name]
        .map(normalizeText)
        .filter(Boolean)
        .join(" ");

const normalizeMemberType = (staffType) =>
    normalizeText(staffType).toLowerCase() === "non-staff"
        ? "non_staff"
        : "staff";

const displayMemberType = (value) =>
    normalizeText(value).toLowerCase() === "non_staff"
        ? "Non-Staff"
        : "Staff";

const today = () => new Date().toISOString().slice(0, 10);

const formatMoney = (value) =>
    new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

function Members() {
    const [currentProfile, setCurrentProfile] = useState(null);
    const [members, setMembers] = useState([]);
    const [sourcePeople, setSourcePeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sourceLoading, setSourceLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [search, setSearch] = useState("");
    const [memberModalOpen, setMemberModalOpen] = useState(false);
    const [selectedPersonId, setSelectedPersonId] = useState("");
    const [memberForm, setMemberForm] = useState({
        join_date: today(),
        initial_balance: "10000",
    });

    const fetchProfile = async () => {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData?.user;
        if (!user?.id) throw new Error("User session not found.");

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, school_id, role_id")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;
        setCurrentProfile(profile);
        return profile;
    };

    const fetchMembers = async (profileOverride = null) => {
        const profile = profileOverride || currentProfile || await fetchProfile();

        let query = supabase
            .from("social_fund_members")
            .select(`
                id,
                school_id,
                member_number,
                member_type,
                staff_id,
                full_name,
                phone,
                initial_balance,
                join_date,
                status,
                created_at
            `)
            .order("created_at", { ascending: false });

        if (Number(profile?.role_id) !== 1) {
            if (!profile?.school_id) {
                throw new Error("Your profile is not assigned to a school.");
            }
            query = query.eq("school_id", profile.school_id);
        }

        const { data, error: membersError } = await query;
        if (membersError) throw membersError;

        const normalized = Array.isArray(data) ? data : [];
        setMembers(normalized);
        return normalized;
    };

    const fetchSourcePeople = async (profileOverride = null, memberRowsOverride = null) => {
        const profile = profileOverride || currentProfile || await fetchProfile();
        const memberRows = memberRowsOverride || members;

        setSourceLoading(true);
        try {
            let query = supabase
                .from("teachers")
                .select(`
                    id,
                    school_id,
                    employee_number,
                    first_name,
                    middle_name,
                    last_name,
                    staff_type,
                    phone,
                    email,
                    status
                `)
                .order("first_name", { ascending: true })
                .order("last_name", { ascending: true });

            // Super Admin can see people across schools. Other welfare managers
            // stay within their assigned school.
            if (Number(profile?.role_id) !== 1) {
                if (!profile?.school_id) {
                    throw new Error("Your profile is not assigned to a school.");
                }
                query = query.eq("school_id", profile.school_id);
            }

            const { data, error: peopleError } = await query;
            if (peopleError) throw peopleError;

            const existingKeys = new Set(
                (Array.isArray(memberRows) ? memberRows : [])
                    .filter((member) => member?.staff_id !== null && member?.staff_id !== undefined)
                    .map((member) => `${member.school_id ?? ""}:${member.staff_id}`)
            );

            const normalized = (Array.isArray(data) ? data : [])
                .filter((person) =>
                    String(person?.status || "").toLowerCase() === "active"
                )
                .map((person) => ({
                    ...person,
                    full_name: buildFullName(person),
                    member_type: normalizeMemberType(person.staff_type),
                }))
                .filter((person) =>
                    !existingKeys.has(`${person.school_id ?? ""}:${person.id}`)
                );

            setSourcePeople(normalized);
            return normalized;
        } finally {
            setSourceLoading(false);
        }
    };

    const loadAll = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            setError("");
            setSuccessMessage("");

            const profile = currentProfile || await fetchProfile();
            const memberRows = await fetchMembers(profile);
            await fetchSourcePeople(profile, memberRows);
        } catch (err) {
            console.error("SOCIAL WELFARE MEMBERS LOAD ERROR:", err);
            setError(err?.message || "Failed to load welfare members.");
            setMembers([]);
            setSourcePeople([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                const profile = await fetchProfile();
                if (!mounted) return;
                const memberRows = await fetchMembers(profile);
                if (!mounted) return;
                await fetchSourcePeople(profile, memberRows);
            } catch (err) {
                console.error("SOCIAL WELFARE MEMBERS INIT ERROR:", err);
                if (mounted) {
                    setError(err?.message || "Failed to load welfare members.");
                    setMembers([]);
                    setSourcePeople([]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        init();
        return () => {
            mounted = false;
        };
    }, []);

    const selectedPerson = useMemo(
        () => sourcePeople.find((person) => String(person.id) === String(selectedPersonId)) || null,
        [sourcePeople, selectedPersonId]
    );

    const filteredSourcePeople = useMemo(() => {
        const term = normalizeText(search).toLowerCase();
        if (!term) return sourcePeople;

        return sourcePeople.filter((person) => {
            const haystack = [
                person.full_name,
                person.employee_number,
                person.phone,
                person.email,
                person.staff_type,
            ]
                .map((value) => normalizeText(value).toLowerCase())
                .join(" ");

            return haystack.includes(term);
        });
    }, [sourcePeople, search]);

    const filteredMembers = useMemo(() => {
        const term = normalizeText(search).toLowerCase();
        if (!term) return members;

        return members.filter((member) => {
            const haystack = [
                member.full_name,
                member.member_number,
                member.phone,
                member.member_type,
                member.status,
            ]
                .map((value) => normalizeText(value).toLowerCase())
                .join(" ");

            return haystack.includes(term);
        });
    }, [members, search]);

    const openAddMemberModal = () => {
        setSelectedPersonId("");
        setMemberForm({
            join_date: today(),
            initial_balance: "10000",
        });
        setError("");
        setSuccessMessage("");
        setMemberModalOpen(true);

        if (!sourcePeople.length) {
            fetchSourcePeople();
        }
    };

    const closeAddMemberModal = () => {
        if (saving) return;
        setMemberModalOpen(false);
        setSelectedPersonId("");
        setMemberForm({
            join_date: today(),
            initial_balance: "10000",
        });
    };

    const handlePersonChange = (value) => {
        setSelectedPersonId(value);
        setError("");
        setSuccessMessage("");
    };

    const addWelfareMember = async (event) => {
        event.preventDefault();

        try {
            if (!selectedPerson) {
                throw new Error("Please select an existing Staff or Non-Staff member.");
            }

            const initialBalance = Number(memberForm.initial_balance || 10000);
            if (!Number.isFinite(initialBalance) || initialBalance < 0) {
                throw new Error("Initial Balance must be 0 or greater.");
            }

            if (!memberForm.join_date) {
                throw new Error("Join Date is required.");
            }

            setSaving(true);
            setError("");
            setSuccessMessage("");

            const { data: duplicate, error: duplicateError } = await supabase
                .from("social_fund_members")
                .select("id, full_name, status")
                .eq("staff_id", selectedPerson.id)
                .eq("school_id", selectedPerson.school_id)
                .limit(1);

            if (duplicateError) throw duplicateError;

            if (duplicate?.length) {
                throw new Error(`${selectedPerson.full_name} is already registered as a Social Welfare member.`);
            }

            const payload = {
                school_id: selectedPerson.school_id,
                member_number: selectedPerson.employee_number || null,
                member_type: selectedPerson.member_type,
                staff_id: selectedPerson.id,
                full_name: selectedPerson.full_name,
                phone: selectedPerson.phone || null,
                initial_balance: initialBalance,
                join_date: memberForm.join_date,
                status: "active",
            };

            const { error: insertError } = await supabase
                .from("social_fund_members")
                .insert([payload]);

            if (insertError) throw insertError;

            setMemberModalOpen(false);
            setSelectedPersonId("");
            setMemberForm({
                join_date: today(),
                initial_balance: "10000",
            });

            const memberRows = await fetchMembers(currentProfile);
            await fetchSourcePeople(currentProfile, memberRows);
            setSuccessMessage(`${selectedPerson.full_name} has been added to Social Welfare.`);
        } catch (err) {
            console.error("ADD SOCIAL WELFARE MEMBER ERROR:", err);
            setError(err?.message || "Failed to add welfare member.");
        } finally {
            setSaving(false);
        }
    };

    const toggleMemberStatus = async (member) => {
        const nextStatus =
            String(member?.status || "").toLowerCase() === "active"
                ? "inactive"
                : "active";

        try {
            setSaving(true);
            setError("");
            setSuccessMessage("");

            const { error: updateError } = await supabase
                .from("social_fund_members")
                .update({ status: nextStatus })
                .eq("id", member.id);

            if (updateError) throw updateError;

            const memberRows = await fetchMembers(currentProfile);
            await fetchSourcePeople(currentProfile, memberRows);
            setSuccessMessage(
                `${member.full_name} is now ${nextStatus === "active" ? "Active" : "Inactive"}.`
            );
        } catch (err) {
            console.error("TOGGLE SOCIAL MEMBER STATUS ERROR:", err);
            setError(err?.message || "Failed to update member status.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[320px]">
                <div className="flex items-center gap-3 text-blue-600 font-semibold">
                    <FaSyncAlt className="animate-spin" />
                    Loading welfare members...
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                            <FaUsers />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Welfare Members</h2>
                            <p className="text-sm text-slate-500">
                                Add existing Staff and Non-Staff from the AfriCore staff registry.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => loadAll(true)}
                        disabled={refreshing || saving}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                        <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={openAddMemberModal}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        <FaUserPlus />
                        Add Welfare Member
                    </button>
                </div>
            </div>

            {(error || successMessage) && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${
                    error
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-green-200 bg-green-50 text-green-700"
                }`}>
                    {error || successMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Welfare Members</p>
                    <p className="mt-2 text-2xl font-bold text-slate-800">{members.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Members</p>
                    <p className="mt-2 text-2xl font-bold text-green-700">
                        {members.filter((member) => String(member.status || "").toLowerCase() === "active").length}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Available Staff / Non-Staff</p>
                    <p className="mt-2 text-2xl font-bold text-blue-700">{sourcePeople.length}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800">Registered Welfare Members</h3>
                        <p className="text-xs text-slate-500 mt-1">These are the people already enrolled in Social Welfare.</p>
                    </div>
                    <div className="relative w-full md:w-80">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search name, employee no., phone..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Member No.</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Name</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Type</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Phone</th>
                                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Initial Balance</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">Status</th>
                                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-5 py-10 text-center text-slate-400">
                                        No welfare members found.
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map((member) => {
                                    const active = String(member.status || "").toLowerCase() === "active";
                                    return (
                                        <tr key={member.id} className="hover:bg-slate-50/70">
                                            <td className="px-5 py-3 font-semibold text-slate-700">{member.member_number || "-"}</td>
                                            <td className="px-5 py-3">
                                                <div className="font-semibold text-slate-800">{member.full_name}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                                    member.member_type === "non_staff"
                                                        ? "bg-purple-100 text-purple-700"
                                                        : "bg-blue-100 text-blue-700"
                                                }`}>
                                                    {displayMemberType(member.member_type)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">{member.phone || "-"}</td>
                                            <td className="px-5 py-3 text-right font-semibold text-slate-700">
                                                TZS {formatMoney(member.initial_balance)}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                                                    active
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-slate-100 text-slate-600"
                                                }`}>
                                                    {active ? <FaUserCheck /> : <FaUserTimes />}
                                                    {active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleMemberStatus(member)}
                                                    disabled={saving}
                                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                                                        active
                                                            ? "border-red-200 text-red-600 hover:bg-red-50"
                                                            : "border-green-200 text-green-700 hover:bg-green-50"
                                                    }`}
                                                >
                                                    {active ? "Deactivate" : "Activate"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {memberModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
                    <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-slate-950 text-white shadow-2xl border border-slate-800">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-6">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                                        <FaUserPlus />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Add Welfare Member</h3>
                                        <p className="text-sm text-slate-400 mt-1">Select an existing Staff or Non-Staff record.</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeAddMemberModal}
                                className="w-9 h-9 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={addWelfareMember} className="p-6 space-y-5 bg-slate-950">
                            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                                <div className="flex items-start gap-3">
                                    <FaUsers className="mt-1 text-blue-400" />
                                    <div>
                                        <p className="font-bold text-white">Source: AfriCore Staff Registry</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-300">
                                            The person is not recreated. Name, Staff/Non-Staff type, employee number and phone are taken from the existing Staff registry in Supabase.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-200">Staff / Non-Staff</label>
                                <select
                                    value={selectedPersonId}
                                    onChange={(event) => handlePersonChange(event.target.value)}
                                    disabled={sourceLoading || saving}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-900 text-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-800"
                                    required
                                >
                                    <option value="">
                                        {sourceLoading ? "Loading Staff / Non-Staff..." : "Select Staff / Non-Staff"}
                                    </option>
                                    {filteredSourcePeople.map((person) => (
                                        <option key={`${person.school_id}-${person.id}`} value={person.id}>
                                            {person.full_name} — {displayMemberType(person.member_type)} — {person.employee_number || "No Employee No."}
                                            {Number(currentProfile?.role_id) === 1 ? ` — School ${person.school_id}` : ""}
                                        </option>
                                    ))}
                                </select>
                                {!sourceLoading && filteredSourcePeople.length === 0 && (
                                    <p className="mt-2 text-xs text-amber-300">
                                        No active Staff / Non-Staff records are available for selection, or all available people are already welfare members.
                                    </p>
                                )}
                            </div>

                            {selectedPerson && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                            <FaUserCheck /> Name
                                        </div>
                                        <p className="mt-2 font-bold text-white">{selectedPerson.full_name}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                            <FaIdBadge /> Employee Number
                                        </div>
                                        <p className="mt-2 font-bold text-white">{selectedPerson.employee_number || "-"}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                            <FaUsers /> Member Type
                                        </div>
                                        <p className="mt-2 font-bold text-white">{displayMemberType(selectedPerson.member_type)}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                            <FaPhone /> Phone
                                        </div>
                                        <p className="mt-2 font-bold text-white">{selectedPerson.phone || "-"}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-200">Initial Balance (TZS)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={memberForm.initial_balance}
                                        onChange={(event) => setMemberForm((prev) => ({ ...prev, initial_balance: event.target.value }))}
                                        disabled={saving}
                                        required
                                        className="w-full rounded-xl border border-slate-700 bg-slate-900 text-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <p className="mt-2 text-xs text-slate-400">New welfare members start with TZS 10,000.</p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-200">Join Date</label>
                                    <input
                                        type="date"
                                        value={memberForm.join_date}
                                        onChange={(event) => setMemberForm((prev) => ({ ...prev, join_date: event.target.value }))}
                                        disabled={saving}
                                        required
                                        className="w-full rounded-xl border border-slate-700 bg-slate-900 text-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
                                <div className="flex items-start gap-3">
                                    <FaSchool className="mt-0.5 text-blue-600" />
                                    <div>
                                        <p className="font-semibold text-white">School association</p>
                                        <p className="mt-1">
                                            The welfare member will be saved against the same school as the selected Staff / Non-Staff record.
                                            This also keeps Super Admin's cross-school selection correct.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeAddMemberModal}
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                                >
                                    <FaTimes />
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || sourceLoading || !selectedPerson}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? <FaSyncAlt className="animate-spin" /> : <FaSave />}
                                    {saving ? "Saving..." : "Save Welfare Member"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Members;
