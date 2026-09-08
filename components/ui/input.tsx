import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("mb-1.5 block text-sm font-semibold text-foreground", className)}
    {...props}
  />
));
Label.displayName = "Label";

export const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    {label && <Label>{label}</Label>}
    {children}
    {error ? (
      <p className="mt-1 text-xs text-danger">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-muted">{hint}</p>
    ) : null}
  </div>
);
