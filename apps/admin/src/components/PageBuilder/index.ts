/**
 * Public surface of the PageBuilder component. Consumers should
 * import from `./PageBuilder` (or `@/components/PageBuilder`) and
 * not reach into individual files; the layout may swap internals
 * without a breaking change as long as `PageBuilder` re-exports
 * the right entrypoint.
 */

export { PageBuilder } from './PageBuilder.tsx';
export type { PageBuilderProps } from './PageBuilder.tsx';
export { SaveStatePill } from './SaveStatePill.tsx';
export type { SaveState } from './SaveStatePill.tsx';
