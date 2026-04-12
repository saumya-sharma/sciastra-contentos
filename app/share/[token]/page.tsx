'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Item = { id: string; title: string; type: string; channel: string; date: string; status: string; scheduledTime?: string };

const CHANNEL_COLORS: Record<string, string> = {
    'Vivek NISER | SciAstra': '#7C3AED',
    'Instagram':              '#E1306C',
    'SciAstra English':       '#1D4ED8',
    'SciAstra 11th':          '#EA580C',
    'SciAstra 12th':          '#639922',
    'SciAstra College':       '#0D9488',
    'SciAstra Whatsapp/emails/notifications': '#25D366',
    'Ad Campaigns':           '#DC2626',
    'Exams':                  '#991B1B',
};

const STATUS_COLORS: Record<string, string> = {
    'Ideation':        'bg-slate-700 text-slate-300',
    'Scripting':       'bg-blue-900/60 text-blue-300',
    'Sent to Editor':  'bg-amber-900/60 text-amber-300',
    'Ready to Publish':'bg-purple-900/60 text-purple-300',
    'Published':       'bg-green-900/60 text-green-300',
};

function getChannelColor(ch: string) {
    return CHANNEL_COLORS[ch] || '#64748b';
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ShareCalendarPage() {
    const params = useParams();
    const token = params?.token as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState<{ type: string; label: string | null; expires_at: string | null } | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);

    useEffect(() => {
        if (!token) return;
        fetch(`/api/share?token=${encodeURIComponent(token)}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { setError(data.error); setLoading(false); return; }
                setMeta(data.meta);
                setItems(data.items || []);
                setLoading(false);
            })
            .catch(() => { setError('Failed to load shared calendar.'); setLoading(false); });
    }, [token]);

    if (loading) {
        return (
            <div style={{ background: '#0d0d0b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ color: '#64748b', fontSize: '14px' }}>Loading…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ background: '#0d0d0b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
                <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
                        <span style={{ color: '#e8a020', fontSize: '24px' }}>●</span>
                        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '24px', color: '#fff' }}>Lume</span>
                    </div>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
                    <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>Link unavailable</p>
                    <p style={{ fontSize: '14px', color: '#475569' }}>{error}</p>
                </div>
            </div>
        );
    }

    // Build week days
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday + weekOffset * 7);
    const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        return { label: `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`, iso };
    });

    // All unique channels in the data
    const channels = Array.from(new Set(items.filter(i => i.type !== 'Exam').map(i => i.channel)));
    const exams = items.filter(i => i.type === 'Exam');
    const examsByDate: Record<string, string[]> = {};
    exams.forEach(e => { if (!examsByDate[e.date]) examsByDate[e.date] = []; examsByDate[e.date].push(e.title); });

    // Month view
    const now = new Date();
    const baseMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const firstDay = baseMonth.getDay();
    const daysToMon = firstDay === 0 ? 6 : firstDay - 1;
    const startDate = new Date(baseMonth);
    startDate.setDate(startDate.getDate() - daysToMon);
    const MONTH_WEEKS = Array.from({ length: 5 }, (_, wi) =>
        Array.from({ length: 7 }, (_, di) => {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + wi * 7 + di);
            return { iso: d.toISOString().split('T')[0], day: d.getDate(), month: d.getMonth() };
        })
    );

    return (
        <div style={{ background: '#0d0d0b', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ background: '#0b1121', borderBottom: '1px solid #1e293b', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#e8a020', fontSize: '20px' }}>●</span>
                        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '20px', color: '#fff' }}>Lume</span>
                    </div>
                    <div style={{ width: '1px', height: '20px', background: '#334155' }} />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
                        Calendar{meta?.label ? ` · ${meta.label}` : ''}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '4px 10px', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Shared view · Read only
                    </span>
                </div>
            </header>

            {/* Controls */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: '#1e293b', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                    {(['week', 'month'] as const).map(v => (
                        <button key={v} onClick={() => setViewMode(v)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: viewMode === v ? '#639922' : 'transparent', color: viewMode === v ? '#fff' : '#94a3b8', transition: 'all 0.15s' }}>
                            {v === 'week' ? 'Week Grid' : 'Month Zoom'}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button onClick={() => viewMode === 'week' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)} style={{ padding: '6px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>←</button>
                    <button onClick={() => { setWeekOffset(0); setMonthOffset(0); }} style={{ padding: '6px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Today</button>
                    <button onClick={() => viewMode === 'week' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)} style={{ padding: '6px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>→</button>
                </div>
            </div>

            {/* Calendar Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                {viewMode === 'week' && (
                    <div style={{ overflowX: 'auto' }}>
                        <div style={{ minWidth: '760px', background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                            {/* Header row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
                                <div style={{ padding: '10px 12px', fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderRight: '1px solid #1e293b' }}>Channel</div>
                                {WEEK_DAYS.map(d => (
                                    <div key={d.iso} style={{ padding: '10px 8px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #1e293b' }}>{d.label}</div>
                                ))}
                            </div>
                            {/* Exam row */}
                            {WEEK_DAYS.some(d => examsByDate[d.iso]?.length > 0) && (
                                <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', borderBottom: '1px solid #451a1a', background: 'rgba(127,29,29,0.2)' }}>
                                    <div style={{ padding: '8px 12px', fontSize: '10px', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', borderRight: '1px solid #451a1a' }}>🗓 Exams</div>
                                    {WEEK_DAYS.map(d => (
                                        <div key={d.iso} style={{ padding: '6px', borderRight: '1px solid #451a1a', minHeight: '32px' }}>
                                            {(examsByDate[d.iso] || []).map((ex, i) => (
                                                <div key={i} style={{ fontSize: '9px', color: '#fca5a5', background: 'rgba(127,29,29,0.5)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '2px 5px', marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={ex}>{ex}</div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Channel rows */}
                            {channels.map(ch => (
                                <div key={ch} style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', borderBottom: '1px solid #1e293b' }}>
                                    <div style={{ padding: '12px', borderRight: '1px solid #1e293b', borderLeft: `3px solid ${getChannelColor(ch)}`, fontSize: '11px', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center' }}>
                                        {ch.replace('SciAstra ', '')}
                                    </div>
                                    {WEEK_DAYS.map(d => {
                                        const matched = items.filter(i => i.channel === ch && i.date === d.iso);
                                        return (
                                            <div key={d.iso} style={{ padding: '6px', borderRight: '1px solid #1e293b', minHeight: '70px' }}>
                                                {matched.map(m => (
                                                    <div key={m.id} style={{ marginBottom: '4px', padding: '5px 6px', borderRadius: '5px', borderLeft: `3px solid ${getChannelColor(m.channel)}`, background: `${getChannelColor(m.channel)}20`, fontSize: '10px', color: '#e2e8f0', lineHeight: '1.3' }}>
                                                        <div style={{ fontWeight: 600, marginBottom: '3px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{m.title || 'Untitled'}</div>
                                                        <span style={{ fontSize: '9px', background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '3px', color: '#94a3b8' }}>{m.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'month' && (
                    <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Month header */}
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                            {MONTH_NAMES[baseMonth.getMonth()]} {baseMonth.getFullYear()}
                        </div>
                        {/* Day name row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
                            {DAY_NAMES.map(d => (
                                <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
                            ))}
                        </div>
                        {MONTH_WEEKS.map((week, wi) => (
                            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #1e293b' }}>
                                {week.map(day => {
                                    const dayItems = items.filter(i => i.date === day.iso && i.type !== 'Exam');
                                    const isCurrentMonth = day.month === baseMonth.getMonth();
                                    return (
                                        <div key={day.iso} style={{ padding: '6px', minHeight: '80px', borderRight: '1px solid #1e293b', opacity: isCurrentMonth ? 1 : 0.35 }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: isCurrentMonth ? '#94a3b8' : '#475569', marginBottom: '4px' }}>{day.day}</div>
                                            {dayItems.slice(0, 3).map(m => (
                                                <div key={m.id} style={{ fontSize: '10px', marginBottom: '2px', padding: '2px 5px', borderRadius: '3px', borderLeft: `2px solid ${getChannelColor(m.channel)}`, background: `${getChannelColor(m.channel)}25`, color: '#cbd5e1', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={m.title}>
                                                    {m.title || 'Untitled'}
                                                </div>
                                            ))}
                                            {dayItems.length > 3 && <div style={{ fontSize: '9px', color: '#475569' }}>+{dayItems.length - 3} more</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span style={{ color: '#e8a020', fontSize: '12px' }}>●</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>Powered by <strong style={{ color: '#64748b' }}>Lume</strong> · getlume.com</span>
                {meta?.expires_at && (
                    <span style={{ fontSize: '11px', color: '#334155', marginLeft: '16px' }}>
                        Expires {new Date(meta.expires_at).toLocaleDateString()}
                    </span>
                )}
            </footer>
        </div>
    );
}
