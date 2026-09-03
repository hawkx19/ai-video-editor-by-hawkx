import { NextRequest, NextResponse } from 'next/server';
import { EDIT_PLAN_SYSTEM_PROMPT, sanitizeEditPlan } from '@/lib/editPlan';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const { prompt, videoDurationSeconds } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${EDIT_PLAN_SYSTEM_PROMPT}\n\nUser request: ${prompt}`,
              },
            ],
          },
        ],
      }),
    });

    // Read as text first so non-JSON errors don't crash the route
    const responseText = await response.text();

    if (!response.ok) {
      console.error('Gemini API error:', response.status, responseText);

      return NextResponse.json(
        {
          error: `Gemini API error (${response.status})`,
          details: responseText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Gemini returned invalid JSON:', responseText);

      return NextResponse.json(
        { error: 'Gemini returned an invalid response' },
        { status: 502 }
      );
    }

    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error('Unexpected Gemini response:', data);

      return NextResponse.json(
        { error: 'Gemini did not return an edit plan' },
        { status: 502 }
      );
    }

    const cleaned = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let rawPlan;

    try {
      rawPlan = JSON.parse(cleaned);
    } catch {
      console.error('Gemini returned invalid plan JSON:', cleaned);

      return NextResponse.json(
        { error: 'Gemini returned an invalid edit plan' },
        { status: 502 }
      );
    }

    const safePlan = sanitizeEditPlan(
      rawPlan,
      Number(videoDurationSeconds) || 180
    );

    return NextResponse.json({ plan: safePlan });

  } catch (err) {
    console.error('edit-plan error:', err);

    return NextResponse.json(
      { error: 'Could not generate edit plan' },
      { status: 500 }
    );
  }
}
