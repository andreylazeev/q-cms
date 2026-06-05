import {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import type {
  ReactNode,
  ReactElement,
  MutableRefObject,
  RefObject,
  MouseEvent,
  KeyboardEvent,
} from "react";
import { cn } from "./utils";

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  itemCountRef: MutableRefObject<number>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuId: string;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx) {
    throw new Error(
      "Dropdown compound components must be used within <DropdownMenu>",
    );
  }
  return ctx;
}

export type DropdownMenuProps = {
  children: ReactNode;
};

export function DropdownMenu({
  children,
}: DropdownMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemCountRef = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `dropdown-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <DropdownContext.Provider
      value={{
        open,
        setOpen,
        activeIndex,
        setActiveIndex,
        itemCountRef,
        triggerRef,
        menuId,
      }}
    >
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export type DropdownTriggerProps = {
  children: ReactElement;
};

export function DropdownTrigger({
  children,
}: DropdownTriggerProps): ReactElement {
  const { open, setOpen, triggerRef, menuId } = useDropdownContext();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!open) {
          setOpen(true);
        }
      }
    },
    [open, setOpen],
  );

  if (typeof children === "string" || typeof children === "number" || typeof children === "boolean") {
    throw new Error("DropdownTrigger requires a single React element child");
  }

  return (
    // @ts-expect-error ref type mismatch from cloneElement
    <children.type
      ref={triggerRef}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={(e: MouseEvent) => {
        setOpen(!open);
        (children.props as Record<string, unknown>).onClick?.(e);
      }}
      onKeyDown={handleKeyDown}
      {...children.props}
    />
  );
}

export type DropdownContentProps = {
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
};

export function DropdownContent({
  children,
  align = "start",
  className,
}: DropdownContentProps): ReactElement | null {
  const { open, setOpen, activeIndex, setActiveIndex, itemCountRef, triggerRef, menuId } =
    useDropdownContext();
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset item count each time the menu opens
  useEffect(() => {
    if (open) {
      itemCountRef.current = 0;
    }
  }, [open, itemCountRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: globalThis.MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen, triggerRef]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const count = itemCountRef.current;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex(Math.min(activeIndex + 1, count - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex(Math.max(activeIndex - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (activeIndex >= 0 && menuRef.current) {
            const items = menuRef.current.querySelectorAll('[role="menuitem"]');
            const el = items[activeIndex] as HTMLElement | undefined;
            if (el && !el.hasAttribute("disabled")) {
              el.click();
            }
          }
          break;
        case "Escape":
          setOpen(false);
          triggerRef.current?.focus();
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, activeIndex, setOpen, setActiveIndex, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-orientation="vertical"
      className={cn(
        "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-lg",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type DropdownItemProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function DropdownItem({
  children,
  onClick,
  disabled = false,
  className,
}: DropdownItemProps): ReactElement {
  const { activeIndex, setOpen, itemCountRef } = useDropdownContext();
  const indexRef = useRef(-1);

  // Register this item's index on mount and keep it stable
  if (indexRef.current === -1) {
    indexRef.current = itemCountRef.current;
    itemCountRef.current += 1;
  }

  const isActive = activeIndex === indexRef.current;

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onClick?.();
          setOpen(false);
        }
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        isActive && "bg-gray-100 text-gray-900",
        !isActive && "text-gray-700",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export type DropdownSeparatorProps = {
  className?: string;
};

export function DropdownSeparator({
  className,
}: DropdownSeparatorProps): ReactElement {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn("-mx-1 my-1 h-px bg-gray-200", className)}
    />
  );
}
