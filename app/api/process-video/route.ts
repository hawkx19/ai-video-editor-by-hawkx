import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { canUserEdit, recordUsage } from '@/lib/rateLimiter';
import { sanitizeEditPlan } from '@/lib/editPlan';
import { processVideo } from '@/lib/ffmpegExecutor';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get('device_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Missing device id' }, { status: 400 });
    }

    const { allowed, remaining } = canUserEdit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Daily free limit reached. Try again tomorrow!' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    const planRaw = formData.get('plan') as string | null;

    if (!file || !planRaw) {
      return NextResponse.json({ error: 'Video and plan are required' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Video too large (max 200MB)' }, { status: 400 });
    }

    const jobId = uuid();
    const uploadsDir = path.join('/tmp', 'uploads');
const outputsDir = path.join('/tmp', 'outputs');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(outputsDir, { recursive: true });

    const inputPath = path.join(uploadsDir, `${jobId}-input.mp4`);
    const outputPath = path.join(outputsDir, `${jobId}-output.mp4`);

    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(inputPath, bytes);

    const plan = sanitizeEditPlan(JSON.parse(planRaw), 180);

    await processVideo(inputPath, outputPath, plan);

    recordUsage(userId);

    fs.unlinkSync(inputPath);

    return NextResponse.json({
      success: true,
      downloadUrl: `/outputs/${jobId}-output.mp4`,
      remainingToday: remaining - 1,
    });
  } catch (err) {
    console.error('process-video error:', err);
    return NextResponse.json({ error: 'Video processing failed' }, { status: 500 });
  }
}
