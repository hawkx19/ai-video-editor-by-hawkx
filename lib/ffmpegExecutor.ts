import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegPath.path);
import { EditPlan } from './editPlan';

function colorGradeFilter(grade: EditPlan['colorGrade']): string {
  switch (grade) {
    case 'warm':
      return 'eq=gamma_r=1.1:gamma_b=0.9:saturation=1.15';
    case 'cool':
      return 'eq=gamma_b=1.1:gamma_r=0.9:saturation=1.1';
    case 'desaturated':
      return 'eq=saturation=0.4:contrast=1.1';
    case 'high_contrast_bw':
      return 'hue=s=0,eq=contrast=1.4';
    default:
      return '';
  }
}

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function textOverlayFilters(overlays: EditPlan['textOverlays']): string[] {
  return overlays.map((o) => {
    const yPos = o.position === 'top' ? '50' : o.position === 'center' ? '(h-text_h)/2' : 'h-100';
    const end = o.startSeconds + o.durationSeconds;
    const escapedText = o.text.replace(/'/g, "\\'").replace(/:/g, '\\:');
    return `drawtext=fontfile=${FONT_PATH}:text='${escapedText}':fontsize=42:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=${yPos}:enable='between(t,${o.startSeconds},${end})'`;
  });
}

export function processVideo(
  inputPath: string,
  outputPath: string,
  plan: EditPlan
): Promise<void> {
  return new Promise((resolve, reject) => {
    const filters: string[] = [];

    const color = colorGradeFilter(plan.colorGrade);
    if (color) filters.push(color);

    if (plan.speed !== 1) {
      filters.push(`setpts=${(1 / plan.speed).toFixed(3)}*PTS`);
    }

    filters.push(...textOverlayFilters(plan.textOverlays));

    filters.push('scale=-2:720');

    if (plan.transitions === 'fade') {
      const duration = plan.trim.endSeconds - plan.trim.startSeconds;
      filters.push(`fade=t=in:st=0:d=1,fade=t=out:st=${duration - 1}:d=1`);
    }

    const command = ffmpeg(inputPath)
      .setStartTime(plan.trim.startSeconds)
      .setDuration(plan.trim.endSeconds - plan.trim.startSeconds)
      .videoFilters(filters)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-preset fast', '-crf 23'])
      .output(outputPath);

    command.on('end', () => resolve());
    command.on('error', (err) => reject(err));
    command.run();
  });
}
