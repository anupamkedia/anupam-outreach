import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { pin, to, subject, body, cc } = await request.json();
    if (pin !== (process.env.TEAM_PIN || "1972"))
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const senderName = process.env.SENDER_NAME || "Anupam Kedia";
    await transporter.sendMail({
      from: `"${senderName}" <${process.env.GMAIL_USER}>`,
      to, cc: cc || undefined,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
