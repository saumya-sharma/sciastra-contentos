import sys

with open('app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

target = '<h3 className="font-bold text-white mb-6">Exam Readiness (Campaign Linked)</h3>'

replacement = """<div className="flex justify-between items-center mb-6">
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
                                                </div>"""

code = code.replace(target, replacement, 1)

with open('app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched Exam Sync UI")
