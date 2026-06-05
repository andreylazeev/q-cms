import {
  useState,
  useCallback,
  useEffect,
  useId,
  createContext,
  useContext,
} from "react";
import type { ReactNode, ReactElement, Ref, MouseEvent } from "react";
import { X } from "lucide-react";
import { cn } from "./utils";

type ModalContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("Modal compound components must be used within <Modal>");
  }
  return ctx;
}

export type ModalProps = {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
};

export type ModalTriggerProps = {
  children: ReactElement;
};

export function Modal({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
}: ModalProps): ReactElement {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const titleId = useId();
  const descriptionId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <ModalContext.Provider value={{ open, setOpen, titleId, descriptionId }}>
      {children}
    </ModalContext.Provider>
  );
}

export function ModalTrigger({
  children,
}: ModalTriggerProps): ReactElement {
  const { setOpen } = useModalContext();

  if (typeof children === "string" || typeof children === "number" || typeof children === "boolean") {
    throw new Error("ModalTrigger requires a single React element child");
  }

  return (
    <children.type
      onClick={(e: MouseEvent) => {
        setOpen(true);
        const childProps = children.props as Record<string, unknown>;
        const childOnClick = childProps['onClick'];
        if (typeof childOnClick === 'function') childOnClick(e);
      }}
      {...(children.props as Record<string, unknown>)}
    />
  );
}

export type ModalContentProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
};

export function ModalContent({
  children,
  title,
  description,
  className,
  ref,
}: ModalContentProps): ReactElement | null {
  const { open, setOpen, titleId, descriptionId } = useModalContext();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        ref={ref}
        className={cn(
          "relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl",
          className,
        )}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-sm p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {title && (
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 pr-6">
            {title}
          </h2>
        )}
        {description && (
          <p id={descriptionId} className="mt-1 text-sm text-gray-500">
            {description}
          </p>
        )}
        <div className={cn((title || description) && "mt-4")}>{children}</div>
      </div>
    </div>
  );
}
