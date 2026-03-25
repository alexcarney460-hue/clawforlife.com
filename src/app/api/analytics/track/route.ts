import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/analytics/queries';

// ---------------------------------------------------------------------------
// POST /api/analytics/track
// Body: { event_type, session_id?, page_url?, referrer?, utm_source?,
//         utm_medium?, utm_campaign?, properties?, customer_id? }
// Auth: NONE — public endpoint for frontend event tracking
// ---------------------------------------------------------------------------

const ALLOWED_EVENT_TYPES = [
  'page_view',
  'add_to_cart',
  'checkout_start',
  'purchase',
  'skill_install',
] as const;

type AllowedEventType = (typeof ALLOWED_EVENT_TYPES)[number];

interface TrackBody {
  event_type: AllowedEventType;
  session_id?: string;
  customer_id?: string;
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  properties?: Record<string, unknown>;
}

function isValidEventType(value: unknown): value is AllowedEventType {
  return (
    typeof value === 'string' &&
    ALLOWED_EVENT_TYPES.includes(value as AllowedEventType)
  );
}

function validateBody(body: unknown): body is TrackBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return isValidEventType(b.event_type);
}

function sanitizeString(value: unknown, maxLength = 2048): string | null {
  if (typeof value !== 'string') return null;
  return value.slice(0, maxLength);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();

    if (!validateBody(body)) {
      return NextResponse.json(
        {
          error: `Invalid request. event_type must be one of: ${ALLOWED_EVENT_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    await trackEvent({
      event_type: body.event_type,
      session_id: sanitizeString(body.session_id, 128),
      customer_id: sanitizeString(body.customer_id, 36) ?? null,
      page_url: sanitizeString(body.page_url),
      referrer: sanitizeString(body.referrer),
      utm_source: sanitizeString(body.utm_source, 256),
      utm_medium: sanitizeString(body.utm_medium, 256),
      utm_campaign: sanitizeString(body.utm_campaign, 256),
      properties: typeof body.properties === 'object' && body.properties !== null
        ? body.properties
        : {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    console.error('[analytics/track] Error:', message);
    // Return 200 even on error — analytics should never break the client
    return NextResponse.json({ success: true });
  }
}
