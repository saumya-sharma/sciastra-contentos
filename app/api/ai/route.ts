import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { title, channel } = await req.json();
    
    // In production, this would call `await google.generativeAI.generateContent(...)`
    // using the Gemini API. For now, we return a mock generated output.
    
    const draft = `*Generated Omni-Channel Assets for: ${title}*

📱 **WhatsApp Broadcast:**
"🚨 Hey SciAstra Warriors! We've just dropped the ultimate guide for ${title}. Don't miss out on this crucial update for ${channel} 🚀 Link below 👇"

🐦 **Twitter / X:**
"Cracking the exam code! 🧬 Just published our new insights on ${title}. Are you ready? Drop your doubts below. #SciAstra #IISER #NISER"

📸 **Instagram Caption:**
"The wait is over! 🔥 Dive deep into ${title} with SciAstra. 
We cover everything you need to know to secure your dream institute.
Link in bio! 🔗
.
.
#sciastra #futuredoctors #futurescientists #IISc"
`;

    // Add an artificial delay to simulate AI processing
    await new Promise(r => setTimeout(r, 1500));

    return NextResponse.json({ success: true, draft });
}
