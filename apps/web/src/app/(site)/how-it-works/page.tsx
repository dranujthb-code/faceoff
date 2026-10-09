import { Prose } from "@/components/Prose";
import { DEBATE_DURATION_SECONDS, DISCONNECT_GRACE_SECONDS, FEED_WEIGHTS, MOTION_LISTING_THRESHOLD_PCT, NO_SHOW_GRACE_SECONDS, OPPONENT_WEIGHTS } from "@faceoff/shared";

export const metadata = { title: "How FaceOff works" };

export default function HowItWorks() {
  return (
    <Prose title="How FaceOff works" intro="FaceOff is the Fight Club for Ideas: live, one-on-one, unscripted debates that anyone can start and anyone can watch. The fight is between arguments, never between people.">
      <h2>Your Wall</h2>
      <p>Everyone gets a public profile called a FaceOff Wall. It shows your topics, the motions you&apos;re willing to defend, your upcoming and live debates, and every completed debate and replay. You decide whether your Wall&apos;s debates are visible to everyone or only to followers.</p>
      <h2>Motions</h2>
      <p>A motion is a single clear proposition — “Voting should be mandatory” — that someone is willing to defend. Post one on your Wall and it&apos;s immediately open for challengers. Propose one in a community and it&apos;s listed once {MOTION_LISTING_THRESHOLD_PCT}% of members support it (minimum three supporters).</p>
      <h2>Swipe to challenge</h2>
      <p>The challenge deck shows people you could debate, with the motions they&apos;ll defend. Swipe right (or press Challenge, or the right arrow key) to send a challenge; swipe left to skip them for a week. Every challenge names the proposition, who argues which side, and when. The person you challenge sees all of that before accepting, and can accept, decline or propose another time. Instant challenges expire after 15 minutes.</p>
      <h2>The debate</h2>
      <ul>
        <li>Two debaters, two cameras, {DEBATE_DURATION_SECONDS / 60} minutes, no moderator in the room.</li>
        <li>Both debaters confirm the rules — and whether they consent to recording — in the green room. The clock starts the moment both are ready.</li>
        <li>The clock is kept by FaceOff&apos;s servers, not by anyone&apos;s browser. When time is up, the debate ends for everyone.</li>
        <li>If a debater drops out, they have {DISCONNECT_GRACE_SECONDS} seconds to reconnect before the debate is marked as interrupted. The clock keeps running.</li>
        <li>If a debater doesn&apos;t show up within {NO_SHOW_GRACE_SECONDS / 60} minutes of the start, the debate is called off.</li>
        <li>The host — whoever sent the challenge — can end the debate early.</li>
      </ul>
      <h2>Recording</h2>
      <p>Recording is optional and needs both debaters&apos; consent, given again in the green room right before going live. If either says no, nothing is recorded. A replay appears only after the recording has actually finished processing.</p>
      <h2>Voting — and what it doesn&apos;t mean</h2>
      <p>Viewers answer two separate questions:</p>
      <ul>
        <li><strong>Who argued more persuasively?</strong> A judgement on the arguments made in this debate. Debaters can&apos;t vote on their own.</li>
        <li><strong>Which position do you support?</strong> Your personal view on the proposition.</li>
      </ul>
      <p>Neither poll measures who is factually right. Popularity is not truth, and FaceOff never presents it as such. Voting stays open for 24 hours after a debate so replay viewers can take part.</p>
      <h2 id="ranking">How your feed is ranked</h2>
      <p>We rank with a small, published formula. Items gain points for being live ({FEED_WEIGHTS.live}), starting within a day ({FEED_WEIGHTS.upcomingSoon}), involving someone you follow ({FEED_WEIGHTS.followsParticipant}), being in one of your communities ({FEED_WEIGHTS.communityMatch}) or topics ({FEED_WEIGHTS.topicMatch}), and having a replay ({FEED_WEIGHTS.replay}). Recency decays with a {FEED_WEIGHTS.halfLifeHours}-hour half-life, and participation (votes, comments, views) adds a little on a logarithmic scale.</p>
      <p>We deliberately don&apos;t use controversy, reports, dislikes or how heated the comments are as signals.</p>
      <p>The challenge deck uses the same approach: shared topics ({OPPONENT_WEIGHTS.sharedTopic} each) and communities ({OPPONENT_WEIGHTS.sharedCommunity} each), being available now ({OPPONENT_WEIGHTS.availableNow}), having an open motion ({OPPONENT_WEIGHTS.openMotion}), and recent activity. Each card tells you why you&apos;re seeing it.</p>
      <h2>Safety</h2>
      <p>Unmoderated doesn&apos;t mean unaccountable. Anyone can report a person, a debate, a comment or a motion; block or mute people; and limit who can challenge them. Trust &amp; Safety reviews reports — threats, child-safety concerns, self-harm and doxxing first — and every enforcement decision can be appealed to a different reviewer.</p>
    </Prose>
  );
}
