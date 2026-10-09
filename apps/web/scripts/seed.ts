/**
 * Seeds reference data (topics, starter communities), an administrator account, and — when
 * SEED_DEMO_CONTENT=true — clearly labelled demonstration users, motions and completed debates.
 * Demo rows carry is_demo = true: the UI badges them "Demo" and analytics exclude them.
 * No demo row ever pretends to be live, and no demo debate claims a recording.
 * Idempotent: safe to run repeatedly.
 */
import { config } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"), quiet: true });
config({ quiet: true });

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;
async function hash(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, 64, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

const TOPICS = [
  ["politics", "Politics", "Elections, governance, parties and power.", true],
  ["public-policy", "Public Policy", "Health, housing, transport, tax — how decisions get made.", true],
  ["technology", "Technology", "Platforms, privacy, gadgets and the internet.", true],
  ["ai", "AI", "Artificial intelligence, automation and the future of work.", true],
  ["education", "Education", "Schools, universities, exams and learning.", false],
  ["economy", "Economy", "Jobs, markets, inflation and money.", false],
  ["culture", "Culture", "Identity, language, art and tradition.", false],
  ["social-issues", "Social Issues", "Rights, equality and how we live together.", true],
  ["sports", "Sports", "Teams, rules, rivalries and the business of sport.", false],
  ["entertainment", "Entertainment", "Film, music, streaming and celebrity.", false],
  ["health", "Health", "Medicine, wellbeing and health systems.", false],
] as const;

const COMMUNITIES = [
  ["ballot-box", "Ballot Box", "politics", "Elections, voting systems and political accountability.", ["elections", "voting"], true],
  ["policy-lab", "Policy Lab", "public-policy", "Test a policy idea against someone who'll pull it apart.", ["policy", "government"], true],
  ["silicon-square", "Silicon Square", "technology", "Big Tech, privacy, platforms and the open internet.", ["privacy", "platforms"], false],
  ["machine-minds", "Machine Minds", "ai", "Will AI take our jobs, save us, or both?", ["ai", "automation"], true],
  ["campus-faceoff", "Campus FaceOff", "education", "Student debaters, university societies and exam season hot takes.", ["students", "universities"], true],
  ["money-matters", "Money Matters", "economy", "Inflation, salaries, crypto and the cost of living.", ["crypto", "jobs"], false],
  ["culture-clash", "Culture Clash", "culture", "Traditions, language and modern identity.", ["identity", "language"], false],
  ["common-ground", "Common Ground", "social-issues", "Hard social questions, argued in good faith.", ["rights", "equality"], false],
  ["locker-room", "Locker Room", "sports", "VAR, transfer fees and who's really the GOAT.", ["football", "cricket"], false],
  ["screen-time", "Screen Time", "entertainment", "Films, series, music and celebrity culture.", ["film", "music"], false],
  ["health-forum", "Health Forum", "health", "Public health, wellbeing and healthcare systems.", ["healthcare", "wellbeing"], false],
] as const;

const DEMO_USERS = [
  ["demo_hannah", "Hannah K.", "Policy nerd. Will argue either side of a housing debate.", "europe", ["politics", "public-policy", "economy"], ["policy-lab", "ballot-box"]],
  ["demo_ubaid", "Ubaid J.", "Engineer by day, AI sceptic by night.", "south_asia", ["ai", "technology"], ["machine-minds", "silicon-square"]],
  ["demo_nora", "Nora A.", "Free-speech maximalist, open to being proven wrong.", "middle_east", ["technology", "social-issues", "politics"], ["silicon-square", "common-ground"]],
  ["demo_gary", "Gary M.", "Energy analyst. Ask me about nuclear.", "americas", ["public-policy", "economy"], ["policy-lab", "money-matters"]],
  ["demo_dana", "Dana R.", "Climate organiser. Coffee first, then debate.", "oceania", ["social-issues", "public-policy"], ["common-ground", "policy-lab"]],
  ["demo_jitesh", "Jitesh S.", "Final-year law student. Campus debating captain.", "south_asia", ["education", "politics"], ["campus-faceoff", "ballot-box"]],
  ["demo_tiffany", "Tiffany K.", "HR leader. Opinions on work culture, strongly held.", "americas", ["economy", "social-issues"], ["money-matters", "common-ground"]],
  ["demo_alana", "Alana P.", "Film critic and reluctant football fan.", "europe", ["entertainment", "sports", "culture"], ["screen-time", "locker-room"]],
  ["demo_robert", "Robert B.", "Retired teacher. Patience of a saint, until you misquote a statistic.", "europe", ["education", "health"], ["campus-faceoff", "health-forum"]],
  ["demo_hinna", "Hinna K.", "Public health researcher.", "middle_east", ["health", "public-policy"], ["health-forum", "policy-lab"]],
] as const;

const DEMO_MOTIONS: Array<[string, string, "for" | "against", string | null]> = [
  ["demo_hannah", "Voting should be mandatory", "for", "ballot-box"],
  ["demo_ubaid", "AI will create more jobs than it destroys", "against", "machine-minds"],
  ["demo_nora", "Censorship is never justifiable", "for", null],
  ["demo_gary", "Nuclear energy is the fastest route to net zero", "for", "policy-lab"],
  ["demo_jitesh", "Exams should be replaced by continuous assessment", "for", "campus-faceoff"],
  ["demo_tiffany", "Four-day work weeks should be the default", "for", "money-matters"],
  ["demo_alana", "VAR has made football worse", "for", "locker-room"],
  ["demo_hinna", "Sugar should be taxed like tobacco", "for", "health-forum"],
];

// [for, against, proposition, community, daysAgo, comments]
const DEMO_DEBATES: Array<[string, string, string, string, number, string[]]> = [
  ["demo_nora", "demo_hannah", "Censorship is never justifiable", "silicon-square", 2, ["Strong opening from Nora.", "Hannah's point about incitement was the turning point for me.", "Great format — ten minutes keeps it tight."]],
  ["demo_gary", "demo_dana", "Nuclear energy is the fastest route to net zero", "policy-lab", 4, ["Dana's cost numbers were hard to answer.", "Would love a rematch on build times."]],
  ["demo_ubaid", "demo_robert", "AI tutors will make teachers obsolete", "machine-minds", 6, ["Robert defended the classroom brilliantly.", "Ubaid's examples felt very current."]],
];

async function main() {
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_ADMIN_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const demo = process.env.SEED_DEMO_CONTENT === "true";
  try {
    await sql.begin(async (tx) => {
      // Write as service_role so seeding works on hosts where the owner role is subject to RLS (e.g. Supabase).
      await tx.unsafe("set local role service_role");
      for (const [i, [slug, name, description, featured]] of TOPICS.entries()) {
        await tx`insert into faceoff.topics (slug, name, description, is_featured, sort_order) values (${slug}, ${name}, ${description}, ${featured}, ${i * 10})
                 on conflict (slug) do update set name = excluded.name, description = excluded.description`;
      }
      for (const [slug, name, topic, description, tags, featured] of COMMUNITIES) {
        await tx`insert into faceoff.communities (slug, name, description, topic_id, tags, is_featured)
                 values (${slug}, ${name}, ${description}, (select id from faceoff.topics where slug = ${topic}), ${tags as unknown as string[]}, ${featured})
                 on conflict (slug) do nothing`;
      }

      const adminEmail = process.env.SEED_ADMIN_EMAIL;
      const adminPassword = process.env.SEED_ADMIN_PASSWORD;
      if (adminEmail && adminPassword) {
        const [existing] = await tx`select id from faceoff.users where email = ${adminEmail}`;
        let adminId: string | undefined = existing?.id as string | undefined;
        if (!adminId) {
          const [u] = await tx`insert into faceoff.users (email, password_hash, email_verified_at, date_of_birth, role, terms_version)
                               values (${adminEmail}, ${await hash(adminPassword)}, now(), '1990-01-01', 'admin', '2026-10-09') returning id`;
          adminId = u!.id as string;
          await tx`insert into faceoff.user_preferences (user_id) values (${adminId!})`;
          await tx`insert into faceoff.profiles (user_id, username, display_name, bio, region, onboarded_at, challenge_eligibility)
                   values (${adminId!}, 'trust_safety', 'FaceOff Trust & Safety', 'Official FaceOff team account.', 'global', now(), 'nobody')`;
          console.log(`created admin ${adminEmail}`);
        }
      }

      if (!demo) return;
      const ids = new Map<string, string>();
      for (const [username, name, bio, region, topics, comms] of DEMO_USERS) {
        const [found] = await tx`select user_id from faceoff.profiles where username = ${username}`;
        let id = found?.user_id as string | undefined;
        if (!id) {
          const [u] = await tx`insert into faceoff.users (email, password_hash, email_verified_at, date_of_birth, terms_version, is_demo)
                               values (${`${username}@demo.faceoff.invalid`}, ${await hash(randomBytes(24).toString("hex"))}, now(), '1992-05-05', '2026-10-09', true)
                               returning id`;
          id = u!.id as string;
          await tx`insert into faceoff.user_preferences (user_id, email_notifications) values (${id}, false)`;
          await tx`insert into faceoff.profiles (user_id, username, display_name, bio, region, is_demo, onboarded_at)
                   values (${id}, ${username}, ${name}, ${bio}, ${region}, true, now() - interval '20 days')`;
          for (const t of topics) await tx`insert into faceoff.user_interests (user_id, topic_id) select ${id}, id from faceoff.topics where slug = ${t} on conflict do nothing`;
          for (const c of comms) await tx`insert into faceoff.community_memberships (community_id, user_id) select id, ${id} from faceoff.communities where slug = ${c} on conflict do nothing`;
        }
        ids.set(username, id);
      }
      // A few demo users are "available now" for instant debates — but they're demo accounts, so
      // instant challenges to them will simply expire. The Demo badge makes that clear in the deck.
      for (const [author, title, side, community] of DEMO_MOTIONS) {
        const exists = await tx`select 1 from faceoff.motions where author_id = ${ids.get(author)!} and title = ${title}`;
        if (exists.length) continue;
        const [m] = await tx`insert into faceoff.motions (author_id, community_id, title, author_side, status, listed_at, is_demo)
                             values (${ids.get(author)!}, ${community ? tx`(select id from faceoff.communities where slug = ${community})` : null}, ${title}, ${side}, 'listed', now(), true)
                             returning id`;
        await tx`insert into faceoff.motion_votes (motion_id, user_id) values (${m!.id}, ${ids.get(author)!}) on conflict do nothing`;
      }
      for (const [forU, againstU, prop, community, daysAgo, comments] of DEMO_DEBATES) {
        const exists = await tx`select 1 from faceoff.debate_sessions where proposition = ${prop} and is_demo`;
        if (exists.length) continue;
        const start = new Date(Date.now() - daysAgo * 86_400_000);
        const end = new Date(start.getTime() + 600_000);
        const [s] = await tx`
          insert into faceoff.debate_sessions (host_id, proposition, community_id, status, visibility, recording_enabled, scheduled_start,
            ready_opened_at, live_started_at, ends_at, ended_at, end_reason, video_room, is_demo, created_at)
          values (${ids.get(forU)!}, ${prop}, (select id from faceoff.communities where slug = ${community}), 'completed', 'public', false,
            ${start}, ${start}, ${start}, ${end}, ${end}, 'time_elapsed', ${"demo_" + randomBytes(6).toString("hex")}, true, ${start})
          returning id`;
        const sid = s!.id as string;
        await tx`insert into faceoff.session_participants (session_id, user_id, side, consented_at, ready_at, joined_at, last_seen_at) values
          (${sid}, ${ids.get(forU)!}, 'for', ${start}, ${start}, ${start}, ${end}), (${sid}, ${ids.get(againstU)!}, 'against', ${start}, ${start}, ${start}, ${end})`;
        const audience = [...ids.entries()].filter(([u]) => u !== forU && u !== againstU).map(([, id]) => id);
        for (const [i, body] of comments.entries()) {
          await tx`insert into faceoff.comments (session_id, author_id, body, created_at) values (${sid}, ${audience[i % audience.length]!}, ${body}, ${new Date(start.getTime() + (i + 1) * 120_000)})`;
        }
        const [pp] = await tx`insert into faceoff.polls (session_id, kind, question, status, closes_at) values (${sid}, 'persuasion', 'Who argued more persuasively?', 'closed', ${end}) returning id`;
        const [po] = await tx`insert into faceoff.polls (session_id, kind, question, status, closes_at) values (${sid}, 'position', 'Which position do you support?', 'closed', ${end}) returning id`;
        for (const [i, voter] of audience.entries()) {
          await tx`insert into faceoff.poll_votes (poll_id, user_id, choice) values (${pp!.id}, ${voter}, ${["for", "against", "for", "tie"][i % 4]!})`;
          await tx`insert into faceoff.poll_votes (poll_id, user_id, choice) values (${po!.id}, ${voter}, ${["against", "for", "undecided", "for"][i % 4]!})`;
        }
      }
      console.log(`seeded demo content: ${ids.size} demo users, ${DEMO_MOTIONS.length} motions, ${DEMO_DEBATES.length} completed debates`);
    });
    console.log("seed complete");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
