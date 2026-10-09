"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { setTheme, useTheme } from "@/lib/client/theme";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { REGIONS, REGION_LABELS, type ProfileSummary, type TopicSummary } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Avatar } from "@/components/Avatar";
import { Button, ErrorNote, Field, Input, Modal, Select, Switch, Textarea, Notice } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ResendVerification } from "@/components/ResendVerification";

interface Props {
  profile: { username: string; displayName: string; bio: string; location: string; region: string; visibility: "public" | "followers"; challengeEligibility: "everyone" | "following" | "nobody"; avatarUrl: string | null };
  prefs: Record<string, boolean>;
  blocked: ProfileSummary[];
  topics: TopicSummary[];
  interests: string[];
  account: { email: string; verified: boolean; status: string };
}

function Section({ id, title, children, desc }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6">
      <h2 id={`${id}-h`} className="font-serif text-2xl font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Settings({ profile, prefs: initialPrefs, blocked: initialBlocked, topics, interests: initialInterests, account }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState(profile);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [interests, setInterests] = useState(initialInterests);
  const theme = useTheme();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [del, setDel] = useState({ open: false, password: "", confirm: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const profileForm = useSubmit();
  const pwForm = useSubmit();
  const delForm = useSubmit();
  const avatarForm = useSubmit();

  const applyTheme = setTheme;
  const savePref = async (key: string, value: boolean) => {
    setPrefs((x) => ({ ...x, [key]: value }));
    try { await api("/me/preferences", { method: "PATCH", body: { [key]: value } }); }
    catch { setPrefs((x) => ({ ...x, [key]: !value })); toast("Couldn't save that setting", "error"); }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[200px_1fr]">
      <nav aria-label="Settings sections" className="md:sticky md:top-24 md:self-start">
        <h1 className="mb-4 font-serif text-3xl font-semibold">Settings</h1>
        <ul className="flex flex-wrap gap-1 text-sm md:flex-col">
          {[["profile", "Profile"], ["privacy", "Privacy and safety"], ["notifications", "Notifications"], ["appearance", "Appearance"], ["account", "Account"]].map(([id, l]) => (
            <li key={id}><a href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-muted hover:bg-sunken hover:text-ink">{l}</a></li>
          ))}
          <li><Link href="/settings/standing" className="block rounded-lg px-3 py-1.5 text-muted hover:bg-sunken hover:text-ink">Account standing</Link></li>
        </ul>
      </nav>
      <div className="min-w-0 space-y-6">
        {!account.verified && <ResendVerification email={account.email} />}
        {account.status !== "active" && <Notice tone="warning">Your account is restricted. <Link href="/settings/standing" className="underline">See details or appeal</Link>.</Notice>}

        <Section id="profile" title="Profile" desc="This is what people see on your Wall.">
          <div className="mb-6 flex items-center gap-4">
            <Avatar profile={{ displayName: p.displayName, avatarUrl: p.avatarUrl }} size="lg" />
            <div>
              <Button variant="secondary" size="sm" loading={avatarForm.busy} onClick={() => fileRef.current?.click()}>Change picture</Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Profile picture"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  avatarForm.run(async () => {
                    const fd = new FormData(); fd.append("file", f);
                    const r = await api<{ avatarUrl: string }>("/me/avatar", { method: "POST", body: fd });
                    setP((x) => ({ ...x, avatarUrl: r.avatarUrl })); toast("Picture updated", "success"); router.refresh();
                  });
                }} />
              {avatarForm.error && <p className="mt-1 text-sm text-danger">{avatarForm.error}</p>}
            </div>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); profileForm.run(async () => { await api("/me/profile", { method: "PATCH", body: { displayName: p.displayName, username: p.username, bio: p.bio, location: p.location, region: p.region } }); toast("Profile saved", "success"); router.refresh(); }); }}>
            {profileForm.error && !Object.keys(profileForm.fields).length && <ErrorNote>{profileForm.error}</ErrorNote>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="s-dn" label="Display name" error={profileForm.fields.displayName}><Input id="s-dn" value={p.displayName} maxLength={50} onChange={(e) => setP({ ...p, displayName: e.target.value })} /></Field>
              <Field id="s-un" label="Username" error={profileForm.fields.username}><Input id="s-un" value={p.username} maxLength={24} onChange={(e) => setP({ ...p, username: e.target.value.toLowerCase() })} /></Field>
            </div>
            <Field id="s-bio" label="Bio" hint={`${p.bio.length}/280`} error={profileForm.fields.bio}><Textarea id="s-bio" value={p.bio} maxLength={280} onChange={(e) => setP({ ...p, bio: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="s-loc" label="Location (optional)"><Input id="s-loc" value={p.location} maxLength={60} onChange={(e) => setP({ ...p, location: e.target.value })} /></Field>
              <Field id="s-rg" label="Region"><Select id="s-rg" value={p.region} onChange={(e) => setP({ ...p, region: e.target.value })}>{REGIONS.map((r) => <option key={r} value={r}>{REGION_LABELS[r]}</option>)}</Select></Field>
            </div>
            <Button type="submit" loading={profileForm.busy}>Save profile</Button>
          </form>
          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm font-medium">Topics you debate</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topics.map((t) => {
                const on = interests.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={async () => {
                    const next = on ? interests.filter((x) => x !== t.id) : [...interests, t.id];
                    if (!next.length) return toast("Keep at least one topic", "error");
                    setInterests(next);
                    try { await api("/me/interests", { method: "PUT", body: { topicIds: next } }); } catch { setInterests(interests); toast("Couldn't save topics", "error"); }
                  }} className={clsx("rounded-full border px-3.5 py-1.5 text-sm", on ? "border-ink bg-ink text-bg" : "border-line-strong hover:border-ink")}>{t.name}</button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section id="privacy" title="Privacy and safety">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="s-vis" label="Who can see your Wall's debates and bio">
              <Select id="s-vis" value={p.visibility} onChange={async (e) => { const v = e.target.value as Props["profile"]["visibility"]; setP({ ...p, visibility: v }); await api("/me/profile", { method: "PATCH", body: { visibility: v } }).then(() => toast("Saved", "success")).catch(() => toast("Couldn't save", "error")); }}>
                <option value="public">Everyone</option><option value="followers">Only people who follow you</option>
              </Select>
            </Field>
            <Field id="s-ce" label="Who can challenge you">
              <Select id="s-ce" value={p.challengeEligibility} onChange={async (e) => { const v = e.target.value as Props["profile"]["challengeEligibility"]; setP({ ...p, challengeEligibility: v }); await api("/me/profile", { method: "PATCH", body: { challengeEligibility: v } }).then(() => toast("Saved", "success")).catch(() => toast("Couldn't save", "error")); }}>
                <option value="everyone">Everyone</option><option value="following">Only people I follow</option><option value="nobody">Nobody (pause challenges)</option>
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted">Debates you take part in are public unless the challenge was sent as unlisted. Your email and date of birth are never shown.</p>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-medium">Blocked people</p>
            {blocked.length === 0 ? <p className="mt-2 text-sm text-muted">You haven&apos;t blocked anyone.</p> : (
              <ul className="mt-3 divide-y divide-line">
                {blocked.map((b) => (
                  <li key={b.userId} className="flex items-center gap-3 py-2.5">
                    <Avatar profile={b} size="sm" /><span className="flex-1 text-sm font-medium">{b.displayName} <span className="text-muted">@{b.username}</span></span>
                    <Button size="sm" variant="secondary" onClick={async () => { await api(`/users/id/${b.userId}/block`, { method: "DELETE", body: {} }); setBlocked((xs) => xs.filter((x) => x.userId !== b.userId)); toast("Unblocked", "success"); }}>Unblock</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section id="notifications" title="Notifications" desc="In-app notifications always appear in Activity. Email copies go to your confirmed address.">
          <div className="divide-y divide-line">
            <Switch label="Challenges" description="New challenges, acceptances, declines and time changes" checked={prefs.notifyChallenges!} onChange={(v) => savePref("notifyChallenges", v)} />
            <Switch label="Debate reminders" description="15 minutes before a scheduled FaceOff" checked={prefs.notifyReminders!} onChange={(v) => savePref("notifyReminders", v)} />
            <Switch label="New followers" checked={prefs.notifyFollowers!} onChange={(v) => savePref("notifyFollowers", v)} />
            <Switch label="Community activity" description="Scheduled debates and listed motions in your communities" checked={prefs.notifyCommunity!} onChange={(v) => savePref("notifyCommunity", v)} />
            <Switch label="Results and replays" checked={prefs.notifyReplays!} onChange={(v) => savePref("notifyReplays", v)} />
            <Switch label="Email me too" description="Challenges, reminders, replays and account notices" checked={prefs.emailNotifications!} onChange={(v) => savePref("emailNotifications", v)} />
          </div>
          <p className="mt-3 text-xs text-muted">Push notifications on iOS and Android arrive with the mobile apps.</p>
        </Section>

        <Section id="appearance" title="Appearance">
          <div className="flex gap-2" role="radiogroup" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((t) => (
              <button key={t} role="radio" aria-checked={theme === t} onClick={() => applyTheme(t)} className={clsx("rounded-full border px-4 py-1.5 text-sm font-medium capitalize", theme === t ? "border-ink bg-ink text-bg" : "border-line-strong")}>{t === "system" ? "Match device" : t}</button>
            ))}
          </div>
        </Section>

        <Section id="account" title="Account">
          <p className="text-sm">Signed in as <strong>{account.email}</strong> {account.verified ? <span className="text-success">(confirmed)</span> : <span className="text-warning">(not confirmed)</span>}</p>
          <form className="mt-6 space-y-4 border-t border-line pt-6" onSubmit={(e) => { e.preventDefault(); pwForm.run(async () => { await api("/auth/change-password", { body: pw }); setPw({ currentPassword: "", newPassword: "" }); toast("Password changed. Other devices were signed out.", "success"); }); }}>
            <p className="text-sm font-medium">Change password</p>
            {pwForm.error && !Object.keys(pwForm.fields).length && <ErrorNote>{pwForm.error}</ErrorNote>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pw-c" label="Current password" error={pwForm.fields.currentPassword}><Input id="pw-c" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
              <Field id="pw-n" label="New password" error={pwForm.fields.newPassword}><Input id="pw-n" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            </div>
            <Button type="submit" variant="secondary" loading={pwForm.busy}>Change password</Button>
          </form>
          <div className="mt-6 border-t border-line pt-6">
            <p className="text-sm font-medium">Delete account</p>
            <p className="mt-1 text-sm text-muted">Removes your profile, picture, bio, follows and memberships, and signs you out everywhere. Debates you took part in stay visible to the other debater, attributed to “Deleted account”.</p>
            <Button variant="danger" className="mt-3" onClick={() => setDel({ open: true, password: "", confirm: "" })}>Delete my account</Button>
          </div>
        </Section>
      </div>
      <Modal open={del.open} onClose={() => setDel({ ...del, open: false })} title="Delete your account?">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); delForm.run(async () => { await api("/auth/delete-account", { body: { password: del.password, confirm: del.confirm } }); router.push("/"); router.refresh(); }); }}>
          {delForm.error && <ErrorNote>{delForm.error}</ErrorNote>}
          <Field id="d-pw" label="Your password"><Input id="d-pw" type="password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
          <Field id="d-c" label='Type "DELETE" to confirm'><Input id="d-c" value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value })} /></Field>
          <Button type="submit" variant="danger" disabled={del.confirm !== "DELETE" || !del.password} loading={delForm.busy}>Permanently delete</Button>
        </form>
      </Modal>
    </div>
  );
}
