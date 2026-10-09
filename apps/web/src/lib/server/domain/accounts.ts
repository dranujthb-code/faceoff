import "server-only";
import { CONSENT_VERSIONS, type OnboardingInput, type SignUpInput } from "@faceoff/shared";
import { asService, asUser } from "../db";
import { DUMMY_HASH, hashPassword, newToken, sha256, verifyPassword } from "../crypto";
import { ApiError, badRequest, conflict } from "../errors";
import { emails, sendEmail } from "../email";
import { env } from "../env";
import { track } from "../analytics";
import { revokeAllSessions } from "../auth";

const TERMS_DISCLOSURE =
  "I am 18 or older and agree to the FaceOff Terms of Service, Privacy Policy and Community Guidelines.";

export async function signUp(input: SignUpInput, userAgent: string | null): Promise<{ userId: string }> {
  const passwordHash = await hashPassword(input.password);
  const userId = await asService(async (tx) => {
    const existing = await tx`select 1 from faceoff.users where email = ${input.email}`;
    if (existing.length) throw conflict("An account with this email already exists. Try signing in instead.");
    const [u] = await tx<{ id: string }[]>`
      insert into faceoff.users (email, password_hash, date_of_birth, terms_version)
      values (${input.email}, ${passwordHash}, ${input.dateOfBirth}, ${CONSENT_VERSIONS.terms})
      returning id`;
    const id = u!.id;
    await tx`insert into faceoff.user_preferences (user_id) values (${id})`;
    await tx`insert into faceoff.consents (user_id, kind, granted, version, disclosure, user_agent) values
      (${id}, 'terms', true, ${CONSENT_VERSIONS.terms}, ${TERMS_DISCLOSURE}, ${userAgent?.slice(0, 300) ?? null}),
      (${id}, 'age', true, ${CONSENT_VERSIONS.terms}, ${"Date of birth provided indicates age 18+"}, ${userAgent?.slice(0, 300) ?? null})`;
    return id;
  });
  await sendVerificationEmail(userId, input.email);
  await track("signup_completed", userId);
  return { userId };
}

export async function sendVerificationEmail(userId: string, email: string) {
  const token = newToken();
  await asService(async (tx) => {
    await tx`update faceoff.auth_tokens set used_at = now() where user_id = ${userId} and kind = 'verify_email' and used_at is null`;
    await tx`insert into faceoff.auth_tokens (user_id, kind, token_hash, expires_at)
             values (${userId}, 'verify_email', ${sha256(token)}, now() + interval '24 hours')`;
  });
  return sendEmail(emails.verify(email, `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`));
}

export async function verifyEmail(token: string): Promise<{ userId: string }> {
  const userId = await asService(async (tx) => {
    const [t] = await tx<{ id: string; user_id: string }[]>`
      select id, user_id from faceoff.auth_tokens
      where token_hash = ${sha256(token)} and kind = 'verify_email' and used_at is null and expires_at > now()
      for update`;
    if (!t) throw new ApiError(400, "invalid_token", "This confirmation link is invalid or has expired. Request a new one.");
    await tx`update faceoff.auth_tokens set used_at = now() where id = ${t.id}`;
    await tx`update faceoff.users set email_verified_at = coalesce(email_verified_at, now()) where id = ${t.user_id}`;
    return t.user_id;
  });
  await track("email_verified", userId);
  return { userId };
}

export async function authenticate(email: string, password: string): Promise<{ userId: string }> {
  const [u] = await asService(
    (tx) => tx<{ id: string; password_hash: string; status: string }[]>`
      select id, password_hash, status from faceoff.users where email = ${email}`,
  );
  const valid = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !valid) throw new ApiError(401, "invalid_credentials", "That email and password don't match.");
  if (u.status === "banned") throw new ApiError(403, "account_banned", "This account has been banned for violating the Community Guidelines.");
  if (u.status === "deleted") throw new ApiError(401, "invalid_credentials", "That email and password don't match.");
  return { userId: u.id };
}

