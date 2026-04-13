import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';
import { sendNotification } from '@/lib/notify';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { emails, subject, title, message, ctaText, ctaUrl, taskId } = body;

    let status = 'Sent';

    try {
        if (emails && emails.length > 0) {
            await sendNotification({
                to: emails,
                subject: subject || 'Lume Notification',
                title: title || 'System Update',
                body: message || 'You have a new update in Lume.',
                ctaText,
                ctaUrl
            });
        } else {
            status = 'No Valid Emails';
        }
    } catch (err) {
        status = 'Failed (Resend API Error)';
        console.error(err);
    }

    // Database logging
    const notificationRecord = {
        id: uuidv4(),
        recipientName: 'Team Broadcast',
        whatsappNumber: 'email', // Retrofit legacy column
        notificationType: 'email_broadcast',
        message: message || "Email Notification Sent",
        taskId: taskId || null,
        timestamp: new Date().toISOString(),
        status
    };

    const { error } = await supabase.from('notifications').insert(notificationRecord);
    if (error) {
        console.error('Failed to log notification to Supabase:', error);
    }

    return NextResponse.json({ 
        success: true, 
        message: status === 'Sent' ? 'Email Notification Sent' : 'Failed to send',
        record: notificationRecord
    });
}
