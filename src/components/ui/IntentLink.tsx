"use client";

import Link from "next/link";
import { useState } from "react";

// A Link that prefetches the whole page as soon as the user shows intent
// (hover, keyboard focus or touch) rather than on click. Every page here is
// dynamic, so plain Links only prefetch the loading skeleton; starting the
// full fetch on hover hides most of the India→US round trip, and the result
// is reused for staleTimes.static (next.config.ts). Nothing is prefetched for
// links the user never points at.
export function IntentLink(props: React.ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  const arm = () => setIntent(true);
  return (
    <Link
      {...props}
      prefetch={intent ? true : false}
      onMouseEnter={(e) => {
        arm();
        props.onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        arm();
        props.onFocus?.(e);
      }}
      onTouchStart={(e) => {
        arm();
        props.onTouchStart?.(e);
      }}
    />
  );
}
