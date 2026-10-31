// src/services/timeUtils.ts

export const shiftTime = (timeStr: string, direction: 1 | -1): string => {
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h);
  date.setMinutes(m);
  
  // إضافة أو طرح ساعة
  date.setHours(date.getHours() + direction);
  
  const newH = date.getHours().toString().padStart(2, '0');
  const newM = date.getMinutes().toString().padStart(2, '0');
  
  return `${newH}:${newM}`;
};
