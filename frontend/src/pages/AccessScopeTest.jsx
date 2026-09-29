import React, {
    useEffect,
    useState
} from "react";

import api from "../services/api";


const AccessScopeTest = () => {

    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        result,
        setResult
    ] = useState(null);


    const [
        error,
        setError
    ] = useState(null);


    const runTest = async () => {

        setLoading(true);
        setError(null);
        setResult(null);

        try {

            const response =
                await api.get(
                    "/auth/access-test"
                );

            setResult(
                response.data
            );

        } catch (error) {

            console.error(
                "ACCESS SCOPE TEST ERROR:",
                error
            );

            setError({
                status:
                    error?.response?.status ||
                    null,

                message:
                    error?.response?.data?.message ||
                    error?.message ||
                    "Access Scope test failed.",

                response:
                    error?.response?.data ||
                    null
            });

        } finally {

            setLoading(false);

        }
    };


    useEffect(() => {

        runTest();

    }, []);


    return (
        <div
            style={{
                minHeight: "100vh",
                padding: "40px",
                background:
                    "#f5f7fb",
                fontFamily:
                    "Arial, sans-serif"
            }}
        >

            <div
                style={{
                    maxWidth: "1000px",
                    margin: "0 auto"
                }}
            >

                <h1>
                    AfriCore Access Scope Test
                </h1>


                <p>
                    Testing the central
                    permission and data
                    scope engine.
                </p>


                <button
                    type="button"
                    onClick={runTest}
                    disabled={loading}
                    style={{
                        padding:
                            "12px 20px",
                        border:
                            "none",
                        borderRadius:
                            "8px",
                        cursor:
                            loading
                                ? "not-allowed"
                                : "pointer"
                    }}
                >
                    {loading
                        ? "Testing..."
                        : "Run Access Test"}
                </button>


                {loading && (
                    <div
                        style={{
                            marginTop:
                                "25px"
                        }}
                    >
                        Checking authenticated
                        user and access scope...
                    </div>
                )}


                {error && (
                    <div
                        style={{
                            marginTop:
                                "25px",
                            padding:
                                "20px",
                            borderRadius:
                                "10px",
                            background:
                                "#fee2e2"
                        }}
                    >

                        <h2>
                            Access Test Failed
                        </h2>

                        <p>
                            HTTP Status:{" "}
                            {error.status ||
                                "Unknown"}
                        </p>

                        <p>
                            {error.message}
                        </p>


                        <pre
                            style={{
                                whiteSpace:
                                    "pre-wrap",
                                overflowX:
                                    "auto"
                            }}
                        >
                            {JSON.stringify(
                                error.response,
                                null,
                                2
                            )}
                        </pre>

                    </div>
                )}


                {result && (
                    <div
                        style={{
                            marginTop:
                                "25px",
                            padding:
                                "25px",
                            borderRadius:
                                "12px",
                            background:
                                "#ffffff"
                        }}
                    >

                        <h2>
                            Access Scope Engine Result
                        </h2>


                        <p>
                            <strong>
                                Success:
                            </strong>{" "}
                            {String(
                                result.success
                            )}
                        </p>


                        <p>
                            <strong>
                                Message:
                            </strong>{" "}
                            {result.message}
                        </p>


                        <h3>
                            Authenticated User
                        </h3>

                        <pre
                            style={{
                                background:
                                    "#f3f4f6",
                                padding:
                                    "15px",
                                borderRadius:
                                    "8px",
                                overflowX:
                                    "auto"
                            }}
                        >
                            {JSON.stringify(
                                result.authenticated_user,
                                null,
                                2
                            )}
                        </pre>


                        <h3>
                            Test
                        </h3>

                        <pre
                            style={{
                                background:
                                    "#f3f4f6",
                                padding:
                                    "15px",
                                borderRadius:
                                    "8px",
                                overflowX:
                                    "auto"
                            }}
                        >
                            {JSON.stringify(
                                result.test,
                                null,
                                2
                            )}
                        </pre>


                        <h3>
                            Complete Response
                        </h3>

                        <pre
                            style={{
                                background:
                                    "#111827",
                                color:
                                    "#ffffff",
                                padding:
                                    "20px",
                                borderRadius:
                                    "8px",
                                overflowX:
                                    "auto"
                            }}
                        >
                            {JSON.stringify(
                                result,
                                null,
                                2
                            )}
                        </pre>

                    </div>
                )}

            </div>

        </div>
    );
};


export default AccessScopeTest;