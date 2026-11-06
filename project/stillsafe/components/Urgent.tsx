import { URGENT_SIGNS } from "../lib/score";

export function UrgentBanner() {
  return (
    <div className="urgent" role="note">
      <strong>Call your provider or labor &amp; delivery now</strong> if your baby is moving less than usual, or you have bleeding, leaking fluid, severe pain, or a severe headache. Don&apos;t wait for your next appointment.
    </div>
  );
}

export function UrgentScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="urgent full" role="alert">
      <h2 style={{ color: "var(--urgent)" }}>Please get checked now</h2>
      <p>What you described can be a sign that your baby needs to be checked today. This is not something to wait on.</p>
      <ul className="list">
        <li>Call your midwife, doctor, or hospital labor &amp; delivery unit <b>now</b>. They&apos;d rather see you and find everything is fine.</li>
        <li>If you can&apos;t reach them, go to the nearest hospital or call your local emergency number.</li>
        <li>Don&apos;t use a home heartbeat monitor or an app to reassure yourself instead.</li>
      </ul>
      <p className="small">Warning signs to act on any time:</p>
      <ul className="list small">{URGENT_SIGNS.map((s) => <li key={s}>{s}</li>)}</ul>
      <button className="btn secondary" style={{ marginTop: 12 }} onClick={onContinue}>I&apos;ve contacted my provider — continue</button>
    </div>
  );
}
