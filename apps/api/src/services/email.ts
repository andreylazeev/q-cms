/**
 * Email service — Nodemailer wrapper.
 *
 * Builds a SMTP transport on demand and exposes a single `send` method
 * for transactional email (magic links, password reset, notifications).
 * The real package will be plugged in once `@q-cms/email` is built —
 * this file provides the contract used by the API.
 *
 * @module services/email
 */

import { getEnv } from '../env.ts';

/** Minimal Transporter interface — avoids pulling in nodemailer types. */
interface Transporter {
  sendMail: (opts: Record<string, unknown>) => Promise<{ messageId: string }>;
  close: () => Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface EmailService {
  send(message: EmailMessage): Promise<{ id: string; accepted: readonly string[] }>;
  close(): Promise<void>;
}

class NodemailerService implements EmailService {
  private transporter: Transporter | Promise<Transporter>;
  constructor(transporter: Transporter | Promise<Transporter>) {
    this.transporter = transporter;
  }
  private async getTransporter(): Promise<Transporter> {
    return this.transporter;
  }
  async send(message: EmailMessage) {
    const env = getEnv();
    const transporter = await this.getTransporter();
    const info = await transporter.sendMail({
      from: message.from ?? env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    });
    return { id: info.messageId, accepted: [message.to] };
  }
  async close() {
    const transporter = await this.getTransporter();
    await transporter.close();
  }
}

/** Lazily resolve the nodemailer factory so the import isn't required at type-check time. */
async function getNodemailer(): Promise<{
  createTransport: (opts: Record<string, unknown>) => Transporter;
}> {
  const mod = await import('nodemailer' as string);
  return (mod as unknown as { default?: { createTransport: (opts: Record<string, unknown>) => Transporter } }).default ??
    (mod as unknown as { createTransport: (opts: Record<string, unknown>) => Transporter });
}

/** In-memory transport for dev/tests. */
class MemoryEmailService implements EmailService {
  private sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
    return { id: `mem-${this.sent.length}`, accepted: [message.to] };
  }
  async close() {
    this.sent = [];
  }
  /** Test helper: snapshot of messages sent. */
  snapshot(): readonly EmailMessage[] {
    return this.sent;
  }
}

let cached: EmailService | undefined;

export function getEmail(): EmailService {
  if (cached) return cached;
  const env = getEnv();
  if (env.SMTP_HOST && env.NODE_ENV !== 'test') {
    cached = new NodemailerService(
      getNodemailer().then((nodemailer) => {
        const transportOptions: Record<string, unknown> = {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
        };
        if (env.SMTP_USER && env.SMTP_PASS) {
          transportOptions['auth'] = { user: env.SMTP_USER, pass: env.SMTP_PASS };
        }
        return nodemailer.createTransport(transportOptions);
      }),
    );
  } else {
    cached = new MemoryEmailService();
  }
  return cached;
}

export function setEmail(svc: EmailService): void {
  cached = svc;
}

export async function closeEmail(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}

/**
 * Build a magic-link email. Exposed here so tests and route handlers
 * can share the same template.
 */
export function buildMagicLink(opts: { url: string; expiresInMinutes: number }): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: 'Your Q-CMS sign-in link',
    html: `<p>Click <a href="${opts.url}">here</a> to sign in. The link expires in ${opts.expiresInMinutes} minutes.</p>`,
    text: `Sign in: ${opts.url}\n\nThis link expires in ${opts.expiresInMinutes} minutes.`,
  };
}
