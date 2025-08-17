"use client";

import { create } from "zustand";

type AuthState = {
  isSoundVerified: boolean;
  setSoundVerified: (verified: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isSoundVerified:
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOUND_BYPASS === "true")
      || (typeof window !== "undefined" && localStorage.getItem("devBypassSound") === "true")
      || false,
  setSoundVerified: (verified: boolean) => set({ isSoundVerified: verified }),
}));

