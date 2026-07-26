import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { pin, firstName, lastName, company } = await request.json();
    if (pin !== (process.env.TEAM_PIN || "1972"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    const body = {
      contacts: [{
        contactId: "1",
        fullName: fullName,
        companies: company ? [{ name: company, isCurrent: true }] : []
      }],
      metadata: { revealEmails: true, revealPhones: true }
    };

    const res = await fetch("https://api.lusha.com/v2/person", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": process.env.LUSHA_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Lusha failed" }, { status: res.status });

    const contactWrapper = data?.contacts?.["1"];
    const contact = contactWrapper?.data;

    if (!contact) return NextResponse.json({ emails: [], phones: [], title: "" });

    return NextResponse.json({
      emails: (contact.emailAddresses || []).map(e => ({ email: e.email, type: e.emailType || "work", confidence: e.emailConfidence || "" })),
      phones: (contact.phoneNumbers || []).map(p => ({ phone: p.internationalNumber || p.localizedNumber || p.e164Format || "", type: p.type || "mobile" })),
      title: contact.jobTitle?.title || "",
      linkedin: contact.socialLinks?.linkedin || "",
      location: contact.location?.city || "",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
