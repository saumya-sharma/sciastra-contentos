import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CHANNEL_NAMES = [
  'Vivek NISER | SciAstra',
  'Instagram',
  'SciAstra English',
  'SciAstra 11th',
  'SciAstra 12th',
  'SciAstra College',
  'SciAstra Whatsapp/emails/notifications',
];

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const [itemsResp, teamResp, campaignsResp] = await Promise.all([
      supabase.from('content_items').select('id, title, status, channel, date, type, assignees, auditLog, created_at'),
      supabase.from('team_members').select('id, name, role').neq('role', 'ADMIN'),
      supabase.from('campaigns').select('id, name, exam'),
    ]);

    const items = itemsResp.data || [];
    const teamMembers = teamResp.data || [];
    const campaigns = campaignsResp.data || [];

    // totalPublished
    const publishedItems = items.filter((i: any) => i.status === 'Published');
    const totalPublished = publishedItems.length;

    // bottleneckStage: stage with most items stuck > 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const stuckItems = items.filter((i: any) => {
      if (i.status === 'Published' || i.status === 'Ideation') return false;
      const ref = i.created_at ? new Date(i.created_at) : (i.date ? new Date(i.date) : null);
      return ref && ref < threeDaysAgo;
    });

    const stageCounts: Record<string, number> = {};
    for (const item of stuckItems) {
      stageCounts[(item as any).status] = (stageCounts[(item as any).status] || 0) + 1;
    }

    let bottleneckStage = 'None';
    let bottleneckCount = 0;
    for (const [stage, count] of Object.entries(stageCounts)) {
      if (count > bottleneckCount) {
        bottleneckCount = count;
        bottleneckStage = stage;
      }
    }

    // avgVelocityDays: average days from created_at → Published (via auditLog timestamp)
    let avgVelocityDays = 0;
    const publishedWithCreated = publishedItems.filter((i: any) => i.created_at);
    if (publishedWithCreated.length > 0) {
      const velocities = publishedWithCreated.map((i: any) => {
        const createdAt = new Date(i.created_at);
        let publishedAt: Date | null = null;
        if (Array.isArray(i.auditLog)) {
          const entry = i.auditLog.find((log: any) =>
            typeof log.action === 'string' && log.action.includes('Published')
          );
          if (entry?.timestamp) publishedAt = new Date(entry.timestamp);
        }
        if (!publishedAt) publishedAt = i.date ? new Date(i.date) : new Date();
        const days = (publishedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, days);
      });
      avgVelocityDays =
        Math.round((velocities.reduce((a: number, b: number) => a + b, 0) / velocities.length) * 10) / 10;
    }

    // topContributor: SMM with most published items
    const smmCounts: Record<string, number> = {};
    for (const item of publishedItems) {
      const smm = (item as any).assignees?.smm;
      if (smm) smmCounts[smm] = (smmCounts[smm] || 0) + 1;
    }
    let topContributor = 'N/A';
    let topContributorCount = 0;
    for (const [smm, count] of Object.entries(smmCounts)) {
      if (count > topContributorCount) {
        topContributorCount = count;
        topContributor = smm;
      }
    }

    // topChannel: channel with most published items overall
    const channelCounts: Record<string, number> = {};
    for (const item of publishedItems) {
      const ch = (item as any).channel;
      if (ch) channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    }
    let topChannel = 'N/A';
    let topChannelCount = 0;
    for (const [ch, count] of Object.entries(channelCounts)) {
      if (count > topChannelCount) {
        topChannelCount = count;
        topChannel = ch;
      }
    }

    // approvalTurnaroundHours: avg hrs from "Ready to Publish" → "Published" via auditLog
    let approvalTurnaroundHours: number | null = null;
    const turnaroundSamples: number[] = [];
    for (const item of publishedItems) {
      const log: any[] = Array.isArray((item as any).auditLog) ? (item as any).auditLog : [];
      const readyEntry = log.find((e: any) => typeof e.action === 'string' && e.action.includes('Ready to Publish'));
      const publishedEntry = log.find((e: any) => typeof e.action === 'string' && e.action.includes('Published'));
      if (readyEntry?.timestamp && publishedEntry?.timestamp) {
        const hrs = (new Date(publishedEntry.timestamp).getTime() - new Date(readyEntry.timestamp).getTime()) / (1000 * 60 * 60);
        if (hrs >= 0) turnaroundSamples.push(hrs);
      }
    }
    if (turnaroundSamples.length > 0) {
      approvalTurnaroundHours = Math.round(
        (turnaroundSamples.reduce((a, b) => a + b, 0) / turnaroundSamples.length) * 10
      ) / 10;
    }

    // teamOutput: {name, published, target} per non-admin team member
    const teamOutput = teamMembers.map((member: any) => {
      const firstName = member.name.split(' ')[0];
      const published = publishedItems.filter(
        (i: any) =>
          i.assignees?.smm === firstName ||
          i.assignees?.editor === firstName ||
          i.assignees?.designer === firstName
      ).length;
      const target = member.role === 'SMM' ? 10 : 15;
      return { name: member.name, published, target };
    });

    // channelCadence: {channel, published, target:3} for items published this week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const channelCadence = CHANNEL_NAMES.map((channel) => {
      const published = publishedItems.filter((i: any) => {
        if (i.channel !== channel) return false;
        const d = i.date ? new Date(i.date) : null;
        return d && d >= startOfWeek;
      }).length;
      return { channel, published, target: 3 };
    });

    // examReadiness: published count per upcoming exam (items with channel 'Exams' in next 90 days)
    const examItems = items.filter((i: any) => i.type === 'Exam' || i.channel === 'Exams');
    const examReadiness = examItems
      .filter((ex: any) => {
        const d = ex.date ? new Date(ex.date) : null;
        return d && d >= now && d <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      })
      .map((ex: any) => {
        const examName = (ex.title || '').split(' ')[0].toLowerCase();
        const ready = publishedItems.filter((i: any) =>
          (i.campaignId && campaigns.find((c: any) => c.id === i.campaignId && c.exam?.toLowerCase().includes(examName))) ||
          (i.title || '').toLowerCase().includes(examName)
        ).length;
        const daysUntil = Math.ceil((new Date(ex.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { title: ex.title, days: daysUntil, ready };
      });

    return NextResponse.json({
      totalPublished,
      bottleneckStage,
      bottleneckCount,
      avgVelocityDays,
      topContributor,
      topChannel,
      approvalTurnaroundHours,
      teamOutput,
      channelCadence,
      examReadiness,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
