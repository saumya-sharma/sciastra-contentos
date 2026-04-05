const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'db.json');
const excelPath = path.join(__dirname, '../../data.xlsx'); 

function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        if (typeof dateStr === 'number') {
            const date = new Date((dateStr - (25567 + 2)) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        }
        return null;
    }
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[0], 10);
        return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
    }
    return null;
}

const channelsMap = [
    { name: 'Vivek NISER | SciAstra', keyword: 'Vivek' },
    { name: 'SciAstra English', keyword: 'English' },
    { name: 'SciAstra 11th', keyword: '11th' },
    { name: 'SciAstra 12th', keyword: '12th' },
    { name: 'SciAstra College', keyword: 'College' },
    { name: 'SciAstra Whatsapp/emails/notifications', keyword: 'Whatsapp' },
    { name: 'Ad Campaigns', keyword: 'Ad' }
];

const assignees = [
    { name: 'Mahak', roleInfo: 'Insta' }, { name: 'Priya', roleInfo: 'English' }, { name: 'Ritika', roleInfo: 'English' }, 
    { name: 'Rishav', roleInfo: 'Editor' }, { name: 'Manu', roleInfo: 'Editor' }, { name: 'Atendra', roleInfo: 'Editor' }, 
    { name: 'Bhupendra', roleInfo: 'Designer' }, { name: 'Vivek', roleInfo: 'Admin' }, { name: 'CMM', roleInfo: 'Admin' }
];

function getAssignee(channel) {
    if (channel.includes('English')) return Math.random() > 0.5 ? 'Priya' : 'Ritika';
    if (channel.includes('Vivek')) return 'Vivek';
    if (channel.includes('Whatsapp')) return 'Mahak'; 
    const randomEditor = ['Rishav', 'Manu', 'Atendra'][Math.floor(Math.random()*3)];
    return randomEditor;
}

const CAMPAIGNS_LIST = [
    { id: uuidv4(), name: 'Homi Campaign 1', target: 'Same as last year Hindi Homi batch' }, 
    { id: uuidv4(), name: 'Homi Campaign 2', target: 'Target leads: 300' }, 
    { id: uuidv4(), name: 'Vikram Campaign 1', target: '150% of last year Vikram batch' }, 
    { id: uuidv4(), name: 'Vikram Campaign 2', target: 'Target leads: 400' }, 
    { id: uuidv4(), name: 'Backlog Series', target: '2000 App downloads Apr 9-12' }, 
    { id: uuidv4(), name: 'Rescue Series', target: 'Notes & free tests via Classplus' }, 
    { id: uuidv4(), name: 'Maha Revision Series', target: 'Final revision before IAT/NEST' }
];

const db = {
    items: [],
    team: assignees.map(a => ({
        id: a.name, // using name as id for ease
        name: a.name,
        role: a.roleInfo === 'Admin' ? 'ADMIN' : a.roleInfo === 'Editor' || a.roleInfo === 'Designer' ? 'CREATOR' : 'SMM',
        whatsapp: '',
        active: true
    })),
    campaigns: CAMPAIGNS_LIST,
    notifications: []
};

try {
    const workbook = xlsx.readFile(excelPath, { cellDates: true, raw: false });
    const simToday = new Date('2026-04-05T00:00:00Z');

    const addedSet = new Set();      // Deduplicates by (date, channel, title)
    const titleDateSet = new Set();   // Deduplicates by (date, title) across ALL channels — one card per unique content piece per day
    const activeCampaigns = {}; // Keep track of active campaign obj per channel

    workbook.SheetNames.forEach(sheetName => {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, dateNF: 'yyyy-mm-dd' });
        
        rows.forEach(row => {
            const getVal = (keyword) => {
                const key = Object.keys(row).find(k => k.toLowerCase().includes(keyword.toLowerCase()));
                return key && row[key] ? String(row[key]).trim() : null;
            };

            const dateStr = getVal('Date');
            if (!dateStr) return;
            const isoDate = parseDate(dateStr);
            if (!isoDate) return;

            const examNotifs = getVal('Exam notifications');
            if (examNotifs && examNotifs !== '') {
                const uniqueKey = `${isoDate}-Exams-${examNotifs}`;
                if (!addedSet.has(uniqueKey)) {
                    addedSet.add(uniqueKey);
                    db.items.push({
                        id: uuidv4(),
                        title: examNotifs,
                        type: 'Exam',
                        channel: 'Exams',
                        date: isoDate,
                        status: new Date(isoDate) < simToday ? 'Published' : 'Ready'
                    });
                }
            }

            channelsMap.forEach(chObj => {
                const content = getVal(chObj.keyword);
                if (content && typeof content === 'string' && content !== '') {
                    
                    const lower = content.toLowerCase();
                    
                    let campaignLabelId = null;
                    const explicitMatch = CAMPAIGNS_LIST.find(c => lower.includes(c.name.toLowerCase()));
                    
                    if (explicitMatch) {
                        campaignLabelId = explicitMatch.id;
                        activeCampaigns[chObj.name] = explicitMatch.id; 
                    } else if (lower.includes('campaign') || lower.includes('series') || lower.includes('day ')) {
                        if (activeCampaigns[chObj.name]) {
                            campaignLabelId = activeCampaigns[chObj.name];
                        }
                    } else {
                        activeCampaigns[chObj.name] = null;
                    }

                    // Primary key: title + date + channel (prevents same item in same channel twice)
                    const uniqueKey = `${isoDate}-${chObj.name}-${content.trim()}`;
                    // Secondary key: title + date (prevents multiplying same content across every channel)
                    const titleDateKey = `${isoDate}-${content.trim().substring(0, 60)}`;

                    if (!addedSet.has(uniqueKey) && !titleDateSet.has(titleDateKey)) {
                        addedSet.add(uniqueKey);
                        titleDateSet.add(titleDateKey);

                        const itemDate = new Date(isoDate);
                        let status = 'Published';
                        if (itemDate >= simToday) {
                            const diff = (itemDate - simToday) / (1000 * 60 * 60 * 24);
                            if (diff <= 2) status = 'Ready to Publish';
                            else if (diff <= 5) status = 'Sent to Editor';
                            else if (diff <= 10) status = 'Scripting';
                            else status = 'Ideation';
                        }

                        const assignedSMM = getAssignee(chObj.name);
                        const editors = ['Rishav', 'Manu', 'Atendra'];

                        db.items.push({
                            id: uuidv4(),
                            title: content,
                            type: 'Content',
                            channel: chObj.name,
                            date: isoDate,
                            scheduledTime: '19:00',
                            status: status,
                            assignees: {
                                smm: assignedSMM,
                                editor: editors[Math.floor(Math.random()*editors.length)],
                                designer: 'Bhupendra'
                            },
                            campaignId: campaignLabelId,
                            driveLink: '',
                            notes: '',
                            approval: 'Pending',
                            auditLog: []
                        });
                    }
                }
            });
        });
    });

    db.items.sort((a,b) => a.date.localeCompare(b.date));
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`Successfully seeded ${db.items.length} unique items.`);

} catch (e) {
    console.error("Failed to seed:", e);
}
