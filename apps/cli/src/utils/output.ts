/**
 * @q-cms/cli — output formatting helpers.
 *
 * Pretty-prints JSON, tables, and progress to the terminal.
 * Respects NO_COLOR / non-TTY environments.
 */

const COLOR_ENABLED =
  process.env.NO_COLOR === undefined && process.env.FORCE_COLOR !== '0' && Boolean(process.stdout.isTTY);

const codes = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

type Color = keyof Omit<typeof codes, 'reset' | 'bold' | 'dim'>;

function c(color: Color, s: string): string {
  return COLOR_ENABLED ? `${codes[color]}${s}${codes.reset}` : s;
}

export const color = {
  red: (s: string) => c('red', s),
  green: (s: string) => c('green', s),
  yellow: (s: string) => c('yellow', s),
  blue: (s: string) => c('blue', s),
  magenta: (s: string) => c('magenta', s),
  cyan: (s: string) => c('cyan', s),
  gray: (s: string) => c('gray', s),
  bold: (s: string) => (COLOR_ENABLED ? `${codes.bold}${s}${codes.reset}` : s),
  dim: (s: string) => (COLOR_ENABLED ? `${codes.dim}${s}${codes.reset}` : s),
};

export const symbols = {
  check: COLOR_ENABLED ? '✓' : '+',
  cross: COLOR_ENABLED ? '✗' : 'x',
  arrow: COLOR_ENABLED ? '→' : '->',
  bullet: COLOR_ENABLED ? '•' : '*',
  info: COLOR_ENABLED ? 'ℹ' : 'i',
  warn: COLOR_ENABLED ? '⚠' : '!',
};

export function success(message: string): void {
  console.log(`${color.green(symbols.check)} ${message}`);
}

export function error(message: string): void {
  console.error(`${color.red(symbols.cross)} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${color.yellow(symbols.warn)} ${message}`);
}

export function info(message: string): void {
  console.log(`${color.cyan(symbols.info)} ${message}`);
}

export function dim(message: string): void {
  console.log(color.dim(message));
}

export function header(title: string): void {
  console.log('');
  console.log(color.bold(title));
  console.log(color.dim('─'.repeat(Math.min(80, title.length + 8))));
}

/** Pretty-print JSON with 2-space indent. */
export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/**
 * Print a table.
 *
 *   printTable(
 *     ['NAME', 'STATUS', 'CREATED'],
 *     [['foo', 'published', '2026-06-01'], ['bar', 'draft', '2026-06-02']],
 *   );
 */
export function printTable(headers: string[], rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): void {
  const widths = headers.map((h, i) => {
    const cellWidths = rows.map((r) => String(r[i] ?? '').length);
    return Math.max(h.length, ...cellWidths);
  });

  const fmtRow = (cells: ReadonlyArray<string | number | null | undefined>): string =>
    cells.map((c, i) => String(c ?? '').padEnd(widths[i] ?? 0)).join('  ');

  console.log(color.bold(fmtRow(headers)));
  console.log(color.dim(widths.map((w) => '─'.repeat(w)).join('  ')));
  for (const row of rows) {
    console.log(fmtRow(row));
  }
}

/** Spinner replacement (no external dep, just dots). */
export class Spinner {
  #timer: NodeJS.Timeout | undefined;
  #text: string;
  #frame = 0;
  readonly #frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  constructor(text: string) {
    this.#text = text;
  }

  start(): this {
    if (!process.stdout.isTTY || process.env.CI !== undefined) {
      console.log(`${color.cyan('…')} ${this.#text}`);
      return this;
    }
    process.stdout.write(`${this.#frames[0]} ${this.#text}\r`);
    this.#timer = setInterval(() => {
      this.#frame = (this.#frame + 1) % this.#frames.length;
      process.stdout.write(`${this.#frames[this.#frame]} ${this.#text}\r`);
    }, 80);
    return this;
  }

  update(text: string): void {
    this.#text = text;
  }

  succeed(text?: string): void {
    this.#stop();
    console.log(`${color.green(symbols.check)} ${text ?? this.#text}`);
  }

  fail(text?: string): void {
    this.#stop();
    console.log(`${color.red(symbols.cross)} ${text ?? this.#text}`);
  }

  #stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');
  }
}
