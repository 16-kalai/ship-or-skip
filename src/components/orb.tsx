import { cn } from "@/lib/cn";

// Rev's face: a slowly swirling, morphing blob. The only colour in the product.
export function Orb({
  size = 24,
  speaking = false,
  className,
}: {
  size?: number;
  // Speeds up the swirl while Rev talks.
  speaking?: boolean;
  className?: string;
}) {
  const pace = speaking ? 1 : 3;
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ animation: `orb-morph ${3 * pace}s ease-in-out infinite` }}
      >
        <span
          className="absolute -inset-1/4"
          style={{
            background:
              "conic-gradient(from 0deg, #7f56d9, #2e90fa, #06aed4, #ee46bc, #7f56d9)",
            animation: `orb-spin ${2.5 * pace}s linear infinite`,
          }}
        />
        <span
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)",
          }}
        />
      </span>
    </span>
  );
}
