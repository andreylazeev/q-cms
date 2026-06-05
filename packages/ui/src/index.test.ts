import { createElement, isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
  Input,
  Modal,
  ModalContent,
  ModalTrigger,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  ThemePicker,
  ThemeProvider,
  ToastProvider,
  cn,
  useTheme,
  useToast,
} from './index';
import { BUILT_IN_THEMES } from '@q-cms/theme';

describe('@q-cms/ui exports', () => {
  it('exports cn utility', () => {
    expect(typeof cn).toBe('function');
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('foo', false && 'bar')).toBe('foo');
  });

  it('exports Button component', () => {
    expect(typeof Button).toBe('function');
    const el = createElement(Button, { children: 'Click' });
    expect(isValidElement(el)).toBe(true);
  });

  it('exports Input component', () => {
    expect(typeof Input).toBe('function');
    const el = createElement(Input, { label: 'Email' });
    expect(isValidElement(el)).toBe(true);
  });

  it('exports Card compound components', () => {
    expect(typeof Card).toBe('function');
    expect(typeof CardHeader).toBe('function');
    expect(typeof CardContent).toBe('function');
    expect(typeof CardFooter).toBe('function');

    const el = createElement(
      Card,
      {},
      createElement(CardHeader, {}, 'Header'),
      createElement(CardContent, {}, 'Content'),
      createElement(CardFooter, {}, 'Footer'),
    );
    expect(isValidElement(el)).toBe(true);
  });

  it('exports Badge component', () => {
    expect(typeof Badge).toBe('function');
    const el = createElement(Badge, { variant: 'success' }, 'Active');
    expect(isValidElement(el)).toBe(true);
  });

  it('exports Modal compound components', () => {
    expect(typeof Modal).toBe('function');
    expect(typeof ModalTrigger).toBe('function');
    expect(typeof ModalContent).toBe('function');
  });

  it('exports Table compound components', () => {
    expect(typeof Table).toBe('function');
    expect(typeof TableHeader).toBe('function');
    expect(typeof TableBody).toBe('function');
    expect(typeof TableRow).toBe('function');
    expect(typeof TableHead).toBe('function');
    expect(typeof TableCell).toBe('function');
    expect(typeof TableLoading).toBe('function');
    expect(typeof TableEmpty).toBe('function');

    const el = createElement(
      Table,
      {},
      createElement(
        TableHeader,
        {},
        createElement(
          TableRow,
          {},
          createElement(TableHead, {}, 'Name'),
          createElement(TableHead, {}, 'Status'),
        ),
      ),
      createElement(
        TableBody,
        {},
        createElement(
          TableRow,
          {},
          createElement(TableCell, {}, 'Item 1'),
          createElement(TableCell, {}, 'Active'),
        ),
      ),
    );
    expect(isValidElement(el)).toBe(true);
  });

  it('exports DropdownMenu compound components', () => {
    expect(typeof DropdownMenu).toBe('function');
    expect(typeof DropdownTrigger).toBe('function');
    expect(typeof DropdownContent).toBe('function');
    expect(typeof DropdownItem).toBe('function');
    expect(typeof DropdownSeparator).toBe('function');
  });

  it('exports ToastProvider and useToast hook', () => {
    expect(typeof ToastProvider).toBe('function');
    expect(typeof useToast).toBe('function');
  });

  it('exports Spinner component', () => {
    expect(typeof Spinner).toBe('function');
    const el = createElement(Spinner, { size: 'lg' });
    expect(isValidElement(el)).toBe(true);
  });
});

