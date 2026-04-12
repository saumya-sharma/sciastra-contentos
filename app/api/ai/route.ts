import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
    const { title, channel, goal, tone, audience, keyPoints, cta } = await req.json();

    const prompt = `You are a senior social media strategist for an ed-tech brand targeting Indian students preparing for competitive science exams (IISER, NISER, IIST, IAT, NEST, KVPY).

Generate complete omni-channel content assets for the following brief:

**Content Title:** ${title}
**Platform / Channel:** ${channel || 'Instagram'}
**Goal:** ${goal || 'Educate & drive engagement'}
**Tone:** ${tone || 'Educate & Inspire'}
**Target Audience:** ${audience || 'Science aspirants, Class 11-12'}
**Key Points to Cover:** ${keyPoints || 'Not specified'}
**Call to Action:** ${cta || 'Follow for more'}

Respond in this exact JSON format (no markdown, pure JSON):
{
  "hook": "One punchy opening line (under 15 words) that stops the scroll",
  "angles": [
    "Angle 1: contrarian take",
    "Angle 2: data/stat driven",
    "Angle 3: story/emotion",
    "Angle 4: how-to/practical",
    "Angle 5: myth-busting"
  ],
  "caption": "Full Instagram/YouTube community post caption (150-200 words) with line breaks. Include emojis sparingly.",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5 #tag6 #tag7 #tag8 #tag9 #tag10",
  "cta": "Strong single-sentence CTA for the end of the post",
  "thumbnail": "Visual direction for thumbnail/cover: describe composition, text overlay, colors, and mood in 2-3 sentences",
  "scores": {
    "hook": 85,
    "trend": 72,
    "cta": 90,
    "fit": 88,
    "overall": 84
  }
}

Scores should be realistic integers 60-97. Be specific to the Indian ed-tech/science exam context.`;

    try {
        const message = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        const raw = message.content[0].type === 'text' ? message.content[0].text : '';

        // Strip any accidental markdown fences
        const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(jsonStr);

        return NextResponse.json({ success: true, draft: null, result: parsed });
    } catch (err: any) {
        console.error('[ai/route] Error:', err);
        return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
    }
}
