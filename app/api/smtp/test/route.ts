import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const { smtp, recipient } = body || {};
  if (!smtp || !recipient) {
    return NextResponse.json({ success: false, error: 'smtp and recipient are required' }, { status: 400 });
  }
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: Number(smtp.port) === 465,
      auth: { user: smtp.username, pass: smtp.password },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: smtp.from_email || smtp.username,
      to: recipient,
      subject: `WebFixx SMTP Test — ${new Date().toISOString()}`,
      text: 'This is a test email from WebFixx to verify your SMTP configuration. If you received this, your SMTP settings are working correctly.',
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 400 });
  }
}