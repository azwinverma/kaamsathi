import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg shadow-sm hover:bg-brand-hover",
        secondary:
          "border border-border bg-surface text-fg shadow-sm hover:bg-surface-hover hover:border-border-strong",
        ghost: "text-fg-body hover:bg-surface-hover hover:text-fg",
        danger: "bg-danger text-white shadow-sm hover:opacity-90 dark:text-neutral-900",
        "danger-outline":
          "border border-border bg-surface text-danger shadow-sm hover:bg-danger-subtle hover:border-danger/40",
        subtle: "bg-brand-subtle text-brand-subtle-fg hover:bg-primary-100 dark:hover:bg-primary-900/50",
        link: "h-auto px-0 text-brand underline-offset-4 hover:underline",
        accent: "bg-accent text-white shadow-sm hover:bg-accent-600",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 max-sm:min-h-11",
        lg: "h-12 px-6 text-base",
        icon: "size-10 max-sm:size-11",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        type={asChild ? undefined : (type ?? "button")}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
