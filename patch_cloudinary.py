import sys

with open('app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

target = 'placeholder="Paste link to raw footage or final render..." />'

cloudinary_block = """placeholder="Paste link to raw footage or final render..." />
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
                                         </div>"""

code = code.replace(target, cloudinary_block, 1)

with open('app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched!")