/** Always resolves (no account enumeration). Sends a reset link if the account exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  const [u] = await asService((tx) => tx<{ id: string; status: string }[]>`select id, status from faceoff.users where email = ${email}`);
  if (!u || u.status === "deleted" || u.status === "banned") return;
  const token = newToken();
  await asService(async (tx) => {
    await tx`update faceoff.auth_tokens set used_at = now() where user_id = ${u.id} and kind = 'reset_password' and used_at is null`;
    await tx`insert into faceoff.auth_tokens (user_id, kind, token_hash, expires_at)
             values (${u.id}, 'reset_password', ${sha256(token)}, now() + interval '1 hour')`;
  });
  await sendEmail(emails.reset(email, `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`));
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const userId = await asService(async (tx) => {
    const [t] = await tx<{ id: string; user_id: string }[]>`
      select id, user_id from faceoff.auth_tokens
      where token_hash = ${sha256(token)} and kind = 'reset_password' and used_at is null and expires_at > now()
      for update`;
    if (!t) throw new ApiError(400, "invalid_token", "This reset link is invalid or has expired. Request a new one.");
    await tx`update faceoff.auth_tokens set used_at = now() where id = ${t.id}`;
    // A successful reset proves control of the inbox.
    await tx`update faceoff.users set password_hash = ${hash}, email_verified_at = coalesce(email_verified_at, now()) where id = ${t.user_id}`;
    return t.user_id;
  });
  await revokeAllSessions(userId);
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string) {
  const [u] = await asService((tx) => tx<{ password_hash: string }[]>`select password_hash from faceoff.users where id = ${userId}`);
  if (!u || !(await verifyPassword(current, u.password_hash))) throw badRequest("Your current password is incorrect", { currentPassword: "Incorrect password" });
  const hash = await hashPassword(next);
  await asService((tx) => tx`update faceoff.users set password_hash = ${hash} where id = ${userId}`);
  await revokeAllSessions(userId, sessionId);
}

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  await asUser(userId, async (tx) => {
    const taken = await tx`select 1 from faceoff.profiles where username = ${input.username} and user_id <> ${userId}`;
    if (taken.length) throw badRequest("That username is taken", { username: "That username is taken" });
    await tx`
      insert into faceoff.profiles (user_id, username, display_name, region, bio, onboarded_at)
      values (${userId}, ${input.username}, ${input.displayName}, ${input.region}, ${input.bio ?? null}, now())
      on conflict (user_id) do update set username = excluded.username, display_name = excluded.display_name,
        region = excluded.region, bio = coalesce(excluded.bio, faceoff.profiles.bio), onboarded_at = coalesce(faceoff.profiles.onboarded_at, now())`;
    await tx`delete from faceoff.user_interests where user_id = ${userId}`;
    for (const topicId of input.topicIds) {
      await tx`insert into faceoff.user_interests (user_id, topic_id)
               select ${userId}, id from faceoff.topics where id = ${topicId} and is_active
               on conflict do nothing`;
    }
    for (const communityId of input.communityIds) {
      await tx`insert into faceoff.community_memberships (community_id, user_id) values (${communityId}, ${userId}) on conflict do nothing`;
    }
  });
  await track("onboarding_completed", userId, { topics: input.topicIds.length, communities: input.communityIds.length });
  if (input.communityIds.length) await track("community_joined", userId, { count: input.communityIds.length, source: "onboarding" });
}

export async function deleteAccount(userId: string, password: string) {
  const [u] = await asService((tx) => tx<{ password_hash: string }[]>`select password_hash from faceoff.users where id = ${userId}`);
  if (!u || !(await verifyPassword(password, u.password_hash))) throw badRequest("Incorrect password", { password: "Incorrect password" });
  await asService(async (tx) => {
    // Personal data is removed; past debates remain for other participants, attributed to "Deleted account".
    await tx`update faceoff.users set status = 'deleted', email = ${`deleted+${userId}@deleted.invalid`},
             password_hash = ${await hashPassword(newToken())} where id = ${userId}`;
    await tx`update faceoff.profiles set account_status = 'deleted', bio = null, avatar_key = null, location = null,
             display_name = 'Deleted account', username = ${`deleted_${userId.replace(/-/g, "").slice(0, 14)}`}, available_until = null
             where user_id = ${userId}`;
    await tx`update faceoff.challenges set status = 'cancelled' where status = 'pending' and (challenger_id = ${userId} or recipient_id = ${userId})`;
    await tx`delete from faceoff.follows where follower_id = ${userId} or followee_id = ${userId}`;
    await tx`delete from faceoff.community_memberships where user_id = ${userId}`;
    await tx`update faceoff.motions set status = 'archived' where author_id = ${userId}`;
  });
  await revokeAllSessions(userId);
}
