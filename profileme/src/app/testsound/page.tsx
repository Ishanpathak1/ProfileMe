"use client";

import SoundPlayCard from "@/features/sound-login/SoundPlayCard";

export default function TestSoundPage() {
  return (
    <div className="px-6 py-5 max-w-3xl mx-auto" style={{ minHeight: "100vh" }}>
      <h3 className="m-0 text-xl font-semibold" style={{ color: "var(--foreground)", marginBottom: 12 }}>Test Sound</h3>
      <SoundPlayCard />
    </div>
  );
}

