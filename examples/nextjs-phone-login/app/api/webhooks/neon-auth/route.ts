import { NextRequest, NextResponse } from 'next/server';
import { addEvent } from '@/lib/webhook-store';
import { createRemoteJWKSet, compactVerify } from 'jose';

/**
 * Neon Auth signs webhooks with EdDSA (Ed25519) using detached JWS.
 *
 * Headers sent by neon-auth:
 *   X-Neon-Signature:       detached JWS (header..signature, no payload)
 *   X-Neon-Signature-Kid:   key ID
 *   X-Neon-Timestamp:       unix timestamp in milliseconds
 *
 * The signed payload is: `${timestamp}.${base64url(rawBody)}`
 * The public keys are at `/.well-known/jwks.json` on the auth server.
 */

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(authBaseUrl: string) {
  let jwks = jwksCache.get(authBaseUrl);
  if (!jwks) {
    const baseWithoutAuth = authBaseUrl.replace(/\/auth\/?$/, '');
    const jwksUrl = new URL('/.well-known/jwks.json', baseWithoutAuth);
    jwks = createRemoteJWKSet(jwksUrl);
    jwksCache.set(authBaseUrl, jwks);
  }
  return jwks;
}

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

async function verifyJWSSignature(
  rawBody: string,
  detachedSignature: string,
  timestamp: string,
  authBaseUrl: string,
): Promise<boolean> {
  try {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > MAX_TIMESTAMP_AGE_MS) {
      console.error('[webhook] Timestamp too old or invalid:', timestamp);
      return false;
    }

    const payloadB64 = Buffer.from(rawBody, 'utf8').toString('base64url');
    const signaturePayload = `${timestamp}.${payloadB64}`;

    const [header, , sig] = detachedSignature.split('.');
    const signaturePayloadB64 = Buffer.from(signaturePayload, 'utf8').toString('base64url');
    const fullJWS = `${header}.${signaturePayloadB64}.${sig}`;

    const jwks = getJWKS(authBaseUrl);
    await compactVerify(fullJWS, jwks);

    return true;
  } catch (error) {
    console.error('[webhook] JWS verification failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signature = request.headers.get('x-neon-signature');
  const timestamp = request.headers.get('x-neon-timestamp');
  const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
  const webhookSecret = process.env.NEON_AUTH_WEBHOOK_SECRET;

  const isLocalDev = !webhookSecret || webhookSecret === 'whsec_local_dev_secret';

  if (!isLocalDev) {
    if (!signature || !timestamp || !authBaseUrl) {
      console.error('[webhook] Missing required headers or NEON_AUTH_BASE_URL');
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }

    const valid = await verifyJWSSignature(rawBody, signature, timestamp, authBaseUrl);
    if (!valid) {
      console.error('[webhook] Invalid JWS signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = (payload.event_type as string) || 'unknown';

  console.log(`[webhook] Received event: ${eventType}`);
  console.log(`[webhook] Payload:`, JSON.stringify(payload, null, 2));

  addEvent(eventType, payload);

  if (eventType.includes('.before_')) {
    return NextResponse.json({ allowed: true });
  }

  return NextResponse.json({ received: true });
}
