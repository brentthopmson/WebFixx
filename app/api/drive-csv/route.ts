import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Always live: this endpoint is polled during an active run and must never be
// cached by Next.js or a CDN, otherwise the rendered CSV stays stale.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!fileId) {
    return NextResponse.json({ success: false, error: 'fileId required' }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      { redirect: 'follow', cache: 'no-store' }
    );
    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Drive returned ${res.status}` }, { status: 502 });
    }
    const text = await res.text();

    // Detect HTML login/consent page from Drive (file not public)
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html') || text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
      return NextResponse.json({ success: false, error: 'Drive returned HTML (file may not be publicly shared)' }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: text });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
