import { Prose } from "@/components/Prose";

export const metadata = { title: "Community guidelines" };

export default function Guidelines() {
  return (
    <Prose title="Community guidelines" updated="9 October 2026" intro="FaceOff exists for disagreement. You can argue for unpopular positions, challenge orthodoxy and be blunt. What you can't do is attack people instead of ideas.">
      <h2>Always allowed</h2>
      <ul>
        <li>Strong, unpopular or minority opinions on any topic, argued in good faith.</li>
        <li>Sharp criticism of ideas, policies, institutions and public figures&apos; public conduct.</li>
        <li>Changing your mind on camera. It&apos;s the best thing that can happen in a debate.</li>
      </ul>
      <h2>Not allowed</h2>
      <ul>
        <li><strong>Threats and incitement</strong> — threatening anyone, or encouraging violence.</li>
        <li><strong>Harassment</strong> — targeted abuse, repeated unwanted contact, or pile-ons against a person.</li>
        <li><strong>Hateful conduct</strong> — attacking people for a protected characteristic such as race, ethnicity, religion, disability, sex, gender identity or sexual orientation.</li>
        <li><strong>Doxxing</strong> — sharing someone&apos;s private information, such as their address, workplace or phone number.</li>
        <li><strong>Impersonation</strong> — pretending to be someone else, including public figures.</li>
        <li><strong>Sexual content</strong> and anything that endangers children. FaceOff is for adults aged 18 and over.</li>
        <li><strong>Spam and manipulation</strong> — fake accounts, vote rigging, coordinated reporting.</li>
        <li><strong>Illegal activity</strong>, including promoting self-harm.</li>
      </ul>
      <h2>Disagreement isn&apos;t a violation</h2>
      <p>Reports are reviewed against these rules, not against whether a viewpoint is popular. We don&apos;t remove content because people disagree with it.</p>
      <h2>Enforcement</h2>
      <p>Depending on severity, we may hide a comment, motion or debate; stop a live debate; issue a warning; suspend an account temporarily; or ban it. Every decision records a reason, notifies you, and can be appealed from Settings, Account standing. A different reviewer handles each appeal.</p>
      <h2>Your tools</h2>
      <ul>
        <li>Block someone to stop them challenging you, following you, seeing your Wall or commenting on your debates.</li>
        <li>Mute someone to hide their comments from you.</li>
        <li>Limit challenges to people you follow, or pause them entirely.</li>
        <li>Report anything with the flag or the menu next to it.</li>
      </ul>
    </Prose>
  );
}
