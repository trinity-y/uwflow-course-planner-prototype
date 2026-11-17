import { useState } from 'react';

import { findAcademicCalendar } from './academicCalendars';

const storageKey = 'uwflow-degree-planner-calendar-v1';
const useAcademicCalendar = () => {
  const [calendar, setValue] = useState(() => {
    try {
      return findAcademicCalendar(localStorage.getItem(storageKey));
    } catch {
      return findAcademicCalendar(null);
    }
  });
  const setCalendar = (id: string) => {
    const next = findAcademicCalendar(id);
    setValue(next);
    try {
      localStorage.setItem(storageKey, next.id);
    } catch {
      /* The selection remains usable without storage. */
    }
  };
  return { calendar, setCalendar };
};
export default useAcademicCalendar;
