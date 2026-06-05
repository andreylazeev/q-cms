import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BODYLESS_METHODS: Record<string, true> = {
  GET: true,
  HEAD: true,
};
const HOP_BY_HOP_HEADERS: Record<string, true> = {
  connection: true,
  'content-length': true,
  host: true,
  'keep-alive': true,
  'proxy-authenticate': true,
  'proxy-authorization': true,
  te: true,
  trailer: true,
  'transfer-encoding': true,
  upgrade: true,
};

interface RouteContext {
  params: Promise<{ path?: string[] }> | { path?: string[] };
}

function getApiBaseUrl(): string {
  const { NEXT_PUBLIC_QCMS_API_URL, API_URL } = process.env;
  const configured = NEXT_PUBLIC_QCMS_API_URL ?? API_URL;
  return (configured && configured.length > 0 ? configured : 'http://localhost:3000').replace(/\/$/, '');
}

async function getPath(context: RouteContext): Promise<string> {
  const params = await context.params;
  return (params.path ?? []).map(encodeURIComponent).join('/');
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  for (const name of Object.keys(HOP_BY_HOP_HEADERS)) headers.delete(name);
  headers.delete('origin');
  return headers;
}

function responseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  for (const name of Object.keys(HOP_BY_HOP_HEADERS)) headers.delete(name);
  return headers;
}

async function proxy(request: Request, context: RouteContext): Promise<NextResponse> {
  const path = await getPath(context);
  const incomingUrl = new URL(request.url);
  const target = new URL(`/api/v1/${path}${incomingUrl.search}`, getApiBaseUrl());
  const body = request.method in BODYLESS_METHODS ? undefined : await request.arrayBuffer();
  const response = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    ...(body ? { body } : {}),
    redirect: 'manual',
  });

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response),
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
