import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'usage.json');

type UsageRecord = {
  [userId: string]: {
    lastEditDate: string;
    videosToday: number;
  };
};

function readUsage(): UsageRecord {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeUsage(data: UsageRecord) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export const DAILY_LIMIT = 1;

export function canUserEdit(userId: string): { allowed: boolean; remaining: number } {
  const usage = readUsage();
  const today = todayStr();
  const record = usage[userId];

  if (!record || record.lastEditDate !== today) {
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  const remaining = Math.max(0, DAILY_LIMIT - record.videosToday);
  return { allowed: remaining > 0, remaining };
}

export function recordUsage(userId: string) {
  const usage = readUsage();
  const today = todayStr();
  const record = usage[userId];

  if (!record || record.lastEditDate !== today) {
    usage[userId] = { lastEditDate: today, videosToday: 1 };
  } else {
    usage[userId].videosToday += 1;
  }

  writeUsage(usage);
}
