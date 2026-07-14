// One "ripple emitter" for the hero background — 3 rings on staggered
// delays so several are always visible mid-expansion, like a stone dropped
// in water. `positionClassName` places the origin point; `colorClassName`
// sets the ring color (rings are unfilled borders using currentColor).
export default function RippleOrigin({ positionClassName, colorClassName }) {
  return (
    <div className={`ripple-origin ${positionClassName} ${colorClassName}`} aria-hidden="true">
      <span className="ripple-ring" style={{ animationDelay: "0s" }} />
      <span className="ripple-ring" style={{ animationDelay: "1.7s" }} />
      <span className="ripple-ring" style={{ animationDelay: "3.4s" }} />
    </div>
  );
}
