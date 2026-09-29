```jsx
import {
    useCallback,
    useEffect,
    useState,
} from "react";

import { supabase } from "../services/supabase";


const usePermissions = () => {

    const [permissions, setPermissions] = useState([]);
    const [role, setRole] = useState(null);
    const [profile, setProfile] = useState(null);

    const [loading, setLoading] = useState(true);


    const loadPermissions = useCallback(
        async () => {

            setLoading(true);

            try {

                /*
                 * -----------------------------------------------
                 * CURRENT USER
                 * -----------------------------------------------
                 */

                const {
                    data: {
                        user,
                    },
                    error: userError,
                } = await supabase.auth.getUser();


                if (userError || !user) {

                    setPermissions([]);
                    setRole(null);
                    setProfile(null);

                    return;

                }


                /*
                 * -----------------------------------------------
                 * PROFILE + ROLE
                 * -----------------------------------------------
                 */

                const {
                    data: profileData,
                    error: profileError,
                } = await supabase
                    .from("profiles")
                    .select(`
                        id,
                        full_name,
                        phone,
                        role_id,
                        school_id,
                        teacher_id,
                        employee_id,
                        roles (
                            id,
                            role_name,
                            description
                        )
                    `)
                    .eq("id", user.id)
                    .maybeSingle();


                if (profileError) {

                    console.error(
                        "Profile loading error:",
                        profileError
                    );

                    return;

                }


                if (!profileData) {

                    setPermissions([]);
                    setRole(null);
                    setProfile(null);

                    return;

                }


                setProfile(profileData);
                setRole(profileData.roles || null);


                /*
                 * -----------------------------------------------
                 * SUPER ADMIN
                 * -----------------------------------------------
                 */

                if (
                    Number(profileData.role_id) === 1
                ) {

                    setPermissions([
                        "*",
                    ]);

                    return;

                }


                /*
                 * -----------------------------------------------
                 * ROLE PERMISSIONS
                 * -----------------------------------------------
                 */

                const {
                    data: rolePermissions,
                    error: permissionError,
                } = await supabase
                    .from("role_permissions")
                    .select(`
                        permission_id,
                        permissions (
                            permission_name
                        )
                    `)
                    .eq(
                        "role_id",
                        profileData.role_id
                    );


                if (permissionError) {

                    console.error(
                        "Permission loading error:",
                        permissionError
                    );

                    setPermissions([]);

                    return;

                }


                const permissionNames =
                    (rolePermissions || [])
                        .map(
                            (item) =>
                                item?.permissions?.permission_name
                        )
                        .filter(Boolean);


                setPermissions(
                    permissionNames
                );

            } catch (error) {

                console.error(
                    "Unexpected permission error:",
                    error
                );

                setPermissions([]);

            } finally {

                setLoading(false);

            }

        },
        []
    );


    useEffect(() => {

        loadPermissions();

    }, [loadPermissions]);


    /*
     * -------------------------------------------------
     * HAS PERMISSION
     * -------------------------------------------------
     */

    const hasPermission =
        useCallback(
            (permission) => {

                if (!permission) {
                    return false;
                }

                if (
                    permissions.includes("*")
                ) {
                    return true;
                }

                return permissions.includes(
                    permission
                );

            },
            [permissions]
        );


    /*
     * -------------------------------------------------
     * HAS ANY PERMISSION
     * -------------------------------------------------
     */

    const hasAnyPermission =
        useCallback(
            (requiredPermissions = []) => {

                if (
                    permissions.includes("*")
                ) {
                    return true;
                }

                return requiredPermissions.some(
                    (permission) =>
                        permissions.includes(
                            permission
                        )
                );

            },
            [permissions]
        );


    /*
     * -------------------------------------------------
     * HAS ALL PERMISSIONS
     * -------------------------------------------------
     */

    const hasAllPermissions =
        useCallback(
            (requiredPermissions = []) => {

                if (
                    permissions.includes("*")
                ) {
                    return true;
                }

                return requiredPermissions.every(
                    (permission) =>
                        permissions.includes(
                            permission
                        )
                );

            },
            [permissions]
        );


    return {

        permissions,

        role,

        profile,

        loading,

        hasPermission,

        hasAnyPermission,

        hasAllPermissions,

        refreshPermissions:
            loadPermissions,

    };

};


export default usePermissions;
```
