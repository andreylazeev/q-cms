export interface EntryEditorState {
  title: string;
  content: string;
  coverId: string | null;
  tags: readonly string[];
  seoTitle: string;
  seoDescription: string;
}

export function buildEntryUpdateData(
  existingData: Record<string, unknown>,
  state: EntryEditorState,
): Record<string, unknown> {
  const { name, title: existingTitle } = existingData;
  const next: Record<string, unknown> = { ...existingData };
  Object.assign(
    next,
    typeof name === 'string' && typeof existingTitle !== 'string'
      ? { name: state.title }
      : { title: state.title },
    {
      content: state.content,
      coverId: state.coverId,
      tags: [...state.tags],
      seo: { title: state.seoTitle, description: state.seoDescription },
    },
  );
  return next;
}
