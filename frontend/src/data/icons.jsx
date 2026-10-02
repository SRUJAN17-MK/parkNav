/**
 * SmartPark - inline icon set (no external icon dependency).
 * Every icon inherits `currentColor` and takes its size from the parent.
 */

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

const make = (paths) =>
  function Icon({ size = 18, ...rest }) {
    return (
      <svg {...base(size)} {...rest}>
        {paths}
      </svg>
    );
  };

export const IconDashboard = make(
  <>
    <rect x="3" y="3" width="7.5" height="8" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.6" />
    <rect x="13.5" y="11" width="7.5" height="10" rx="1.6" />
    <rect x="3" y="14" width="7.5" height="7" rx="1.6" />
  </>,
);

export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const IconMap = make(
  <>
    <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
    <path d="M9 4v13M15 6.5v13" />
  </>,
);

export const IconNavigation = make(
  <>
    <path d="M21 3 3 10.5l7.5 3L14 21l7-18Z" />
  </>,
);

export const IconHistory = make(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v4h4" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const IconCamera = make(
  <>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H8l1.5-2h5L16 6h2.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" />
    <circle cx="12" cy="13" r="3.4" />
  </>,
);

export const IconCar = make(
  <>
    <path d="M4 16.5V19a1 1 0 0 1-1 1H2.5M20 16.5V19a1 1 0 0 0 1 1h.5" />
    <path d="M2.5 16.5h19v-4.2l-1.7-.4-1.9-4.4A2 2 0 0 0 16 6.5H8a2 2 0 0 0-1.9 1.4l-1.9 4.4-1.7.4v4.2Z" />
    <path d="M6.6 12h.01M17.4 12h.01" />
  </>,
);

export const IconGrid = make(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.4" />
    <rect x="14" y="3" width="7" height="7" rx="1.4" />
    <rect x="3" y="14" width="7" height="7" rx="1.4" />
    <rect x="14" y="14" width="7" height="7" rx="1.4" />
  </>,
);

export const IconCheck = make(<path d="m4.5 12.5 5 5 10-11" />);

export const IconCheckCircle = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.2 2.7 2.7L16 9.5" />
  </>,
);

export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />);

export const IconXCircle = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </>,
);

export const IconAlert = make(
  <>
    <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 16.8h.01" />
  </>,
);

export const IconArrowLeft = make(
  <>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </>,
);

export const IconArrowRight = make(
  <>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </>,
);

export const IconLogout = make(
  <>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17 5 12l5-5M5 12h11" />
  </>,
);

export const IconMenu = make(<path d="M4 6h16M4 12h16M4 18h16" />);

export const IconTurnLeft = make(
  <>
    <path d="M9 20V10a3 3 0 0 1 3-3h7" />
    <path d="m15 3 4 4-4 4" />
  </>,
);

export const IconTurnRight = make(
  <>
    <path d="M15 20V10a3 3 0 0 0-3-3H5" />
    <path d="m9 3-4 4 4 4" />
  </>,
);

export const IconStraight = make(
  <>
    <path d="M12 20V5" />
    <path d="m7 10 5-5 5 5" />
  </>,
);

export const IconUTurn = make(
  <>
    <path d="M8 20v-8a4 4 0 0 1 8 0v3" />
    <path d="m13 12 3 3 3-3" />
  </>,
);

export const IconDoor = make(
  <>
    <path d="M4 21h16" />
    <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3H17a1 1 0 0 1 1 1v17" />
    <circle cx="13.5" cy="12" r="1" fill="currentColor" stroke="none" />
  </>,
);

export const IconFlag = make(
  <>
    <path d="M5 21V4" />
    <path d="M5 4h11l-1.6 3.5L16 11H5" />
  </>,
);

export const IconGauge = make(
  <>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="m12 14 4-4" />
  </>,
);

export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 2" />
  </>,
);

export const IconFilter = make(
  <>
    <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />
  </>,
);

export const IconUser = make(
  <>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </>,
);

export const IconUsers = make(
  <>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M17.5 14.4A6.5 6.5 0 0 1 21.5 20" />
  </>,
);

export const IconRadar = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.6" />
    <path d="M12 12 18 6" />
  </>,
);

export const IconBuilding = make(
  <>
    <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
    <path d="M14 10h4a2 2 0 0 1 2 2v9" />
    <path d="M3 21h18" />
    <path d="M7.5 8h3M7.5 12h3M7.5 16h3" />
  </>,
);

export const IconPlay = make(
  <>
    <path d="M7 4.8 19 12 7 19.2V4.8Z" />
  </>,
);

export const IconRefresh = make(
  <>
    <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M4 12.5A8 8 0 0 0 17.7 17.7L20 15.5" />
    <path d="M20 20v-4.5h-4.5" />
  </>,
);

export const IconPin = make(
  <>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </>,
);

export const IconZap = make(<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />);

export const IconPrint = make(
  <>
    <path d="M7 9V3h10v6" />
    <path d="M5 9h14a2 2 0 0 1 2 2v6h-4v4H7v-4H3v-6a2 2 0 0 1 2-2Z" />
  </>,
);

export const IconClipboard = make(
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 10h6M9 14h6M9 18h3" />
  </>,
);

export const IconInfo = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>,
);

export const IconUpload = make(
  <>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </>,
);

export const IconLayers = make(
  <>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </>,
);

export const IconTarget = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </>,
);

export const IconTrendUp = make(
  <>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </>,
);

export const IconShield = make(
  <>
    <path d="M12 3 4.5 6v6c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
