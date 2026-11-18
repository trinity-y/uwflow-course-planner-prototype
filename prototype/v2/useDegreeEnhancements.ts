import { useState } from 'react';

import { degreeEnhancements } from './degreeEnhancements';

const storageKey = 'uwflow-degree-planner-enhancements-v1';
export const readEnhancementIds = (value: string | null): string[] => {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed)
      ? degreeEnhancements
          .filter((item) => parsed.includes(item.id))
          .map((item) => item.id)
      : [];
  } catch {
    return [];
  }
};
const useDegreeEnhancements = () => {
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      return readEnhancementIds(localStorage.getItem(storageKey));
    } catch {
      return [];
    }
  });
  const toggle = (id: string) => {
    if (!degreeEnhancements.some((item) => item.id === id)) return;
    setSelected((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Selection still works without storage. */
      }
      return next;
    });
  };
  return { selected, toggle };
};
export default useDegreeEnhancements;
