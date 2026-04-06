"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';

type AuditLog = { user: string; action: string; timestamp: string };
type Item = { id: string; title: string; type: string; channel: string; date: string; scheduledTime?: string; status: string; assignees?: { smm?: string, editor?: string, designer?: string }; campaignId?: string; driveLink?: string; notes?: string; approval?: string; auditLog?: AuditLog[]; assets?: any[]; };
type TeamMember = { id: string; name: string; role: string; whatsapp: string; active?: boolean; channels?: string[] };
type Campaign = { id: string, name: string, target?: string, exam?: string, startDate?: string, endDate?: string };

const STATUSES = ['Ideation', 'Scripting', 'Sent to Editor', 'Ready to Publish', 'Published'];

const CHANNELS = [
    { name: 'Vivek NISER | SciAstra', cls: 'border-l-purple-500', bg: 'bg-purple-900/30' },
    { name: 'SciAstra English', cls: 'border-l-blue-500', bg: 'bg-blue-900/30' },
    { name: 'SciAstra 11th', cls: 'border-l-orange-500', bg: 'bg-orange-900/30' },
    { name: 'SciAstra 12th', cls: 'border-l-orange-500', bg: 'bg-orange-900/30' },
    { name: 'SciAstra College', cls: 'border-l-teal-500', bg: 'bg-teal-900/30' },
    { name: 'SciAstra Whatsapp/emails/notifications', cls: 'border-l-[#25D366]', bg: 'bg-[#25D366]/20' },
    { name: 'Ad Campaigns', cls: 'border-l-red-500', bg: 'bg-red-900/30' },
    { name: 'Exams', cls: 'border-l-red-600', bg: 'bg-red-950/40' }
];

