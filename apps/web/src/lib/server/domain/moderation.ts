import "server-only";
import { URGENT_REPORT_REASONS, type ReportReason, type ReportTarget } from "@faceoff/shared";
import { asService, asUser } from "../db";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../errors";
import { track } from "../analytics";
import { audit } from "../audit";
import { revokeAllSessions, type Viewer } from "../auth";
import { notify } from "./notifications";
import { adminTerminate } from "./debates";

export async function fileReport(viewer: Viewer, input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string }) {
  const targetUserId = await asService(async (tx) => {
    switch (input.targetType) {
      case "user": {
        const [u] = await tx`select user_id from faceoff.profiles where user_id = ${input.targetId}`;
        if (!u) throw notFound("User not found");
        return u.user_id as string;
      }
      case "comment": {
        const [c] = await tx`select author_id from faceoff.comments where id = ${input.targetId}`;
        if (!c) throw notFound("Comment not found");
        return c.author_id as string;
      }
      case "motion": {
        const [m] = await tx`select author_id from faceoff.motions where id = ${input.targetId}`;
        if (!m) throw notFound("Motion not found");
        return m.author_id as string;
      }
      case "session": {
        const [s] = await tx`select id from faceoff.debate_sessions where id = ${input.targetId}`;
        if (!s) throw notFound("Debate not found");
        return null;
      }
    }
  });
  if (targetUserId === viewer.userId) throw badRequest("You can't report yourself");
  const priority = URGENT_REPORT_REASONS.includes(input.reason) ? 1 : input.targetType === "session" ? 2 : 3;
  try {
    await asUser(viewer.userId, (tx) => tx`
      insert into faceoff.reports (reporter_id, target_type, target_id, target_user_id, reason, details, priority)
      values (${viewer.userId}, ${input.targetType}, ${input.targetId}, ${targetUserId}, ${input.reason}, ${input.details ?? null}, ${priority})`);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw conflict("You've already reported this — our team will review it.");
    throw e;
  }
  await track("report_filed", viewer.userId, { target: input.targetType, reason: input.reason, urgent: priority === 1 });
}

export type ModAction =
  | "warn" | "hide_comment" | "restore_comment" | "hide_session" | "restore_session" | "hide_motion" | "restore_motion"
  | "terminate_session" | "suspend_user" | "unsuspend_user" | "ban_user" | "dismiss_report";

const ADMIN_ONLY: ReadonlySet<ModAction> = new Set(["ban_user"]);
const APPEALABLE: ReadonlySet<ModAction> = new Set(["hide_comment", "hide_session", "hide_motion", "suspend_user", "ban_user", "terminate_session", "warn"]);

export interface ModInput {
  action: ModAction;
  targetType: "user" | "session" | "comment" | "motion" | "report";
  targetId: string;
  reason: string;
  reportId?: string;
  durationDays?: number;
}

