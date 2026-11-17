import { useId } from 'react';

/**
 * KeelSonar mark, drawn to the Keel family spec (QuantProcessing/keel-brand):
 * a 28x28 tile in a 32 viewBox, radius 8, #50d2c1, with the figure cut out as
 * a mask. The figure is a sonar ping ((•)) over the family keel triangle that
 * KeelUni and the Keel mark share. Master: brand/keelsonar.svg.
 */
export function BrandMark({ size = 34 }: { size?: number }) {
  const maskId = `keelsonar-mask-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="KeelSonar"
    >
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="#fff" />
          <circle cx="16" cy="14.5" r="2.2" fill="#000" />
          <path
            d="M19.68 10.82a5.2 5.2 0 0 1 0 7.36M12.32 18.18a5.2 5.2 0 0 1 0 -7.36M23.28 8.39a9.5 9.5 0 0 1 0 12.22M8.72 20.61a9.5 9.5 0 0 1 0 -12.22"
            fill="none"
            stroke="#000"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M13.4 22.8h5.2L16 26.6z"
            fill="#000"
            stroke="#000"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" className="brand-mark-tile" mask={`url(#${maskId})`} />
    </svg>
  );
}
