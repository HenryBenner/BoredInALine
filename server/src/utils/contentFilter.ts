import pool from '../config/database';

let bannedWords: string[] = [];
let lastRefresh = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000;

async function loadBannedWords(): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT word FROM banned_words WHERE is_active = true'
    );
    bannedWords = result.rows.map(row => row.word.toLowerCase());
    lastRefresh = Date.now();
  } catch (error) {
    console.error('Failed to load banned words:', error);
  }
}

export async function checkContent(text: string): Promise<{ isClean: boolean; matchedWords: string[] }> {
  if (!text || !text.trim()) {
    return { isClean: true, matchedWords: [] };
  }

  if (Date.now() - lastRefresh > REFRESH_INTERVAL || bannedWords.length === 0) {
    await loadBannedWords();
  }

  const lowerText = text.toLowerCase();
  const matchedWords: string[] = [];

  for (const word of bannedWords) {
    if (word.includes(' ')) {
      if (lowerText.includes(word)) {
        matchedWords.push(word);
      }
    } else {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText)) {
        matchedWords.push(word);
      }
    }
  }

  return {
    isClean: matchedWords.length === 0,
    matchedWords,
  };
}
