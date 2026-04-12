'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Item = { id: string; title: string; type: string; channel: string; date: string; status: string; assignees?: { smm?: string; editor?: string; designer?: string } };

const STATUSES = ['Ideation', 'Scripting', 'Sent to Editor', 'Ready to Publish', 'Published'];

const CHANNEL_COLORS: Record<string, string> = {
    'Vivek NISER | SciAstra': '#7C3AED',
    'Instagram':              '#E1306C',
    'SciAstra English':       '#1D4ED8',
    'SciAstra 11th':          '#EA580C',
    'SciAstra 12th':          '#639922',
    'SciAstra College':       '#0D9488',
    'SciAstra Whatsapp/emails/notifications': '#25D366',
    'Ad Campaigns':           '#DC2626',
};

const STATUS_DOTS: Record<string, string> = {
    'Ideation':        '#475569',
    'Scripting':       '#3b82f6',
    'Sent to Editor':  '#f59e0b',
    'Ready to Publish':'#a855f7',
    'Published':       '#22c55e',
};

function initials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function SharePipelinePage() {
    const params = useParams();
    const token = params?.token as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState<{ type: string; label: string | null } | null>(null);
    const [items, setItems] = useState<Item[]>([]);

    useEffect(() => {
        if (!token) return;
        fetch(`/api/share?token=${encodeURIComponent(token)}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { setError(data.error); setLoading(false); return; }
                if (data.meta?.type !== 'pipeline') { setError('This link is not a pipeline share.'); setLoading(false); return; }
                setMeta(data.meta);
                setItems(data.items || []);
                setLoading(false);
            })
            .catch(() => { setError('Failed to load shared pipeline.'); setLoading(false); });
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

    const contentItems = items.filter(i => i.type !== 'Exam');

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
                        Pipeline{meta?.label ? ` · ${meta.label}` : ''}
                    </span>
                </div>
                <span style={{ fontSize: '11px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '4px 10px', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Shared view · Read only
                </span>
            </header>

            {/* Kanban Board */}
            <div style={{ flex: 1, overflowX: 'auto', padding: '20px 24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                {STATUSES.map(status => {
                    const colItems = contentItems.filter(i => i.status === status);
                    const dotColor = STATUS_DOTS[status] || '#475569';
                    return (
                        <div key={status} style={{ minWidth: '260px', maxWidth: '280px', flex: '0 0 260px', background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                            {/* Column header */}
                            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1' }}>{status}</span>
                                </div>
                                <span style={{ fontSize: '11px', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '2px 7px', color: '#639922', fontWeight: 700 }}>{colItems.length}</span>
                            </div>
                            {/* Cards */}
                            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '70vh' }}>
                                {colItems.map(item => {
                                    const chColor = CHANNEL_COLORS[item.channel] || '#64748b';
                                    const assigneeName = item.assignees?.smm || item.assignees?.editor;
                                    return (
                                        <div key={item.id} style={{ background: '#0b1121', borderRadius: '8px', padding: '12px', borderLeft: `3px solid ${chColor}`, position: 'relative' }}>
                                            {/* Channel tag */}
                                            <div style={{ marginBottom: '6px' }}>
                                                <span style={{ fontSize: '9px', fontWeight: 700, background: `${chColor}25`, color: chColor, padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {item.channel.replace('SciAstra ', '')}
                                                </span>
                                            </div>
                                            {/* Title */}
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px', lineHeight: '1.4' }}>
                                                {item.title || <em style={{ color: '#475569' }}>Untitled</em>}
                                            </p>
                                            {/* Footer row */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '10px', color: '#475569' }}>{item.date}</span>
                                                {assigneeName && (
                                                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>
                                                        {initials(assigneeName)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {colItems.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#334155', fontSize: '12px' }}>Empty</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <footer style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span style={{ color: '#e8a020', fontSize: '12px' }}>●</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>Powered by <strong style={{ color: '#64748b' }}>Lume</strong> · getlume.com</span>
            </footer>
        </div>
    );
}
