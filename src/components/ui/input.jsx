import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
    return (
        <input
            type={type}
            className={cn(
                "flex h-12 w-full rounded-lg border border-border-light bg-white px-4 py-2 text-base text-text-main transition-all",
                "placeholder:text-text-secondary/60",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "dark:border-border-dark dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500",
                className
            )}
            ref={ref}
            {...props}
        />
    );
});
Input.displayName = "Input";

export { Input };
