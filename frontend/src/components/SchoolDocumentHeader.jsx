import React from "react";
import { useSchool } from "../../context/SchoolContext";

/**
 * Global school branding header for printed documents and reports.
 * Uses the current school's identity and YES/NO document settings.
 */
function SchoolDocumentHeader({
    title = "",
    subtitle = "",
    className = "",
}) {
    const {
        school,
        loading,
        schoolName,
        registrationNumber,
        address,
        phone,
        email,
        logo,
        showSchoolName,
        showLogo,
        showRegistrationNumber,
        showAddress,
        showPhone,
        showEmail,
    } = useSchool();

    if (loading || !school) return null;

    const hasContactInformation =
        (showAddress && address) ||
        (showPhone && phone) ||
        (showEmail && email);

    return (
        <div className={`school-document-header mb-6 border-b-2 border-slate-800 pb-4 text-center ${className}`}>
            {showLogo && logo ? (
                <div className="mb-3 flex justify-center">
                    <img
                        src={logo}
                        alt={schoolName || "School Logo"}
                        className="h-20 w-20 object-contain"
                    />
                </div>
            ) : null}

            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
                {showSchoolName && schoolName ? schoolName : "AfriCore ERP"}
            </h1>

            {showRegistrationNumber && registrationNumber ? (
                <p className="mt-1 text-sm font-medium text-slate-700">
                    Registration No: {registrationNumber}
                </p>
            ) : null}

            {hasContactInformation ? (
                <div className="mt-2 space-y-0.5 text-sm text-slate-600">
                    {showAddress && address ? <p>{address}</p> : null}
                    {showPhone && phone ? <p>Phone: {phone}</p> : null}
                    {showEmail && email ? <p>Email: {email}</p> : null}
                </div>
            ) : null}

            {title ? (
                <h2 className="mt-4 text-xl font-bold text-slate-900">
                    {title}
                </h2>
            ) : null}

            {subtitle ? (
                <p className="mt-1 text-sm text-slate-600">
                    {subtitle}
                </p>
            ) : null}
        </div>
    );
}

export default SchoolDocumentHeader;
