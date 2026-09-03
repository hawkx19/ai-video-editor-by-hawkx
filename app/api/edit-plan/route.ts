import { NextRequest, NextResponse } from 'next/server';
import { EDIT_PLAN_SYSTEM_PROMPT, sanitizeEditPlan } from '@/lib/editPlan';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, videoDurationSeconds } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${EDIT_PLAN_SYSTEM_PROMPT}\n\nUser request: ${prompt}` }] }],
      }),
    });

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const rawPlan = JSON.parse(cleaned);

    const safePlan = sanitizeEditPlan(rawPlan, Number(videoDurationSeconds) || 180);

    return NextResponse.json({ plan: safePlan });
  } catch (err) {
    console.error('edit-plan error:', err);
    return NextResponse.json({ error: 'Could not generate edit plan' }, { status: 500 });
  }
  }
