'use client';

import { useState, useEffect } from 'react';

function ensureDeviceId() {
  if (typeof document === 'undefined') return;
  const has = document.cookie.split('; ').find((c) => c.startsWith('device_id='));
  if (!has) {
    const id = crypto.randomUUID();
    document.cookie = `device_id=${id}; path=/; max-age=31536000`;
  }
}

const STYLE_PRESETS = ['Documentary', 'Meme / Funny', 'Cinematic', 'Vlog'];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'planning' | 'processing' | 'done' | 'error'>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    ensureDeviceId();
  }, []);

  async function handleSubmit() {
    if (!file || !prompt.trim()) {
      setErrorMsg('Please upload a video and describe the edit style.');
      return;
    }
    setErrorMsg('');
    setDownloadUrl(null);

    try {
      const duration = await getVideoDuration(file);

      setStatus('planning');
      const planRes = await fetch('/api/edit-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, videoDurationSeconds: duration }),
      });
      if (!planRes.ok) throw new Error((await planRes.json()).error || 'Planning failed');
      const { plan } = await planRes.json();

      setStatus('processing');
      const formData = new FormData();
      formData.append('video', file);
      formData.append('plan', JSON.stringify(plan));

      const processRes = await fetch('/api/process-video', { method: 'POST', body: formData });
      const result = await processRes.json();
      if (!processRes.ok) throw new Error(result.error || 'Processing failed');

      setDownloadUrl(result.downloadUrl);
      setStatus('done');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('error');
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
          disabled={status === 'planning' || status === 'processing'}
          className="w-full py-3 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
        >
          {status === 'planning' && 'Understanding your prompt...'}
          {status === 'processing' && 'Editing your video...'}
          {(status === 'idle' || status === 'done' || status === 'error') && 'Edit My Video'}
        </button>

        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

        {downloadUrl && (
          <div className="pt-4 border-t border-gray-800">
            <video src={downloadUrl} controls className="w-full rounded mb-2" />
            <a href={downloadUrl} download className="text-indigo-400 underline text-sm">
              Download edited video
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video.duration || 180);
    video.src = URL.createObjectURL(file);
  });
            }
