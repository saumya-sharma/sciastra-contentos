import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
    const examsToAdd: any[] = [];
    console.log("Starting cron to fetch live exam dates...");

    // 1. Fetch NEST Exam Dates
    try {
        const nestHtml = await fetch('https://www.nestexam.in/', { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' }
        }).then(res => res.text());
        const $ = cheerio.load(nestHtml);
        
        const pageText = $('body').text().replace(/\s+/g, ' ');
        const nestMatch = pageText.match(/date of examination.*?(\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i); 
        
        let nestDate = nestMatch ? new Date(nestMatch[1]) : new Date('2026-06-30T00:00:00Z');
        
        examsToAdd.push({
            id: uuidv4(),
            title: 'NEST 2026 Examination',
            type: 'Exam',
            channel: 'Exams',
            date: nestDate.toISOString().split('T')[0],
            status: 'Ready'
        });
    } catch (e) {
        console.error("Failed NEST fetch", e);
    }

    // 2. Fetch NISER / IAT 
    try {
        const iatHtml = await fetch('https://iiseradmission.in/', { 
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }).then(res => res.text());
        const $2 = cheerio.load(iatHtml);
        const pageText2 = $2('body').text().replace(/\s+/g, ' ');
        const iatMatch = pageText2.match(/IAT.*?(\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i); 
        
        let iatDate = iatMatch ? new Date(iatMatch[1]) : new Date('2026-06-09T00:00:00Z');

        examsToAdd.push({
            id: uuidv4(),
            title: 'IAT (IISER Aptitude Test) 2026',
            type: 'Exam',
            channel: 'Exams',
            date: iatDate.toISOString().split('T')[0],
            status: 'Ready'
        });
    } catch (e) {
        console.error("Failed IAT fetch", e);
    }

    // Deduplicate against existing DB exam records
    const { data: existing } = await supabase.from('content_items').select('title, type').eq('type', 'Exam');
    const existingTitles = new Set(existing?.map(e => e.title) || []);
    
    for (const ex of examsToAdd) {
        if (!existingTitles.has(ex.title)) {
            await supabase.from('content_items').insert(ex);
        }
    }

    return NextResponse.json({ 
        message: 'Cron job ran successfully. Live dates parsed and stored.', 
        examsFetched: examsToAdd 
    });
}
