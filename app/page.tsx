"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';


type AuditLog = { user: string; action: string; timestamp: string };
type Item = { id: string; title: string; type: string; channel: string; date: string; scheduledTime?: string; status: string; assignees?: { smm?: string, editor?: string, designer?: string }; campaignId?: string; driveLink?: string; notes?: string; approval?: string; auditLog?: AuditLog[]; assets?: any[]; };
type TeamMember = { id: string; name: string; role: string; whatsapp: string; active?: boolean; channels?: string[] };
type Campaign = { id: string, name: string, target?: string, exam?: string, startDate?: string, endDate?: string };

const STATUSES = ['Ideation', 'Scripting', 'Sent to Editor', 'Ready to Publish', 'Published'];

type Channel = { id: string; name: string; platform: string; color: string; cls: string; bg: string; defaultAssignee?: string; archived?: boolean; order?: number };

const DEFAULT_CHANNELS: Channel[] = [
    { id: 'ch_vivek',    name: 'Vivek NISER | SciAstra', platform: 'YouTube',   color: '#7C3AED', cls: 'border-l-purple-500', bg: 'bg-purple-900/30',   defaultAssignee: 'Vivek', order: 0 },
    { id: 'ch_ig',       name: 'Instagram',              platform: 'Instagram', color: '#E1306C', cls: 'border-l-[#E1306C]',  bg: 'bg-[#E1306C]/15',    defaultAssignee: 'Mahak', order: 1 },
    { id: 'ch_english',  name: 'SciAstra English',       platform: 'YouTube',   color: '#1D4ED8', cls: 'border-l-blue-500',   bg: 'bg-blue-900/30',     defaultAssignee: 'Priya', order: 2 },
    { id: 'ch_11th',     name: 'SciAstra 11th',          platform: 'YouTube',   color: '#EA580C', cls: 'border-l-orange-500', bg: 'bg-orange-900/30',   defaultAssignee: 'Ritika', order: 3 },
    { id: 'ch_12th',     name: 'SciAstra 12th',          platform: 'YouTube',   color: '#639922', cls: 'border-l-[#639922]',  bg: 'bg-[#639922]/15',    defaultAssignee: 'Ritika', order: 4 },
    { id: 'ch_college',  name: 'SciAstra College',       platform: 'YouTube',   color: '#0D9488', cls: 'border-l-teal-500',   bg: 'bg-teal-900/30',     defaultAssignee: 'Team', order: 5 },
    { id: 'ch_wa',       name: 'SciAstra Whatsapp/emails/notifications', platform: 'WhatsApp', color: '#25D366', cls: 'border-l-[#25D366]', bg: 'bg-[#25D366]/20', defaultAssignee: 'Mahak', order: 6 },
    { id: 'ch_ads',      name: 'Ad Campaigns',           platform: 'Other',     color: '#DC2626', cls: 'border-l-red-500',    bg: 'bg-red-900/30',      order: 7 },
    { id: 'ch_exams',    name: 'Exams',                  platform: 'Other',     color: '#991B1B', cls: 'border-l-red-600',    bg: 'bg-red-950/40',      order: 8 },
];

// Legacy CHANNELS constant kept for compat — derived from DEFAULT_CHANNELS
const CHANNELS = DEFAULT_CHANNELS.map(c => ({ name: c.name, cls: c.cls, bg: c.bg }));

type AnalyticsData = {
    totalPublished: number;
    bottleneckStage: string;
    bottleneckCount: number;
    avgVelocityDays: number;
    topContributor: string;
    topChannel: string;
    approvalTurnaroundHours: number | null;
    teamOutput: { name: string; published: number; target: number }[];
    channelCadence: { channel: string; published: number; target: number }[];
    examReadiness: { title: string; days: number; ready: number }[];
};

