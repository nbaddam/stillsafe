"use client";
// Speak-to-type using the browser's built-in speech recognition (Web Speech API). No extra service or key.
// Privacy: in Chrome the audio is sent to Google's speech service to be turned into text; Safari can do it
// on the device. The transcript goes into the text box so the user can check and edit it before sending.
import { useEffect, useRef, useState } from "react";

function getRecognizer(): any {
  if (typeof window === "undefined") return null;
  const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return R ? new R() : null;
}

// Simple outline microphone, drawn in the button's text color. Decorative: the text label carries the meaning.
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

export default function VoiceButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<any>(null);

  useEffect(() => { setSupported(!!getRecognizer()); }, []);
  useEffect(() => () => rec.current?.abort?.(), []);

  if (!supported) return null; // e.g. Firefox: just type instead

  const toggle = () => {
    if (listening) { rec.current?.stop(); return; }
    const r = getRecognizer();
    if (!r) return;
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => onText(Array.from(e.results).map((x: any) => x[0].transcript).join(" "));
    r.onerror = (e: any) => setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone access is blocked. You can allow it in your browser settings, or type instead." : e.error === "no-speech" ? "I didn't hear anything. Tap the mic to try again." : "Voice input didn't work this time. You can type instead.");
    r.onend = () => setListening(false);
    rec.current = r;
    setError("");
    setListening(true);
    r.start();
  };

  return (
    <>
      <button type="button" className={`btn mic ${listening ? "on" : ""}`} onClick={toggle} disabled={disabled} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Answer by voice"}>
        {/* Icon + text label (not icon or color alone) says what it does and what state it's in */}
        <MicIcon />
        <span>{listening ? "Stop" : "Voice typing"}</span>
      </button>
      {(listening || error) && (
        <p className="voice-status small" role="status" aria-live="polite">
          {error || "Listening… speak your answer, then check it and tap Send."}
        </p>
      )}
    </>
  );
}
