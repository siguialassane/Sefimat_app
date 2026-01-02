import * as React from "react";

// Custom Mosque icon (not available in Lucide)
export function Mosque({ className, ...props }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            <path d="M12 2C12 2 8 6 8 10V12H16V10C16 6 12 2 12 2Z" />
            <path d="M5 12H19V22H5V12Z" />
            <path d="M3 22H21" />
            <path d="M9 22V18C9 16.3431 10.3431 15 12 15C13.6569 15 15 16.3431 15 18V22" />
            <circle cx="12" cy="8" r="1" fill="currentColor" />
        </svg>
    );
}
