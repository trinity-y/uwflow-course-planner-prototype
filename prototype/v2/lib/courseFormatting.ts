export const termCodeToDate = (code: number): string => {
  const monthInt = code % 10;
  const year = 1900 + Math.floor(code / 10);
  const month = monthInt === 1 ? 'Winter' : monthInt === 5 ? 'Spring' : 'Fall';
  return `${month} ${year}`;
};

export const splitCourseCode = (code: string): [string, string] => {
  if (!code || code === '') {
    return ['', ''];
  }

  let codeLetters = '';
  let i = 0;
  while (
    i < code.length &&
    code[i].toUpperCase() >= 'A' &&
    code[i].toUpperCase() <= 'Z'
  ) {
    codeLetters += code[i].toUpperCase();
    i += 1;
  }

  return [codeLetters, code.slice(i)];
};

export const formatCourseCode = (code: string): string => {
  if (!code || code === '') {
    return code;
  }

  return splitCourseCode(code).join(' ').toUpperCase();
};

export const getCurrentTermCode = (): number => {
  const curDate = new Date();
  const curYear = curDate.getFullYear();
  const curMonth = curDate.getMonth();
  const monthInt =
    curMonth >= 0 && curMonth <= 3 ? 1 : curMonth >= 4 && curMonth <= 7 ? 5 : 9;
  return (curYear - 1900) * 10 + monthInt;
};

export const getCoursePageRoute = (code: string) => `/course/${code}`;
