import { useId } from "react";
import type { MachineStatus } from "@/lib/types";

/**
 * Line drawing of a front-loading washer, traced from the sample art.
 * Strokes only. While running the clothes tumble behind the glass and the
 * body trembles; when done the display blinks "End".
 */
export function WashingMachine({
  status,
  display,
  broken = false,
  className = "",
}: {
  status: MachineStatus;
  display: string;
  broken?: boolean;
  className?: string;
}) {
  const running = status === "running" && !broken;
  const clipId = `glass${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 880 1000"
      role="img"
      aria-label={`Washing machine, ${broken ? "out of order" : status === "idle" ? "free" : status}`}
      className={`wm ${running ? "wm-running" : ""} ${status === "done" || broken ? "wm-done" : ""} ${broken ? "wm-broken" : ""} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={7}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="522" cy="505" r="140" />
        </clipPath>
      </defs>

      {/* side panel in perspective */}
      <path d="M208 66 L80 88 Q62 92 62 110 L64 858 Q64 874 78 881 L214 964" />
      <path d="M92 124 L158 113 L160 876 L92 838 Z" strokeWidth={5} />

      {/* front */}
      <path d="M208 66 L784 64 Q806 64 806 86 L806 928 Q806 944 790 945 L230 965 Q214 966 214 950 Z" />

      {/* control strip */}
      <path d="M208 204 L418 208 Q430 204 440 196 L806 194" />
      <path d="M435 68 L435 184 Q434 200 420 207" strokeWidth={5} />
      <path d="M252 86 L410 86" strokeWidth={5} />
      <rect x="262" y="156" width="124" height="36" rx="4" strokeWidth={5} />

      <circle cx="521" cy="134" r="33" />
      <circle cx="521" cy="134" r="23" strokeWidth={5} />
      <g strokeWidth={4}>
        {[100, 113, 126, 139, 152, 165].map((y) => (
          <g key={y}>
            <path d={`M458 ${y} L484 ${y}`} />
            <path d={`M558 ${y} L584 ${y}`} />
          </g>
        ))}
      </g>

      <rect x="612" y="96" width="112" height="50" rx="6" strokeWidth={5} />
      <text
        x="668"
        y="132"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        className="wm-display"
        fontSize={display.length > 5 ? 26 : 32}
      >
        {display}
      </text>

      <g strokeWidth={5}>
        {[641, 674, 706].map((x) => (
          <g key={x}>
            <circle cx={x} cy="180" r="10" />
            <path d={`M${x} 170 L${x} 162`} />
          </g>
        ))}
        {[96, 110, 124, 138].map((y) => (
          <rect key={y} x="741" y={y} width="22" height="10" rx="5" />
        ))}
        <circle cx="752" cy="178" r="9" />
      </g>

      {/* door */}
      <ellipse cx="530" cy="505" rx="222" ry="238" />
      <ellipse cx="533" cy="505" rx="211" ry="227" strokeWidth={4} />
      <circle cx="522" cy="505" r="152" />
      <circle cx="527" cy="500" r="141" strokeWidth={4} />
      <path d="M733 404 Q682 450 684 505 Q686 562 735 606" />

      {/* laundry behind the glass */}
      <g clipPath={`url(#${clipId})`} strokeWidth={5}>
        <g className="wm-drum">
          <g transform="translate(522 505) scale(1.3) translate(-522 -505)">
          {/* shirt */}
          <path d="M432 522 L456 506 Q470 516 484 506 L508 522 L499 540 L490 535 L490 588 L450 588 L450 535 L441 540 Z" />
          {/* sock */}
          <path d="M562 420 L562 470 Q562 492 584 494 L606 494 Q618 482 602 472 L586 470 L586 420 Z" />
          {/* towel */}
          <path d="M440 440 Q465 420 490 440 T540 440" />
          <path d="M560 560 Q585 540 610 560" />
          <circle cx="600" cy="600" r="7" strokeWidth={4} />
          <circle cx="445" cy="620" r="5" strokeWidth={4} />
          </g>
        </g>
        {running && <path className="wm-water" d="M360 600 Q400 585 440 600 T520 600 T600 600 T680 600 T760 600" />}
      </g>

      {/* plinth, filter hatch, feet */}
      <path d="M214 852 L806 832" />
      <rect x="658" y="852" width="100" height="70" rx="6" strokeWidth={5} />
      <rect x="700" y="852" width="22" height="9" rx="2" strokeWidth={4} />
      <rect x="224" y="966" width="34" height="12" rx="3" strokeWidth={5} />
      <rect x="706" y="947" width="34" height="11" rx="3" strokeWidth={5} />
      <rect x="82" y="880" width="20" height="10" rx="3" strokeWidth={5} />
    </svg>
  );
}
