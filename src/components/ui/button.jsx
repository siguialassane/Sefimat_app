import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    {
        variants: {
            variant: {
                default: "bg-primary hover:bg-primary-hover text-text-main shadow-sm shadow-primary/20",
                destructive: "bg-red-500 text-white hover:bg-red-600",
                outline: "border border-border-light bg-white hover:bg-gray-50 text-text-main dark:border-border-dark dark:bg-transparent dark:text-white dark:hover:bg-white/5",
                secondary: "bg-primary/10 text-primary-dark hover:bg-primary/20 dark:text-primary",
                ghost: "hover:bg-gray-100 dark:hover:bg-white/5",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-11 px-6",
                sm: "h-9 px-4 text-xs",
                lg: "h-12 px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

const Button = React.forwardRef(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
