export default function GSLogo({ size = 40, className = "" }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      data-testid="gs-logo"
    >
      {/* Glossy gradient tile */}
      <svg viewBox="0 0 64 64" width={size} height={size} className="absolute inset-0">
        <defs>
          <linearGradient id="gs-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <linearGradient id="gs-shine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="64" height="64" rx="16" fill="url(#gs-bg)" />
        <rect x="0" y="0" width="64" height="34" rx="16" fill="url(#gs-shine)" />
        {/* GS monogram - custom path */}
        <text
          x="32" y="42"
          textAnchor="middle"
          fontFamily="Manrope, Arial, sans-serif"
          fontWeight="800"
          fontSize="28"
          fill="white"
          letterSpacing="-1"
        >GS</text>
      </svg>
      {/* subtle pulse ring */}
      <span className="absolute inset-0 rounded-2xl ring-1 ring-white/40 pointer-events-none" />
    </div>
  );
}

export function GSLogoWithText({ size = 40, subtitle = "Point of Sale" }) {
  return (
    <div className="flex items-center gap-2">
      <GSLogo size={size} />
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Built by R I Billing Pro</div>
        <div className="text-base md:text-lg font-extrabold tracking-tight">
          GS <span className="text-indigo-500">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}
