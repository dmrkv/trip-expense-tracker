import { colorFromString, initialsFromName } from '../lib/avatar';

export default function Avatar({
  name,
  src,
  size = 40,
  className = '',
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const bg = colorFromString(name || 'A');
  return (
    <div
      className={`grid place-items-center rounded-full text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.max(11, Math.round(size * 0.38)),
      }}
      aria-hidden
    >
      {initialsFromName(name || '?')}
    </div>
  );
}
