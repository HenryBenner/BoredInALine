export const getNightStartTime = (): Date => {
  const now = new Date();
  const nightStart = new Date(now);
  nightStart.setHours(4, 0, 0, 0);
  
  if (now.getHours() < 4) {
    nightStart.setDate(nightStart.getDate() - 1);
  }
  
  return nightStart;
};

export const getNightStartSQL = (): string => {
  return `(CURRENT_DATE + INTERVAL '4 hours' - CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/New_York') < 4 THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END)`;
};