export default function ContentOS() {
    const [items, setItems] = useState<Item[]>([]);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [config, setConfig] = useState({ hasWatiKey: false });
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pipeline');

    // Lazy-init Supabase browser client (avoids build-time env var errors)
    const supabaseBrowser = useMemo(() => createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    ), []);
    const [teamManagementTab, setTeamManagementTab] = useState<'members'|'channels'|'invites'>('members');
    const [channelConfig, setChannelConfig] = useState<Channel[]>(DEFAULT_CHANNELS);
    const [showAddChannelForm, setShowAddChannelForm] = useState(false);
    const [newChannelForm, setNewChannelForm] = useState({ name: '', platform: 'Instagram', color: '#E1306C', defaultAssignee: '' });
    const [reportDate, setReportDate] = useState('');
    const [isDark, setIsDark] = useState(true);
    const [mounted, setMounted] = useState(false);
    
    // Auth & Roles — DO NOT read from localStorage (old role-selector system is deprecated)
    // Supabase session check in useEffect sets these
    const [role, setRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('Unknown');
    const [viewMode, setViewMode] = useState<'week'|'month'>('week');
    const [weekOffset, setWeekOffset] = useState(0);   // 0 = current week, +1 = next week, etc.
    const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, +1 = next, etc.
    const [userEmail, setUserEmail] = useState(''); // logged-in email from Supabase session
    const [authView, setAuthView] = useState<'login'|'request'>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [requestForm, setRequestForm] = useState({ name: '', email: '', role: 'Social Media Manager', message: '' });
    const [requestSent, setRequestSent] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [showDirectInvite, setShowDirectInvite] = useState(false);
    const [directInviteForm, setDirectInviteForm] = useState({ name: '', email: '', role: 'SMM' });

    // Drawer state
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [toast, setToast] = useState('');
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [loginStep, setLoginStep] = useState<'role' | 'smm-pick'>('role');
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(1);
    const [newMember, setNewMember] = useState({ name: '', role: 'CREATOR', whatsapp: '+91', channels: [] as string[] });

    // Filters
    const [filterChannel, setFilterChannel] = useState('');
    const [filterCampaign, setFilterCampaign] = useState('');
    const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
    const [newCampaignForm, setNewCampaignForm] = useState({ name: '', exam: 'None', target: '', startDate: '', endDate: '' });
    const [savingCampaign, setSavingCampaign] = useState(false);
    const [savedToast, setSavedToast] = useState(false); // "Saved ✓" indicator in drawer
    const [titleError, setTitleError] = useState(false); // New item title validation

    // Notify Teams inline panel
    const [showNotifyPanel, setShowNotifyPanel] = useState(false);
    const [notifyTeams, setNotifyTeams] = useState<string[]>([]);
    const [notifyChannel, setNotifyChannel] = useState<'zoho'|'wati'|'both'>('zoho');
    const [notifyMessageType, setNotifyMessageType] = useState('batch_live');
    const [notifyCustomMsg, setNotifyCustomMsg] = useState('');
    const [notifySending, setNotifySending] = useState(false);
    const [notifyResult, setNotifyResult] = useState('');
    const [zohoEnabled, setZohoEnabled] = useState(false);
    const [watiEnabled, setWatiEnabled] = useState(false);

    // AI Brief Studio modal
    const [showAiBriefModal, setShowAiBriefModal] = useState(false);
    const [briefTitle, setBriefTitle] = useState('');
    const [briefChannel, setBriefChannel] = useState('');
    const [briefGoal, setBriefGoal] = useState('');
    const [briefTone, setBriefTone] = useState('Educate & Inspire');
    const [briefAudience, setBriefAudience] = useState('');
    const [briefKeyPoints, setBriefKeyPoints] = useState('');
    const [briefCTA, setBriefCTA] = useState('');
    const [briefGenerating, setBriefGenerating] = useState(false);
    const [briefResult, setBriefResult] = useState<null | {
        hook: string; caption: string; hashtags: string; cta: string;
        angles: string[]; thumbnail: string;
        scores: { hook: number; trend: number; cta: number; fit: number; overall: number };
    }>(null);
    const [trendsOpen, setTrendsOpen] = useState(true);

    // Escape key closes AI Brief modal
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAiBriefModal(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        // Clear stale legacy role-selector localStorage (old auth system)
        localStorage.removeItem('sa_role');
        localStorage.removeItem('sa_name');

        // Dark mode
        const savedTheme = localStorage.getItem('sa_theme');
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }
        setReportDate(new Date().toLocaleDateString());
        setMounted(true);

        // Supabase session check
        supabaseBrowser.auth.getSession().then(({ data }) => {
            if (data.session) {
                const email = data.session.user.email || '';
                const metaName = data.session.user.user_metadata?.name || data.session.user.user_metadata?.full_name || '';
                setUserEmail(email);
                fetch(`/api/auth?email=${encodeURIComponent(email)}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.role) {
                            setRole(d.role);
                            setUserName(d.name?.trim() ? d.name : (metaName || email.split('@')[0]));
                        } else {
                            setAuthError(d.message || 'Access denied.');
                            setLoading(false);
                        }
                    }).catch(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        supabaseBrowser.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setRole(null);
                setUserEmail('');
                setUserName('Unknown');
            }
        });
    }, []);

    // Fetch app data whenever role is set
    useEffect(() => {
        if (!role) return;
        fetch('/api/db').then(res => res.json()).then(data => {
            setItems(data.items || []);
            setTeam(data.team || []);
            setCampaigns(data.campaigns || []);
            setNotifications(data.notifications || []);
            if (data.config) setConfig(data.config);
            setLoading(false);
        }).catch(() => setLoading(false));
        fetch('/api/analytics').then(res => res.json()).then(data => {
            if (!data.error) setAnalyticsData(data);
        }).catch(() => {});
        fetch('/api/cron').catch(() => {});
        fetch('/api/notify-teams').then(r => r.json()).then(cfg => {
            setZohoEnabled(!!cfg.zohoConfigured);
            setWatiEnabled(!!cfg.watiConfigured);
        }).catch(() => {});
    }, [role]);

    const toggleDarkMode = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        if (newDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('sa_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('sa_theme', 'light');
        }
    };

    const createCampaign = async () => {
        if (!newCampaignForm.name.trim()) return;
        setSavingCampaign(true);
        const newCamp: Campaign = {
            id: `camp_${Date.now()}`,
            name: newCampaignForm.name.trim(),
            target: newCampaignForm.target,
            exam: newCampaignForm.exam,
            startDate: newCampaignForm.startDate,
            endDate: newCampaignForm.endDate,
        };
        await fetch('/api/db', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _action: 'CREATE_CAMPAIGN', campaign: newCamp }),
        });
        setCampaigns(prev => [...prev, newCamp]);
        setShowNewCampaignModal(false);
        setNewCampaignForm({ name: '', exam: 'None', target: '', startDate: '', endDate: '' });
        setSavingCampaign(false);
        setToast(`Campaign "${newCamp.name}" created!`);
        setTimeout(() => setToast(''), 3000);
    };


    const login = (roleType: string, name: string, tab: string) => {
        localStorage.setItem('sa_role', roleType);
        localStorage.setItem('sa_name', name);
        setRole(roleType);
        setUserName(name);
        setActiveTab(tab);
    };

    const logout = () => {
        localStorage.removeItem('sa_role');
        localStorage.removeItem('sa_name');
        setRole(null);
    };

    const triggerWhatsApp = async (item: Item) => {
        setToast('Sending...');
        await fetch('/api/notify', {
             method: 'POST', body: JSON.stringify({
                 recipientName: item.assignees?.smm || 'Admin',
                 whatsappNumber: '+919999999999', 
                 notificationType: 'Manual Trigger',
                 title: item.title,
                 channel: item.channel,
                 scheduledTime: item.scheduledTime,
                 taskId: item.id
             })
        });
        setToast('WhatsApp notification queued');
        setTimeout(() => setToast(''), 4000);
    };

    const showSavedToast = () => {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
    };

    const refreshData = async () => {
        const data = await fetch('/api/db').then(r => r.json());
        setItems(data.items || []);
        setCampaigns(data.campaigns || []);
        setTeam(data.team || []);
    };

    const updateItem = async (item: Item, payloadChanges: Partial<Item>) => {
        if (item.id === 'new') {
            const potentialTitle = payloadChanges.title !== undefined ? payloadChanges.title : item.title;
            if (!potentialTitle.trim()) {
                // Must have a title to create an item
                setSelectedItem({ ...item, ...payloadChanges });
                setTitleError(true);
                setTimeout(() => setTitleError(false), 3000);
                return;
            }
            setTitleError(false);

            // Persist new item to DB immediately
            const newId = Math.random().toString(36).substring(7);
            const newItem: Item = { 
                ...item, 
                ...payloadChanges, 
                id: newId, 
                auditLog: [{ user: userName, action: `Created`, timestamp: new Date().toISOString() }] 
            };
            setItems(prev => [...prev, newItem]);
            setSelectedItem(newItem);
            // Write to DB + refresh so calendar and kanban are in sync
            await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _action: 'CREATE_ITEM', item: newItem }),
            });
            showSavedToast();
            await refreshData(); // re-fetch so calendar row updates immediately
            return;
        }

        const payload = { id: item.id, _actor: userName, ...payloadChanges };
        const optimisticLog = { user: userName, action: `Updated properties`, timestamp: new Date().toISOString() };
        if (payloadChanges.status) optimisticLog.action = `Moved from ${item.status} to ${payloadChanges.status}`;
        
        const optimistic = items.map(i => i.id === item.id ? { ...i, ...payloadChanges, auditLog: [...(i.auditLog||[]), optimisticLog] } : i);
        setItems(optimistic);
        if (selectedItem?.id === item.id) setSelectedItem({ ...item, ...payloadChanges, auditLog: [...(selectedItem.auditLog||[]), optimisticLog] } as Item);
        
        await fetch('/api/db', { method: 'PUT', body: JSON.stringify(payload) });
        showSavedToast();

        // Trigger Webhook if status hit specific targets
        if (payloadChanges.status === 'Ready to Publish' || payloadChanges.status === 'Sent to Editor') {
            await fetch('/api/notify', {
                 method: 'POST', body: JSON.stringify({
                     recipientName: item.assignees?.smm || 'Admin',
                     whatsappNumber: '+910000000000',
                     notificationType: payloadChanges.status,
                     message: `Task "${item.title}" is now ${payloadChanges.status}`,
                     taskId: item.id
                 })
            });
        }
    };

    const updateTeamMember = async (member: TeamMember) => {
        const payload = { _action: 'UPDATE_TEAM', member };
        const optimistic = [...team.filter(t => t.id !== member.id), member];
        setTeam(optimistic);
        await fetch('/api/db', { method: 'PUT', body: JSON.stringify(payload) });
    };

    const handleDeactivate = (member: TeamMember) => {
        if (member.active === false) {
            updateTeamMember({ ...member, active: true });
        } else {
            if (window.confirm(`Are you sure you want to deactivate ${member.name}? They will lose access but their history will be preserved.`)) {
                updateTeamMember({ ...member, active: false });
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedItem) return;

        setToast('Uploading to Cloudinary...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', selectedItem.title);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            
            if (data.success) {
                const curAssets = (selectedItem as any).assets || [];
                const newAssets = [...curAssets, { url: data.asset.secure_url, name: file.name, status: 'Uploaded' }];
                updateItem(selectedItem, { assets: newAssets });
                setToast('Asset saved! Pinging SMM via WhatsApp...');
                
                if (selectedItem.assignees?.smm) {
                    await fetch('/api/notify', {
                        method: 'POST',
                        body: JSON.stringify({
                            recipientName: selectedItem.assignees.smm, 
                            whatsappNumber: '+910000000000',
                            notificationType: 'Asset Uploaded',
                            message: `Asset ready for "${selectedItem.title}". Please review.`,
                            taskId: selectedItem.id
                        })
                    });
                }
                setTimeout(() => setToast('WhatsApp sent to SMM'), 1500);
            } else {
                setToast('Upload failed.');
            }
        } catch(err) {
            setToast('Error uploading file.');
        }
    };


    const getBorderClass = (chName: string) => CHANNELS.find(x => x.name === chName)?.cls || 'border-l-slate-500';
    const getBgClass = (chName: string) => CHANNELS.find(x => x.name === chName)?.bg || 'bg-slate-900/30';

    let visibleItems = items;
    if (role === 'SMM') {
        visibleItems = items.filter(i => i.assignees?.smm?.includes(userName.split(' ')[0]) || i.type === 'Exam');
    } else if (role === 'CREATOR') {
        visibleItems = items.filter(i => (i.assignees?.editor?.includes(userName.split(' ')[0]) || i.assignees?.designer?.includes(userName.split(' ')[0])) && (i.status === 'Sent to Editor' || i.status === 'Ready to Publish'));
    }

    if (filterChannel) visibleItems = visibleItems.filter(i => i.channel === filterChannel || i.type === 'Exam');
    if (filterCampaign) visibleItems = visibleItems.filter(i => i.campaignId === filterCampaign || i.type === 'Exam');

    // Global Exam Countdown Extraction
    const upcomingExams = useMemo(() => {
        const now = new Date('2026-04-05T00:00:00Z').getTime(); // App Sandbox Time
        return items.filter(i => i.type === 'Exam')
             .map(e => ({ title: e.title, days: Math.ceil((new Date(e.date).getTime() - now) / (1000 * 3600 * 24)) }))
             .filter(e => e.days >= 0)
             .sort((a,b) => a.days - b.days).slice(0, 3);
    }, [items]);

    // Don't render login UI on server — avoids hydration mismatch from localStorage reads
    if (!mounted) return null;

    const handleSignIn = async () => {
        if (!authEmail || !authPassword) { setAuthError('Please enter email and password.'); return; }
        setAuthLoading(true);
        setAuthError('');
        const { data, error } = await supabaseBrowser.auth.signInWithPassword({
            email: authEmail.toLowerCase(),
            password: authPassword,
        });
        if (error) { setAuthError(error.message); setAuthLoading(false); return; }
        const email = data.user?.email || '';
        const metaName = data.user?.user_metadata?.name || data.user?.user_metadata?.full_name || '';
        setUserEmail(email);
        const roleResp = await fetch(`/api/auth?email=${encodeURIComponent(email)}`).then(r => r.json());
        if (roleResp.role) {
            setRole(roleResp.role);
            // Prefer: db name → user_metadata name → email prefix
            setUserName(roleResp.name?.trim() ? roleResp.name : (metaName || email.split('@')[0]));
        } else {
            setAuthError(roleResp.message || 'Access denied.');
            await supabaseBrowser.auth.signOut();
        }
        setAuthLoading(false);
    };

    const handleRequestAccess = async () => {
        if (!requestForm.name || !requestForm.email) { setAuthError('Name and email required.'); return; }
        setAuthLoading(true);
        await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _action: 'request_access', ...requestForm, requestedRole: requestForm.role }),
        });
        setRequestSent(true);
        setAuthLoading(false);
    };

    const handleLogout = async () => {
        await supabaseBrowser.auth.signOut();
        localStorage.removeItem('sa_role');
        localStorage.removeItem('sa_name');
        setRole(null);
        setUserEmail('');
        setUserName('Unknown');
    };

    if (!role) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--color-background)] px-4">
                <div className="bg-[var(--color-surface)] p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-md">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-full bg-white mx-auto mb-4 flex items-center justify-center p-2 shadow-lg border border-slate-700">
                            <img src="https://www.sciastra.com/assets/images/sciastra-logo.webp" alt="SciAstra" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tighter">SciAstra <span className="text-[#639922]">ContentOS</span></h1>
                        <p className="text-slate-500 text-xs mt-1">Internal Content Operations Platform</p>
                    </div>

                    {/* Tab toggle */}
                    <div className="flex bg-slate-900 rounded-lg p-1 mb-6">
                        <button onClick={() => { setAuthView('login'); setAuthError(''); setRequestSent(false); }} className={`flex-1 py-2 rounded text-xs font-bold transition ${authView === 'login' ? 'bg-[#639922] text-white' : 'text-slate-400 hover:text-white'}`}>Sign In</button>
                        <button onClick={() => { setAuthView('request'); setAuthError(''); }} className={`flex-1 py-2 rounded text-xs font-bold transition ${authView === 'request' ? 'bg-[#639922] text-white' : 'text-slate-400 hover:text-white'}`}>Request Access</button>
                    </div>

                    {authView === 'login' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 tracking-widest">Work Email</label>
                                <input
                                    type="email"
                                    value={authEmail}
                                    onChange={e => setAuthEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                                    placeholder="you@sciastra.com"
                                    className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white placeholder-slate-600"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 tracking-widest">Password</label>
                                <input
                                    type="password"
                                    value={authPassword}
                                    onChange={e => setAuthPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                                    placeholder="••••••••"
                                    className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white placeholder-slate-600"
                                />
                            </div>
                            {authError && <p className="text-red-400 text-xs font-medium text-center">{authError}</p>}
                            <button
                                onClick={handleSignIn}
                                disabled={authLoading}
                                className="w-full bg-[#639922] hover:bg-[#4d7a18] disabled:opacity-50 text-white font-black py-3 rounded-xl transition text-sm"
                            >
                                {authLoading ? 'Signing in…' : 'Sign In'}
                            </button>
                            <p className="text-center text-[10px] text-slate-600">Forgot password? Contact <span className="text-slate-400">saumyaprakash@sciastra.com</span></p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requestSent ? (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">✅</div>
                                    <p className="font-bold text-white mb-2">Request sent!</p>
                                    <p className="text-slate-400 text-sm">You will receive an email when approved.</p>
                                    <button onClick={() => { setRequestSent(false); setAuthView('login'); }} className="mt-4 text-xs text-[#639922] hover:underline">← Back to Sign In</button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 tracking-widest">Full Name</label>
                                        <input value={requestForm.name} onChange={e => setRequestForm(f => ({...f, name: e.target.value}))} placeholder="Your full name" className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 tracking-widest">Work Email</label>
                                        <input type="email" value={requestForm.email} onChange={e => setRequestForm(f => ({...f, email: e.target.value}))} placeholder="you@sciastra.com" className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 tracking-widest">Your Role</label>
                                        <select value={requestForm.role} onChange={e => setRequestForm(f => ({...f, role: e.target.value}))} className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white">
                                            <option>Social Media Manager</option>
                                            <option>Video Editor</option>
                                            <option>Designer</option>
                                        </select>
                                    </div>
                                    {authError && <p className="text-red-400 text-xs font-medium text-center">{authError}</p>}
                                    <button onClick={handleRequestAccess} disabled={authLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition text-sm">
                                        {authLoading ? 'Submitting…' : 'Submit Request'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden text-sm relative">
            
            {/* Action Toast Overlay */}
            {toast && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-[#1E293B] border border-[#639922]/50 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-medium">
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#639922] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#639922]"></span>
                        </span>
                        {toast}
                    </div>
                </div>
            )}

            {/* Create New Campaign Modal */}
            {showNewCampaignModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewCampaignModal(false)}>
                    <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-white font-black text-lg tracking-tight">New Campaign</h2>
                            <button onClick={() => setShowNewCampaignModal(false)} className="text-slate-400 hover:text-white transition text-xl leading-none">✕</button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-widest">Campaign Name *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newCampaignForm.name}
                                    onChange={e => setNewCampaignForm(f => ({...f, name: e.target.value}))}
                                    className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white"
                                    placeholder="e.g. Homi Campaign 3"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-widest">Related Exam</label>
                                    <select
                                        value={newCampaignForm.exam}
                                        onChange={e => setNewCampaignForm(f => ({...f, exam: e.target.value}))}
                                        className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white cursor-pointer"
                                    >
                                        {['IAT','NEST','JEE','NEET','ISI','CMI','BITSAT','None'].map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-widest">Target</label>
                                    <input
                                        type="text"
                                        value={newCampaignForm.target}
                                        onChange={e => setNewCampaignForm(f => ({...f, target: e.target.value}))}
                                        className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white"
                                        placeholder="e.g. 300 leads"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-widest">Start Date</label>
                                    <input
                                        type="date"
                                        value={newCampaignForm.startDate}
                                        onChange={e => setNewCampaignForm(f => ({...f, startDate: e.target.value}))}
                                        className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-widest">End Date</label>
                                    <input
                                        type="date"
                                        value={newCampaignForm.endDate}
                                        onChange={e => setNewCampaignForm(f => ({...f, endDate: e.target.value}))}
                                        className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowNewCampaignModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-700 transition">Cancel</button>
                            <button
                                onClick={createCampaign}
                                disabled={!newCampaignForm.name.trim() || savingCampaign}
                                className="flex-1 py-2.5 rounded-lg bg-[#639922] text-white text-sm font-black hover:bg-[#4d7a18] transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingCampaign ? 'Saving...' : 'Save Campaign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exam Context Banner */}
            {upcomingExams.length > 0 && (
                <div className="bg-gradient-to-r from-red-900/50 via-slate-900 to-red-900/50 border-b border-red-500/20 py-1.5 px-6 flex justify-center items-center gap-6 text-xs text-red-100 font-medium z-50">
                    <span className="animate-pulse">🚨</span>
                    {upcomingExams.map((ex, idx) => (
                        <span key={`${ex.title}-${idx}`}>{ex.title} in <strong className="text-white">{ex.days}</strong> days</span>
                    ))}
                    <span className="animate-pulse">🚨</span>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-64 bg-[#0B1121] border-r border-slate-800 flex flex-col hidden md:flex z-10 transition-all">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center p-1.5 shadow-sm border border-slate-700">
                                <img src="https://www.sciastra.com/assets/images/sciastra-logo.webp" alt="SciAstra" className="w-full h-full object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).insertAdjacentHTML('afterend','<span class="text-xs font-black text-slate-800">SA</span>');}} />
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5 leading-none">
                                    <span className="text-xl font-black text-white tracking-tight">SciAstra</span>
                                    <span className="text-[10px] font-black bg-[#639922] text-white px-1.5 py-0.5 rounded leading-none mt-0.5">ContentOS</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium tracking-wide mt-1 leading-none">Content Hub</p>
                            </div>
                        </div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-900 inline-block px-2 py-1 rounded">
                            {role === 'ADMIN' ? 'Admin' : role === 'SMM' ? 'SMM' : 'Creator'} | {userName.split(' ')[0] || 'You'}
                        </div>
                    </div>
                    <nav className="flex-1 px-4 space-y-2">
                        {role === 'CREATOR' ? (
                            <button onClick={() => setActiveTab('pipeline')} className={`w-full text-left px-4 py-2 font-medium rounded-lg transition ${activeTab === 'pipeline' ? 'bg-[var(--color-surface)] text-[#639922]' : 'text-slate-400 hover:text-white'}`}>Task Inbox</button>
                        ) : (
                            <>
                                <button onClick={() => setActiveTab('pipeline')} className={`w-full text-left px-4 py-2 font-medium rounded-lg transition ${activeTab === 'pipeline' ? 'bg-[var(--color-surface)] text-[#639922]' : 'text-slate-400 hover:text-white'}`}>Kanban Board</button>
                                <button onClick={() => setActiveTab('calendar')} className={`w-full text-left px-4 py-2 font-medium rounded-lg transition ${activeTab === 'calendar' ? 'bg-[var(--color-surface)] text-[#639922]' : 'text-slate-400 hover:text-white'}`}>Calendar Matrix</button>
                                <button onClick={() => setActiveTab('campaigns')} className={`w-full text-left px-4 py-2 font-medium rounded-lg transition ${activeTab === 'campaigns' ? 'bg-[var(--color-surface)] text-[#639922]' : 'text-slate-400 hover:text-white'}`}>Campaign Hub</button>
                            </>
                        )}
                        {role === 'ADMIN' && (
                            <>
                                <button onClick={() => setActiveTab('analytics')} className={`w-full text-left px-4 py-2 font-medium rounded-lg transition ${activeTab === 'analytics' ? 'bg-[var(--color-surface)] text-[#639922]' : 'text-slate-400 hover:text-white'}`}>Operations Analytics</button>
                                <button onClick={() => setActiveTab('cmo-report')} className={`w-full text-left px-4 py-2 font-medium rounded-lg transition ${activeTab === 'cmo-report' ? 'bg-[var(--color-surface)] text-[#639922]' : 'text-slate-400 hover:text-white'}`}>CMO Report</button>
                                <button onClick={() => setActiveTab('team')} className={`w-full text-left px-4 py-2 font-medium rounded-lg transition ${activeTab === 'team' ? 'bg-[var(--color-surface)] text-[#639922]' : 'text-slate-400 hover:text-white'}`}>Team Management</button>
                            </>
                        )}
                    </nav>
                    <div className="p-4 border-t border-slate-800 flex justify-between items-center">
                        <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-400 transition flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            Sign Out
                        </button>
                        <div className="flex items-center gap-1.5">
                            <button onClick={toggleDarkMode} title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition flex items-center justify-center">
                                {isDark ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                                ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                                )}
                            </button>
                            <button onClick={() => {setShowTutorial(true); setTutorialStep(1);}} className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 font-bold hover:text-white hover:bg-slate-700 transition flex items-center justify-center">?</button>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 relative flex flex-col bg-[var(--color-background)] overflow-hidden">
                    <header className="h-16 border-b border-slate-800 flex items-center px-6 justify-between bg-[#0B1121]/90 backdrop-blur z-20 shrink-0">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-bold capitalize">{activeTab.replace('-', ' ')}</h2>
                            
                            {/* Filter Bar */}
                            {(activeTab === 'pipeline' || activeTab === 'calendar') && (
                                <div className="flex gap-2 ml-4">
                                    <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 outline-none">
                                        <option value="">All Channels</option>
                                        {channelConfig.filter(c => c.name !== 'Exams' && !c.archived).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                    <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 outline-none max-w-[150px]">
                                        <option value="">All Campaigns</option>
                                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {activeTab === 'calendar' && (
                            <div className="flex items-center gap-2">
                                {/* View mode toggle */}
                                <div className="flex bg-slate-900 rounded p-1 border border-slate-800">
                                    <button onClick={()=>setViewMode('week')} className={`px-3 py-1 rounded text-xs transition ${viewMode==='week'?'bg-[#639922] text-white':'text-slate-400 hover:text-white'}`}>Week Grid</button>
                                    <button onClick={()=>setViewMode('month')} className={`px-3 py-1 rounded text-xs transition ${viewMode==='month'?'bg-[#639922] text-white':'text-slate-400 hover:text-white'}`}>Month Zoom</button>
                                </div>
                                {/* Navigation arrows */}
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        onClick={() => viewMode === 'week' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)}
                                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                                        title="Previous"
                                    >←</button>
                                    <button
                                        onClick={() => { setWeekOffset(0); setMonthOffset(0); }}
                                        className="px-3 py-1 rounded bg-slate-800 hover:bg-[#639922] hover:text-white text-slate-300 text-xs font-bold transition"
                                    >Today</button>
                                    <button
                                        onClick={() => viewMode === 'week' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)}
                                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                                        title="Next"
                                    >→</button>
                                </div>
                            </div>
                        )}
                    </header>

                    <div className="flex-1 overflow-auto p-4 md:p-6 relative custom-scrollbar">
                        {loading ? (
                            <div className="animate-pulse space-y-4">Booting systems...</div>
                        ) : (
                            <>
                                {activeTab === 'pipeline' && (
                                    <div className="flex gap-4 md:gap-6 h-full items-start overflow-x-auto pb-4">
                                        {STATUSES.map(status => (
                                            <div 
                                                key={status} 
                                                className="w-80 flex-shrink-0 bg-[var(--color-surface)] rounded-xl border border-slate-800/50 flex flex-col max-h-full"
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => {
                                                    const itemId = e.dataTransfer.getData('item');
                                                    const itm = items.find(i=>i.id===itemId);
                                                    if (itm && itm.status !== status) updateItem(itm, { status });
                                                }}
                                            >
                                                <div className="p-3 md:p-4 font-bold border-b border-slate-800/50 flex justify-between items-center text-slate-300">
                                                    <span>{status}</span>
                                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-[#639922]">
                                                        {visibleItems.filter(i => i.status === status && i.type !== 'Exam').length}
                                                    </span>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-3 custom-scrollbar">
                                                    {visibleItems.filter(i => i.status === status && i.type !== 'Exam').map(item => (
                                                        <div 
                                                            key={item.id} 
                                                            draggable
                                                            onDragStart={e => e.dataTransfer.setData('item', item.id)}
                                                            onClick={() => setSelectedItem(item)} 
                                                            className={`bg-[#0B1121] p-4 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-800 border-l-[3px] ${getBorderClass(item.channel)} shadow-sm transition-all relative group`}
                                                        >
                                                            <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-[var(--color-surface)] to-transparent pointer-events-none rounded-tr-lg opacity-0 group-hover:opacity-100 transition"></div>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getBgClass(item.channel)} text-white/80`}>
                                                                    {item.channel.split(' ')[0]}
                                                                </span>
                                                                {item.campaignId && <span className="bg-purple-900/40 border border-purple-500/20 text-purple-300 text-[8px] px-1.5 py-0.5 rounded font-bold ml-2 truncate max-w-[100px]">{campaigns.find(c=>c.id===item.campaignId)?.name || 'Campaign'}</span>}
                                                            </div>
                                                            <h3 className="font-semibold text-slate-100 leading-tight mb-3 text-xs md:text-sm" title={item.title}>
                                                                {item.title.length > 40 ? item.title.substring(0, 40) + '...' : item.title}
                                                            </h3>
                                                            
                                                            <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-800/50">
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    🗓 {item.date}
                                                                </span>
                                                                <div className="flex -space-x-1">
                                                                    {item.assignees?.smm && <div className="w-5 h-5 rounded-full bg-blue-900 text-blue-200 border border-slate-800 flex items-center justify-center text-[8px] font-bold z-30" title={item.assignees.smm}>{item.assignees.smm.charAt(0)}</div>}
                                                                    {item.assignees?.editor && <div className="w-5 h-5 rounded-full bg-orange-900 text-orange-200 border border-slate-800 flex items-center justify-center text-[8px] font-bold z-20" title={item.assignees.editor}>{item.assignees.editor.charAt(0)}</div>}
                                                                    {item.assignees?.designer && <div className="w-5 h-5 rounded-full bg-teal-900 text-teal-200 border border-slate-800 flex items-center justify-center text-[8px] font-bold z-10" title={item.assignees.designer}>{item.assignees.designer.charAt(0)}</div>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'calendar' && viewMode === 'week' && (() => {
                                    // Build dynamic week days based on weekOffset
                                    const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                                    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                    const today = new Date();
                                    // Find Monday of current week
                                    const dayOfWeek = today.getDay(); // 0=Sun
                                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                                    const monday = new Date(today);
                                    monday.setDate(today.getDate() - daysToMonday + weekOffset * 7);
                                    const WEEK_DAYS = Array.from({length: 7}, (_, i) => {
                                        const d = new Date(monday);
                                        d.setDate(monday.getDate() + i);
                                        const iso = d.toISOString().split('T')[0];
                                        const label = `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
                                        return { label, iso };
                                    });
                                    const examsByDate: Record<string, string[]> = {};
                                    items.filter(i => i.type === 'Exam').forEach(e => {
                                        if (!examsByDate[e.date]) examsByDate[e.date] = [];
                                        examsByDate[e.date].push(e.title);
                                    });
                                    return (
                                   <div className="overflow-x-auto h-full">
                                        <div className="min-w-[1000px] bg-[var(--color-surface)] border border-slate-800 rounded-xl">
                                            {/* Header row */}
                                            <div className="grid grid-cols-[150px_repeat(7,_1fr)] border-b border-slate-800 bg-slate-900/50">
                                                <div className="p-3 font-bold text-slate-500 border-r border-slate-800 text-xs text-center uppercase tracking-wider">Channel</div>
                                                {WEEK_DAYS.map(d => (
                                                    <div key={d.iso} className="p-3 font-bold text-center border-r border-slate-800 text-xs text-slate-300">{d.label}</div>
                                                ))}
                                            </div>
                                            {/* Exam banner row — spans all columns for dates that have exams */}
                                            {WEEK_DAYS.some(d => examsByDate[d.iso]?.length > 0) && (
                                                <div className="grid grid-cols-[150px_repeat(7,_1fr)] border-b border-red-900/40 bg-red-950/30">
                                                    <div className="p-2 border-r border-red-900/30 text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center">🗓 Exams</div>
                                                    {WEEK_DAYS.map(d => (
                                                        <div key={d.iso} className="border-r border-red-900/30 p-1.5 min-h-[36px]">
                                                            {(examsByDate[d.iso] || []).map((ex, i) => (
                                                                <div key={i} className="text-[9px] text-red-300 font-bold bg-red-900/40 border border-red-700/30 rounded px-1.5 py-0.5 mb-0.5 leading-tight truncate" title={ex}>{ex.length > 30 ? ex.substring(0,30)+'…' : ex}</div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Channel content rows */}
                                            {channelConfig.filter(c=>c.name!=='Exams'&&!c.archived).map(ch => (
                                                <div key={ch.name} className="grid grid-cols-[150px_repeat(7,_1fr)] border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                                                    <div className={`p-4 border-r border-slate-800 text-xs font-bold ${getBorderClass(ch.name)} border-l-4 flex items-center`}>
                                                        {ch.name}
                                                    </div>
                                                    {WEEK_DAYS.map(d => {
                                                        const matched = visibleItems.filter(i => i.channel === ch.name && i.date === d.iso);
                                                        return (
                                                            <div key={d.iso} className="border-r border-slate-800/50 p-2 relative min-h-[80px] group hover:bg-slate-700/30 transition">
                                                                {matched.map(m => (
                                                                    <div key={m.id} onClick={(e)=>{e.stopPropagation(); setSelectedItem(m)}} className={`mb-1 p-1.5 rounded text-[9px] leading-tight font-medium ${getBgClass(m.channel)} ${getBorderClass(m.channel)} border-l-4 border-y border-r border-y-slate-700 border-r-slate-700 text-white shadow-sm cursor-pointer`}>
                                                                        <span title={m.title || 'Untitled Post'}>{m.title ? (m.title.length > 35 ? m.title.substring(0, 35) + '...' : m.title) : <em className="text-slate-400">Untitled Post</em>}</span>
                                                                    </div>
                                                                ))}
                                                                <div onClick={() => setSelectedItem({ id: 'new', title: '', type: 'Content', channel: ch.name, date: d.iso, status: 'Ideation', assignees: { smm: userName, editor: '', designer: '' } })} className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-sm text-slate-500 font-light hover:text-[#639922] hover:bg-slate-700 rounded transition cursor-pointer">+</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                   </div>
                                    );
                                })()}

                                {activeTab === 'calendar' && viewMode === 'month' && (() => {
                                    // Build 4-week grid dynamically based on monthOffset
                                    const MNAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                    const now = new Date();
                                    // Start from the 1st of the month + offset
                                    const baseMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
                                    // Find first Monday on or before the 1st
                                    const firstDay = new Date(baseMonth);
                                    const startDow = firstDay.getDay();
                                    const backDays = startDow === 0 ? 6 : startDow - 1;
                                    firstDay.setDate(firstDay.getDate() - backDays);
                                    const MONTH_WEEKS = Array.from({length: 4}, (_, wi) => {
                                        const dates = Array.from({length: 7}, (__, di) => {
                                            const d = new Date(firstDay);
                                            d.setDate(firstDay.getDate() + wi * 7 + di);
                                            return d.toISOString().split('T')[0];
                                        });
                                        const start = dates[0], end = dates[6];
                                        const sd = new Date(start), ed = new Date(end);
                                        const label = `Week ${wi+1}: ${MNAMES[sd.getMonth()]} ${sd.getDate()}–${MNAMES[ed.getMonth()]} ${ed.getDate()}`;
                                        return { label, dates };
                                    });
                                    return (
                                   <div className="overflow-x-auto h-full">
                                        <div className="min-w-[700px] bg-[var(--color-surface)] border border-slate-800 rounded-xl">
                                            {/* Month Zoom: 4-week grid — each column = one week summary */}
                                            <div className="grid border-b border-slate-800 bg-slate-900/50" style={{gridTemplateColumns: '120px repeat(4, 1fr)'}}>
                                                <div className="p-3 font-bold text-slate-500 border-r border-slate-800 text-xs text-center uppercase tracking-wider">Channel</div>
                                                {MONTH_WEEKS.map(w => (
                                                    <div key={w.label} onClick={() => { setViewMode('week'); }} className="p-3 font-bold text-center border-r border-slate-800 text-xs text-slate-300 cursor-pointer hover:bg-slate-800 transition leading-tight">{w.label}</div>
                                                ))}
                                            </div>
                                            {channelConfig.filter(c=>c.name!=='Exams'&&!c.archived).map(ch => (
                                                <div key={ch.name} className="grid border-b border-slate-800/50 hover:bg-slate-800/20 transition" style={{gridTemplateColumns: '120px repeat(4, 1fr)'}}>
                                                    <div className={`p-3 border-r border-slate-800 text-[10px] font-bold ${getBorderClass(ch.name)} border-l-4 flex items-center leading-tight`}>
                                                        {ch.name}
                                                    </div>
                                                    {MONTH_WEEKS.map(({ dates }, widx) => {
                                                        const weekItems = visibleItems.filter(i => i.channel === ch.name && dates.includes(i.date));
                                                        const published = weekItems.filter(i=>i.status==='Published').length;
                                                        return (
                                                            <div key={widx} onClick={() => setViewMode('week')} className="border-r border-slate-800/50 p-2 min-h-[60px] cursor-pointer hover:bg-slate-700/30 transition flex flex-col gap-1">
                                                                {weekItems.length === 0 ? (
                                                                    <span className="text-[10px] text-slate-700 italic">—</span>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-base font-black text-white">{weekItems.length}</span>
                                                                            <span className="text-[9px] text-slate-500">pieces</span>
                                                                        </div>
                                                                        <div className="text-[9px] text-[#639922] font-bold">{published} pub</div>
                                                                        <div className="h-1 w-full bg-slate-800 rounded overflow-hidden">
                                                                            <div className="h-full bg-[#639922]" style={{width: `${weekItems.length > 0 ? Math.round(published/weekItems.length*100) : 0}%`}}></div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                   </div>
                                    );
                                })()}

                                {activeTab === 'campaigns' && (
                                    <div>
                                        {/* Header with Create button */}
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-base font-bold text-white">All Campaigns <span className="text-slate-500 font-medium text-sm">({campaigns.length})</span></h3>
                                            {role === 'ADMIN' && (
                                                <button
                                                    onClick={() => {
                                                        setNewCampaignForm({ name: '', target: '', exam: '', color: '#639922' });
                                                        setShowNewCampaignModal(true);
                                                    }}
                                                    className="bg-[#639922] hover:bg-[#4d7a18] text-white px-4 py-2 rounded-lg text-xs font-black transition shadow flex items-center gap-2"
                                                >+ Create New Campaign</button>
                                            )}
                                        </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
                                        {campaigns.map(camp => {
                                            const campItems = items.filter(i => i.campaignId === camp.id);
                                            const published = campItems.filter(i => i.status === 'Published').length;
                                            const progress = campItems.length > 0 ? Math.round((published / campItems.length) * 100) : 0;
                                            return (
                                                <div key={camp.id} className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-6 hover:border-purple-500/50 transition relative group">
                                                    {/* ⋯ menu — ADMIN only */}
                                                    {role === 'ADMIN' && (
                                                        <div className="absolute top-3 right-3">
                                                            <div className="relative" id={`camp-menu-${camp.id}`}>
                                                                <button
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        const el = document.getElementById(`camp-dropdown-${camp.id}`);
                                                                        if (el) el.classList.toggle('hidden');
                                                                    }}
                                                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition opacity-0 group-hover:opacity-100 text-lg leading-none"
                                                                >⋯</button>
                                                                <div id={`camp-dropdown-${camp.id}`} className="hidden absolute right-0 top-9 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 min-w-[130px]">
                                                                    <button
                                                                        onClick={async e => {
                                                                            e.stopPropagation();
                                                                            document.getElementById(`camp-dropdown-${camp.id}`)?.classList.add('hidden');
                                                                            if (!window.confirm(`Delete campaign "${camp.name}"?\n\nContent items linked to it will become Standalone Posts.`)) return;
                                                                            // Set linked items campaignId to null
                                                                            for (const itm of campItems) {
                                                                                await fetch('/api/db', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: itm.id, updates: { campaignId: null }, actor: userName }) });
                                                                            }
                                                                            // Delete the campaign
                                                                            await fetch(`/api/db?id=${camp.id}&_action=DELETE_CAMPAIGN`, { method: 'DELETE' });
                                                                            await refreshData();
                                                                            setToast(`Campaign "${camp.name}" deleted`);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-900/20 transition font-bold flex items-center gap-2"
                                                                    >
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                                                        Delete Campaign
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <h3 className="text-lg font-bold text-white mb-1 leading-tight pr-8">{camp.name}</h3>
                                                    <p className="text-slate-400 text-xs mb-6 font-medium">{camp.target || 'TBD'}</p>
                                                    
                                                    <div className="mb-4">
                                                        <div className="flex justify-between text-xs font-bold mb-2">
                                                            <span className="text-[#639922]">Progress</span>
                                                            <span>{published} / {campItems.length} Content</span>
                                                        </div>
                                                        <div className="h-2 w-full bg-[#0B1121] rounded overflow-hidden">
                                                            <div className="h-full bg-[#639922] transition-all" style={{width: `${progress}%`}}></div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 flex-wrap text-[10px] uppercase font-bold tracking-wider">
                                                        {Array.from(new Set(campItems.map(i=>i.channel))).slice(0,3).map(ch => (
                                                            <span key={ch} className={`${getBgClass(String(ch))} px-2 py-1 rounded`}>{String(ch).startsWith('SciAstra ') ? String(ch).slice(9) : String(ch)}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    </div>
                                )}

                                {activeTab === 'team' && role === 'ADMIN' && (
                                    <div className="max-w-4xl space-y-6">
                                        {!config.hasWatiKey && (
                                            <div className="bg-orange-500/10 border border-orange-500/50 p-4 rounded-xl flex gap-3">
                                                <span className="text-orange-500">⚠️</span>
                                                <div>
                                                    <h4 className="font-bold text-orange-400 text-sm">WATI API Not Configured</h4>
                                                    <p className="text-orange-200/70 text-xs mt-1">WhatsApp notifications are running in Mock Mode. Add <code>WATI_API_KEY</code> and <code>WATI_ENDPOINT</code> to your deployment environments to enable live API sync.</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="bg-[var(--color-surface)] rounded-xl border border-slate-800 overflow-hidden">
                                            {/* Tab Bar */}
                                            <div className="flex border-b border-slate-800 bg-slate-900/50">
                                                {(['members', 'channels'] as const).map(tab => (
                                                    <button key={tab} onClick={() => setTeamManagementTab(tab)}
                                                        className={`px-6 py-4 text-sm font-bold capitalize tracking-wide transition border-b-2 -mb-px ${ teamManagementTab === tab ? 'border-[#639922] text-[#639922]' : 'border-transparent text-slate-400 hover:text-white' }`}>
                                                        {tab === 'members' ? '👥 Platform Identities' : '📺 Channels'}
                                                    </button>
                                                ))}
                                                {/* Pending Invites tab — load count lazily */}
                                                <button
                                                    onClick={() => {
                                                        setTeamManagementTab('invites');
                                                        fetch('/api/auth?action=pending_invites').then(r=>r.json()).then(d=>setPendingInvites(d.invites||[]));
                                                    }}
                                                    className={`px-6 py-4 text-sm font-bold tracking-wide transition border-b-2 -mb-px flex items-center gap-2 ${ teamManagementTab === 'invites' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white' }`}
                                                >
                                                    📨 Pending Invites
                                                    {pendingInvites.length > 0 && <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingInvites.length}</span>}
                                                </button>
                                                {teamManagementTab === 'members' && (
                                                    <div className="ml-auto flex items-center pr-4">
                                                        <button onClick={() => setShowOnboardModal(true)} className="bg-[#639922] text-white px-4 py-2 rounded text-xs font-bold hover:bg-[#4d7a18] transition shadow">+ Onboard Member</button>
                                                    </div>
                                                )}
                                                {teamManagementTab === 'channels' && (
                                                    <div className="ml-auto flex items-center pr-4">
                                                        <button onClick={() => setShowAddChannelForm(true)} className="bg-[#639922] text-white px-4 py-2 rounded text-xs font-bold hover:bg-[#4d7a18] transition shadow">+ Add Channel</button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Members Tab */}
                                            {teamManagementTab === 'members' && (
                                                <div className="divide-y divide-slate-800">
                                                    {team.map(member => (
                                                        <div key={member.id} className={`p-6 flex items-center justify-between hover:bg-slate-800/30 transition ${member.active === false ? 'opacity-50 grayscale' : ''}`}>
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300">{member.name.charAt(0)}</div>
                                                                <div>
                                                                    <input type="text" defaultValue={member.name} onBlur={(e) => updateTeamMember({...member, name: e.target.value})} className="bg-transparent font-bold text-white outline-none focus:border-b focus:border-[#639922] transition w-48"/>
                                                                    <div className="text-xs text-slate-500 flex gap-4 mt-1 items-center">
                                                                        <span>Phone: </span>
                                                                        <input type="tel" placeholder="Add phone..." defaultValue={member.whatsapp} onBlur={(e) => updateTeamMember({...member, whatsapp: e.target.value})} className="bg-[#0B1121] border border-slate-700 hover:border-slate-500 focus:border-[#639922] outline-none text-slate-300 w-32 rounded px-2 py-1 transition cursor-text pointer-events-auto" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <select defaultValue={member.role} disabled={member.active===false} onChange={(e) => updateTeamMember({...member, role: e.target.value})} className="bg-[#0B1121] border border-slate-700 text-xs rounded px-3 py-2 font-bold outline-none text-white">
                                                                    <option value="ADMIN">Administrator</option>
                                                                    <option value="SMM">Social Manager</option>
                                                                    <option value="CREATOR">Creator (Editor/Design)</option>
                                                                </select>
                                                                <button onClick={() => handleDeactivate(member)} className={`px-4 py-2 rounded text-xs font-bold border transition ${member.active === false ? 'border-green-500/50 text-green-400 hover:bg-green-500/10' : 'border-red-500/50 text-red-400 hover:bg-red-500/10'}`}>
                                                                    {member.active === false ? 'Reactivate' : 'Deactivate'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Channels Tab */}
                                            {teamManagementTab === 'channels' && (
                                                <div className="divide-y divide-slate-800">
                                                    {/* Add Channel Form */}
                                                    {showAddChannelForm && (
                                                        <div className="p-6 bg-slate-900/70 space-y-4">
                                                            <p className="text-xs font-bold text-[#639922] uppercase tracking-widest mb-2">New Channel</p>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Channel Name *</label>
                                                                    <input type="text" value={newChannelForm.name} onChange={e => setNewChannelForm(f => ({...f, name: e.target.value}))}
                                                                        className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-2.5 text-sm text-white"
                                                                        placeholder="e.g. SciAstra LinkedIn" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Platform</label>
                                                                    <select value={newChannelForm.platform} onChange={e => setNewChannelForm(f => ({...f, platform: e.target.value}))}
                                                                        className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-2.5 text-sm text-white cursor-pointer">
                                                                        {['Instagram','YouTube','LinkedIn','Twitter','WhatsApp','Email','Other'].map(p => <option key={p}>{p}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Color</label>
                                                                    <div className="flex items-center gap-2">
                                                                        <input type="color" value={newChannelForm.color} onChange={e => setNewChannelForm(f => ({...f, color: e.target.value}))}
                                                                            className="w-8 h-8 rounded cursor-pointer border border-slate-700 bg-transparent" />
                                                                        <span className="text-xs text-slate-400 font-mono">{newChannelForm.color}</span>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Default Assignee</label>
                                                                    <select value={newChannelForm.defaultAssignee} onChange={e => setNewChannelForm(f => ({...f, defaultAssignee: e.target.value}))}
                                                                        className="w-full bg-[#0B1121] border border-slate-700 focus:border-[#639922] outline-none rounded-lg p-2.5 text-sm text-white cursor-pointer">
                                                                        <option value="">None</option>
                                                                        {team.filter(t => t.active !== false).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-3 pt-2">
                                                                <button onClick={() => setShowAddChannelForm(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-bold hover:bg-slate-800 transition">Cancel</button>
                                                                <button
                                                                    disabled={!newChannelForm.name.trim()}
                                                                    onClick={() => {
                                                                        if (!newChannelForm.name.trim()) return;
                                                                        const hexColor = newChannelForm.color;
                                                                        const newCh: Channel = {
                                                                            id: `ch_${Date.now()}`,
                                                                            name: newChannelForm.name.trim(),
                                                                            platform: newChannelForm.platform,
                                                                            color: hexColor,
                                                                            cls: `border-l-[${hexColor}]`,
                                                                            bg: `bg-[${hexColor}]/15`,
                                                                            defaultAssignee: newChannelForm.defaultAssignee,
                                                                            archived: false,
                                                                            order: channelConfig.length,
                                                                        };
                                                                        setChannelConfig(prev => [...prev, newCh]);
                                                                        setNewChannelForm({ name: '', platform: 'Instagram', color: '#E1306C', defaultAssignee: '' });
                                                                        setShowAddChannelForm(false);
                                                                    }}
                                                                    className="px-6 py-2 rounded-lg bg-[#639922] text-white text-xs font-black hover:bg-[#4d7a18] transition disabled:opacity-50">
                                                                    Save Channel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Channel list */}
                                                    {channelConfig.filter(ch => ch.name !== 'Exams').map((ch, idx) => (
                                                        <div key={ch.id} className={`p-4 flex items-center gap-4 hover:bg-slate-800/20 transition ${ch.archived ? 'opacity-40' : ''}`}>
                                                            {/* Drag handle */}
                                                            <span className="text-slate-600 cursor-grab text-lg select-none" title="Drag to reorder"
                                                                draggable
                                                                onDragStart={e => e.dataTransfer.setData('chIdx', String(idx))}
                                                                onDragOver={e => e.preventDefault()}
                                                                onDrop={e => {
                                                                    const from = parseInt(e.dataTransfer.getData('chIdx'));
                                                                    if (from === idx) return;
                                                                    setChannelConfig(prev => {
                                                                        const arr = [...prev];
                                                                        const [moved] = arr.splice(from, 1);
                                                                        arr.splice(idx, 0, moved);
                                                                        return arr.map((c,i) => ({...c, order: i}));
                                                                    });
                                                                }}>⠿</span>
                                                            {/* Color dot */}
                                                            <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold text-sm text-white truncate">{ch.name}</p>
                                                                <p className="text-[10px] text-slate-500">{ch.platform}{ch.defaultAssignee ? ` · ${ch.defaultAssignee}` : ''}</p>
                                                            </div>
                                                            {/* Color input */}
                                                            <input type="color" value={ch.color} title="Change color"
                                                                onChange={e => setChannelConfig(prev => prev.map(c => c.id === ch.id ? {...c, color: e.target.value} : c))}
                                                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer" />
                                                            {/* Archive / Restore */}
                                                            <button
                                                                onClick={() => setChannelConfig(prev => prev.map(c => c.id === ch.id ? {...c, archived: !c.archived} : c))}
                                                                className={`px-3 py-1.5 rounded text-[10px] font-bold border transition ${ch.archived ? 'border-green-500/40 text-green-400 hover:bg-green-500/10' : 'border-slate-600 text-slate-400 hover:border-red-500/40 hover:text-red-400'}`}>
                                                                {ch.archived ? 'Restore' : 'Archive'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <div className="p-4 text-[10px] text-slate-600 text-center">
                                                        Drag rows to reorder · Archived channels are hidden from Calendar &amp; Kanban
                                                    </div>
                                                </div>
                                            )}

                                            {/* Pending Invites Panel */}
                                            {teamManagementTab === 'invites' && (
                                                <div className="p-6 space-y-6">
                                                    {/* Direct Invite button */}
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-xs text-slate-500">Requests submitted via the login page appear here for approval.</p>
                                                        <button onClick={() => setShowDirectInvite(v => !v)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">+ Direct Invite</button>
                                                    </div>

                                                    {/* Direct Invite form */}
                                                    {showDirectInvite && (
                                                        <div className="bg-slate-900/60 border border-indigo-500/20 rounded-xl p-5 space-y-4">
                                                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Send Invite Email</p>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Name</label>
                                                                    <input value={directInviteForm.name} onChange={e => setDirectInviteForm(f=>({...f,name:e.target.value}))} className="w-full bg-[#0B1121] border border-slate-700 focus:border-indigo-500 outline-none rounded-lg p-2.5 text-sm text-white" placeholder="Full name" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Email</label>
                                                                    <input type="email" value={directInviteForm.email} onChange={e => setDirectInviteForm(f=>({...f,email:e.target.value}))} className="w-full bg-[#0B1121] border border-slate-700 focus:border-indigo-500 outline-none rounded-lg p-2.5 text-sm text-white" placeholder="email@sciastra.com" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Role</label>
                                                                    <select value={directInviteForm.role} onChange={e => setDirectInviteForm(f=>({...f,role:e.target.value}))} className="w-full bg-[#0B1121] border border-slate-700 focus:border-indigo-500 outline-none rounded-lg p-2.5 text-sm text-white cursor-pointer">
                                                                        <option value="ADMIN">Admin</option>
                                                                        <option value="SMM">SMM</option>
                                                                        <option value="CREATOR">Creator</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-3">
                                                                <button onClick={() => setShowDirectInvite(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-bold hover:bg-slate-800 transition">Cancel</button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!directInviteForm.email || !directInviteForm.name) return;
                                                                        await fetch('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ _action: 'direct_invite', ...directInviteForm }) });
                                                                        setShowDirectInvite(false);
                                                                        setDirectInviteForm({name:'',email:'',role:'SMM'});
                                                                        setToast('Invite sent! ✅');
                                                                    }}
                                                                    className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition"
                                                                >Send Invite</button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Pending list */}
                                                    {pendingInvites.length === 0 ? (
                                                        <p className="text-slate-600 text-sm text-center py-8 italic">No pending requests 🎉</p>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {pendingInvites.map((inv: any) => (
                                                                <div key={inv.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                                                                    <div>
                                                                        <p className="font-bold text-white text-sm">{inv.name}</p>
                                                                        <p className="text-slate-400 text-xs">{inv.email} · <span className="text-indigo-400">{inv.requested_role}</span></p>
                                                                        <p className="text-slate-600 text-[10px] mt-1">{new Date(inv.created_at).toLocaleDateString()}</p>
                                                                    </div>
                                                                    <div className="flex gap-2 shrink-0">
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (!window.confirm(`Approve ${inv.name} as ${inv.requested_role}?`)) return;
                                                                                await fetch('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ _action: 'approve_invite', inviteId: inv.id, email: inv.email, name: inv.name, role: inv.requested_role }) });
                                                                                setPendingInvites(p => p.filter(i => i.id !== inv.id));
                                                                                setToast(`${inv.name} approved & invite email sent ✅`);
                                                                            }}
                                                                            className="px-3 py-1.5 rounded bg-[#639922] hover:bg-[#4d7a18] text-white text-xs font-black transition"
                                                                        >Approve</button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (!window.confirm(`Reject request from ${inv.name}?`)) return;
                                                                                await fetch('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ _action: 'reject_invite', inviteId: inv.id }) });
                                                                                setPendingInvites(p => p.filter(i => i.id !== inv.id));
                                                                            }}
                                                                            className="px-3 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-900/20 text-xs font-bold transition"
                                                                        >Reject</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'analytics' && role === 'ADMIN' && (
                                    <div className="max-w-6xl space-y-6">
                                        <div className="bg-gradient-to-br from-slate-900 to-[#0B1121] border border-slate-800 rounded-xl p-6 shadow-2xl">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="font-bold text-lg text-white">Operations Velocity</h3>
                                                <select className="bg-[#0B1121] border border-slate-700 text-xs rounded px-3 py-1 outline-none text-slate-300">
                                                    <option>This Week</option><option>This Month</option><option>All Time</option>
                                                </select>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="bg-[#0B1121] border border-slate-800/50 p-5 rounded-lg flex flex-col justify-between">
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 block">Avg Pipeline Velocity</span>
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-3xl font-black text-[#639922]">{analyticsData?.avgVelocityDays ?? '—'}</span>
                                                        <span className="text-slate-400 text-sm font-medium mb-1">Days</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 mt-2">Ideation → Published</p>
                                                </div>
                                                <div className="bg-[#0B1121] border border-slate-800/50 p-5 rounded-lg flex flex-col justify-between relative overflow-hidden">
                                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-900/20 blur-xl rounded-full"></div>
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 block">Primary Bottleneck</span>
                                                    <div>
                                                        <span className="text-xl font-bold text-red-400">{analyticsData?.bottleneckStage ?? '—'}</span>
                                                        <p className="text-xs text-red-500/80 mt-1 font-medium">{analyticsData ? `${analyticsData.bottleneckCount} items stuck > 3 days` : 'Loading...'}</p>
                                                    </div>
                                                </div>
                                                <div className="bg-[#0B1121] border border-slate-800/50 p-5 rounded-lg flex flex-col justify-between">
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 block">Approval Turnaround</span>
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-3xl font-black text-blue-400">{analyticsData?.approvalTurnaroundHours ?? '—'}</span>
                                                        <span className="text-slate-400 text-sm font-medium mb-1">Hours</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 mt-2">Ready to Publish → Approved</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-6">
                                                <h3 className="font-bold text-white mb-6">Team Output (Published)</h3>
                                                <div className="space-y-4">
                                                    {(analyticsData?.teamOutput ?? team.filter(t=>t.role!=='ADMIN').map(m => ({ name: m.name, published: 0, target: m.role === 'SMM' ? 10 : 15 }))).map(member => {
                                                        const pct = Math.min((member.published / member.target) * 100, 100);
                                                        const roleDerived = team.find(t=>t.name===member.name)?.role ?? 'CREATOR';
                                                        return (
                                                            <div key={member.name}>
                                                                <div className="flex justify-between text-xs font-medium mb-1">
                                                                    <span className="text-slate-300">{member.name} <span className="text-[10px] text-slate-600">({roleDerived})</span></span>
                                                                    <span className="text-slate-400">{member.published} / {member.target}</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-[#0B1121] rounded overflow-hidden">
                                                                    <div className={`h-full ${roleDerived === 'SMM' ? 'bg-blue-500' : 'bg-purple-500'} transition-all`} style={{width: `${pct}%`}}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h3 className="font-bold text-white">Channel Cadence vs Target</h3>
                                                    <span className="text-[10px] text-slate-500">This week</span>
                                                </div>
                                                <div className="space-y-4">
                                                    {(analyticsData?.channelCadence ?? CHANNELS.filter(c=>c.name!=='Exams'&&c.name!=='Ad Campaigns').map(c=>({channel:c.name,published:0,target:3}))).map(ch => {
                                                        const chConfig = CHANNELS.find(c=>c.name===ch.channel);
                                                        return (
                                                            <div key={ch.channel} className="flex items-center justify-between border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${chConfig?.bg?.replace('/30','') ?? 'bg-slate-500'}`}></div>
                                                                    <span className="text-xs font-medium text-slate-300">{ch.channel.startsWith('SciAstra ') ? ch.channel.replace('SciAstra ', '') : ch.channel.split(' ')[0]}</span>
                                                                </div>
                                                                <div className="text-xs font-bold font-mono">
                                                                    <span className={ch.published >= ch.target ? 'text-[#639922]' : 'text-slate-400'}>{ch.published}</span><span className="text-slate-600"> / {ch.target}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {upcomingExams.length > 0 && (
                                            <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h3 className="font-bold text-white">Exam Readiness (Campaign Linked)</h3>
                                                    <button onClick={() => {
                                                        setToast('Syncing live dates via Cron...');
                                                        fetch('/api/cron').then(res=>res.json()).then(data=>{
                                                            setToast(data.message);
                                                            setTimeout(() => window.location.reload(), 1500);
                                                        });
                                                    }} className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-[#639922] hover:text-white text-slate-300 px-3 py-1.5 rounded flex items-center gap-2 transition">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21.5 2v6h-6M2.13 15.57a9 9 0 1 0 3.84-10.45l-4.5 4.5"/></svg>
                                                        Trigger Sync
                                                    </button>
                                                </div>
                                                <div className="space-y-4">
                                                    {upcomingExams.map((ex, idx) => {
                                                        const relevantCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(ex.title.toLowerCase().split(' ')[0]) || c.name.toLowerCase().includes('campaign'));
                                                        return (
                                                            <div key={idx} className="bg-[#0B1121] border border-slate-800 p-4 rounded-lg">
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <h4 className="text-sm font-black text-red-100 flex items-center gap-2"><span className="text-red-500">🚨</span> {ex.title} <span className="text-xs font-bold text-slate-500 ml-2">in {ex.days} days</span></h4>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {relevantCampaigns.map(camp => {
                                                                        const campItems = items.filter(i => i.campaignId === camp.id);
                                                                        const pub = campItems.filter(i => i.status === 'Published').length;
                                                                        const pct = campItems.length > 0 ? Math.round((pub / campItems.length) * 100) : 0;
                                                                        return (
                                                                             <div key={camp.id} className="text-xs flex items-center justify-between bg-[var(--color-surface)] px-3 py-2 rounded border border-slate-800/50">
                                                                                 <span className="font-medium text-slate-300 truncate max-w-[150px]">{camp.name}</span>
                                                                                 <div className="flex items-center gap-3">
                                                                                     <span className="text-slate-500">{pub}/{campItems.length} pub</span>
                                                                                     <span className={`font-bold ${pct >= 100 ? 'text-[#639922]' : pct > 50 ? 'text-orange-400' : 'text-red-400'}`}>{pct}%</span>
                                                                                 </div>
                                                                             </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {activeTab === 'cmo-report' && role === 'ADMIN' && (
                                    <div className="max-w-4xl mx-auto bg-[var(--color-surface)] border border-slate-800 p-8 rounded-xl shadow-2xl relative" id="cmo-report-container">
                                         <div className="flex justify-between items-start mb-10 pb-6 border-b border-slate-800">
                                              <div>
                                                  <h2 className="text-2xl font-black uppercase tracking-tighter">SciAstra Weekly Report</h2>
                                                  <p className="text-slate-400 text-sm mt-1">Automatically generated for Executive Review (<span className="text-slate-200 font-bold">{reportDate || '—'}</span>)</p>
                                              </div>
                                              <button onClick={() => {
                                                  // Minimalist native PDF engine via browser print layer
                                                  const printContent = document.getElementById('cmo-report-container')?.innerHTML;
                                                  const originalContent = document.body.innerHTML;
                                                  if(printContent) {
                                                      document.body.innerHTML = `<div style="background: #0B1121; color: white; padding: 40px; font-family: sans-serif;">${printContent}</div>`;
                                                      window.print();
                                                      document.body.innerHTML = originalContent;
                                                      window.location.reload();
                                                  }
                                              }} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 transition">
                                                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                   Export PDF
                                              </button>
                                         </div>

                                         <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                                              <div className="bg-[#0B1121] p-4 rounded-lg border border-slate-800/50">
                                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Total Published</span>
                                                   <span className="text-3xl font-black text-[#639922]">{analyticsData?.totalPublished ?? items.filter(i=>i.status==='Published').length}</span>
                                              </div>
                                              <div className="bg-[#0B1121] p-4 rounded-lg border border-slate-800/50">
                                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Top Channel</span>
                                                   <span className="text-xl font-bold text-blue-400 truncate block">{analyticsData?.topChannel ?? '—'}</span>
                                              </div>
                                              <div className="bg-[#0B1121] p-4 rounded-lg border border-slate-800/50">
                                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Top Contributor</span>
                                                   <span className="text-xl font-bold text-purple-400">{analyticsData?.topContributor ?? '—'}</span>
                                              </div>
                                              <div className="bg-[#0B1121] p-4 rounded-lg border border-slate-800/50">
                                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Bottleneck</span>
                                                   <span className="text-xl font-bold text-red-400">{analyticsData?.bottleneckStage ?? '—'}</span>
                                              </div>
                                         </div>

                                         <div className="space-y-8">
                                              <div>
                                                   <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Critical Red Alerts</h3>
                                                   {items.filter(i=>i.status !== 'Published' && i.status !== 'Ready to Publish').slice(0,1).map(i => (
                                                        <div key={i.id} className="bg-red-950/30 border border-red-500/20 p-4 rounded-lg">
                                                            <div className="flex gap-3">
                                                                 <span className="text-2xl mt-1">🚨</span>
                                                                 <div>
                                                                      <h4 className="font-bold text-red-200">High Risk: Content stalled right before Exam!</h4>
                                                                      <p className="text-red-300 text-sm mt-1">The task <span className="font-bold text-white">"{i.title}"</span> ({i.channel}) is currently stuck in <span className="underline">{i.status}</span>. Exam IAT is approaching in 12 days. Immediate intervention required by {i.assignees?.smm ?? "team"}.</p>
                                                                 </div>
                                                            </div>
                                                        </div>
                                                   ))}
                                              </div>

                                              <div>
                                                   <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Exam Readiness Summary</h3>
                                                   <div className="grid grid-cols-2 gap-4">
                                                        {(analyticsData?.examReadiness ?? upcomingExams.map(ex => ({ title: ex.title, days: ex.days, ready: 0 }))).map((ex, idx) => (
                                                            <div key={idx} className="flex justify-between p-3 bg-[#0B1121] rounded">
                                                                <span className="font-bold text-slate-300">{ex.title} (in {ex.days}d)</span>
                                                                <span className="text-[#639922] font-mono font-bold">{ex.ready} ready</span>
                                                            </div>
                                                        ))}
                                                   </div>
                                              </div>
                                         </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>

            {/* Tutorial Modal */}
            {showTutorial && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 transition-opacity" onClick={() => setShowTutorial(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#0B1121] border border-[#639922]/30 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-6 border-b border-slate-800 bg-[var(--color-surface)] relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-[#639922]/10 blur-3xl"></div>
                            <h2 className="text-xl font-bold text-white relative">ContentOS Operations Workflow</h2>
                            <p className="text-xs text-slate-400 mt-1 relative">Step {tutorialStep} of 5</p>
                        </div>
                        <div className="p-8 h-48 flex items-center justify-center text-center">
                            {tutorialStep === 1 && (
                                <div>
                                    <h3 className="font-bold text-[#639922] mb-2 text-lg">Calendar Briefs</h3>
                                    <p className="text-slate-300">SMM hits the <strong>+</strong> icon inside the Calendar Matrix to instantly draft a new channel brief without leaving the map.</p>
                                </div>
                            )}
                            {tutorialStep === 2 && (
                                <div>
                                    <h3 className="font-bold text-[#639922] mb-2 text-lg">Asset Handover</h3>
                                    <p className="text-slate-300">Designer uploads finished assets directly to the Content Drawer. It's stored sequentially on Cloudinary.</p>
                                </div>
                            )}
                            {tutorialStep === 3 && (
                                <div>
                                    <h3 className="font-bold text-[#639922] mb-2 text-lg">Editorial Finalization</h3>
                                    <p className="text-slate-300">Editor verifies the cut, attaches timestamps, and moves the Kanban card to <strong>Ready to Publish</strong>.</p>
                                </div>
                            )}
                            {tutorialStep === 4 && (
                                <div>
                                    <h3 className="font-bold text-[#639922] mb-2 text-lg">One-Click Approval</h3>
                                    <p className="text-slate-300">Vivek or the CMM validates the Drawer brief and sets Approval state to <strong>Final Approved</strong>.</p>
                                </div>
                            )}
                            {tutorialStep === 5 && (
                                <div>
                                    <h3 className="font-bold text-[#639922] mb-2 text-lg">WhatsApp Firing</h3>
                                    <p className="text-slate-300">Admin triggers the WhatsApp notification pushing the exact scheduled time & copy instructions back to the SMM.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-800 flex justify-between gap-3 bg-[var(--color-surface)]/50 items-center">
                            <div className="flex gap-1 ml-4">
                                {[1,2,3,4,5].map(dot => (
                                    <div key={dot} className={`w-2 h-2 rounded-full ${tutorialStep === dot ? 'bg-[#639922]' : 'bg-slate-700'}`}></div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={()=>setShowTutorial(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition">Skip</button>
                                {tutorialStep < 5 ? (
                                    <button onClick={()=>setTutorialStep(c=>c+1)} className="bg-slate-800 text-white px-6 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 transition">Next</button>
                                ) : (
                                    <button onClick={()=>setShowTutorial(false)} className="bg-[#639922] text-white px-6 py-2 rounded-lg text-xs font-bold hover:bg-[#4d7a18] transition">Complete</button>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Onboard Team Modal */}
            {showOnboardModal && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 transition-opacity" onClick={() => setShowOnboardModal(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0B1121] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden transform duration-200">
                        <div className="p-6 border-b border-slate-800 bg-[var(--color-surface)]">
                            <h2 className="text-lg font-bold text-white">Onboard New Team Member</h2>
                            <p className="text-xs text-slate-400 mt-1">Add a new identity to the SciAstra ContentOS platform.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Full Name</label>
                                <input type="text" value={newMember.name} onChange={e=>setNewMember({...newMember, name:e.target.value})} className="w-full bg-[var(--color-surface)] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white" placeholder="e.g. John Doe"/>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">WhatsApp Number</label>
                                <input type="tel" value={newMember.whatsapp} onChange={e=>setNewMember({...newMember, whatsapp:e.target.value})} className="w-full bg-[var(--color-surface)] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white font-mono" placeholder="+91"/>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Platform Role</label>
                                <select value={newMember.role} onChange={e=>setNewMember({...newMember, role:e.target.value})} className="w-full bg-[var(--color-surface)] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white font-bold">
                                    <option value="ADMIN">Administrator</option>
                                    <option value="SMM">Social Manager</option>
                                    <option value="CREATOR">Creator (Editor/Design)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Assigned Channels</label>
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-[var(--color-surface)] border border-slate-800 rounded-lg">
                                    {channelConfig.filter(c=>c.name!=='Exams'&&!c.archived).map(ch => (
                                        <label key={ch.name} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1.5 rounded transition">
                                            <input type="checkbox" checked={newMember.channels.includes(ch.name)} onChange={(e) => {
                                                const checked = e.target.checked;
                                                setNewMember(prev => ({...prev, channels: checked ? [...prev.channels, ch.name] : prev.channels.filter(x=>x!==ch.name)}));
                                            }} className="accent-[#639922] w-3 h-3"/>
                                            <span className="text-xs text-slate-300 truncate" title={ch.name}>{ch.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-[var(--color-surface)]/50">
                            <button onClick={()=>setShowOnboardModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition">Cancel</button>
                            <button disabled={!newMember.name} onClick={() => {
                                const id = newMember.name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random()*1000);
                                updateTeamMember({...newMember, id, active: true});
                                setShowOnboardModal(false);
                                setNewMember({ name: '', role: 'CREATOR', whatsapp: '+91', channels: [] });
                            }} className="bg-[#639922] text-white px-6 py-2 rounded-lg text-xs font-bold hover:bg-[#4d7a18] transition disabled:opacity-50">Save Identity</button>
                        </div>
                    </div>
                </>
            )}

            {/* Global Content Drawer */}
            {selectedItem && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSelectedItem(null)} />
                    <div className="fixed top-0 right-0 w-full max-w-xl h-full bg-[#0B1121] border-l border-slate-800 z-50 flex flex-col shadow-2xl overflow-hidden transform duration-300 ease-out">
                        <header className="p-6 md:p-8 border-b border-slate-800 flex justify-between items-start bg-[var(--color-surface)] relative group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#639922] blur-[100px] opacity-10 pointer-events-none group-hover:opacity-20 transition duration-700"></div>
                            
                            <div className="pr-8 z-10 w-full">
                                <div className="flex justify-between items-center mb-2">
                                     <span className={`text-[10px] font-bold text-white uppercase px-2 py-1 rounded tracking-wider ${getBgClass(selectedItem.channel)}`}>{selectedItem.channel}</span>
                                     <input type="time" defaultValue={selectedItem.scheduledTime} onBlur={e => updateItem(selectedItem, {scheduledTime: e.target.value})} className="bg-transparent text-slate-400 text-xs font-mono outline-none hover:text-white transition" />
                                </div>
                                <div className="relative">
                                    <textarea 
                                        defaultValue={selectedItem.title} 
                                        onBlur={(e) => updateItem(selectedItem, {title: e.target.value})} 
                                        className={`w-full bg-transparent font-black text-xl md:text-2xl leading-tight resize-none outline-none focus:border-b border-slate-700 ${titleError ? 'border-b border-red-500 pb-1' : ''}`} 
                                        rows={2}
                                        placeholder="Enter Content Title..."
                                    />
                                    {titleError && <span className="absolute bottom-[-16px] left-0 text-red-500 text-[10px] font-bold">Title is required</span>}
                                </div>
                                {selectedItem.campaignId && <span className="text-purple-400 text-xs font-bold uppercase tracking-wider block mt-2">&rarr; {campaigns.find(c=>c.id===selectedItem.campaignId)?.name || 'Campaign'}</span>}
                            </div>
                            {/* Header actions: Saved indicator + close */}
                            <div className="flex flex-col items-end gap-2 z-10 shrink-0">
                                <button onClick={() => setSelectedItem(null)} className="text-slate-500 hover:text-white text-3xl leading-none transition">&times;</button>
                                <div className={`flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${
                                    savedToast 
                                        ? 'text-[#639922] opacity-100 translate-y-0' 
                                        : 'text-transparent opacity-0 translate-y-1'
                                }`}>
                                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 6l3.5 3.5L11 2" stroke="#639922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    Saved
                                </div>
                            </div>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                            
                            {/* Detailed Brief Section */}
                            {selectedItem.type !== 'Exam' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Pipeline State</label>
                                            <select 
                                                value={selectedItem.status} 
                                                onChange={(e) => updateItem(selectedItem, {status: e.target.value})} 
                                                className="w-full bg-[var(--color-surface)] border border-slate-700 text-white rounded-lg p-2.5 text-sm font-bold outline-none focus:border-[#639922] cursor-pointer"
                                            >
                                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Internal Approval</label>
                                            <select 
                                                value={selectedItem.approval || 'Pending'} 
                                                onChange={(e) => updateItem(selectedItem, {approval: e.target.value})} 
                                                className={`w-full border rounded-lg p-2.5 text-sm font-bold outline-none cursor-pointer ${selectedItem.approval === 'Approved' ? 'bg-green-900/30 border-green-500/50 text-green-400' : 'bg-[var(--color-surface)] border-slate-700 text-white'}`}
                                            >
                                                <option value="Pending">🟡 Pending Review</option>
                                                <option value="Approved">🟢 Final Approved</option>
                                                <option value="Changes Requested">🔴 Changes Required</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Campaign field with Standalone option + Create New */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Campaign</label>
                                        <select
                                            value={selectedItem.campaignId || ''}
                                            onChange={(e) => {
                                                if (e.target.value === '__create__') {
                                                    setShowNewCampaignModal(true);
                                                } else {
                                                    updateItem(selectedItem, { campaignId: e.target.value || undefined });
                                                }
                                            }}
                                            className="w-full bg-[var(--color-surface)] border border-slate-700 text-white rounded-lg p-2.5 text-sm font-bold outline-none focus:border-[#639922] cursor-pointer"
                                        >
                                            <option value="">Standalone Post (No Campaign)</option>
                                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            <option value="__create__">✚ Create New Campaign...</option>
                                        </select>
                                    </div>

                                    <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-5 shadow-inner shadow-black/20">
                                        <div className="flex justify-between items-center mb-6">
                                            <label className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${getBgClass(selectedItem.channel).split(' ')[0].replace('/30','')}`}></div> Active Content Brief</label>
                                            <button
                                                onClick={() => {
                                                    setBriefTitle(selectedItem.title || '');
                                                    setBriefChannel(selectedItem.channel || '');
                                                    setBriefResult(null);
                                                    setShowAiBriefModal(true);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#639922]/15 border border-[#639922]/30 hover:bg-[#639922]/25 hover:border-[#639922]/60 text-[#639922] text-[11px] font-bold tracking-wide transition"
                                            >
                                                ✨ Brief with AI
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {/* YouTube channels: Title + SEO + Thumbnail (YouTube-only) */}
                                            {(selectedItem.channel.includes('English') || selectedItem.channel.includes('Vivek')) ? (
                                                <>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">YouTube Title</label><input type="text" className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm text-white" defaultValue={selectedItem.title} /></div>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">SEO Description &amp; Links</label><textarea className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm h-24 text-white custom-scrollbar" placeholder="Download App link..." /></div>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">Thumbnail Aesthetic Brief</label><input type="text" className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm text-white" placeholder="Describe the thumbnail style, colors, and key elements..." /></div>
                                                </>
                                            ) : selectedItem.channel.includes('Whatsapp') ? (
                                                /* WhatsApp: only broadcast copy */
                                                <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold flex justify-between block"><span>Broadcast Copy</span><span>160 char suggested limit</span></label><textarea className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm h-32 text-white custom-scrollbar" placeholder="🚨 Warrior alert! Today we launch..." /></div>
                                            ) : selectedItem.channel.includes('Ad') ? (
                                                /* Ad Campaigns: headline + copy + CTA */
                                                <>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">Ad Headline</label><input type="text" className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm text-white" placeholder="Stop scrolling. IAT in 12 days." /></div>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">Ad Copy</label><textarea className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm h-20 text-white custom-scrollbar" placeholder="Full details about the campaign..." /></div>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">CTA Button Text</label><input type="text" className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm text-white" placeholder="Enroll Now" /></div>
                                                </>
                                            ) : (
                                                /* Instagram/other: Hook + Caption + Hashtags (no SEO) */
                                                <>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">First 3 Second Hook (Reel)</label><input type="text" className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm text-white" placeholder="Do you know the secret of NISER?" /></div>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">Instagram Caption</label><textarea className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm h-20 text-white custom-scrollbar" placeholder="Full details below..." /></div>
                                                    <div><label className="text-[10px] uppercase text-slate-500 mb-1 font-bold block">Hashtags</label><input type="text" className="w-full bg-[#0B1121] border border-slate-800 rounded-lg p-3 text-sm text-slate-300" defaultValue="#SciAstra #IISER" /></div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {/* Assigned SMM — live dropdown from DB */}
                                        <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-4">
                                             <label className="text-[10px] uppercase text-slate-500 mb-2 font-bold block text-center">Assigned SMM</label>
                                             <div className="flex items-center gap-2">
                                                 <div className="w-7 h-7 rounded-full bg-blue-900 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">{(selectedItem.assignees?.smm || '?').charAt(0)}</div>
                                                 <select value={selectedItem.assignees?.smm || ''} onChange={(e) => updateItem(selectedItem, { assignees: { ...selectedItem.assignees, smm: e.target.value } })} className="flex-1 min-w-0 bg-[#0B1121] border border-slate-800 rounded-lg p-1.5 text-xs font-bold text-white outline-none focus:border-[#639922] cursor-pointer">
                                                     <option value="">Unassigned</option>
                                                     {team.filter(t => t.role === 'SMM' && t.active !== false).map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                                                 </select>
                                             </div>
                                        </div>
                                        {/* Assigned Editor — CREATOR role only (not Designer) */}
                                        <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-4">
                                             <label className="text-[10px] uppercase text-slate-500 mb-2 font-bold block text-center">Assigned Editor</label>
                                             <div className="flex items-center gap-2">
                                                 <div className="w-7 h-7 rounded-full bg-orange-900 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">{(selectedItem.assignees?.editor || '?').charAt(0)}</div>
                                                 <select value={selectedItem.assignees?.editor || ''} onChange={(e) => updateItem(selectedItem, { assignees: { ...selectedItem.assignees, editor: e.target.value } })} className="flex-1 min-w-0 bg-[#0B1121] border border-slate-800 rounded-lg p-1.5 text-xs font-bold text-white outline-none focus:border-[#639922] cursor-pointer">
                                                     <option value="">Unassigned</option>
                                                     {team.filter(t => t.role === 'CREATOR' && t.active !== false && t.name !== 'Bhupendra').map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                                                 </select>
                                             </div>
                                        </div>
                                        {/* Assigned Designer — Bhupendra + Vivek K */}
                                        <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-4">
                                             <label className="text-[10px] uppercase text-slate-500 mb-2 font-bold block text-center">Assigned Designer</label>
                                             <div className="flex items-center gap-2">
                                                 <div className="w-7 h-7 rounded-full bg-pink-900 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">{(selectedItem.assignees?.designer || '?').charAt(0)}</div>
                                                 <select value={selectedItem.assignees?.designer || ''} onChange={(e) => updateItem(selectedItem, { assignees: { ...selectedItem.assignees, designer: e.target.value } })} className="flex-1 min-w-0 bg-[#0B1121] border border-slate-800 rounded-lg p-1.5 text-xs font-bold text-white outline-none focus:border-[#639922] cursor-pointer">
                                                     <option value="">Unassigned</option>
                                                     {team.filter(t => (t.name === 'Bhupendra' || t.name === 'Vivek K') && t.active !== false).map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                                                     {/* Hardcode fallback in case DB doesn't have them yet */}
                                                     {!team.find(t => t.name === 'Bhupendra') && <option value="Bhupendra">Bhupendra</option>}
                                                     {!team.find(t => t.name === 'Vivek K') && <option value="Vivek K">Vivek K</option>}
                                                 </select>
                                             </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800/50">
                                         <label className="text-[10px] uppercase text-slate-500 mb-2 font-bold flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Google Drive Assets Link</label>
                                         <input type="text" defaultValue={selectedItem.driveLink} onBlur={(e) => updateItem(selectedItem, {driveLink: e.target.value})} className="w-full bg-[#0B1121] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-[#3b82f6]" placeholder="Paste link to raw footage or final render..." />
                                     </div>

                                     <div className="pt-4 mt-4 border-t border-slate-800/50">
                                         <label className="text-[10px] uppercase text-slate-500 mb-2 font-bold flex items-center gap-2">Cloudinary Asset Handover</label>
                                         <div className="space-y-3">
                                             {((selectedItem as any).assets || []).map((ast: any, idx: number) => (
                                                 <div key={idx} className="flex items-center justify-between bg-[#0B1121] border border-slate-800 p-3 rounded-lg overflow-hidden">
                                                     <div className="flex flex-col w-2/3 truncate">
                                                         <a href={ast.url} target="_blank" rel="noreferrer" className="text-xs text-slate-300 font-bold truncate hover:text-[#639922] transition w-full underline">{ast.name}</a>
                                                         <span className="text-[9px] text-slate-500 font-mono mt-0.5">Secure CDN Sync</span>
                                                     </div>
                                                     <select
                                                         className={`text-[10px] font-bold rounded px-2 py-1 outline-none ${ast.status === 'Approved' ? 'bg-green-900/30 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
                                                         value={ast.status}
                                                         onChange={(e) => {
                                                             const newAssets = [...((selectedItem as any).assets || [])];
                                                             newAssets[idx].status = e.target.value;
                                                             updateItem(selectedItem, { assets: newAssets } as any);
                                                         }}
                                                     >
                                                         <option value="Uploaded">Uploaded</option>
                                                         <option value="Approved">Approved</option>
                                                     </select>
                                                 </div>
                                             ))}
                                             
                                             <label className="cursor-pointer flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-700 hover:border-[#639922] hover:bg-[#639922]/5 rounded-lg transition group">
                                                 <span className="text-xs font-bold text-slate-500 group-hover:text-[#639922] uppercase tracking-wider flex items-center gap-2">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                    Upload Asset file
                                                 </span>
                                                 <input type="file" className="hidden" onChange={handleFileUpload} />
                                             </label>
                                         </div>
                                    </div>

                                    <div className="pt-4">
                                         <label className="text-[10px] uppercase text-slate-500 mb-2 font-bold flex items-center gap-2">Internal Notes</label>
                                         <textarea defaultValue={selectedItem.notes} onBlur={(e) => updateItem(selectedItem, {notes: e.target.value})} className="w-full bg-[#0B1121] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm h-20 text-slate-300 custom-scrollbar" placeholder="Any specific requirements for the team?" />
                                    </div>
                                </div>
                            )}

                            {/* Accountability Layer */}
                            {selectedItem.type !== 'Exam' && (
                                <div className="border-t border-slate-800/50 pt-8 mt-8 relative">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Execution Audit Trail</h4>
                                    <div className="space-y-4 pl-3 relative before:absolute before:inset-0 before:ml-[1.4rem] before:h-full before:w-[2px] before:bg-slate-800">
                                        {selectedItem.auditLog && selectedItem.auditLog.length > 0 ? selectedItem.auditLog.map((log, idx) => (
                                            <div key={idx} className="relative flex items-start gap-4">
                                                <div className="w-8 h-8 rounded-full border border-slate-700 bg-[var(--color-surface)] text-slate-300 flex items-center justify-center font-bold text-[10px] z-10 shrink-0">{log.user.charAt(0)}</div>
                                                <div className="flex flex-col pt-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-200 text-xs">{log.user}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                                                    </div>
                                                    <span className="text-slate-400 text-xs mt-1 leading-relaxed bg-[#0B1121] px-3 py-1.5 rounded-md border border-slate-800/50">{log.action}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <span className="text-xs text-slate-600 block pl-8 italic font-medium">System initialized. Awaiting trackable actions.</span>
                                        )}
                                    </div>

                                    {/* Action History / Webhook logs */}
                                    <h4 className="text-xs font-bold text-[#25D366] uppercase tracking-widest mb-6 mt-10">WATI Transmission Logs</h4>
                                    <div className="space-y-4 pl-3 relative before:absolute before:inset-0 before:ml-[1.4rem] before:h-full before:w-[2px] before:bg-green-900/40">
                                        {notifications.filter((n: any) => n.taskId === selectedItem.id).length > 0 ? notifications.filter((n: any) => n.taskId === selectedItem.id).map((log: any, idx: number) => (
                                            <div key={idx} className="relative flex items-start gap-4">
                                                <div className="w-8 h-8 rounded-full border border-green-500/50 bg-[#0B1121] text-green-400 flex items-center justify-center font-bold z-10 shrink-0">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.525.146-.18.194-.3.297-.495.098-.21.05-.39-.024-.54-.075-.15-.673-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.21 2.095 3.18 5.077 4.455.71.3 1.264.48 1.693.615.714.225 1.365.195 1.874.12.576-.09 1.767-.72 2.016-1.426.248-.705.248-1.305.174-1.425-.074-.12-.274-.195-.575-.345h-.001zm-5.46-11.83C7.545 2.551 3.87 6.226 3.87 10.718c0 1.487.352 2.923 1.059 4.221l-1.472 5.378 5.5-1.442c1.233.644 2.65 1.002 4.081 1.002h.004c4.493 0 8.167-3.674 8.168-8.167 0-2.175-.845-4.22-2.383-5.759-1.536-1.54-3.582-2.386-5.76-2.388h-.001-.001zM11.996 2h.001A9.972 9.972 0 0 1 22 11.998c0 2.67-1.04 5.178-2.927 7.067C17.185 20.952 14.673 22 12.001 22h-.004c-1.696 0-3.344-.43-4.81-1.246l-.348-.194-3.568.936.953-3.48-.21-.334A9.977 9.977 0 0 1 2 11.998C2 6.484 6.48 2 11.996 2z"/></svg>
                                                </div>
                                                <div className="flex flex-col pt-0.5 w-full">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-bold text-slate-200 text-xs truncate max-w-[150px]">{log.recipientName} ({log.whatsappNumber})</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                                                    </div>
                                                    <span className="text-slate-400 text-[10px] mt-1 leading-relaxed bg-[#0B1121] px-3 py-1.5 rounded-md border border-slate-800/50 block">"{log.message}"</span>
                                                    <span className={`text-[10px] block mt-1.5 font-bold font-mono tracking-wide ${log.status.includes('Sent') ? 'text-green-500' : 'text-orange-500'}`}>{log.status}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <span className="text-xs text-slate-600 block pl-8 italic font-medium">No WhatsApp messages fired for this component.</span>
                                        )}
                                    </div>

                                    {/* Notify Teams Panel */}
                                    <div className="mt-8 pt-6 border-t border-slate-800/50">
                                        <button
                                            onClick={() => { setShowNotifyPanel(p => !p); setNotifyResult(''); }}
                                            className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition border text-sm ${
                                                showNotifyPanel
                                                    ? 'bg-indigo-900/30 border-indigo-500/40 text-indigo-300'
                                                    : 'bg-indigo-900/10 border-indigo-500/20 hover:bg-indigo-900/25 hover:border-indigo-500/40 text-indigo-400'
                                            }`}
                                        >
                                            <span className="text-base">📢</span> Notify Teams
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${showNotifyPanel ? 'rotate-180' : ''}`}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>

                                        {showNotifyPanel && (() => {
                                            const TEAMS = [
                                                { key: 'marketing',  label: 'Marketing Team' },
                                                { key: 'sales',      label: 'Sales Team' },
                                                { key: 'operations', label: 'Operations Team' },
                                                { key: 'academic',   label: 'Academic / Faculty Team' },
                                                { key: 'founders',   label: 'Founders' },
                                            ];
                                            const MSG_TYPES = [
                                                { key: 'batch_live',    label: 'Batch announcement going live — prepare for enquiry spike' },
                                                { key: 'result_post',   label: 'Result / achievement post' },
                                                { key: 'campaign_align',label: 'Campaign launching — all teams align' },
                                                { key: 'urgent_review', label: 'Urgent content change — please review' },
                                                { key: 'custom',        label: 'Custom message…' },
                                            ];
                                            const buildPreview = (): string => {
                                                const teamLabels = notifyTeams.map(t => TEAMS.find(x => x.key === t)?.label || t).join(', ') || '[select teams]';
                                                const dateStr = selectedItem?.date ? new Date(selectedItem.date).toDateString() : 'TBD';
                                                const time = selectedItem?.scheduledTime || '–';
                                                if (notifyMessageType === 'custom') return notifyCustomMsg || '(type your message above)';
                                                const templates: Record<string, string> = {
                                                    batch_live:    `Hi ${teamLabels}, a new ${selectedItem?.channel || ''} post is going live on ${dateStr} at ${time}: "${selectedItem?.title || ''}". Please prepare for increased enquiries. — SciAstra MarketingOS`,
                                                    result_post:   `Hi ${teamLabels}, a result/achievement post is scheduled: "${selectedItem?.title || ''}" (${selectedItem?.channel || ''}) on ${dateStr}. Stand by for engagement. — SciAstra MarketingOS`,
                                                    campaign_align:`Hi ${teamLabels}, campaign content "${selectedItem?.title || ''}" is launching on ${dateStr}. All teams please align your workflows accordingly. — SciAstra MarketingOS`,
                                                    urgent_review: `URGENT — Hi ${teamLabels}, the content "${selectedItem?.title || ''}" requires an immediate review. Please check SciAstra ContentOS now. — SciAstra MarketingOS`,
                                                };
                                                return templates[notifyMessageType] || '';
                                            };
                                            const sendNotification = async () => {
                                                if (!notifyTeams.length) { setNotifyResult('⚠ Select at least one team'); return; }
                                                setNotifySending(true);
                                                setNotifyResult('');
                                                try {
                                                    const res = await fetch('/api/notify-teams', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            teams: notifyTeams,
                                                            channel: notifyChannel,
                                                            message: buildPreview(),
                                                            subject: `[ContentOS] ${selectedItem?.title || 'Update'}`,
                                                            itemTitle: selectedItem?.title,
                                                            itemChannel: selectedItem?.channel,
                                                            scheduledDate: selectedItem?.date,
                                                        }),
                                                    });
                                                    const data = await res.json();
                                                    setNotifyResult(data.success ? '✅ Notifications sent!' : '❌ Send failed');
                                                    setTimeout(() => { setShowNotifyPanel(false); setNotifyResult(''); setNotifyTeams([]); }, 2500);
                                                } catch {
                                                    setNotifyResult('❌ Network error');
                                                } finally {
                                                    setNotifySending(false);
                                                }
                                            };
                                            return (
                                                <div className="mt-3 bg-[#0B1121] border border-indigo-500/20 rounded-xl p-4 space-y-4">
                                                    {/* Team selection */}
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Select Teams to Notify</p>
                                                        <div className="space-y-1.5">
                                                            {TEAMS.map(t => (
                                                                <label key={t.key} className="flex items-center gap-2.5 cursor-pointer group">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={notifyTeams.includes(t.key)}
                                                                        onChange={e => setNotifyTeams(prev =>
                                                                            e.target.checked ? [...prev, t.key] : prev.filter(x => x !== t.key)
                                                                        )}
                                                                        className="accent-indigo-500 w-3.5 h-3.5"
                                                                    />
                                                                    <span className="text-sm text-slate-300 group-hover:text-white transition">{t.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Channel */}
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Channel</p>
                                                        <div className="flex flex-col gap-1.5">
                                                            {[
                                                                { value: 'zoho',  label: 'Zoho Mail', enabled: zohoEnabled },
                                                                { value: 'wati',  label: 'WhatsApp (WATI)', enabled: watiEnabled },
                                                                { value: 'both',  label: 'Both', enabled: zohoEnabled || watiEnabled },
                                                            ].map(opt => (
                                                                <label key={opt.value} className={`flex items-center gap-2.5 ${opt.enabled ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                                                                    <input
                                                                        type="radio"
                                                                        name="notifyCh"
                                                                        value={opt.value}
                                                                        checked={notifyChannel === opt.value}
                                                                        disabled={!opt.enabled}
                                                                        onChange={() => setNotifyChannel(opt.value as 'zoho'|'wati'|'both')}
                                                                        className="accent-indigo-500"
                                                                    />
                                                                    <span className="text-sm text-slate-300">{opt.label}</span>
                                                                    {!opt.enabled && opt.value !== 'both' && (
                                                                        <span className="text-[9px] text-slate-500 italic">(not configured)</span>
                                                                    )}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Message type */}
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Message Type</p>
                                                        <select
                                                            value={notifyMessageType}
                                                            onChange={e => setNotifyMessageType(e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg p-2.5 outline-none focus:border-indigo-500 cursor-pointer"
                                                        >
                                                            {MSG_TYPES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                                        </select>
                                                        {notifyMessageType === 'custom' && (
                                                            <textarea
                                                                value={notifyCustomMsg}
                                                                onChange={e => setNotifyCustomMsg(e.target.value)}
                                                                rows={3}
                                                                placeholder="Type your message..."
                                                                className="w-full mt-2 bg-slate-900 border border-slate-700 text-sm text-white rounded-lg p-2.5 outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Preview */}
                                                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3">
                                                        <p className="text-[9px] uppercase text-slate-500 mb-1.5 font-bold tracking-wider">Preview</p>
                                                        <p className="text-xs text-slate-300 leading-relaxed italic">{buildPreview()}</p>
                                                    </div>

                                                    {/* Result / Actions */}
                                                    {notifyResult && <p className="text-xs font-bold text-center py-1">{notifyResult}</p>}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => { setShowNotifyPanel(false); setNotifyTeams([]); setNotifyResult(''); }}
                                                            className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-bold hover:bg-slate-800 transition"
                                                        >Cancel</button>
                                                        <button
                                                            onClick={sendNotification}
                                                            disabled={notifySending || !notifyTeams.length || (!zohoEnabled && !watiEnabled)}
                                                            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {notifySending ? 'Sending…' : 'Send Notification'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Webhook Action Trigger */}
                                    <div className="mt-8 pt-6 border-t border-slate-800/50">
                                        <button onClick={() => triggerWhatsApp(selectedItem)} className="w-full bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 hover:border-[#25D366]/50 text-[#25D366] font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition shadow-lg">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.525.146-.18.194-.3.297-.495.098-.21.05-.39-.024-.54-.075-.15-.673-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.21 2.095 3.18 5.077 4.455.71.3 1.264.48 1.693.615.714.225 1.365.195 1.874.12.576-.09 1.767-.72 2.016-1.426.248-.705.248-1.305.174-1.425-.074-.12-.274-.195-.575-.345h-.001zm-5.46-11.83C7.545 2.551 3.87 6.226 3.87 10.718c0 1.487.352 2.923 1.059 4.221l-1.472 5.378 5.5-1.442c1.233.644 2.65 1.002 4.081 1.002h.004c4.493 0 8.167-3.674 8.168-8.167 0-2.175-.845-4.22-2.383-5.759-1.536-1.54-3.582-2.386-5.76-2.388h-.001-.001zM11.996 2h.001A9.972 9.972 0 0 1 22 11.998c0 2.67-1.04 5.178-2.927 7.067C17.185 20.952 14.673 22 12.001 22h-.004c-1.696 0-3.344-.43-4.81-1.246l-.348-.194-3.568.936.953-3.48-.21-.334A9.977 9.977 0 0 1 2 11.998C2 6.484 6.48 2 11.996 2z"/></svg>
                                            Trigger WhatsApp Workflow Sync
                                        </button>
                                        <p className="text-[9px] text-slate-500 text-center mt-2 font-medium">Sends payload to internal webhook simulating WATI integration.</p>
                                    </div>

                                    {/* Fix 2: Delete Post — ADMIN only */}
                                    {role === 'ADMIN' && selectedItem.id !== 'new' && (
                                        <div className="mt-8 pt-6 border-t border-red-900/30">
                                            {!deleteConfirm ? (
                                                <button
                                                    onClick={() => setDeleteConfirm(true)}
                                                    className="w-full bg-red-950/30 border border-red-500/20 hover:bg-red-900/30 hover:border-red-500/40 text-red-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition text-sm"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                                    Delete Post
                                                </button>
                                            ) : (
                                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 space-y-3">
                                                    <p className="text-red-300 text-sm font-bold text-center">Delete this post permanently?</p>
                                                    <p className="text-red-400/70 text-xs text-center">This cannot be undone.</p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-bold hover:bg-slate-800 transition">Cancel</button>
                                                        <button
                                                            onClick={async () => {
                                                                await fetch(`/api/db?id=${selectedItem.id}`, { method: 'DELETE' });
                                                                setSelectedItem(null);
                                                                setDeleteConfirm(false);
                                                                await refreshData();
                                                            }}
                                                            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-black transition"
                                                        >Confirm Delete</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ── AI Brief Studio — Full-screen modal ─────────────────────── */}
            {showAiBriefModal && (
                <div
                    className="fixed inset-0 z-[9999] flex flex-col"
                    style={{
                        background: '#0B1121',
                        animation: 'aiBriefSlideUp 250ms ease-out both',
                    }}
                >
                    <style>{`
                        @keyframes aiBriefSlideUp {
                            from { opacity: 0; transform: translateY(32px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                        .ai-col-scroll::-webkit-scrollbar { width: 4px; }
                        .ai-col-scroll::-webkit-scrollbar-track { background: transparent; }
                        .ai-col-scroll::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
                        .score-bar-fill { transition: width 1s cubic-bezier(0.16,1,.3,1); }
                    `}</style>

                    {/* Header */}
                    <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0B1121]">
                        <div className="flex items-center gap-2 text-[#639922] font-black text-sm tracking-wide">
                            <span className="text-base">✨</span> AI Brief Studio
                        </div>
                        <input
                            value={briefTitle}
                            onChange={e => setBriefTitle(e.target.value)}
                            className="hidden md:block flex-1 max-w-xs mx-8 bg-transparent border-b border-slate-700 focus:border-[#639922] outline-none text-white text-sm font-bold text-center pb-1 placeholder:text-slate-600 transition"
                            placeholder="Content item title…"
                        />
                        <button
                            onClick={() => setShowAiBriefModal(false)}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-bold transition px-3 py-1.5 rounded-lg hover:bg-slate-800"
                        >
                            <span className="text-lg leading-none">×</span> Close
                        </button>
                    </header>

                    {/* Body — two-column on desktop, single column on mobile */}
                    <div className="flex-1 flex overflow-hidden flex-col md:flex-row">

                        {/* ── LEFT COLUMN ── */}
                        <div className="md:w-1/2 flex flex-col border-r border-slate-800/60 overflow-hidden">
                            <div className="flex-1 overflow-y-auto ai-col-scroll px-6 py-6 space-y-6 pb-24 md:pb-6">

                                {/* Trending Now panel */}
                                <div className="rounded-xl border border-slate-800 overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-800/60 transition text-left"
                                        onClick={() => setTrendsOpen(o => !o)}
                                    >
                                        <span className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest">
                                            🔥 Trending Now <span className="text-[#639922] font-mono text-[10px] normal-case font-normal">in science education</span>
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-slate-500 transition-transform ${trendsOpen ? 'rotate-180' : ''}`}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </button>
                                    {trendsOpen && (
                                        <div className="px-4 py-3 space-y-2 bg-[#0d1526]">
                                            {[
                                                { tag: '#JEE2026', heat: 92, note: 'Exam season approaching' },
                                                { tag: '#NITVsIISER', heat: 78, note: 'Debate trending on X' },
                                                { tag: '#ScienceCareer', heat: 71, note: 'Evergreen, high share rate' },
                                                { tag: '#AIinEducation', heat: 65, note: 'Cross-niche opportunity' },
                                                { tag: '#CollegeAdmissions', heat: 60, note: 'Parent audience spike' },
                                            ].map(t => (
                                                <div key={t.tag} className="flex items-center gap-3">
                                                    <span
                                                        className="text-[11px] font-bold text-[#639922] cursor-pointer hover:text-white transition shrink-0"
                                                        onClick={() => setBriefKeyPoints(k => k ? `${k}, ${t.tag}` : t.tag)}
                                                        title="Click to add to brief"
                                                    >{t.tag}</span>
                                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-[#639922]/70 rounded-full" style={{ width: `${t.heat}%` }} />
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 shrink-0">{t.heat}</span>
                                                    <span className="text-[10px] text-slate-600 hidden lg:block shrink-0">{t.note}</span>
                                                </div>
                                            ))}
                                            <p className="text-[10px] text-slate-600 pt-1">Click a tag to add it to key points ↑</p>
                                        </div>
                                    )}
                                </div>

                                {/* Brief form */}
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brief Details</p>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-slate-500 font-bold block">Content Title</label>
                                        <input value={briefTitle} onChange={e => setBriefTitle(e.target.value)}
                                            className="w-full bg-[#0d1526] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white placeholder:text-slate-600 transition"
                                            placeholder="e.g. Why NISER is India's best science college" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-slate-500 font-bold block">Channel</label>
                                            <select value={briefChannel} onChange={e => setBriefChannel(e.target.value)}
                                                className="w-full bg-[#0d1526] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-2.5 text-sm text-white cursor-pointer transition">
                                                <option value="">Select…</option>
                                                {channelConfig.filter(c => !c.archived).map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-slate-500 font-bold block">Tone</label>
                                            <select value={briefTone} onChange={e => setBriefTone(e.target.value)}
                                                className="w-full bg-[#0d1526] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-2.5 text-sm text-white cursor-pointer transition">
                                                {['Educate & Inspire', 'Hype & Urgency', 'Storytelling', 'Debate & Hook', 'Motivational', 'Data-Driven'].map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-slate-500 font-bold block">Content Goal</label>
                                        <input value={briefGoal} onChange={e => setBriefGoal(e.target.value)}
                                            className="w-full bg-[#0d1526] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white placeholder:text-slate-600 transition"
                                            placeholder="e.g. Drive app downloads, grow subscribers, generate leads" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-slate-500 font-bold block">Target Audience</label>
                                        <input value={briefAudience} onChange={e => setBriefAudience(e.target.value)}
                                            className="w-full bg-[#0d1526] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white placeholder:text-slate-600 transition"
                                            placeholder="e.g. Class 11-12 students preparing for JEE/NEET" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-slate-500 font-bold block">Key Points / Context</label>
                                        <textarea value={briefKeyPoints} onChange={e => setBriefKeyPoints(e.target.value)}
                                            rows={3}
                                            className="w-full bg-[#0d1526] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white placeholder:text-slate-600 resize-none transition custom-scrollbar"
                                            placeholder="Key facts, angles, data points, or trending tags to include…" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-slate-500 font-bold block">Desired CTA</label>
                                        <input value={briefCTA} onChange={e => setBriefCTA(e.target.value)}
                                            className="w-full bg-[#0d1526] border border-slate-800 focus:border-[#639922] outline-none rounded-lg p-3 text-sm text-white placeholder:text-slate-600 transition"
                                            placeholder="e.g. Download app, Comment below, Share with a friend" />
                                    </div>
                                </div>
                            </div>

                            {/* Generate button — sticky at bottom of left column */}
                            <div className="shrink-0 px-6 py-4 border-t border-slate-800 bg-[#0B1121]">
                                <button
                                    disabled={briefGenerating || !briefTitle.trim()}
                                    onClick={async () => {
                                        if (!briefTitle.trim()) return;
                                        setBriefGenerating(true);
                                        setBriefResult(null);
                                        // Simulated generation (replace with real API call when ready)
                                        await new Promise(r => setTimeout(r, 1800));
                                        const ch = briefChannel.toLowerCase();
                                        const isYT = ch.includes('english') || ch.includes('vivek') || ch.includes('12th') || ch.includes('11th') || ch.includes('college');
                                        const isIG = ch.includes('instagram');
                                        setBriefResult({
                                            hook: isYT
                                                ? `This one fact about ${briefTitle} will change how you study for JEE — most toppers never talk about this.`
                                                : isIG
                                                ? `POV: You just discovered the secret that NISER students don't share publicly 👀`
                                                : `🚨 ${briefTitle} — everything you need to know in under 60 seconds.`,
                                            caption: isIG
                                                ? `${briefTitle}\n\nMost ${briefAudience || 'students'} have no idea about this.\n\n${briefKeyPoints ? `Key insight: ${briefKeyPoints.split(',')[0]}\n\n` : ''}Save this post before it disappears from your feed.\n\n${briefCTA || 'Drop a 🔥 if this was helpful!'}`
                                                : `${briefTitle}\n\n${briefGoal ? `Our goal: ${briefGoal}` : 'Watch till the end — the last point changes everything.'}\n\n${briefCTA || 'Subscribe for more science content!'}`,
                                            hashtags: isIG
                                                ? '#SciAstra #JEE2026 #NITvIISER #ScienceEducation #IndianStudents #StudyMotivation'
                                                : '#SciAstra #Education #JEE #NEET #ScienceIndia',
                                            cta: briefCTA || (isYT ? 'Subscribe & hit the bell 🔔' : 'Save + share with a friend who needs this 📲'),
                                            angles: [
                                                `The Shock Angle: Lead with a counter-intuitive stat about ${briefTitle.split(' ').slice(0,3).join(' ')}`,
                                                `The Story Angle: One student's journey — before and after discovering this`,
                                                `The Debate Angle: "${briefTitle} — overrated or underrated?" — invite opinions`,
                                                `The Data Angle: Hard numbers that prove the point within 5 seconds`,
                                                `The FOMO Angle: "Most students find out too late — don't be one of them"`,
                                            ],
                                            thumbnail: isYT
                                                ? `Bold text overlay: "${briefTitle.split(' ').slice(0,4).join(' ').toUpperCase()}" — dark background, high-contrast neon accent, shocked/serious face expression, SciAstra logo bottom-right`
                                                : `Carousel cover: clean white card, bold headline text, SciAstra brand color accent strip`,
                                            scores: { hook: 8, trend: 7, cta: 9, fit: 8, overall: 80 },
                                        });
                                        setBriefGenerating(false);
                                    }}
                                    className="w-full py-3.5 rounded-xl font-black text-sm tracking-wide transition flex items-center justify-center gap-2
                                        bg-[#639922] hover:bg-[#4d7a18] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {briefGenerating ? (
                                        <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round"/></svg> Generating…</>
                                    ) : (
                                        <><span>✨</span> Generate Brief</>
                                    )}
                                </button>
                                {!briefTitle.trim() && <p className="text-[10px] text-slate-600 text-center mt-2">Add a content title to generate</p>}
                            </div>
                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div className="md:w-1/2 overflow-y-auto ai-col-scroll px-6 py-6 space-y-6">
                            {!briefResult && !briefGenerating ? (
                                /* Empty state */
                                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mb-5 opacity-20">
                                        <rect x="8" y="16" width="48" height="36" rx="6" stroke="#639922" strokeWidth="2"/>
                                        <path d="M20 28h24M20 36h16" stroke="#639922" strokeWidth="2" strokeLinecap="round"/>
                                        <path d="M44 8l4 4-4 4M50 12H40" stroke="#639922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <p className="text-slate-500 font-bold text-sm">Your brief will appear here</p>
                                    <p className="text-slate-700 text-xs mt-1 max-w-[200px]">Fill in the form and hit Generate Brief</p>
                                </div>
                            ) : briefGenerating ? (
                                /* Loading state */
                                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-4">
                                    <svg className="animate-spin text-[#639922]" width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round"/></svg>
                                    <p className="text-slate-400 text-sm font-bold">Analysing channel, tone, trends…</p>
                                    <p className="text-slate-600 text-xs">Building 5 content angles for you</p>
                                </div>
                            ) : briefResult && (
                                /* Results */
                                <div className="space-y-6">

                                    {/* Score bars */}
                                    <div className="bg-[#0d1526] border border-slate-800 rounded-xl p-5">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Content Score</p>
                                        <div className="space-y-3">
                                            {[
                                                { label: 'Hook strength',   val: briefResult.scores.hook,  max: 10, pct: briefResult.scores.hook * 10 },
                                                { label: 'Trend alignment', val: briefResult.scores.trend, max: 10, pct: briefResult.scores.trend * 10 },
                                                { label: 'CTA clarity',     val: briefResult.scores.cta,   max: 10, pct: briefResult.scores.cta * 10 },
                                                { label: 'Platform fit',    val: briefResult.scores.fit,   max: 10, pct: briefResult.scores.fit * 10 },
                                            ].map(s => (
                                                <div key={s.label} className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400 w-32 shrink-0">{s.label}</span>
                                                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="score-bar-fill h-full bg-[#639922] rounded-full" style={{ width: `${s.pct}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-white w-8 text-right">{s.val}/10</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                                            <span className="text-xs text-slate-400 font-bold">Overall</span>
                                            <span className="text-2xl font-black text-[#639922]">{briefResult.scores.overall}<span className="text-sm text-slate-500 font-normal">/100</span></span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 text-right">
                                            {briefResult.scores.overall >= 80 ? '— Strong brief. Ready to shoot.' : briefResult.scores.overall >= 60 ? '— Solid. Consider refining the hook.' : '— Needs more context. Add key points.'}
                                        </p>
                                    </div>

                                    {/* Hook */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Hook</p>
                                            <button onClick={() => navigator.clipboard.writeText(briefResult.hook)} className="text-[10px] text-slate-600 hover:text-[#639922] transition font-bold">Copy</button>
                                        </div>
                                        <div className="bg-[#0d1526] border border-[#639922]/20 rounded-xl p-4">
                                            <p className="text-white text-sm leading-relaxed">{briefResult.hook}</p>
                                        </div>
                                    </div>

                                    {/* 5 Angles */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">5 Content Angles</p>
                                        <div className="space-y-2">
                                            {briefResult.angles.map((a, i) => (
                                                <div key={i} className="flex gap-3 bg-[#0d1526] border border-slate-800 rounded-lg p-3">
                                                    <span className="text-[#639922] font-black text-xs shrink-0 mt-0.5">{i + 1}</span>
                                                    <p className="text-slate-300 text-xs leading-relaxed">{a}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Caption */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caption Draft</p>
                                            <button onClick={() => navigator.clipboard.writeText(briefResult.caption)} className="text-[10px] text-slate-600 hover:text-[#639922] transition font-bold">Copy</button>
                                        </div>
                                        <pre className="bg-[#0d1526] border border-slate-800 rounded-xl p-4 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">{briefResult.caption}</pre>
                                    </div>

                                    {/* Hashtags */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hashtags</p>
                                            <button onClick={() => navigator.clipboard.writeText(briefResult.hashtags)} className="text-[10px] text-slate-600 hover:text-[#639922] transition font-bold">Copy</button>
                                        </div>
                                        <div className="bg-[#0d1526] border border-slate-800 rounded-xl p-4">
                                            <p className="text-[#639922] text-xs leading-relaxed">{briefResult.hashtags}</p>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Call to Action</p>
                                        <div className="bg-[#0d1526] border border-slate-800 rounded-xl p-4">
                                            <p className="text-white text-sm">{briefResult.cta}</p>
                                        </div>
                                    </div>

                                    {/* Thumbnail brief (YT only) */}
                                    {briefResult.thumbnail && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thumbnail Direction</p>
                                            <div className="bg-[#0d1526] border border-slate-800 rounded-xl p-4">
                                                <p className="text-slate-300 text-xs leading-relaxed">{briefResult.thumbnail}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Apply to drawer button */}
                                    <button
                                        onClick={() => setShowAiBriefModal(false)}
                                        className="w-full py-3 rounded-xl bg-[#639922] hover:bg-[#4d7a18] text-white font-black text-sm transition mt-2"
                                    >
                                        ← Back to Drawer
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
