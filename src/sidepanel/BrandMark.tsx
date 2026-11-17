/**
 * KeelSonar mark: the Keel family letter tile (KeelUni = U, KeelCue = Q).
 * Inline so it follows the panel theme tokens; the static master lives in
 * brand/keelsonar-mark.svg and public/icon.svg.
 */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="KeelSonar"
    >
      <rect width="64" height="64" rx="14" className="brand-mark-tile" />
      <path
        d="M42.6 22.4C40.2 19.2 36.4 17.2 32 17.2C26 17.2 21.6 20.6 21.6 25.3C21.6 30.3 26.2 31.3 32 32.2C37.8 33.1 42.6 34.6 42.6 39.7C42.6 44.5 38 47.8 32 47.8C27.4 47.8 23.6 45.8 21.4 42.6"
        className="brand-mark-glyph"
        fill="none"
        strokeWidth="7.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
