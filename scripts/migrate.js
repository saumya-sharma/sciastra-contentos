const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('Starting migration to Supabase...');
    const dbPath = path.join(__dirname, '../data/db.json');
    if (!fs.existsSync(dbPath)) {
        console.error('Local db.json not found!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

    // 1. Migrate Team Members
    if (data.team && data.team.length > 0) {
        console.log(`Migrating ${data.team.length} team members...`);
        const { error } = await supabase.from('team_members').upsert(data.team);
        if (error) console.error('Error migrating team:', error);
        else console.log('Team members migrated successfully!');
    }

    // 2. Migrate Campaigns
    if (data.campaigns && data.campaigns.length > 0) {
        console.log(`Migrating ${data.campaigns.length} campaigns...`);
        const { error } = await supabase.from('campaigns').upsert(data.campaigns);
        if (error) console.error('Error migrating campaigns:', error);
        else console.log('Campaigns migrated successfully!');
    }

    // 3. Migrate Content Items
    if (data.items && data.items.length > 0) {
        console.log(`Migrating ${data.items.length} content items...`);
        // Batch in chunks of 100 just in case
        for (let i = 0; i < data.items.length; i += 100) {
            const chunk = data.items.slice(i, i + 100);
            const { error } = await supabase.from('content_items').upsert(chunk);
            if (error) console.error('Error migrating items chunk:', error);
        }
        console.log('Content items migrated successfully!');
    }

    // 4. Migrate Notifications
    if (data.notifications && data.notifications.length > 0) {
        console.log(`Migrating ${data.notifications.length} notifications...`);
        for (let i = 0; i < data.notifications.length; i += 100) {
            const chunk = data.notifications.slice(i, i + 100);
            const { error } = await supabase.from('notifications').upsert(chunk);
            if (error) console.error('Error migrating notifications chunk:', error);
        }
        console.log('Notifications migrated successfully!');
    }

    console.log('Migration complete!');
}

migrate();
