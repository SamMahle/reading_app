import type { ReactNode } from 'react';

/** Inline icons: no icon font or network fetch. Stroke icons on a 24 grid. */
function Svg({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Svg filled>
    <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.3-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z" />
  </Svg>
);
export const SpeakerIcon = () => (
  <Svg>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="currentColor" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
  </Svg>
);
export const ArrowIcon = () => (
  <Svg>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
);
export const RedoIcon = () => (
  <Svg>
    <path d="M20 11a8 8 0 1 0-2.3 6.3M20 4.5V11h-6.5" />
  </Svg>
);
export const CrossIcon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const GearIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </Svg>
);
export const HomeIcon = () => (
  <Svg>
    <path d="M4 11.5L12 4.5l8 7M6.5 10v9.5h11V10" />
  </Svg>
);
export const BookIcon = () => (
  <Svg>
    <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" />
  </Svg>
);
export const BooksIcon = () => (
  <Svg>
    <path d="M5 4.5h3.5v15H5zM10.5 4.5H14v15h-3.5zM15.6 6.2l3.3-.9 3 13.3-3.3.9z" />
  </Svg>
);
export const StarIcon = ({ filled = true }: { filled?: boolean }) => (
  <Svg filled={filled}>
    <path d="M12 3.6l2.5 5.3 5.7.7-4.2 4 1.1 5.8-5.1-2.9-5.1 2.9 1.1-5.8-4.2-4 5.7-.7z" />
  </Svg>
);
export const HeartIcon = () => (
  <Svg filled>
    <path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.4-7.5 10-7.5 10z" />
  </Svg>
);
export const SoloIcon = () => (
  <Svg>
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M5 20.5c.6-4 3.3-6 7-6s6.4 2 7 6" />
  </Svg>
);
export const CoachIcon = () => (
  <Svg>
    <circle cx="8" cy="8.5" r="2.8" />
    <circle cx="16.5" cy="6.8" r="3.3" />
    <path d="M2.8 20.5c.4-3.2 2.4-5 5.2-5 1.2 0 2.2.3 3 .9M10.8 20.5c.5-4.2 2.7-6.5 5.7-6.5s5.2 2.3 5.7 6.5" />
  </Svg>
);
export const MicIcon = () => (
  <Svg>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </Svg>
);
export const StopIcon = () => (
  <Svg filled>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
  </Svg>
);
export const TrashIcon = () => (
  <Svg>
    <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7" />
  </Svg>
);
export const MoonIcon = () => (
  <Svg>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
  </Svg>
);
