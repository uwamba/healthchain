"use client";

import { useEffect, useState } from "react";

// Drives every demo scene's auto-looping "click" — flips a boolean on a
// timer so a scene can render its before/after state and pulse the click
// cursor at the same moment, with no user interaction required (these are
// passive, watch-only demos on a marketing/explainer page). `offset` staggers
// scenes so a page full of them doesn't click all at once.
export default function useDemoCycle({ period = 2600, offset = 0 } = {}) {
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    let intervalId;
    const startDelay = setTimeout(() => {
      setClicked(true);
      intervalId = setInterval(() => setClicked((c) => !c), period);
    }, offset || period);

    return () => {
      clearTimeout(startDelay);
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return clicked;
}
