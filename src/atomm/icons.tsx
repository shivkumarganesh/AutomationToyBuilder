/** Inline stroked icons, 16 px, colour inherited from the parent's text token. */
const I = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg className={size === 20 ? 'icon icon-20' : 'icon'} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    <path d={d} />
  </svg>
)
export const IconGrid = () => (
  <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
  </svg>
)
export const IconFigure = () => <I d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12 6.6 8.4 3 7l3.6-1.4ZM12.5 11.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" />
export const IconScenery = () => <I d="M1.5 13h13M3 13l3.5-6 2.5 4 1.5-2.5L13 13M11.5 4.5a1.2 1.2 0 1 0 0-.01" />
export const IconImport = () => <I d="M8 10V3M5 6l3-3 3 3M3 11v2h10v-2" />
export const IconPanel = () => (
  <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M6 3v10" />
  </svg>
)
export const IconBack = () => <I d="m10 4-4 4 4 4" />
export const IconMinus = () => <I d="M4 8h8" />
export const IconPlus = () => <I d="M8 4v8M4 8h8" />
export const IconFit = () => <I d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
export const IconReset = () => <I d="M3 8a5 5 0 1 0 1.5-3.6M3 3v3h3" />
export const IconClose = () => <I d="m4 4 8 8M12 4l-8 8" />
export const IconCheck = () => <I d="m3.5 8.5 3 3 6-7" />
export const IconWarn = () => <I d="M8 2.5 14 13H2ZM8 6.5v3M8 11.3h.01" />
export const IconTrash = () => <I d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
export const IconBulb = () => (
  <I size={20} d="M7.5 15.5h5M8.5 17.8h3M10 2.2a5 5 0 0 1 3 9c-.6.5-.9 1.1-.9 1.8H7.9c0-.7-.3-1.3-.9-1.8a5 5 0 0 1 3-9Z" />
)
export const IconInfo = () => (
  <svg className="icon icon-20" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 9.2v4.6M10 6.6h.01" />
  </svg>
)
