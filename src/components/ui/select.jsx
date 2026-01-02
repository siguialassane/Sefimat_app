import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
    return (
        <div className="relative">
            <select
                className={cn(
                    "flex h-12 w-full appearance-none rounded-lg border border-border-light bg-white px-4 pr-10 py-2 text-base text-text-main transition-all cursor-pointer",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "dark:border-border-dark dark:bg-gray-900 dark:text-white",
                    className
                )}
                ref={ref}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary pointer-events-none" />
        </div>
    );
});
Select.displayName = "Select";

export { Select };
