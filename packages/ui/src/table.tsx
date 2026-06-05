import type {
  HTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
  ReactElement,
  Ref,
  KeyboardEvent,
} from "react";
import { useCallback } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "./utils";

export type SortDirection = "asc" | "desc" | null;

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  ref?: Ref<HTMLTableElement>;
};

export function Table({
  className,
  ref,
  ...props
}: TableProps): ReactElement {
  return (
    <div className="w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement> & {
  ref?: Ref<HTMLTableSectionElement>;
};

export function TableHeader({
  className,
  ref,
  ...props
}: TableHeaderProps): ReactElement {
  return (
    <thead
      ref={ref}
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement> & {
  ref?: Ref<HTMLTableSectionElement>;
};

export function TableBody({
  className,
  ref,
  ...props
}: TableBodyProps): ReactElement {
  return (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  ref?: Ref<HTMLTableRowElement>;
};

export function TableRow({
  className,
  ref,
  ...props
}: TableRowProps): ReactElement {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-gray-50 data-[state=selected]:bg-gray-100",
        className,
      )}
      {...props}
    />
  );
}

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement> & {
  ref?: Ref<HTMLTableCellElement>;
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
};

export function TableHead({
  className,
  ref,
  sortable,
  sortDirection,
  onSort,
  children,
  ...props
}: TableHeadProps): ReactElement {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableCellElement>) => {
      if (sortable && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSort?.();
      }
    },
    [sortable, onSort],
  );

  const SortIcon =
    sortDirection === "asc"
      ? ArrowUp
      : sortDirection === "desc"
        ? ArrowDown
        : ArrowUpDown;

  return (
    <th
      ref={ref}
      className={cn(
        "h-11 px-4 text-left align-middle font-medium text-gray-500",
        sortable && "cursor-pointer select-none hover:text-gray-900",
        className,
      )}
      aria-sort={
        sortDirection === "asc"
          ? "ascending"
          : sortDirection === "desc"
            ? "descending"
            : sortable
              ? "none"
              : undefined
      }
      tabIndex={sortable ? 0 : undefined}
      role={sortable ? "columnheader button" : "columnheader"}
      onClick={sortable ? onSort : undefined}
      onKeyDown={sortable ? handleKeyDown : undefined}
      {...props}
    >
      <div className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <SortIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        )}
      </div>
    </th>
  );
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  ref?: Ref<HTMLTableCellElement>;
};

export function TableCell({
  className,
  ref,
  ...props
}: TableCellProps): ReactElement {
  return (
    <td
      ref={ref}
      className={cn("px-4 py-3 align-middle", className)}
      {...props}
    />
  );
}

// Skeleton loader for table rows

export type TableLoadingProps = {
  columns: number;
  rows?: number;
};

export function TableLoading({ columns, rows = 5 }: TableLoadingProps): ReactElement {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// Empty state
export type TableEmptyProps = {
  columns: number;
  message?: string;
};

export function TableEmpty({
  columns,
  message = "No data found",
}: TableEmptyProps): ReactElement {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="h-24 text-center">
        <div className="flex flex-col items-center justify-center gap-1 text-gray-500">
          <p className="text-sm font-medium">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
