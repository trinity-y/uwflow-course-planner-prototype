import { useEffect, useState } from 'react';

const storageKey = 'uwflow-degree-planner-wishlist-v1';

const readWishlist = (): string[] => {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? '[]',
    );
    return Array.isArray(stored)
      ? Array.from(
          new Set(
            stored.filter((code): code is string => typeof code === 'string'),
          ),
        )
      : [];
  } catch {
    return [];
  }
};

export const reorderWishlist = (
  current: string[],
  code: string,
  target: number,
) => {
  const source = current.indexOf(code);
  if (source < 0 || !Number.isInteger(target)) return current;
  const next = current.filter((item) => item !== code);
  next.splice(Math.max(0, Math.min(target, next.length)), 0, code);
  return next;
};

const useWishlist = () => {
  const [wishlist, setWishlist] = useState(readWishlist);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(wishlist));
    } catch {
      /* Keep the wishlist usable in memory when browser storage is unavailable. */
    }
  }, [wishlist]);
  const toggleWishlist = (code: string) =>
    setWishlist((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  const moveWishlist = (code: string, target: number) =>
    setWishlist((current) => reorderWishlist(current, code, target));
  return { wishlist, toggleWishlist, moveWishlist };
};

export default useWishlist;
