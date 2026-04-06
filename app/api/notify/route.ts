import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
    const dbPath = path.join(process.cwd(), 'data/db.json');
    if (!fs.existsSync(dbPath)) return NextResponse.json({ error: 'DB not found' }, { status: 500 });
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const body = await req.json();

    const { recipientName, whatsappNumber, notificationType, message, taskId, title, channel, scheduledTime } = body;

    const apiKey = process.env.WATI_API_KEY;
    const accountId = process.env.WATI_ACCOUNT_ID || 'PENDING';
    const apiUrl = process.env.WATI_ENDPOINT || `https://live-mt-server.wati.io/${accountId}/api/v1/sendTemplateMessage`; 
    let status = 'Sent (Mock)';
    
    // Format WATI payload
    const watiPayload = {
        broadcast_name: "contentos_approval",
        parameters: [
            { name: "name", value: recipientName },
            { name: "title", value: title || 'Content Item' },
            { name: "channel", value: channel || 'SciAstra' },
            { name: "time", value: scheduledTime || 'TBD' }
        ],
        template_name: "content_review_alert",
        broadcast_group: "",
        receivers: [whatsappNumber.replace('+', '')] // Ensure clean digits
    };

    if (apiKey) {
        try {
            const watiRes = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'text/json'
                },
                body: JSON.stringify(watiPayload)
            });
            const data = await watiRes.json();
            status = data.result ? 'Sent (Live)' : 'Failed (API Error)';
        } catch (err) {
            status = 'Failed (Network Error)';
            console.error(err);
        }
    } else {
        // Simulate delay for UI polish if running mock
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Database logging
    const filledMessage = `Hi ${recipientName}, your content '${title || 'Content Item'}' on ${channel || 'SciAstra'} is ready for review. Scheduled: ${scheduledTime || 'TBD'}. Please approve on SciAstra ContentOS.`;
    const notificationRecord = {
        id: uuidv4(),
        recipientName,
        whatsappNumber,
        notificationType,
        message: apiKey ? "WATI Template Broadcast Sent" : filledMessage,
        taskId,
        timestamp: new Date().toISOString(),
        status
    };

    if (!db.notifications) {
        db.notifications = [];
    }
    db.notifications.push(notificationRecord);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    return NextResponse.json({ 
        success: true, 
        message: apiKey ? 'WATI Notification Sent' : 'WhatsApp notification queued (Mock Mode)',
        record: notificationRecord
    });
}
