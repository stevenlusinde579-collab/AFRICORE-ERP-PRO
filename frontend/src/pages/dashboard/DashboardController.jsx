import {
    useEffect,
    useState
} from "react";

import {
    Navigate
} from "react-router-dom";

import {
    supabase
} from "../../services/supabase";

import {
    useRole
} from "../../context/RoleContext";

import Dashboard from "./Dashboard";


// =====================================================
// ROLE DASHBOARDS
// =====================================================

import HeadmasterDashboard from "./HeadmasterDashboard";
import DeputyHeadmasterDashboard from "./DeputyHeadmasterDashboard";
import AcademicMasterDashboard from "./AcademicMasterDashboard";
import SubjectTeacherDashboard from "./SubjectTeacherDashboard";
import ClassTeacherDashboard from "./ClassTeacherDashboard";
import AccountantDashboard from "./AccountantDashboard";
import SecretaryDashboard from "./SecretaryDashboard";
import SocialWelfareDashboard from "./SocialWelfareDashboard";
import TeacherOnDutyDashboard from "./TeacherOnDutyDashboard";


// =====================================================
// DASHBOARD CONTROLLER
// =====================================================

function DashboardController() {

    const {
        selectedRoleId,
        selectedRoleName,
        loadingRoles
    } = useRole();


    const [loading, setLoading] =
        useState(true);


    const [user, setUser] =
        useState(null);


    const [primaryRole, setPrimaryRole] =
        useState(null);


    const [roles, setRoles] =
        useState([]);


    const [error, setError] =
        useState("");


    // =====================================================
    // LOAD CURRENT USER + AVAILABLE ROLES
    // =====================================================

    useEffect(() => {

        let mounted = true;


        const loadUserDashboard = async () => {

            try {

                setLoading(true);

                setError("");


                // =========================================
                // GET AUTH USER
                // =========================================

                const {
                    data: userData,
                    error: userError
                } =
                    await supabase.auth.getUser();


                if (userError) {

                    throw new Error(
                        userError.message
                    );

                }


                const currentUser =
                    userData?.user;


                if (!currentUser) {

                    if (mounted) {

                        setUser(null);

                        setLoading(false);

                    }

                    return;

                }


                if (mounted) {

                    setUser(
                        currentUser
                    );

                }


                // =========================================
                // GET PROFILE
                // =========================================

                const {
                    data: profile,
                    error: profileError
                } =
                    await supabase

                        .from("profiles")

                        .select(`
                            id,
                            role_id,
                            school_id
                        `)

                        .eq(
                            "id",
                            currentUser.id
                        )

                        .maybeSingle();


                if (profileError) {

                    throw new Error(
                        profileError.message
                    );

                }


                if (!profile) {

                    throw new Error(
                        "Your user profile was not found."
                    );

                }


                // =========================================
                // GET ACTIVE PROFILE ROLES
                // =========================================

                const {
                    data: profileRoles,
                    error: profileRolesError
                } =
                    await supabase

                        .from("profile_roles")

                        .select(`
                            role_id,
                            is_primary,
                            is_active
                        `)

                        .eq(
                            "profile_id",
                            currentUser.id
                        )

                        .eq(
                            "is_active",
                            true
                        );


                if (profileRolesError) {

                    console.warn(
                        "DashboardController profile_roles error:",
                        profileRolesError
                    );

                }


                // =========================================
                // BUILD ACTIVE ROLE IDS
                // =========================================

                const activeRoleRows =
                    Array.isArray(
                        profileRoles
                    )
                        ? profileRoles.filter(
                            row =>
                                row?.role_id !== null &&
                                row?.role_id !== undefined
                        )
                        : [];


                const roleIds =
                    activeRoleRows

                        .map(
                            row =>
                                Number(
                                    row.role_id
                                )
                        )

                        .filter(
                            id =>
                                Number.isFinite(
                                    id
                                )
                        );


                // =========================================
                // LEGACY PROFILE ROLE
                // =========================================

                if (
                    roleIds.length === 0 &&
                    profile.role_id !== null &&
                    profile.role_id !== undefined
                ) {

                    const legacyRoleId =
                        Number(
                            profile.role_id
                        );


                    if (
                        Number.isFinite(
                            legacyRoleId
                        )
                    ) {

                        roleIds.push(
                            legacyRoleId
                        );

                    }

                }


                const uniqueRoleIds = [
                    ...new Set(
                        roleIds
                    )
                ];


                if (
                    uniqueRoleIds.length === 0
                ) {

                    throw new Error(
                        "No active system role has been assigned to your account."
                    );

                }


                // =========================================
                // GET ROLE RECORDS
                // =========================================

                const {
                    data: roleRows,
                    error: roleError
                } =
                    await supabase

                        .from("roles")

                        .select(`
                            id,
                            role_name,
                            description
                        `)

                        .in(
                            "id",
                            uniqueRoleIds
                        );


                if (roleError) {

                    throw new Error(
                        roleError.message
                    );

                }


                const loadedRoles =
                    Array.isArray(
                        roleRows
                    )
                        ? roleRows
                        : [];


                // =========================================
                // FIND PRIMARY ROLE
                // =========================================

                let selectedPrimaryRole =
                    null;


                // =========================================
                // PRIMARY FROM profile_roles
                // =========================================

                const primaryRow =
                    activeRoleRows.find(
                        row =>
                            row?.is_primary === true
                    );


                if (primaryRow) {

                    selectedPrimaryRole =
                        loadedRoles.find(
                            role =>
                                Number(
                                    role.id
                                ) ===
                                Number(
                                    primaryRow.role_id
                                )
                        ) || null;

                }


                // =========================================
                // FALLBACK profiles.role_id
                // =========================================

                if (
                    !selectedPrimaryRole &&
                    profile.role_id !== null &&
                    profile.role_id !== undefined
                ) {

                    selectedPrimaryRole =
                        loadedRoles.find(
                            role =>
                                Number(
                                    role.id
                                ) ===
                                Number(
                                    profile.role_id
                                )
                        ) || null;

                }


                // =========================================
                // FALLBACK FIRST ACTIVE ROLE
                // =========================================

                if (
                    !selectedPrimaryRole &&
                    loadedRoles.length > 0
                ) {

                    selectedPrimaryRole =
                        loadedRoles[0];

                }


                if (!selectedPrimaryRole) {

                    throw new Error(
                        "Your assigned system role could not be identified."
                    );

                }


                // =========================================
                // SAVE
                // =========================================

                if (mounted) {

                    setPrimaryRole(
                        selectedPrimaryRole
                    );

                    setRoles(
                        loadedRoles
                    );

                    setLoading(false);

                }


                console.log(
                    "DashboardController ROLES:",
                    {
                        user:
                            currentUser.email,

                        primaryRole:
                            selectedPrimaryRole.role_name,

                        primaryRoleId:
                            selectedPrimaryRole.id,

                        selectedRoleId:
                            selectedRoleId,

                        selectedRoleName:
                            selectedRoleName,

                        allRoles:
                            loadedRoles.map(
                                role =>
                                    role.role_name
                            )
                    }
                );

            }
            catch (error) {

                console.error(
                    "DashboardController Error:",
                    error
                );


                if (mounted) {

                    setError(
                        error?.message ||
                        "Unable to load your dashboard."
                    );

                    setLoading(false);

                }

            }

        };


        loadUserDashboard();


        return () => {

            mounted = false;

        };

    }, [selectedRoleId]);


    // =====================================================
    // WAIT FOR ROLE CONTEXT
    // =====================================================

    if (
        loading ||
        loadingRoles
    ) {

        return (

            <div className="
                min-h-[60vh]
                flex
                items-center
                justify-center
            ">

                <div className="text-center">

                    <div className="
                        w-12
                        h-12
                        border-4
                        border-blue-200
                        border-t-blue-600
                        rounded-full
                        animate-spin
                        mx-auto
                    " />

                    <p className="
                        mt-4
                        text-gray-600
                        font-medium
                    ">

                        Loading your dashboard...

                    </p>

                </div>

            </div>

        );

    }


    // =====================================================
    // NOT AUTHENTICATED
    // =====================================================

    if (!user) {

        return (

            <Navigate
                to="/login"
                replace
            />

        );

    }


    // =====================================================
    // ERROR
    // =====================================================

    if (error) {

        return (

            <div className="
                min-h-[60vh]
                flex
                items-center
                justify-center
            ">

                <div className="
                    max-w-lg
                    w-full
                    bg-white
                    border
                    border-red-200
                    rounded-2xl
                    shadow
                    p-8
                    text-center
                ">

                    <div className="
                        w-14
                        h-14
                        mx-auto
                        rounded-full
                        bg-red-100
                        text-red-600
                        flex
                        items-center
                        justify-center
                        text-2xl
                        font-bold
                    ">

                        !

                    </div>


                    <h2 className="
                        text-xl
                        font-bold
                        text-gray-800
                        mt-4
                    ">

                        Dashboard Access Error

                    </h2>


                    <p className="
                        text-gray-600
                        mt-2
                    ">

                        {error}

                    </p>


                    <button
                        type="button"
                        onClick={() =>
                            window.location.reload()
                        }
                        className="
                            mt-6
                            bg-blue-600
                            hover:bg-blue-700
                            text-white
                            px-5
                            py-3
                            rounded-lg
                            font-semibold
                        "
                    >

                        Try Again

                    </button>

                </div>

            </div>

        );

    }


    // =====================================================
    // DETERMINE EFFECTIVE ROLE
    // =====================================================

    /*
        IMPORTANT:

        selectedRoleId comes from RoleContext.

        This is the role currently selected by
        the user in the role switcher.

        We do NOT use profiles.role_id here when
        a role has already been selected.
    */

    const selectedRole =
        roles.find(
            role =>
                Number(
                    role.id
                ) ===
                Number(
                    selectedRoleId
                )
        ) || null;


    const effectiveRole =
        selectedRole ||
        primaryRole;


    const effectiveRoleId =
        Number(
            effectiveRole?.id
        );


    const effectiveRoleName =
        String(
            effectiveRole?.role_name ||
            selectedRoleName ||
            ""
        )
            .trim()
            .toLowerCase();


    // =====================================================
    // DEBUG
    // =====================================================

    console.log(
        "DashboardController EFFECTIVE ROLE:",
        {
            selectedRoleId,
            selectedRoleName,
            effectiveRoleId,
            effectiveRoleName,
            effectiveRole:
                effectiveRole?.role_name,
            primaryRole:
                primaryRole?.role_name
        }
    );


    // =====================================================
    // SUPER ADMIN
    // =====================================================

    if (
        effectiveRoleId === 1 ||
        effectiveRoleName === "super admin" ||
        effectiveRoleName === "super administrator"
    ) {

        return (
            <Dashboard />
        );

    }


    // =====================================================
    // HEADMASTER
    // =====================================================

    if (
        effectiveRoleId === 2 ||
        effectiveRoleName === "headmaster"
    ) {

        return (
            <HeadmasterDashboard />
        );

    }


    // =====================================================
    // DEPUTY HEADMASTER
    // =====================================================

    if (
        effectiveRoleId === 3 ||
        effectiveRoleName === "deputy headmaster"
    ) {

        return (
            <DeputyHeadmasterDashboard />
        );

    }


    // =====================================================
    // ACADEMIC MASTER
    // =====================================================

    if (
        effectiveRoleId === 4 ||
        effectiveRoleName === "academic master"
    ) {

        return (
            <AcademicMasterDashboard />
        );

    }


    // =====================================================
    // CLASS TEACHER
    // =====================================================
    //
    // IMPORTANT:
    // We intentionally use the actual role name here.
    // We do NOT guess a Class Teacher role ID.
    //
    // The Class Teacher dashboard will therefore work
    // even if the role ID is different in this database.
    //
    // =====================================================

    if (
        effectiveRoleName === "class teacher"
    ) {

        return (
            <ClassTeacherDashboard />
        );

    }


    // =====================================================
    // SUBJECT TEACHER
    // =====================================================

    if (
        effectiveRoleId === 5 ||
        effectiveRoleName === "subject teacher" ||
        effectiveRoleName === "teacher"
    ) {

        return (
            <SubjectTeacherDashboard />
        );

    }


    // =====================================================
    // ACCOUNTANT
    // =====================================================

    if (
        effectiveRoleId === 6 ||
        effectiveRoleName === "accountant"
    ) {

        return (
            <AccountantDashboard />
        );

    }


    // =====================================================
    // SECRETARY
    // =====================================================

    if (
        effectiveRoleId === 7 ||
        effectiveRoleName === "secretary"
    ) {

        return (
            <SecretaryDashboard />
        );

    }


    // =====================================================
    // SOCIAL WELFARE MANAGER
    // =====================================================

    if (
        effectiveRoleName === "social welfare manager" ||
        effectiveRoleName === "social welfare"
    ) {

        return (
            <SocialWelfareDashboard />
        );

    }


    // =====================================================
    // TEACHER ON DUTY
    // =====================================================

    if (
        effectiveRoleId === 13 ||
        effectiveRoleName === "teacher on duty"
    ) {

        return (
            <TeacherOnDutyDashboard />
        );

    }


    // =====================================================
    // MATRON
    // =====================================================

    if (
        effectiveRoleId === 14 ||
        effectiveRoleName === "matron"
    ) {

        return (
            <Dashboard />
        );

    }


    // =====================================================
    // PATRON
    // =====================================================

    if (
        effectiveRoleId === 15 ||
        effectiveRoleName === "patron"
    ) {

        return (
            <Dashboard />
        );

    }


    // =====================================================
    // FALLBACK
    // =====================================================

    return (

        <div className="
            bg-white
            rounded-2xl
            shadow
            border
            p-8
        ">

            <h1 className="
                text-2xl
                font-bold
                text-gray-800
            ">

                Welcome to AfriCore ERP PRO

            </h1>


            <p className="
                text-gray-600
                mt-2
            ">

                You are logged in as:

                <span className="font-bold ml-1">

                    {effectiveRole?.role_name}

                </span>

            </p>


            <p className="
                text-gray-500
                mt-4
            ">

                Your role has been identified successfully.
                The dedicated dashboard for this role will be
                configured as the system continues to develop.

            </p>

        </div>

    );

}


export default DashboardController;