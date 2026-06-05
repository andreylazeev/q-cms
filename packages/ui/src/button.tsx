import { cloneElement, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactNode, ReactElement, Ref } from "react";
import { cn } from "./utils";
import { Spinner } from "./spinner";

const variantStyles = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 disabled:bg-blue-300",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400 disabled:text-gray-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300",
} as const;

const sizeStyles = {
  sm: "px-2.5 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
} as const;

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
} & (
    | { asChild: true; children: ReactElement }
    | { asChild?: false }
  );

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ref,
  asChild,
  ...props
}: ButtonProps): ReactElement {
  const isDisabled = disabled || loading;

  const classes = cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer",
    variantStyles[variant],
    sizeStyles[size],
    isDisabled && "pointer-events-none opacity-60",
    className,
  );
  if (asChild) {
    const child = children;
    if (!isValidElement(child)) {
      throw new Error("Button asChild requires a single React element child");
    }
    return cloneElement(child, {
      className: cn(classes, (child.props as Record<string, unknown>)['className'] as string | undefined),
      ...(isDisabled ? { "aria-disabled": true } : {}),
    } as Record<string, unknown>);
  }

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading && <Spinner size={size === "lg" ? "md" : "sm"} />}
      {children}
    </button>
  );
}
