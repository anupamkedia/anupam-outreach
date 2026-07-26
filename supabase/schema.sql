-- =============================================
-- ANUPAM OUTREACH — Database Schema
-- Run this in Supabase SQL Editor (supabase.com)
-- =============================================

-- 1. TEAM MEMBERS
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROSPECTS (Contacts)
CREATE TABLE IF NOT EXISTS prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  designation TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  headline TEXT DEFAULT '',
  research TEXT DEFAULT '',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'researched', 'emailed', 'followed_up', 'whatsapp_sent', 'responded', 'meeting', 'won', 'lost')),
  source TEXT DEFAULT 'manual',
  created_by UUID REFERENCES team_members(id),
  assigned_to UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EMAILS SENT
CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  email_type TEXT DEFAULT 'initial' CHECK (email_type IN ('initial', 'follow_up', 'custom')),
  sent_by UUID REFERENCES team_members(id),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_by UUID REFERENCES team_members(id),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ACTIVITY LOG
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  performed_by UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. STYLE SAMPLES (for AI tone training)
CREATE TABLE IF NOT EXISTS style_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  added_by UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FOLLOW-UP REMINDERS
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  note TEXT DEFAULT '',
  completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company);
CREATE INDEX IF NOT EXISTS idx_emails_prospect ON emails(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activity_prospect ON activity_log(prospect_id);
CREATE INDEX IF NOT EXISTS idx_followups_date ON follow_ups(scheduled_date) WHERE NOT completed;

-- AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ROW LEVEL SECURITY (allow all for authenticated)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- Policies: Allow all operations for service role (API routes use service key)
CREATE POLICY "service_all" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON prospects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON emails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON whatsapp_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON activity_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON style_samples FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON follow_ups FOR ALL USING (true) WITH CHECK (true);

-- INSERT DEFAULT ADMIN
INSERT INTO team_members (email, name, role) VALUES ('anupam@anupampaints.com', 'Anupam Kedia', 'admin')
ON CONFLICT (email) DO NOTHING;
