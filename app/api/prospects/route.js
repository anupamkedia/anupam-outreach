import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export async function GET(request) {
  const url = new URL(request.url);
  const pin = url.searchParams.get("pin");
  if (pin !== (process.env.TEAM_PIN || "1972"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getSupabase();
  const action = url.searchParams.get("action") || "list";

  // LIST prospects
  if (action === "list") {
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    let q = db.from("prospects").select("*, created_by_user:team_members!prospects_created_by_fkey(name)").order("created_at", { ascending: false });
    if (status && status !== "all") q = q.eq("status", status);
    if (search) q = q.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
    const { data, error } = await q.limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // GET single prospect with history
  if (action === "detail") {
    const id = url.searchParams.get("id");
    const [prospect, emails, whatsapp, activity] = await Promise.all([
      db.from("prospects").select("*").eq("id", id).single(),
      db.from("emails").select("*, sent_by_user:team_members!emails_sent_by_fkey(name)").eq("prospect_id", id).order("sent_at", { ascending: false }),
      db.from("whatsapp_messages").select("*, sent_by_user:team_members!whatsapp_messages_sent_by_fkey(name)").eq("prospect_id", id).order("sent_at", { ascending: false }),
      db.from("activity_log").select("*, performed_by_user:team_members!activity_log_performed_by_fkey(name)").eq("prospect_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    return NextResponse.json({
      prospect: prospect.data, emails: emails.data || [],
      whatsapp: whatsapp.data || [], activity: activity.data || [],
    });
  }

  // DASHBOARD stats
  if (action === "dashboard") {
    const [total, byStatus, recentActivity, pendingFollowups] = await Promise.all([
      db.from("prospects").select("id", { count: "exact", head: true }),
      db.from("prospects").select("status"),
      db.from("activity_log").select("*, performed_by_user:team_members!activity_log_performed_by_fkey(name), prospect:prospects!activity_log_prospect_id_fkey(name,company)").order("created_at", { ascending: false }).limit(15),
      db.from("follow_ups").select("*, prospect:prospects!follow_ups_prospect_id_fkey(name,company)").eq("completed", false).order("scheduled_date").limit(10),
    ]);
    const statusCounts = {};
    (byStatus.data || []).forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
    return NextResponse.json({
      total: total.count || 0, statusCounts,
      recentActivity: recentActivity.data || [],
      pendingFollowups: pendingFollowups.data || [],
    });
  }

  // STYLE SAMPLES
  if (action === "styles") {
    const { data } = await db.from("style_samples").select("*").order("created_at", { ascending: false });
    return NextResponse.json(data || []);
  }

  // TEAM MEMBERS
  if (action === "team") {
    const { data } = await db.from("team_members").select("*").order("name");
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.pin !== (process.env.TEAM_PIN || "1972"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getSupabase();
    const { action } = body;

    // CREATE prospect
    if (action === "create_prospect") {
      const { data, error } = await db.from("prospects").insert({
        name: body.name, company: body.company, designation: body.designation || "",
        industry: body.industry || "", email: body.email || "", phone: body.phone || "",
        location: body.location || "", summary: body.summary || "", headline: body.headline || "",
        research: body.research || "", status: body.status || "new",
        source: body.source || "manual", created_by: body.userId,
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // Log activity
      await db.from("activity_log").insert({ prospect_id: data.id, action: "Created prospect", performed_by: body.userId });
      return NextResponse.json(data);
    }

    // UPDATE prospect
    if (action === "update_prospect") {
      const updates = { ...body.updates, updated_at: new Date().toISOString() };
      const { data, error } = await db.from("prospects").update(updates).eq("id", body.id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await db.from("activity_log").insert({ prospect_id: body.id, action: body.logAction || "Updated prospect", details: body.logDetails || "", performed_by: body.userId });
      return NextResponse.json(data);
    }

    // SAVE EMAIL
    if (action === "save_email") {
      const { data, error } = await db.from("emails").insert({
        prospect_id: body.prospectId, subject: body.subject, body: body.body,
        email_type: body.emailType || "initial", sent_by: body.userId,
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await db.from("prospects").update({ status: body.emailType === "follow_up" ? "followed_up" : "emailed" }).eq("id", body.prospectId);
      await db.from("activity_log").insert({ prospect_id: body.prospectId, action: `Sent ${body.emailType || "initial"} email`, details: body.subject, performed_by: body.userId });
      return NextResponse.json(data);
    }

    // SAVE WHATSAPP
    if (action === "save_whatsapp") {
      await db.from("whatsapp_messages").insert({ prospect_id: body.prospectId, message: body.message, sent_by: body.userId });
      await db.from("prospects").update({ status: "whatsapp_sent" }).eq("id", body.prospectId);
      await db.from("activity_log").insert({ prospect_id: body.prospectId, action: "Sent WhatsApp", performed_by: body.userId });
      return NextResponse.json({ success: true });
    }

    // ADD STYLE SAMPLE
    if (action === "add_style") {
      await db.from("style_samples").insert({ content: body.content, added_by: body.userId });
      return NextResponse.json({ success: true });
    }

    // DELETE STYLE SAMPLE
    if (action === "delete_style") {
      await db.from("style_samples").delete().eq("id", body.styleId);
      return NextResponse.json({ success: true });
    }

    // ADD FOLLOW-UP
    if (action === "add_followup") {
      await db.from("follow_ups").insert({ prospect_id: body.prospectId, scheduled_date: body.date, note: body.note || "", created_by: body.userId });
      await db.from("activity_log").insert({ prospect_id: body.prospectId, action: "Scheduled follow-up", details: `${body.date}: ${body.note || ""}`, performed_by: body.userId });
      return NextResponse.json({ success: true });
    }

    // COMPLETE FOLLOW-UP
    if (action === "complete_followup") {
      await db.from("follow_ups").update({ completed: true }).eq("id", body.followupId);
      return NextResponse.json({ success: true });
    }

    // ADD TEAM MEMBER
    if (action === "add_member") {
      const { data, error } = await db.from("team_members").insert({ email: body.email, name: body.memberName, role: body.role || "member" }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // LOGIN / IDENTIFY
    if (action === "login") {
      const { data } = await db.from("team_members").select("*").eq("email", body.email).single();
      if (!data) return NextResponse.json({ error: "Not registered. Contact admin." }, { status: 404 });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
