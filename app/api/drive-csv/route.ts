import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!fileId) {
    return NextResponse.json({ success: false, error: 'fileId required' }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      { redirect: 'follow' }
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
