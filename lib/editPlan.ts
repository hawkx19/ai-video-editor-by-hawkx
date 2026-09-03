export type EditPlan = {
  style: string;
  trim: {
    startSeconds: number;
    endSeconds: number;
  };
  colorGrade: 'none' | 'warm' | 'cool' | 'desaturated' | 'high_contrast_bw';
  speed: number;
  textOverlays: {
    text: string;
    startSeconds: number;
    durationSeconds: number;
    position: 'top' | 'center' | 'bottom';
  }[];
  addSubtitles: boolean;
  musicMood: 'none' | 'suspenseful' | 'upbeat' | 'calm' | 'dramatic';
  transitions: 'cut' | 'fade' | 'zoom';
};

export const EDIT_PLAN_SYSTEM_PROMPT = `You are a video editing planner. A user will describe how they want their video edited, in plain language (e.g. "make it look like a documentary" or "turn it into a funny meme edit").

Your job: convert their request into ONLY a JSON object matching this exact shape, with no extra text, no markdown fences, nothing else:

{
  "style": string,
  "trim": { "startSeconds": number, "endSeconds": number },
  "colorGrade": "none" | "warm" | "cool" | "desaturated" | "high_contrast_bw",
  "speed": number,
  "textOverlays": [
    { "text": string, "startSeconds": number, "durationSeconds": number, "position": "top" | "center" | "bottom" }
  ],
  "addSubtitles": boolean,
  "musicMood": "none" | "suspenseful" | "upbeat" | "calm" | "dramatic",
  "transitions": "cut" | "fade" | "zoom"
}

Style guidance:
- "documentary": colorGrade "desaturated", speed 1.0, transitions "fade", musicMood "calm" or "dramatic", addSubtitles true
- "meme" / "funny": colorGrade "none" or "high_contrast_bw", speed 1.1-1.3, transitions "zoom", several short punchy textOverlays, musicMood "upbeat"
- "cinematic": colorGrade "warm" or "cool", speed 0.9-1.0, transitions "fade", musicMood "dramatic"
- "vlog": colorGrade "warm", speed 1.0-1.1, transitions "cut", musicMood "upbeat", addSubtitles true

Only output the raw JSON object. Nothing before or after it.`;

export function sanitizeEditPlan(raw: any, videoDurationSeconds: number): EditPlan {
  const MAX_DURATION = 180;

  const start = Math.max(0, Number(raw?.trim?.startSeconds) || 0);
  let end = Number(raw?.trim?.endSeconds) || Math.min(videoDurationSeconds, MAX_DURATION);
  end = Math.min(end, videoDurationSeconds, start + MAX_DURATION);
  if (end <= start) end = Math.min(start + 10, videoDurationSeconds);

  const speed = Math.min(2, Math.max(0.5, Number(raw?.speed) || 1));

  const validColorGrades = ['none', 'warm', 'cool', 'desaturated', 'high_contrast_bw'];
  const colorGrade = validColorGrades.includes(raw?.colorGrade) ? raw.colorGrade : 'none';

  const validTransitions = ['cut', 'fade', 'zoom'];
  const transitions = validTransitions.includes(raw?.transitions) ? raw.transitions : 'cut';

  const validMoods = ['none', 'suspenseful', 'upbeat', 'calm', 'dramatic'];
  const musicMood = validMoods.includes(raw?.musicMood) ? raw.musicMood : 'none';

  const textOverlays = Array.isArray(raw?.textOverlays)
    ? raw.textOverlays.slice(0, 8).map((t: any) => ({
        text: String(t?.text || '').slice(0, 60),
        startSeconds: Math.max(0, Number(t?.startSeconds) || 0),
        durationSeconds: Math.min(10, Math.max(1, Number(t?.durationSeconds) || 3)),
        position: ['top', 'center', 'bottom'].includes(t?.position) ? t.position : 'bottom',
      }))
    : [];

  return {
    style: String(raw?.style || 'custom').slice(0, 40),
    trim: { startSeconds: start, endSeconds: end },
    colorGrade,
    speed,
    textOverlays,
    addSubtitles: Boolean(raw?.addSubtitles),
    musicMood,
    transitions,
  };
}