export default function ContentOS() {
    const [items, setItems] = useState<Item[]>([]);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [config, setConfig] = useState({ hasWatiKey: false });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pipeline');
    const [reportDate, setReportDate] = useState('');
    const [isDark, setIsDark] = useState(true);
    const [mounted, setMounted] = useState(false);
    
    // Auth & Roles — initialized from localStorage synchronously on first render
    // This prevents the flash where mounted=true but role=null
    const [role, setRole] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('sa_role');
    });
    const [userName, setUserName] = useState<string>(() => {
        if (typeof window === 'undefined') return 'Unknown';
        return localStorage.getItem('sa_name') || 'Unknown';
    });
    const [viewMode, setViewMode] = useState<'week'|'month'>('week');

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

    useEffect(() => {
        // 1. SYNC: read role was already done by lazy useState initializer above
        //    Just handle tutorial check here
        const savedRole = localStorage.getItem('sa_role');
        const savedName = localStorage.getItem('sa_name');
        if (savedRole && savedName) {
            if (!localStorage.getItem('sa_tutorial_seen')) {
                setShowTutorial(true);
                localStorage.setItem('sa_tutorial_seen', 'true');
            }
        }

        // Dark mode
        const savedTheme = localStorage.getItem('sa_theme');
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }

        // Report date (client-only to avoid SSR mismatch)
        setReportDate(new Date().toLocaleDateString());

        // 2. MOUNT: unblock login UI — happens in same microtask as role set above
        setMounted(true);

        // 3. ASYNC: fetch DB data (non-blocking)
        fetch('/api/db').then(res => res.json()).then(data => {
            setItems(data.items || []);
            setTeam(data.team || []);
            setCampaigns(data.campaigns || []);
            setNotifications(data.notifications || []);
            if (data.config) setConfig(data.config);
            setLoading(false);
        });

        // Background cron (fire-and-forget)
        fetch('/api/cron').catch(() => {});

        // Check Zoho + WATI notification config
        fetch('/api/notify-teams').then(r => r.json()).then(cfg => {
            setZohoEnabled(!!cfg.zohoConfigured);
            setWatiEnabled(!!cfg.watiConfigured);
        }).catch(() => {});
    }, []);

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

    const updateItem = async (item: Item, payloadChanges: Partial<Item>) => {
        if (item.id === 'new') {
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
            // Write to DB so calendar and kanban stay in sync on reload
            await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _action: 'CREATE_ITEM', item: newItem }),
            });
            showSavedToast();
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

    if (!role) {
        const smmMembers = team.filter(t => t.role === 'SMM' && t.active !== false);
        const creatorMembers = team.filter(t => t.role === 'CREATOR' && t.active !== false);
        const adminMembers = team.filter(t => t.role === 'ADMIN' && t.active !== false);
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--color-background)]">
                <div className="bg-[var(--color-surface)] p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-lg w-full text-center hover:shadow-[#639922]/10 transition-shadow">
                    <h1 className="text-3xl font-black mb-2 tracking-tighter uppercase">SciAstra<span className="text-[#639922]">OS</span></h1>

                    {loginStep === 'role' ? (
                        <>
                            <p className="text-slate-400 mb-8 text-sm">Who are you?</p>
                            <div className="space-y-4">
                                {adminMembers.slice(0,1).map(t => (
                                    <button key={t.id} onClick={() => login('ADMIN', t.name, 'pipeline')} className="w-full bg-[#0F172A] hover:bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between transition group">
                                        <span className="block text-[#639922] font-bold">Admin ({t.name})</span><span>→</span>
                                    </button>
                                ))}
                                {smmMembers.length > 0 && (
                                    <button onClick={() => setLoginStep('smm-pick')} className="w-full bg-[#0F172A] hover:bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between transition group">
                                        <span className="block text-blue-400 font-bold">SMM (Social Media Manager)</span><span>→</span>
                                    </button>
                                )}
                                {creatorMembers.slice(0,1).map(t => (
                                    <button key={t.id} onClick={() => login('CREATOR', t.name, 'pipeline')} className="w-full bg-[#0F172A] hover:bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between transition group">
                                        <span className="block text-purple-400 font-bold">Creator / Editor ({t.name})</span><span>→</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-slate-400 mb-2 text-sm">Select your SMM identity</p>
                            <p className="text-slate-600 mb-6 text-xs">Your content queue will filter to your assigned channels.</p>
                            <div className="space-y-3">
                                {smmMembers.map(t => (
                                    <button key={t.id} onClick={() => login('SMM', t.name, 'pipeline')} className="w-full bg-[#0F172A] hover:bg-[#0d2242] border border-blue-900/50 p-4 rounded-xl flex items-center gap-4 transition">
                                        <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center font-black text-blue-300 text-lg">{t.name.charAt(0)}</div>
                                        <div className="text-left">
                                            <div className="font-bold text-blue-300 text-sm">{t.name}</div>
                                            <div className="text-slate-500 text-xs">{t.channels?.join(', ') || 'All channels'}</div>
                                        </div>
                                        <span className="ml-auto text-slate-500">→</span>
                                    </button>
                                ))}
                                <button onClick={() => setLoginStep('role')} className="text-xs text-slate-600 hover:text-slate-400 transition mt-2">← Back</button>
                            </div>
                        </>
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
                        <div className="flex items-center gap-2 mb-1">
                             <img src="https://www.sciastra.com/assets/images/sciastra-logo.webp" alt="SciAstra" width={130} className="object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).insertAdjacentHTML('afterend','<span class="text-2xl font-black tracking-tighter uppercase">SciAstra</span>');}} />
                             <span className="text-xs font-black bg-[#639922] text-white px-1.5 py-0.5 rounded-md leading-none ml-1">OS</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium tracking-wide mb-2">Content Hub</p>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-900 inline-block px-2 py-1 rounded">
                            {role} | {userName.split(' ')[0]}
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
                        <button onClick={logout} className="text-xs text-slate-500 hover:text-red-400 transition flex items-center justify-between">
                            Switch Identity <span>→</span>
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
                                        {CHANNELS.filter(c=>c.name!=='Exams').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                    <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 outline-none max-w-[150px]">
                                        <option value="">All Campaigns</option>
                                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {activeTab === 'calendar' && (
                            <div className="flex bg-slate-900 rounded p-1 border border-slate-800">
                                <button onClick={()=>setViewMode('week')} className={`px-3 py-1 rounded text-xs transition ${viewMode==='week'?'bg-[#639922] text-white':'text-slate-400 hover:text-white'}`}>Week Grid</button>
                                <button onClick={()=>setViewMode('month')} className={`px-3 py-1 rounded text-xs transition ${viewMode==='month'?'bg-[#639922] text-white':'text-slate-400 hover:text-white'}`}>Month Zoom</button>
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
                                    const WEEK_DAYS = [{label:'Mon Apr 5',iso:'2026-04-05'},{label:'Tue Apr 6',iso:'2026-04-06'},{label:'Wed Apr 7',iso:'2026-04-07'},{label:'Thu Apr 8',iso:'2026-04-08'},{label:'Fri Apr 9',iso:'2026-04-09'},{label:'Sat Apr 10',iso:'2026-04-10'},{label:'Sun Apr 11',iso:'2026-04-11'}];
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
                                            {CHANNELS.filter(c=>c.name!=='Exams').map(ch => (
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
                                                                        <span title={m.title}>{m.title.length > 35 ? m.title.substring(0, 35) + '...' : m.title}</span>
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

                                {activeTab === 'calendar' && viewMode === 'month' && (
                                   <div className="overflow-x-auto h-full">
                                        <div className="min-w-[900px] bg-[var(--color-surface)] border border-slate-800 rounded-xl">
                                            {/* Month Zoom: 4-week grid — each column = one week summary */}
                                            <div className="grid grid-cols-[150px_repeat(4,_1fr)] border-b border-slate-800 bg-slate-900/50">
                                                <div className="p-3 font-bold text-slate-500 border-r border-slate-800 text-xs text-center uppercase tracking-wider">Channel</div>
                                                {[
                                                    {label:'Week 1: Apr 5–11', dates:['2026-04-05','2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10','2026-04-11']},
                                                    {label:'Week 2: Apr 12–18', dates:['2026-04-12','2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17','2026-04-18']},
                                                    {label:'Week 3: Apr 19–25', dates:['2026-04-19','2026-04-20','2026-04-21','2026-04-22','2026-04-23','2026-04-24','2026-04-25']},
                                                    {label:'Week 4: Apr 26–May 2', dates:['2026-04-26','2026-04-27','2026-04-28','2026-04-29','2026-04-30','2026-05-01','2026-05-02']},
                                                ].map(w => (
                                                    <div key={w.label} onClick={() => setViewMode('week')} className="p-3 font-bold text-center border-r border-slate-800 text-xs text-slate-300 cursor-pointer hover:bg-slate-800 transition">{w.label}</div>
                                                ))}
                                            </div>
                                            {CHANNELS.filter(c=>c.name!=='Exams').map(ch => (
                                                <div key={ch.name} className="grid grid-cols-[150px_repeat(4,_1fr)] border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                                                    <div className={`p-4 border-r border-slate-800 text-xs font-bold ${getBorderClass(ch.name)} border-l-4 flex items-center`}>
                                                        {ch.name}
                                                    </div>
                                                    {[
                                                        ['2026-04-05','2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10','2026-04-11'],
                                                        ['2026-04-12','2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17','2026-04-18'],
                                                        ['2026-04-19','2026-04-20','2026-04-21','2026-04-22','2026-04-23','2026-04-24','2026-04-25'],
                                                        ['2026-04-26','2026-04-27','2026-04-28','2026-04-29','2026-04-30','2026-05-01','2026-05-02'],
                                                    ].map((weekDates, widx) => {
                                                        const weekItems = visibleItems.filter(i => i.channel === ch.name && weekDates.includes(i.date));
                                                        const published = weekItems.filter(i=>i.status==='Published').length;
                                                        return (
                                                            <div key={widx} onClick={() => setViewMode('week')} className="border-r border-slate-800/50 p-3 min-h-[80px] cursor-pointer hover:bg-slate-700/30 transition flex flex-col gap-1">
                                                                {weekItems.length === 0 ? (
                                                                    <span className="text-xs text-slate-700 italic">No content</span>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-lg font-black text-white">{weekItems.length}</span>
                                                                            <span className="text-[10px] text-slate-500">pieces</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-[#639922] font-bold">{published} published</div>
                                                                        <div className="h-1 w-full bg-slate-800 rounded overflow-hidden mt-1">
                                                                            <div className="h-full bg-[#639922]" style={{width: `${weekItems.length > 0 ? Math.round(published/weekItems.length*100) : 0}%`}}></div>
                                                                        </div>
                                                                        <div className="text-[9px] text-slate-600 mt-1 truncate">{weekItems[0]?.title?.substring(0,30)}...</div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                   </div>
                                )}

                                {activeTab === 'campaigns' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
                                        {campaigns.map(camp => {
                                            const campItems = items.filter(i => i.campaignId === camp.id);
                                            const published = campItems.filter(i => i.status === 'Published').length;
                                            const progress = campItems.length > 0 ? Math.round((published / campItems.length) * 100) : 0;
                                            return (
                                                <div key={camp.id} className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-6 hover:border-purple-500/50 transition">
                                                    <h3 className="text-lg font-bold text-white mb-1 leading-tight">{camp.name}</h3>
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
                                                            <span key={ch} className={`${getBgClass(String(ch))} px-2 py-1 rounded`}>{String(ch).split(' ')[0]}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
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
                                        <div className="bg-[var(--color-surface)] rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
                                            <div className="p-6 bg-slate-900/50 flex justify-between items-center">
                                            <h3 className="font-bold text-lg">Platform Identities</h3>
                                            <button onClick={() => setShowOnboardModal(true)} className="bg-[#639922] text-white px-4 py-2 rounded text-xs font-bold hover:bg-[#4d7a18] transition shadow">+ Onboard Member</button>
                                        </div>
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
                                                        <span className="text-3xl font-black text-[#639922]">4.2</span>
                                                        <span className="text-slate-400 text-sm font-medium mb-1">Days</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 mt-2">Ideation → Published</p>
                                                </div>
                                                <div className="bg-[#0B1121] border border-slate-800/50 p-5 rounded-lg flex flex-col justify-between relative overflow-hidden">
                                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-900/20 blur-xl rounded-full"></div>
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 block">Primary Bottleneck</span>
                                                    <div>
                                                        <span className="text-xl font-bold text-red-400">Sent to Editor</span>
                                                        <p className="text-xs text-red-500/80 mt-1 font-medium">8 items stuck &gt; 3 days</p>
                                                    </div>
                                                </div>
                                                <div className="bg-[#0B1121] border border-slate-800/50 p-5 rounded-lg flex flex-col justify-between">
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 block">Approval Turnaround</span>
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-3xl font-black text-blue-400">14</span>
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
                                                    {team.filter(t=>t.role!=='ADMIN').map(member => {
                                                        const count = items.filter(i => i.status === 'Published' && (i.assignees?.smm === member.name.split(' ')[0] || i.assignees?.editor === member.name.split(' ')[0] || i.assignees?.designer === member.name.split(' ')[0])).length;
                                                        const target = member.role === 'SMM' ? 10 : 15;
                                                        const pct = Math.min((count / target) * 100, 100);
                                                        return (
                                                            <div key={member.id}>
                                                                <div className="flex justify-between text-xs font-medium mb-1">
                                                                    <span className="text-slate-300">{member.name} <span className="text-[10px] text-slate-600">({member.role})</span></span>
                                                                    <span className="text-slate-400">{count} / {target}</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-[#0B1121] rounded overflow-hidden">
                                                                    <div className={`h-full ${member.role === 'SMM' ? 'bg-blue-500' : 'bg-purple-500'} transition-all`} style={{width: `${pct}%`}}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-[var(--color-surface)] border border-slate-800 rounded-xl p-6">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h3 className="font-bold text-white">Channel Cadence vs Target</h3>
                                                    <button className="text-[10px] text-[#639922] font-bold uppercase tracking-wider hover:underline">Edit Targets (3/wk)</button>
                                                </div>
                                                <div className="space-y-4">
                                                    {CHANNELS.filter(c=>c.name!=='Exams' && c.name!=='Ad Campaigns').map(ch => {
                                                        const published = items.filter(i => i.channel === ch.name && i.status === 'Published').length;
                                                        return (
                                                            <div key={ch.name} className="flex items-center justify-between border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${ch.bg.replace('/30','')}`}></div>
                                                                    <span className="text-xs font-medium text-slate-300">{ch.name.split(' ')[0]}</span>
                                                                </div>
                                                                <div className="text-xs font-bold font-mono">
                                                                    <span className={published >= 3 ? 'text-[#639922]' : 'text-slate-400'}>{published}</span><span className="text-slate-600"> / 3</span>
                                                                </div>
                                                            </div>
                                                        )
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
                                                   <span className="text-3xl font-black text-[#639922]">{items.filter(i=>i.status==='Published').length}</span>
                                              </div>
                                              <div className="bg-[#0B1121] p-4 rounded-lg border border-slate-800/50">
                                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Top Channel</span>
                                                   <span className="text-xl font-bold text-blue-400 truncate block">SciAstra College</span>
                                              </div>
                                              <div className="bg-[#0B1121] p-4 rounded-lg border border-slate-800/50">
                                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Top Contributor</span>
                                                   <span className="text-xl font-bold text-purple-400">Priya</span>
                                              </div>
                                              <div className="bg-[#0B1121] p-4 rounded-lg border border-slate-800/50">
                                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Bottleneck</span>
                                                   <span className="text-xl font-bold text-red-400">Sent to Editor</span>
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
                                                        {upcomingExams.map((ex, idx) => {
                                                            const pub = Math.floor(Math.random() * 5) + 1;
                                                            return (
                                                                <div key={idx} className="flex justify-between p-3 bg-[#0B1121] rounded">
                                                                    <span className="font-bold text-slate-300">{ex.title} (in {ex.days}d)</span>
                                                                    <span className="text-[#639922] font-mono font-bold">{pub} ready</span>
                                                                </div>
                                                            )
                                                        })}
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
                                    {CHANNELS.filter(c=>c.name!=='Exams').map(ch => (
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
                                <textarea defaultValue={selectedItem.title} onBlur={(e) => updateItem(selectedItem, {title: e.target.value})} className="w-full bg-transparent font-black text-xl md:text-2xl leading-tight resize-none outline-none focus:border-b border-slate-700" rows={2}/>
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

                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
