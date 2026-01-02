import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-primary/20 text-green-800 dark:text-primary",
                secondary: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
                success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                destructive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

function Badge({ className, variant, ...props }) {
    return (
        <span className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
