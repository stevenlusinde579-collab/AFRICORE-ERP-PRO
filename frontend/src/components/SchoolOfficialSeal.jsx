import React from "react";
import { useSchool } from "../context/SchoolContext";

/**
 * School-specific official seal for supported printed documents.
 * This is a visual school stamp, not a cryptographic signature.
 */
export default function SchoolOfficialSeal({ className = "" }) {
    const { school, showOfficialSeal } = useSchool();

    if (!showOfficialSeal || !school) return null;

    const schoolName = String(school.school_name || "School").trim();
    const registration = String(school.registration_number || "").trim();

    return (
        <div className={`school-official-seal flex justify-end ${className}`} aria-label={`Official school seal for ${schoolName}`}>
            <div className="relative flex h-32 w-32 rotate-[-8deg] flex-col items-center justify-center rounded-full border-[4px] border-double border-blue-900 px-3 text-center text-blue-900 opacity-80 print:opacity-80">
                <div className="absolute inset-[5px] rounded-full border border-blue-900" />
                <span className="relative max-w-full text-[8px] font-black uppercase leading-tight tracking-[0.08em]">
                    {schoolName}
                </span>
                {registration ? (
                    <span className="relative mt-1 text-[7px] font-semibold tracking-wide">
                        {registration}
                    </span>
                ) : null}
                <span className="relative my-1 border-y border-blue-900 px-1 py-0.5 text-[10px] font-black uppercase tracking-widest">
                    Official Seal
                </span>
                <span className="relative text-[9px] font-black uppercase tracking-[0.12em]">
                    Headmaster
                </span>
            </div>
        </div>
    );
}
