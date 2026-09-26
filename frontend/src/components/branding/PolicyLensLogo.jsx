import React from 'react';
import fullLogo from '../../assets/branding/policylens-logo.png';
import markLogo from '../../assets/branding/policylens-mark.png';

/**
 * Official PolicyLens Brand Logo Component.
 * Uses the official brand asset uploaded and approved for the project.
 *
 * Props:
 *   variant — 'full' | 'mark' (default: 'full')
 *   size    — 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 *   alt     — custom alt text (default: 'PolicyLens — Financial Risk Intelligence')
 *   className — additional CSS classes
 *   style   — container style overrides
 *   imgStyle — image style overrides
 *   onClick — optional click handler
 */
export default function PolicyLensLogo({
  variant = 'full',
  size = 'md',
  alt = 'PolicyLens — Financial Risk Intelligence',
  className = '',
  style = {},
  imgStyle = {},
  onClick,
  ...rest
}) {
  const isMark = variant === 'mark';
  const src = isMark ? markLogo : fullLogo;

  // Preset dimensions ensuring aspect ratio preservation
  const sizeMap = {
    full: {
      sm: { maxHeight: 22, maxWidth: 120 },
      md: { maxHeight: 32, maxWidth: 175 },
      lg: { maxHeight: 46, maxWidth: 230 },
      xl: { maxHeight: 60, maxWidth: 300 },
    },
    mark: {
      sm: { width: 20, height: 20 },
      md: { width: 28, height: 28 },
      lg: { width: 40, height: 40 },
      xl: { width: 56, height: 56 },
    },
  };

  const dimensions = (sizeMap[variant] || sizeMap.full)[size] || sizeMap.full.md;

  return (
    <div
      className={`brand-logo brand-logo--${variant} brand-logo--${size} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        ...style,
      }}
      onClick={onClick}
      {...rest}
    >
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        style={{
          display: 'block',
          objectFit: 'contain',
          height: 'auto',
          width: 'auto',
          ...dimensions,
          ...imgStyle,
        }}
      />
    </div>
  );
}
