'use client';

import { type ReactNode } from 'react';
import { cn } from '../lib/utils.ts';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

/** Minimal, presentational data table. Sorting/pagination handled upstream. */
export function DataTable<T>(props: DataTableProps<T>): React.JSX.Element {
  const { columns, rows, rowKey, isLoading, emptyMessage = 'No records.', onRowClick, className } = props;
  return (
    <div
      className={cn('w-full overflow-auto rounded-lg border', className)}
      style={{ borderColor: 'var(--color-border)' }}
    >
      <table className="w-full text-sm" role="table">
        <thead style={{ background: 'var(--color-muted)' }}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn('px-4 py-2 text-left font-medium', col.className)}
                style={{
                  width: col.width,
                  textAlign: col.align ?? 'left',
                  color: 'var(--color-muted-foreground)',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-t', onRowClick ? 'cursor-pointer hover:bg-muted/50' : '')}
                style={{ borderColor: 'var(--color-border)' }}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn('px-4 py-2', col.className)}
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
