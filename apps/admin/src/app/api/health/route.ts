import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness probe used by container orchestrators and uptime checks.
 * Returns 200 OK with a minimal JSON body indicating the build id and
 * process uptime.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'q-cms-admin',
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
