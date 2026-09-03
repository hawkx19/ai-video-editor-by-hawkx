import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { EDIT_PLAN_SYSTEM_PROMPT, sanitizeEditPlan } from '@/lib/editPlan';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prompt, videoDurationSeconds } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: EDIT_PLAN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}';

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const rawPlan = JSON.parse(cleaned);

    const safePlan = sanitizeEditPlan(rawPlan, Number(videoDurationSeconds) || 180);

    return NextResponse.json({ plan: safePlan });
  } catch (err) {
    console.error('edit-plan error:', err);
    return NextResponse.json({ error: 'Could not generate edit plan' }, { status: 500 });
  }
}
