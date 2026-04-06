-- SciAstra ContentOS Supabase Schema

-- 1. Content Items
CREATE TABLE IF NOT EXISTS public.content_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    channel TEXT NOT NULL,
    date TEXT NOT NULL,
    "scheduledTime" TEXT,
    status TEXT NOT NULL,
    assignees JSONB,
    "campaignId" TEXT,
    "driveLink" TEXT,
    notes TEXT,
    approval TEXT,
    "auditLog" JSONB DEFAULT '[]'::jsonb,
    assets JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    whatsapp TEXT,
    active BOOLEAN DEFAULT true,
    channels JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target TEXT,
    exam TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    "recipientName" TEXT,
    "whatsappNumber" TEXT,
    "notificationType" TEXT,
    message TEXT,
    "taskId" TEXT,
    status TEXT,
    timestamp TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) for internal service role usage
-- Later we can enable RLS to restrict public access.
ALTER TABLE public.content_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
