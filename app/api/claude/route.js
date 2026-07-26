import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { pin, messages, useSearch } = await request.json();
    if (pin !== (process.env.TEAM_PIN || "1972"))
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });

    const body = { model: "claude-sonnet-4-6", max_tokens: 2000, messages };
    if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2024-01-01",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
