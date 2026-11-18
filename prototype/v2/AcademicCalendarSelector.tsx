import React from 'react';
import { ExternalLink } from 'react-feather';

import { academicCalendars } from './academicCalendars';

interface Props {
  value: string;
  onChange: (id: string) => void;
  sourceUrl: string;
}
const AcademicCalendarSelector = ({ value, onChange, sourceUrl }: Props) => (
  <div className="mt-md flex flex-wrap items-center gap-sm">
    <label htmlFor="academic-calendar" className="text-xs text-lecture">
      Academic calendar
    </label>
    <select
      id="academic-calendar"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-solid border-white/30 bg-white px-sm py-sm font-inter text-sm text-dark1 outline-none focus:ring-2 focus:ring-lecture"
    >
      {academicCalendars.map((calendar) => (
        <option key={calendar.id} value={calendar.id}>
          {calendar.label}
        </option>
      ))}
    </select>
    <a
      href={sourceUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Open selected academic calendar"
      className="flex items-center text-lecture"
    >
      <ExternalLink size={15} />
    </a>
  </div>
);
export default AcademicCalendarSelector;
