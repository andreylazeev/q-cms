/**
 * Project-wide type augmentations.
 *
 * React 19's @types/react no longer ships `JSX` as a global
 * namespace — it lives under `React.JSX` and `react/jsx-runtime`.
 * Re-export the namespace as a global here so existing
 * `): JSX.Element` return-type annotations continue to compile
 * without changes.
 */
import type { JSX as ReactJSX } from 'react';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}

export {};