export async function applyModeration(actor: Viewer, input: ModInput): Promise<{ actionId: string }> {
  if (ADMIN_ONLY.has(input.action) && actor.role !== "admin") throw forbidden("Only administrators can ban accounts");
  if (input.reason.trim().length < 3) throw badRequest("Give a reason (it is shown to the user and kept in the audit log)");
  if (input.action === "terminate_session") {
    await adminTerminate(input.targetId, actor.userId, input.reason);
  }
  const result = await asService(async (tx) => {
    let subject: string | null = null;
    let expiresAt: Date | null = null;
    switch (input.action) {
      case "hide_comment":
      case "restore_comment": {
        const [c] = await tx`update faceoff.comments set status = ${input.action === "hide_comment" ? "hidden" : "visible"} where id = ${input.targetId} returning author_id`;
        if (!c) throw notFound("Comment not found");
        subject = c.author_id;
        break;
      }
      case "hide_session":
      case "restore_session": {
        const [s] = await tx`update faceoff.debate_sessions set moderation_state = ${input.action === "hide_session" ? "hidden" : "visible"} where id = ${input.targetId} returning host_id`;
        if (!s) throw notFound("Debate not found");
        subject = s.host_id;
        break;
      }
      case "terminate_session": {
        const [s] = await tx`select host_id from faceoff.debate_sessions where id = ${input.targetId}`;
        subject = s?.host_id ?? null;
        break;
      }
      case "hide_motion":
      case "restore_motion": {
        const [m] = await tx`update faceoff.motions set moderation_state = ${input.action === "hide_motion" ? "hidden" : "visible"} where id = ${input.targetId} returning author_id`;
        if (!m) throw notFound("Motion not found");
        subject = m.author_id;
        break;
      }
      case "suspend_user":
      case "ban_user":
      case "unsuspend_user":
      case "warn": {
        const [u] = await tx`select id, role from faceoff.users where id = ${input.targetId}`;
        if (!u) throw notFound("User not found");
        if (u.id === actor.userId) throw badRequest("You can't take enforcement action on your own account");
        if (u.role === "admin" && input.action !== "warn") throw forbidden("Administrators can't be suspended from the console");
        subject = u.id;
        if (input.action === "suspend_user") {
          const days = Math.min(Math.max(input.durationDays ?? 7, 1), 365);
          expiresAt = new Date(Date.now() + days * 86_400_000);
          await tx`update faceoff.users set status = 'suspended', suspended_until = ${expiresAt} where id = ${u.id}`;
          await tx`update faceoff.profiles set account_status = 'suspended', available_until = null where user_id = ${u.id}`;
        } else if (input.action === "ban_user") {
          await tx`update faceoff.users set status = 'banned', suspended_until = null where id = ${u.id}`;
          await tx`update faceoff.profiles set account_status = 'banned', available_until = null where user_id = ${u.id}`;
        } else if (input.action === "unsuspend_user") {
          await tx`update faceoff.users set status = 'active', suspended_until = null where id = ${u.id}`;
          await tx`update faceoff.profiles set account_status = 'active' where user_id = ${u.id}`;
        }
        if (input.action === "suspend_user" || input.action === "ban_user") {
          await tx`update faceoff.challenges set status = 'cancelled', responded_at = now()
                   where status = 'pending' and (challenger_id = ${u.id} or recipient_id = ${u.id})`;
        }
        break;
      }
      case "dismiss_report":
        break;
    }
    const [a] = await tx<{ id: string }[]>`
      insert into faceoff.moderation_actions (moderator_id, action, target_type, target_id, subject_user_id, report_id, reason, expires_at)
      values (${actor.userId}, ${input.action}, ${input.targetType}, ${input.targetId}, ${subject}, ${input.reportId ?? null}, ${input.reason}, ${expiresAt})
      returning id`;
    if (input.reportId) {
      await tx`update faceoff.reports set status = ${input.action === "dismiss_report" ? "dismissed" : "actioned"},
               resolution = ${input.reason}, resolved_at = now(), assigned_to = coalesce(assigned_to, ${actor.userId})
               where id = ${input.reportId}`;
      // Resolve duplicate open reports on the same target with the same outcome.
      if (input.action !== "dismiss_report") {
        await tx`update faceoff.reports r set status = 'actioned', resolution = ${input.reason}, resolved_at = now()
                 from faceoff.reports src where src.id = ${input.reportId} and r.target_type = src.target_type and r.target_id = src.target_id
                   and r.status in ('open','in_review')`;
      }
    }
    await audit(tx, actor.userId, `moderation.${input.action}`, { type: input.targetType, id: input.targetId }, { reason: input.reason, reportId: input.reportId ?? null, durationDays: input.durationDays ?? null });
    if (subject && APPEALABLE.has(input.action)) {
      const labels: Partial<Record<ModAction, string>> = {
        warn: "You received a warning",
        hide_comment: "One of your comments was hidden",
        hide_session: "One of your debates was hidden",
        hide_motion: "One of your motions was hidden",
        suspend_user: "Your account has been suspended",
        ban_user: "Your account has been banned",
        terminate_session: "Your debate was stopped by Trust & Safety",
      };
      await notify(tx, {
        userId: subject,
        kind: "moderation_notice",
        entity: { type: "moderation_action", id: a!.id },
        title: labels[input.action] ?? "A moderation action affected your account",
        body: `Reason: ${input.reason}${expiresAt ? ` (until ${expiresAt.toUTCString()})` : ""}. You can appeal from Settings → Account standing.`,
        href: "/settings/standing",
        dedupeKey: `mod:${a!.id}`,
      });
    }
    return { actionId: a!.id, subject };
  });
  if (input.action === "ban_user" && result.subject) await revokeAllSessions(result.subject);
  await track("enforcement_action", actor.userId, { action: input.action });
  return { actionId: result.actionId };
}

