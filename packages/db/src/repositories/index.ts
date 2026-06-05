/**
 * Repository barrel — re-exports every domain repository and its
 * accompanying input types.
 *
 * @packageDocumentation
 */

export {
  UserRepository,
  type CreateUserInput,
  type UpdateUserInput,
} from './user-repository.ts';

export {
  EntryRepository,
  type CreateEntryInput,
  type UpdateEntryInput,
  type ListEntriesInput,
} from './entry-repository.ts';

export {
  MediaRepository,
  type CreateMediaInput,
  type UpdateMediaInput,
  type ListMediaInput,
  type AddVariantInput,
} from './media-repository.ts';

export {
  WebhookRepository,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type RecordDeliveryInput,
} from './webhook-repository.ts';

export {
  AuditLogRepository,
  type RecordAuditInput,
  type QueryAuditInput,
} from './audit-log-repository.ts';
