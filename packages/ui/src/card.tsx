import type { HTMLAttributes, ReactElement, Ref } from "react";
import { cn } from "./utils";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  ref?: Ref<HTMLDivElement>;
};

export function Card({
  className,
  ref,
  ...props
}: CardProps): ReactElement {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-gray-200 bg-white shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  ref?: Ref<HTMLDivElement>;
};

export function CardHeader({
  className,
  ref,
  ...props
}: CardHeaderProps): ReactElement {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 px-6 pt-6", className)}
      {...props}
    />
  );
}

export type CardContentProps = HTMLAttributes<HTMLDivElement> & {
  ref?: Ref<HTMLDivElement>;
};

export function CardContent({
  className,
  ref,
  ...props
}: CardContentProps): ReactElement {
  return (
    <div ref={ref} className={cn("px-6 py-4", className)} {...props} />
  );
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement> & {
  ref?: Ref<HTMLDivElement>;
};

export function CardFooter({
  className,
  ref,
  ...props
}: CardFooterProps): ReactElement {
  return (
    <div
      ref={ref}
      className={cn("flex items-center px-6 pb-6 pt-2", className)}
      {...props}
    />
  );
}
