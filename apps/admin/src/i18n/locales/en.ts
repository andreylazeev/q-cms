/**
 * English translation dictionary for the Q-CMS admin UI.
 *
 * Keys are grouped by feature namespace. The provider loads this
 * dictionary under the namespace `admin` so components can use
 * `useTranslation("admin")` and reach into keys without a prefix.
 *
 * Plural forms use the {@link PluralizedTranslation} shape, which
 * the i18n engine selects from via `Intl.PluralRules`.
 */

import type { Translations } from '@q-cms/i18n';

export const en: Translations = {
  // Common actions / labels shared by many pages
  common: {
    save: 'Save',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    preview: 'Preview',
    duplicate: 'Duplicate',
    back: 'Back',
    loading: 'Loading…',
    add: 'Add',
    remove: 'Remove',
    selectPlaceholder: 'Select…',
    guest: 'Guest',
    signOut: 'Sign out',
    toggleTheme: 'Toggle theme',
    collapse: 'Collapse',
    expand: 'Expand',
    search: 'Search…',
    globalSearch: 'Global search',
    changelog: 'Changelog',
    primaryNav: 'Primary',
    removeAria: 'Remove {{name}}',
  },

  // Sidebar
  nav: {
    dashboard: 'Dashboard',
    collections: 'Collections',
    templates: 'Templates',
    media: 'Media',
    users: 'Users',
    settings: 'Settings',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
  },

  // Login page
  auth: {
    title: 'Sign in',
    subtitle: 'Use your Q-CMS administrator credentials.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    requiredFields: 'Email and password are required.',
    invalidCredentials: 'Invalid credentials.',
  },

  // Dashboard
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of your content, media, and team activity.',
    newCollection: 'New collection',
    newEntry: 'New entry',
    metricsLabel: 'Key metrics',
    recentActivity: 'Recent activity',
    recentActivityDescription: 'Latest entries across collections',
    emptyActivity: 'No recent activity.',
    viewAll: 'View all',
    open: 'Open',
    // Table column headers
    columnTitle: 'Title',
    columnStatus: 'Status',
    columnUpdated: 'Updated',
    // Stat cards
    statEntries: 'Entries',
    statMedia: 'Media',
    statUsers: 'Users',
    statCollections: 'Collections',
  },

  // Collections list page
  collections: {
    title: 'Collections',
    subtitle: 'Browse the content models defined in your schema.',
    failedToLoad: 'Failed to load collections.',
    loading: 'Loading collections…',
    emptyTitle: 'No collections found',
    emptyHint: 'Define one in schema.ts to get started.',
    ariaLabel: 'Collections',
    singleton: 'Singleton',
  },

  // Collection entries page
  entries: {
    newEntry: 'New entry',
    searchPlaceholder: 'Filter by title or slug…',
    searchAria: 'Search entries',
    filterAll: 'All',
    filterPublished: 'Published',
    filterInReview: 'In review',
    filterDraft: 'Draft',
    filterApproved: 'Approved',
    filterArchived: 'Archived',
    allLocales: 'All locales',
    edit: 'Edit',
    editAria: 'Edit entry',
    preview: 'Preview',
    previewAria: 'Preview entry',
    duplicate: 'Duplicate',
    duplicateAria: 'Duplicate entry',
    delete: 'Delete',
    deleteAria: 'Delete entry',
    deleteConfirm: 'Delete "{{title}}"? This cannot be undone.',
    duplicatePlaceholder: 'Duplicate is a placeholder — wired up in a follow-up.',
    emptyTitle: 'No entries yet',
    emptyHint: 'The {{slug}} collection is empty. Create your first entry to get started.',
    emptyCta: 'Create your first entry',
    updated: 'Updated {{time}}',
  },

  // Templates page
  templates: {
    title: 'Page templates',
    subtitle:
      'Compose, edit, and bind templates to the public site. The home-default and article-default templates ship with the v0.1 seed.',
    newTemplate: 'New template',
    loading: 'Loading templates…',
    emptyTitle: 'No templates yet',
    emptyHint:
      'Create your first template to get started. You will be redirected to the visual builder where you can add, edit, and reorder blocks.',
    emptyCta: 'Create your first template',
    statusPublished: 'Published',
    statusStale: 'Stale',
    statusDraft: 'Draft',
    editAria: 'Edit {{name}}',
    deleteAria: 'Delete {{name}}',
    deleteConfirm: 'Delete template "{{name}}"? This cannot be undone.',
    deleteSuccess: 'Deleted {{name}}',
    deleteFailed: 'Delete failed',
    loadFailed: 'Failed to load templates',
    block: 'block',
    blocks: 'blocks',
    edit: 'Edit',
  },

  // Users page
  users: {
    title: 'Users',
    subtitle: 'Manage administrator accounts, roles, and invitations.',
    inviteUser: 'Invite user',
    empty: 'No users yet.',
    inviteTitle: 'Invite user',
    inviteDescription: 'Send a magic-link invitation to join the workspace.',
    inviteSend: 'Send invite',
    inviteSent: 'Invitation sent to {{email}}',
    inviteFailed: 'Invite failed',
    summary: {
      one: '{{count}} user across the workspace — admins, editors, authors, and viewers.',
      other: '{{count}} users across the workspace — admins, editors, authors, and viewers.',
    },
    columns: {
      user: 'User',
      role: 'Role',
      status: 'Status',
      lastLogin: 'Last login',
    },
    roles: {
      admin: 'Admin',
      editor: 'Editor',
      author: 'Author',
      reviewer: 'Reviewer',
      viewer: 'Viewer',
    },
  },

  // Media page
  media: {
    title: 'Media library',
    subtitle: 'Upload and manage images, videos, and documents.',
    upload: 'Upload',
    uploadAria: 'Upload files',
    type: 'Type',
    allTypes: 'All types',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    other: 'Other',
    dropzonePrimary: 'Drag & drop files here',
    dropzoneSecondary: 'or use the Upload button above',
    dropzoneAria: 'Drop files to upload',
    loading: 'Loading media…',
    empty: 'No media yet. Upload your first file above.',
    uploaded: 'Uploaded {{name}}',
    uploadFailed: 'Upload failed',
    delete: 'Delete',
    deleteAria: 'Delete {{name}}',
    deleteConfirm: 'Delete {{name}}?',
    deleted: 'Deleted',
  },

  // Settings page
  settings: {
    title: 'Settings',
    subtitle: 'Site configuration, locales, and integrations.',
    siteCardTitle: 'Site',
    siteCardDescription: 'General site metadata.',
    siteName: 'Site name',
    defaultLocale: 'Default locale',
    supportedLocales: 'Supported locales',
    addLocale: 'Add locale',
    themeCardTitle: 'Theme',
    themeCardDescription:
      'Switch the admin palette. The active theme is stored in this browser only (localStorage key: qcms_theme) and syncs across tabs.',
    livePreview: 'Live preview',
    livePreviewHint: 'Renders the active theme on a sample article header.',
    gallery: 'Gallery',
    resetHint: 'Need a clean slate? Reset removes your saved theme and reverts to default in auto mode.',
    resetButton: 'Reset to defaults',
    resetSuccess: 'Theme reset to defaults',
    tokenInspector: 'Token inspector',
    tokenInspectorHint: '— every value in the active theme',
    webhooksTitle: 'Webhooks',
    webhooksDescription: 'Outgoing event notifications.',
    apiTokensTitle: 'API tokens',
    apiTokensDescription: 'Personal access tokens for the REST/GraphQL API.',
    tableName: 'Name',
    tableUrl: 'URL',
    tableEvents: 'Events',
    tablePrefix: 'Prefix',
    tableScopes: 'Scopes',
    tableStatus: 'Status',
    noWebhooks: 'No webhooks configured.',
    noTokens: 'No tokens issued.',
    settingsSaved: 'Settings saved',
    persistedHint: 'Settings are read from and persisted to /api/v1/settings.',
  },

  // Language picker
  language: {
    label: 'Language',
    en: 'English',
    ru: 'Русский',
  },

  // Toasts
  toasts: {
    dismiss: 'Dismiss',
  },
};
