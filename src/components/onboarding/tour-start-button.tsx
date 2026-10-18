"use client";

import { getIcon } from "@/components/icon";
import { START_TOUR_EVENT } from "@/components/onboarding/onboarding-tour";
import { Button } from "@/components/ui/primitives";

/** Replays the onboarding tour, which otherwise only runs on a first visit. */
export function TourStartButton() {
  const SparkIcon = getIcon("Sparkles");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}
    >
      <SparkIcon size={16} aria-hidden="true" />
      نمایش تور سایت
    </Button>
  );
}
