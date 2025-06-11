import { type ReactNode, createContext, useState } from "react";

interface RaiseHandContextType {
  raisedHands: Map<string, number>;
  setRaisedHand: (
    identity: string,
    raised: boolean,
    timestamp?: number,
  ) => void;
}

export const RaiseHandContext = createContext<RaiseHandContextType>({
  raisedHands: new Map(),
  setRaisedHand: () => {},
});

interface RaiseHandProviderProps {
  children: ReactNode;
}

export function RaiseHandProvider({ children }: RaiseHandProviderProps) {
  const [raisedHands, setRaisedHandsState] = useState(
    new Map<string, number>(),
  );

  const setRaisedHand = (
    identity: string,
    raised: boolean,
    timestamp = Date.now(),
  ) => {
    setRaisedHandsState((prev) => {
      const newMap = new Map(prev);
      if (raised) {
        newMap.set(identity, timestamp);
      } else {
        newMap.delete(identity);
      }
      return newMap;
    });
  };

  return (
    <RaiseHandContext.Provider value={{ raisedHands, setRaisedHand }}>
      {children}
    </RaiseHandContext.Provider>
  );
}
