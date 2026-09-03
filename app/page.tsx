'use client';

import { useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const STYLE_PRESETS = ['Documentary', 'Meme / Funny', 'Cinematic', 'Vlog'];
const DAILY_LIMIT_KEY = 'lastEditDate';

function canEditToday(): boolean {
  const last = localStorage.getItem(DAILY_LIMIT_KEY);
  const today = new Date().toDateString();
  return last !== today;
}

function markEditedToday() {
  localStorage.setItem(DAILY_LIMIT_KEY, new Date().toDateString());
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());

  async function handleSubmit() {
    if (!file || !prompt.trim()) {
      setErrorMsg('Please upload a video and describe the edit style.');
      return;
    }
    if (!canEditToday()) {
      setErrorMsg('Daily free limit reached (1 video/day). Try again tomorrow!');
      return;
    }

    setErrorMsg('');
    setDownloadUrl(null);
    setBusy(true);

    try {
      // Step 1: get AI edit plan
      setStatus('Understanding your prompt...');
      const planRes = await fetch('/api/edit-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, videoDurationSeconds: 180 }),
      });
      const { plan } = await planRes.json();

      // Step 2: load FFmpeg (runs entirely in the browser, free)
      setStatus('Loading video engine...');
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg.loaded) {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      // Step 3: write input file
      setStatus('Editing your video...');
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));

      // Build filter based on AI plan
      const filters: string[] = [];
      if (plan.colorGrade === 'warm') filters.push('eq=gamma_r=1.1:gamma_b=0.9:saturation=1.15');
      if (plan.colorGrade === 'cool') filters.push('eq=gamma_b=1.1:gamma_r=0.9:saturation=1.1');
      if (plan.colorGrade === 'desaturated') filters.push('eq=saturation=0.4:contrast=1.1');
      if (plan.colorGrade === 'high_contrast_bw') filters.push('hue=s=0,eq=contrast=1.4');
      filters.push('scale=-2:720');
      const filterStr = filters.join(',');

      const duration = Math.min(180, plan.trim.endSeconds - plan.trim.startSeconds || 180);

      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', String(plan.trim.startSeconds || 0),
        '-t', String(duration),
        '-vf', filterStr,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        'output.mp4',
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data as Uint8Array], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      markEditedToday();
      setDownloadUrl(url);
      setStatus('Done!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Something went wrong: ' + (err.message || 'processing failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Free AI Video Editor</h1>
      <p className="text-gray-400 mb-8 text-center max-w-md">
        Upload a video, describe the style you want, and get it edited — free.
        (3 min max, 720p, 1 video per day)
      </p>

      <div className="w-full max-w-md space-y-4">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:bg-indigo-600 file:text-white"
        />

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Edit this like a documentary with slow cuts and calm music"
          className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-sm"
          rows={3}
        />

        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setPrompt(`Edit this video in ${s} style`)}
              className="text-xs px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700"
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full py-3 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
        >
          {busy ? status || 'Working...' : 'Edit My Video'}
        </button>

        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

        {downloadUrl && (
          <div className="pt-4 border-t border-gray-800">
            <video src={downloadUrl} controls className="w-full rounded mb-2" />
            <a href={downloadUrl} download="edited-video.mp4" className="text-indigo-400 underline text-sm">
              Download edited video
            </a>
          </div>
        )}
      </div>
    </main>
  );
  }