export async function listReports(status: "open" | "in_review" | "actioned" | "dismissed" | "all", staffId: string, limit = 100) {
  return asUser(staffId, async (tx) => {
    const rows = await tx`
      select r.*, rp.username as reporter_username, tp.username as target_username, tp.display_name as target_display_name,
        case r.target_type
          when 'comment' then (select body from faceoff.comments where id = r.target_id)
          when 'session' then (select proposition from faceoff.debate_sessions where id = r.target_id)
          when 'motion' then (select title from faceoff.motions where id = r.target_id)
          else null end as target_preview,
        (select count(*)::int from faceoff.reports r2 where r2.target_type = r.target_type and r2.target_id = r.target_id) as report_count,
        (select count(*)::int from faceoff.moderation_actions ma where ma.subject_user_id = r.target_user_id) as prior_actions
      from faceoff.reports r
      left join faceoff.profiles rp on rp.user_id = r.reporter_id
      left join faceoff.profiles tp on tp.user_id = r.target_user_id
      ${status === "all" ? tx`` : tx`where r.status = ${status}`}
      order by (r.status in ('open','in_review')) desc, r.priority asc, r.created_at asc
      limit ${limit}`;
    return rows;
  });
}

export async function assignReport(actor: Viewer, reportId: string) {
  await asService(async (tx) => {
    const r = await tx`update faceoff.reports set status = 'in_review', assigned_to = ${actor.userId} where id = ${reportId} and status in ('open','in_review') returning id`;
    if (!r.length) throw notFound("Report not found or already resolved");
    await audit(tx, actor.userId, "report.assign", { type: "report", id: reportId });
  });
}

export async function myStanding(userId: string) {
  return asUser(userId, async (tx) => {
    const actions = await tx`
      select a.id, a.action, a.reason, a.expires_at, a.created_at, ap.status as appeal_status, ap.decision_note
      from faceoff.moderation_actions a left join faceoff.appeals ap on ap.action_id = a.id and ap.user_id = ${userId}
      where a.subject_user_id = ${userId} order by a.created_at desc limit 50`;
    const [u] = await tx`select status, suspended_until from faceoff.users where id = ${userId}`;
    return { status: u?.status as string, suspendedUntil: u?.suspended_until as Date | null, actions };
  });
}

export async function fileAppeal(viewer: Viewer, actionId: string, body: string) {
  try {
    await asUser(viewer.userId, (tx) => tx`insert into faceoff.appeals (user_id, action_id, body) values (${viewer.userId}, ${actionId}, ${body})`);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "23505") throw conflict("You've already appealed this decision");
    if (code === "42501") throw notFound("Moderation action not found");
    throw e;
  }
}

export async function listAppeals(staffId: string) {
  return asUser(staffId, (tx) => tx`
    select ap.*, a.action, a.reason, a.target_type, a.target_id, a.created_at as action_created_at, p.username
    from faceoff.appeals ap join faceoff.moderation_actions a on a.id = ap.action_id left join faceoff.profiles p on p.user_id = ap.user_id
    order by (ap.status = 'open') desc, ap.created_at asc limit 100`);
}

const REVERSAL: Partial<Record<ModAction, ModAction>> = {
  hide_comment: "restore_comment",
  hide_session: "restore_session",
  hide_motion: "restore_motion",
  suspend_user: "unsuspend_user",
  ban_user: "unsuspend_user",
};

export async function decideAppeal(actor: Viewer, appealId: string, decision: "upheld" | "overturned", note: string) {
  const [ap] = await asService((tx) => tx`
    select ap.id, ap.status, ap.user_id, a.action, a.target_type, a.target_id, a.moderator_id
    from faceoff.appeals ap join faceoff.moderation_actions a on a.id = ap.action_id where ap.id = ${appealId}`);
  if (!ap) throw notFound("Appeal not found");
  if (ap.status !== "open") throw new ApiError(409, "invalid_state", "This appeal was already decided");
  if (ap.moderator_id === actor.userId && actor.role !== "admin") throw forbidden("A different moderator must review appeals of your own decisions");
  if (decision === "overturned") {
    const reverse = REVERSAL[ap.action as ModAction];
    if (reverse) {
      if (ap.action === "ban_user" && actor.role !== "admin") throw forbidden("Only administrators can overturn bans");
      await applyModeration(actor, { action: reverse, targetType: ap.target_type, targetId: ap.target_id, reason: `Appeal overturned: ${note}` });
    }
  }
  await asService(async (tx) => {
    await tx`update faceoff.appeals set status = ${decision}, decided_by = ${actor.userId}, decision_note = ${note}, decided_at = now() where id = ${appealId}`;
    await audit(tx, actor.userId, `appeal.${decision}`, { type: "appeal", id: appealId }, { note });
    await notify(tx, {
      userId: ap.user_id,
      kind: "moderation_notice",
      entity: { type: "appeal", id: appealId },
      title: decision === "overturned" ? "Your appeal was successful" : "Your appeal was reviewed",
      body: note,
      href: "/settings/standing",
      dedupeKey: `appeal:${appealId}`,
    });
  });
}
