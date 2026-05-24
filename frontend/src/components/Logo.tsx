type Props = {
  /** Height of the logo image in pixels. Width auto-scales. */
  size?: number;
  /** Adds a contrasting outer ring — useful when sitting on a dark background. */
  onDark?: boolean;
  /** Optional — when provided, a sibling text label is rendered next to the mark. */
  withLabel?: string;
  /** Color tone for the optional label. */
  variant?: 'default' | 'orange';
  className?: string;
};

/**
 * The official PCCHSF crest. The image lives in /public/pcchsf-logo.png — drop your
 * artwork at frontend/public/pcchsf-logo.png and the whole app picks it up.
 */
export function Logo({ size = 44, onDark = false, withLabel, variant = 'default', className = '' }: Props) {
  const labelColor =
    variant === 'orange' ? 'text-saffron-500' : onDark ? 'text-white' : 'text-ink-900';
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <img
        src="/pcchsf-logo.jpg"
        alt="Pimpri Chinchwad Co-Operative Housing Societies Federation"
        width={size}
        height={size}
        className={`block object-contain rounded-full ${onDark ? 'ring-2 ring-white/15' : ''}`}
        style={{ height: size, width: size }}
        draggable={false}
      />
      {withLabel && (
        <span className={`text-base font-bold tracking-tight ${labelColor}`}>{withLabel}</span>
      )}
    </div>
  );
}
