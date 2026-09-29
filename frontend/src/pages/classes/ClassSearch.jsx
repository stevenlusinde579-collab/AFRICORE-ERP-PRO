import { useState } from "react";

function ClassSearch({ onSearch }) {
    const [search, setSearch] = useState("");

    const handleSearch = (e) => {
        const value = e.target.value;

        setSearch(value);

        if (onSearch) {
            onSearch({
                search: value,
            });
        }
    };

    return (
        <div className="bg-white rounded-xl shadow p-5 mt-6">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* =================================================
                    SEARCH CLASS
                    ================================================= */}

                <input
                    type="text"
                    value={search}
                    onChange={handleSearch}
                    placeholder="Search Class..."
                    className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* =================================================
                    ACTIVE ACADEMIC LEVEL
                    ================================================= */}

                <input
                    type="text"
                    placeholder="Search Academic Level..."
                    disabled
                    className="border rounded-lg p-3 bg-gray-100 text-gray-500 cursor-not-allowed"
                />

                {/* =================================================
                    ACADEMIC YEAR
                    ================================================= */}

                <input
                    type="text"
                    placeholder="Academic Year..."
                    disabled
                    className="border rounded-lg p-3 bg-gray-100 text-gray-500 cursor-not-allowed"
                />

            </div>

        </div>
    );
}

export default ClassSearch;