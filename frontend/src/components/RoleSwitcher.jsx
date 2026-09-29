import React, {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    FaChevronDown,
    FaCheck,
    FaUserShield,
} from "react-icons/fa";

import { useRole } from "../context/RoleContext";

function RoleSwitcher() {
    const {
        roles,
        selectedRole,
        selectedRoleId,
        selectedProfileRoleId,
        selectedRoleName,
        hasMultipleRoles,
        loading,
        selectRole,
    } = useRole();

    const [open, setOpen] = useState(false);

    const dropdownRef = useRef(null);

    // =====================================================
    // CLOSE DROPDOWN WHEN CLICKING OUTSIDE
    // =====================================================

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {
        return (
            <div className="relative">
                <div
                    className="
                        flex
                        items-center
                        gap-3
                        px-4
                        py-2
                        rounded-lg
                        border
                        border-gray-200
                        bg-white
                        shadow-sm
                    "
                >
                    <div
                        className="
                            w-8
                            h-8
                            rounded-full
                            bg-blue-100
                            text-blue-600
                            flex
                            items-center
                            justify-center
                        "
                    >
                        <FaUserShield size={14} />
                    </div>

                    <div className="text-left">
                        <div className="text-[11px] text-gray-500 font-medium">
                            Current Role
                        </div>

                        <div className="text-sm font-semibold text-gray-800">
                            Loading...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =====================================================
    // NO ROLE
    // =====================================================

    if (!roles || roles.length === 0) {
        return (
            <div className="relative">
                <div
                    className="
                        flex
                        items-center
                        gap-3
                        px-4
                        py-2
                        rounded-lg
                        border
                        border-red-200
                        bg-white
                        shadow-sm
                    "
                >
                    <div
                        className="
                            w-8
                            h-8
                            rounded-full
                            bg-red-100
                            text-red-600
                            flex
                            items-center
                            justify-center
                        "
                    >
                        <FaUserShield size={14} />
                    </div>

                    <div className="text-left">
                        <div className="text-[11px] text-gray-500 font-medium">
                            Current Role
                        </div>

                        <div className="text-sm font-semibold text-red-600">
                            Role not found
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =====================================================
    // ONE ROLE ONLY
    // =====================================================

    if (!hasMultipleRoles) {
        return (
            <div className="relative">
                <div
                    className="
                        flex
                        items-center
                        gap-3
                        px-4
                        py-2
                        rounded-lg
                        border
                        border-gray-200
                        bg-white
                        shadow-sm
                    "
                >
                    <div
                        className="
                            w-8
                            h-8
                            rounded-full
                            bg-blue-100
                            text-blue-600
                            flex
                            items-center
                            justify-center
                        "
                    >
                        <FaUserShield size={14} />
                    </div>

                    <div className="text-left">
                        <div className="text-[11px] text-gray-500 font-medium">
                            Current Role
                        </div>

                        <div className="text-sm font-semibold text-gray-800">
                            {selectedRoleName ||
                                selectedRole?.roleName ||
                                selectedRole?.role?.name ||
                                "Unknown Role"}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =====================================================
    // MULTIPLE ROLES
    // =====================================================

    return (
        <div
            ref={dropdownRef}
            className="relative"
            style={{
                zIndex: 99999,
            }}
        >
            {/* =================================================
                ROLE BUTTON
            ================================================= */}

            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="
                    flex
                    items-center
                    gap-3
                    px-4
                    py-2
                    rounded-lg
                    border
                    border-gray-200
                    bg-white
                    shadow-sm
                    hover:bg-gray-50
                    transition
                    min-w-[230px]
                    cursor-pointer
                "
            >
                <div
                    className="
                        w-8
                        h-8
                        rounded-full
                        bg-blue-100
                        text-blue-600
                        flex
                        items-center
                        justify-center
                        flex-shrink-0
                    "
                >
                    <FaUserShield size={14} />
                </div>

                <div className="flex-1 text-left">
                    <div className="text-[11px] text-gray-500 font-medium">
                        Current Role
                    </div>

                    <div className="text-sm font-semibold text-gray-800 truncate">
                        {selectedRoleName ||
                            selectedRole?.roleName ||
                            selectedRole?.role?.name ||
                            "Select Role"}
                    </div>
                </div>

                <FaChevronDown
                    size={12}
                    className={`
                        text-gray-500
                        transition-transform
                        duration-200
                        ${open ? "rotate-180" : ""}
                    `}
                />
            </button>

            {/* =================================================
                DROPDOWN
            ================================================= */}

            {open && (
                <div
                    className="
                        absolute
                        right-0
                        mt-2
                        w-[280px]
                        rounded-xl
                        border
                        border-gray-200
                        bg-white
                        shadow-2xl
                        overflow-hidden
                    "
                    style={{
                        zIndex: 100000,
                    }}
                >
                    {/* HEADER */}

                    <div
                        className="
                            px-4
                            py-3
                            border-b
                            border-gray-100
                            bg-gray-50
                        "
                    >
                        <div className="text-sm font-bold text-gray-800">
                            Switch Role
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                            Select the role you want to use
                        </div>
                    </div>

                    {/* ROLES */}

                    <div className="py-2">
                        {roles.map((role) => {
                            const roleId =
                                Number(role.roleId);

                            const active =
                                Number(selectedRoleId) ===
                                roleId;

                            const profileRoleActive =
                                selectedProfileRoleId &&
                                role.profileRoleId ===
                                    selectedProfileRoleId;

                            const roleName =
                                role.roleName ||
                                role.role?.name ||
                                `Role ${roleId}`;

                            return (
                                <button
                                    key={
                                        role.profileRoleId ||
                                        `${role.roleId}-${roleId}`
                                    }
                                    type="button"
                                    onClick={() => {
                                        selectRole(
                                            role.profileRoleId ||
                                                role.roleId
                                        );

                                        setOpen(false);
                                    }}
                                    className={`
                                        w-full
                                        flex
                                        items-center
                                        gap-3
                                        px-4
                                        py-3
                                        text-left
                                        transition
                                        cursor-pointer
                                        ${
                                            active ||
                                            profileRoleActive
                                                ? "bg-blue-50"
                                                : "hover:bg-gray-50"
                                        }
                                    `}
                                >
                                    {/* ICON */}

                                    <div
                                        className={`
                                            w-9
                                            h-9
                                            rounded-full
                                            flex
                                            items-center
                                            justify-center
                                            flex-shrink-0
                                            ${
                                                active ||
                                                profileRoleActive
                                                    ? "bg-blue-100 text-blue-600"
                                                    : "bg-gray-100 text-gray-500"
                                            }
                                        `}
                                    >
                                        <FaUserShield
                                            size={14}
                                        />
                                    </div>

                                    {/* ROLE NAME */}

                                    <div className="flex-1 min-w-0">
                                        <div
                                            className={`
                                                text-sm
                                                font-semibold
                                                truncate
                                                ${
                                                    active ||
                                                    profileRoleActive
                                                        ? "text-blue-700"
                                                        : "text-gray-700"
                                                }
                                            `}
                                        >
                                            {roleName}
                                        </div>

                                        {role.isPrimary && (
                                            <div className="text-[10px] text-gray-500 mt-0.5">
                                                Primary Role
                                            </div>
                                        )}
                                    </div>

                                    {/* CHECK */}

                                    {(active ||
                                        profileRoleActive) && (
                                        <FaCheck
                                            size={14}
                                            className="text-blue-600 flex-shrink-0"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* FOOTER */}

                    <div
                        className="
                            px-4
                            py-2
                            border-t
                            border-gray-100
                            bg-gray-50
                        "
                    >
                        <div className="text-[10px] text-gray-500">
                            {roles.length} assigned roles
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RoleSwitcher;