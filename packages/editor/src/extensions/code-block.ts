import { Node } from '@tiptap/core';

/**
 * CodeBlock — enhanced code block with language selector support.
 *
 * Extends the default codeBlock from StarterKit with additional
 * metadata for language selection UI integration.
 *
 * Attributes:
 * - language: programming language identifier (e.g. 'typescript', 'python')
 * - showLineNumbers: whether to render line numbers
 */
export const CodeBlock = Node.create({
  name: 'codeBlock',

  group: 'block',

  content: 'text*',

  defining: true,

  marks: '',

  code: true,

  addAttributes() {
    return {
      language: {
        default: '',
        parseHTML: (element) => {
          const lang = element.getAttribute('data-language');
          if (lang) return lang;

          // Also check the class for language-xxx pattern (common in syntax highlighters)
          const className = element.className;
          if (typeof className === 'string') {
            const match = className.match(/language-(\w+)/);
            return match?.[1] ?? '';
          }
          return '';
        },
        renderHTML: (attributes) => {
          if (!attributes.language) return {};
          return { 'data-language': attributes.language };
        },
      },
      showLineNumbers: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute('data-line-numbers') === 'true',
        renderHTML: (attributes) => ({
          'data-line-numbers': attributes.showLineNumbers ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { language, showLineNumbers } = node.attrs as {
      language: string;
      showLineNumbers: boolean;
    };

    const classList = ['code-block'];
    if (language) classList.push(`language-${language}`);
    if (showLineNumbers) classList.push('line-numbers');

    return [
      'pre',
      {
        'data-type': 'code-block',
        ...HTMLAttributes,
        ...(language ? { 'data-language': language } : {}),
        ...(showLineNumbers ? { 'data-line-numbers': 'true' } : {}),
        class: classList.join(' '),
      },
      ['code', { class: language ? `language-${language}` : '' }, 0],
    ];
  },

  addCommands() {
    return {
      setCodeBlock:
        (attrs: { language?: string }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              language: attrs.language ?? '',
            },
          }),
    };
  },
});
