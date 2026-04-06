import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const dbPath = path.join(process.cwd(), 'data/db.json');
    if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ items: [], team: [], campaigns: [] });
    }
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    return NextResponse.json({
        ...data,
        config: { hasWatiKey: !!process.env.WATI_API_KEY }
    });
}

export async function PUT(req: Request) {
    const dbPath = path.join(process.cwd(), 'data/db.json');
    const body = await req.json();
    
    if (fs.existsSync(dbPath)) {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        
        // Handling Team Member edits
        if (body._action === 'UPDATE_TEAM') {
            const tIndex = data.team.findIndex((t: any) => t.id === body.member.id);
            if (tIndex !== -1) {
                data.team[tIndex] = body.member;
            } else {
                data.team.push(body.member);
            }
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            return NextResponse.json({ success: true });
        }

        // Create new campaign
        if (body._action === 'CREATE_CAMPAIGN') {
            if (!data.campaigns) data.campaigns = [];
            data.campaigns.push(body.campaign);
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            return NextResponse.json({ success: true, campaign: body.campaign });
        }


        const index = data.items.findIndex((i: any) => i.id === body.id);
        if (index !== -1) {
            const item = data.items[index];
            
            // Audit Log
            if (body.status && item.status !== body.status) {
                if (!item.auditLog) item.auditLog = [];
                item.auditLog.push({
                    user: body._actor || 'System',
                    action: `Moved from ${item.status} to ${body.status}`,
                    timestamp: new Date().toISOString()
                });
            }
            if (body.approval && item.approval !== body.approval) {
                if (!item.auditLog) item.auditLog = [];
                item.auditLog.push({
                    user: body._actor || 'System',
                    action: `Changed Approval Status to ${body.approval}`,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Merge
            Object.keys(body).forEach(key => {
                if (key !== '_actor' && key !== 'id' && key !== '_action') {
                    item[key] = body[key];
                }
            });

            data.items[index] = item;
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            return NextResponse.json(item);
        }
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
