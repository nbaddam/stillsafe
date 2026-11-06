"use client";
import Conversation from "../components/Conversation";

export default function Home() {
  return (
    <main className="wrap">
      <div className="brand"><span className="dot" /> StillSafe <small><a href="/cdc">How we validated this</a> · not medical advice</small></div>
      <Conversation />
    </main>
  );
}
