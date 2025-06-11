import { LayoutType } from "@/components/livestreams/room/layouts/permissions";
import { useParticipants } from "@livekit/components-react";
import { useCallback, useState } from "react";

export function useLayoutManagement() {
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>(
    LayoutType.GRID,
  );
  const [presenterId, setPresenterId] = useState<string | null>(null);
  const participants = useParticipants();

  const getAvailableLayouts = useCallback((): LayoutType[] => {
    const availableLayouts: LayoutType[] = [LayoutType.GRID];

    if (participants.length === 1) {
      availableLayouts.push(LayoutType.SINGLE_SPEAKER);
    }

    if (participants.length === 2) {
      availableLayouts.push(LayoutType.SIDE_BY_SIDE, LayoutType.INTERVIEW);
    }

    if (participants.length > 1) {
      availableLayouts.push(LayoutType.PICTURE_IN_PICTURE);
    }

    if (presenterId && participants.some((p) => p.identity === presenterId)) {
      availableLayouts.push(LayoutType.PRESENTATION, LayoutType.PANEL);
    }

    return availableLayouts;
  }, [participants, presenterId]);

  const selectLayout = useCallback(
    (layout: LayoutType) => {
      const available = getAvailableLayouts();
      if (available.includes(layout)) {
        setSelectedLayout(layout);
      }
    },
    [getAvailableLayouts],
  );

  const selectPresenter = useCallback((participantId: string | null) => {
    setPresenterId(participantId);
    if (!participantId) {
      setSelectedLayout(LayoutType.GRID);
    }
  }, []);

  return {
    selectedLayout,
    selectLayout,
    presenterId,
    selectPresenter,
    availableLayouts: getAvailableLayouts(),
  };
}
