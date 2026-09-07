import type { LucideIcon } from "lucide-react";

/** iOS ayarlar tarzı renkli squircle ikon rozeti. */
export function IconChip({
  icon: Icon,
  tint,
  size = 38,
  iconSize = 19,
}: {
  icon: LucideIcon;
  tint: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `color-mix(in srgb, ${tint} 17%, transparent)`,
        color: tint,
      }}
    >
      <Icon size={iconSize} strokeWidth={2} />
    </span>
  );
}