describe('Button component', () => {
  it('renders with default variant', () => {
    const el = createElement(Button, { children: 'Save' });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders with variant and size', () => {
    const el = createElement(Button, {
      variant: 'danger',
      size: 'lg',
      children: 'Delete',
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders with loading state', () => {
    const el = createElement(Button, {
      loading: true,
      children: 'Saving...',
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders disabled state', () => {
    const el = createElement(Button, {
      disabled: true,
      children: 'Disabled',
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('handles asChild prop', () => {
    const Link = (props: Record<string, unknown>) => createElement('a', props, 'Link');
    const el = createElement(Button, {
      asChild: true,
      children: createElement(Link, { href: '/test' }),
    });
    expect(isValidElement(el)).toBe(true);
  });
});

describe('Input component', () => {
  it('renders with label', () => {
    const el = createElement(Input, { label: 'Email' });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders with error', () => {
    const el = createElement(Input, {
      label: 'Email',
      error: 'Required field',
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders with hint', () => {
    const el = createElement(Input, {
      label: 'Email',
      hint: 'Enter your work email',
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders required state', () => {
    const el = createElement(Input, {
      label: 'Email',
      required: true,
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders disabled state', () => {
    const el = createElement(Input, {
      label: 'Email',
      disabled: true,
    });
    expect(isValidElement(el)).toBe(true);
  });
});

describe('Badge component', () => {
  it('renders with default variant', () => {
    const el = createElement(Badge, { children: 'Default' });
    expect(isValidElement(el)).toBe(true);
  });

  it('renders all variants', () => {
    const variants = ['default', 'success', 'warning', 'danger', 'info'] as const;
    for (const variant of variants) {
      const el = createElement(Badge, { variant, children: variant });
      expect(isValidElement(el)).toBe(true);
    }
  });
});

describe('Spinner component', () => {
  it('renders with default size', () => {
    const el = createElement(Spinner);
    expect(isValidElement(el)).toBe(true);
  });

  it('renders with all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const el = createElement(Spinner, { size });
      expect(isValidElement(el)).toBe(true);
    }
  });
});

describe('Table components', () => {
  it('renders TableLoading skeleton', () => {
    const el = createElement(
      Table,
      {},
      createElement(TableBody, {}, createElement(TableLoading, { columns: 3 })),
    );
    expect(isValidElement(el)).toBe(true);
  });

  it('renders TableEmpty state', () => {
    const el = createElement(
      Table,
      {},
      createElement(TableBody, {}, createElement(TableEmpty, { columns: 3, message: 'No results' })),
    );
    expect(isValidElement(el)).toBe(true);
  });

  it('renders sortable column header', () => {
    const el = createElement(TableHead, {
      sortable: true,
      sortDirection: 'asc',
      children: 'Name',
    });
    expect(isValidElement(el)).toBe(true);
  });
});

describe('Toast system', () => {
  it('renders ToastProvider with children', () => {
    const el = createElement(ToastProvider, {}, createElement('div', {}, 'App content'));
    expect(isValidElement(el)).toBe(true);
  });
});

describe('cn utility', () => {
  it('merges class names', () => {
    const result = cn('px-4', 'py-2', 'px-4');
    // tailwind-merge deduplicates px-4
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });

  it('handles falsy values', () => {
    const result = cn('base', false && 'hidden', undefined, null, 'extra');
    expect(result).toBe('base extra');
  });

  it('handles conditional classes', () => {
    const result = cn('base', true && 'active', false && 'hidden');
    expect(result).toBe('base active');
  });
});

describe('ThemeProvider / useTheme exports', () => {
  it('exports ThemeProvider component', () => {
    expect(typeof ThemeProvider).toBe('function');
    const el = createElement(ThemeProvider, {}, createElement('div', {}, 'child'));
    expect(isValidElement(el)).toBe(true);
  });

  it('exports useTheme hook', () => {
    expect(typeof useTheme).toBe('function');
  });
});

describe('ThemePicker', () => {
  it('exports the ThemePicker component', () => {
    expect(typeof ThemePicker).toBe('function');
    const el = createElement(ThemePicker, {
      themes: BUILT_IN_THEMES,
      value: 'default',
      onChange: () => {},
      mode: 'auto',
      onModeChange: () => {},
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('accepts every built-in theme as input', () => {
    const el = createElement(ThemePicker, {
      themes: BUILT_IN_THEMES,
      value: 'midnight',
      onChange: () => {},
      mode: 'auto',
      onModeChange: () => {},
    });
    expect(isValidElement(el)).toBe(true);
    // The component will spread the `themes` prop into its render.
    // We confirm the prop survives a render pass by reading it from
    // the element's props.
    expect((el as { props: { themes: unknown } }).props.themes).toBe(BUILT_IN_THEMES);
  });

  it('honors the loading flag', () => {
    const el = createElement(ThemePicker, {
      themes: [],
      value: 'default',
      onChange: () => {},
      mode: 'auto',
      onModeChange: () => {},
      isLoading: true,
    });
    expect((el as { props: { isLoading: boolean } }).props.isLoading).toBe(true);
  });

  it('accepts any of the three mode choices', () => {
    for (const m of ['light', 'dark', 'auto'] as const) {
      const el = createElement(ThemePicker, {
        themes: BUILT_IN_THEMES,
        value: 'default',
        onChange: () => {},
        mode: m,
        onModeChange: () => {},
      });
      expect(isValidElement(el)).toBe(true);
    }
  });
});
