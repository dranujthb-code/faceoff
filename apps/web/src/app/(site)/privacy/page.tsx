import { Prose } from "@/components/Prose";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <Prose title="Privacy policy" updated="9 October 2026" draft>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address, a hash of your password, and your date of birth (to confirm you&apos;re 18+). Your email and date of birth are never shown publicly.</li>
        <li><strong>Profile data you choose to share:</strong> display name, username, picture, bio, location, region, topics and communities.</li>
        <li><strong>Debate data:</strong> challenges, debates you join, comments, reactions and votes. Individual votes are private; only totals are shown.</li>
        <li><strong>Recordings:</strong> only when both debaters consent. We keep a record of each consent and the exact wording shown.</li>
        <li><strong>Live video:</strong> transmitted through our real-time video provider. It is not stored unless the debate is recorded.</li>
        <li><strong>Product analytics:</strong> counts of actions (for example “challenge sent”) linked to your account ID. We don&apos;t store IP addresses or device fingerprints in analytics.</li>
        <li><strong>Security data:</strong> session records with browser user-agent, and hashed network identifiers used for rate limiting.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To run FaceOff, find you opponents and debates, send notifications you&apos;ve allowed, keep the platform safe, and measure whether the product works. We don&apos;t sell personal data.</p>
      <h2>Who we share it with</h2>
      <p>Service providers that host the platform on our behalf: database and storage hosting, real-time video, email delivery and error monitoring. Each is bound by a data processing agreement. We disclose data to authorities only where legally required.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile, Wall visibility, challenge settings and notification preferences at any time.</li>
        <li>Delete your account from Settings. Your profile and personal details are removed; debates you took part in remain, attributed to “Deleted account”.</li>
        <li>Contact us to request a copy of your data.</li>
      </ul>
      <h2>Retention</h2>
      <p>Account data is kept while your account exists. Moderation records and audit logs are kept as needed to enforce our rules and meet legal obligations. Exact retention periods are pending legal review.</p>
      <h2>Contact</h2>
      <p>Privacy questions: use the contact form and choose “Legal”.</p>
    </Prose>
  );
}
