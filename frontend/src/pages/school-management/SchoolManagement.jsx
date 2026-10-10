import React from "react";

export default function SchoolManagement() {
    return (
        <div className="min-h-screen bg-slate-100 p-6">
            <div className="mx-auto max-w-6xl">
                <div className="rounded-xl bg-white p-6 shadow">
                    <h1 className="text-2xl font-bold text-blue-800">
                        School Management
                    </h1>

                    <p className="mt-2 text-gray-600">
                        Super Admin - School Administration
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border p-5">
                            <h2 className="font-semibold">Total Schools</h2>
                            <p className="mt-2 text-3xl font-bold">0</p>
                        </div>

                        <div className="rounded-lg border p-5">
                            <h2 className="font-semibold">Active Schools</h2>
                            <p className="mt-2 text-3xl font-bold text-green-600">
                                0
                            </p>
                        </div>

                        <div className="rounded-lg border p-5">
                            <h2 className="font-semibold">Inactive Schools</h2>
                            <p className="mt-2 text-3xl font-bold text-red-600">
                                0
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            className="rounded-lg bg-blue-700 px-5 py-3 text-white"
                        >
                            Add School
                        </button>

                        <button
                            type="button"
                            className="rounded-lg border px-5 py-3"
                        >
                            Refresh
                        </button>
                    </div>

                    <div className="mt-6 overflow-x-auto rounded-lg border">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-4">School Name</th>
                                    <th className="p-4">School Code</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="p-8 text-center text-gray-500"
                                    >
                                        No schools loaded yet.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}