import { z } from "zod";
import {
  CHALLENGE_ELIGIBILITY,
  COMMENT_MAX_LENGTH,
  MIN_AGE,
  POLL_KINDS,
  PROFILE_VISIBILITY,
  PROPOSITION_MAX_LENGTH,
  REACTIONS,
  REGIONS,
  REPORT_REASONS,
  REPORT_TARGETS,
  SIDES,
} from "./constants";

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "faceoff", "support", "help", "api", "settings", "signin", "signup", "login",
  "logout", "root", "system", "moderator", "staff", "official", "about", "terms", "privacy", "home",
  "discover", "activity", "profile", "null", "undefined", "me",
]);

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), "Include at least one letter and one number");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(24, "At most 24 characters")
  .regex(/^[a-z0-9_]+$/, "Use letters, numbers and underscores only")
  .refine((u) => !RESERVED_USERNAMES.has(u), "That username is reserved");

/** Returns age in whole years on `on` for an ISO date string (YYYY-MM-DD). */
export function ageOn(dateOfBirth: string, on: Date = new Date()): number {
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number];
  let age = on.getUTCFullYear() - y;
  const beforeBirthday = on.getUTCMonth() + 1 < m || (on.getUTCMonth() + 1 === m && on.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a real date")
  .refine((s) => ageOn(s) >= MIN_AGE, `You must be ${MIN_AGE} or older to use FaceOff`)
  .refine((s) => ageOn(s) <= 120, "Enter a real date");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  dateOfBirth: dateOfBirthSchema,
  acceptTerms: z.literal(true, { message: "You must accept the Terms and Community Guidelines" }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(128) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1, "Enter a display name").max(50).optional(),
  bio: z.string().trim().max(280, "Keep your bio under 280 characters").optional(),
  location: z.string().trim().max(60).optional(),
  region: z.enum(REGIONS).optional(),
  visibility: z.enum(PROFILE_VISIBILITY).optional(),
  challengeEligibility: z.enum(CHALLENGE_ELIGIBILITY).optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Enter a display name").max(50),
  region: z.enum(REGIONS),
  topicIds: z.array(z.string().uuid()).min(1, "Pick at least one topic").max(12),
  communityIds: z.array(z.string().uuid()).max(30).default([]),
  bio: z.string().trim().max(280).optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const preferencesSchema = z.object({
  notifyChallenges: z.boolean().optional(),
  notifyReminders: z.boolean().optional(),
  notifyFollowers: z.boolean().optional(),
  notifyCommunity: z.boolean().optional(),
  notifyReplays: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

export const propositionSchema = z
  .string()
  .trim()
  .min(8, "Write a clear proposition (at least 8 characters)")
  .max(PROPOSITION_MAX_LENGTH, `Keep the proposition under ${PROPOSITION_MAX_LENGTH} characters`);

export const createChallengeSchema = z
  .object({
    recipientId: z.string().uuid(),
    proposition: propositionSchema,
    context: z.string().trim().max(500).optional(),
    challengerSide: z.enum(SIDES),
    motionId: z.string().uuid().optional(),
    communityId: z.string().uuid().optional(),
    kind: z.enum(["instant", "scheduled"]),
    proposedStart: z.string().datetime({ offset: true }).optional(),
    groundRules: z.string().trim().max(300).optional(),
    recordingEnabled: z.boolean().default(true),
    visibility: z.enum(["public", "unlisted"]).default("public"),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "scheduled") {
      if (!v.proposedStart) {
        ctx.addIssue({ code: "custom", path: ["proposedStart"], message: "Pick a date and time" });
        return;
      }
      const t = Date.parse(v.proposedStart);
      if (t < Date.now() + 5 * 60_000) ctx.addIssue({ code: "custom", path: ["proposedStart"], message: "Schedule at least 5 minutes ahead" });
      if (t > Date.now() + 60 * 86_400_000) ctx.addIssue({ code: "custom", path: ["proposedStart"], message: "Schedule within the next 60 days" });
    }
  });
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const respondChallengeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), acceptRecording: z.boolean().optional() }),
  z.object({ action: z.literal("decline"), reason: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("propose_time"), proposedStart: z.string().datetime({ offset: true }) }),
]);
export type RespondChallengeInput = z.infer<typeof respondChallengeSchema>;

export const consentSchema = z.object({
  acceptRules: z.literal(true, { message: "Accept the debate rules to continue" }),
  acceptRecording: z.boolean(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write something").max(COMMENT_MAX_LENGTH, `Keep comments under ${COMMENT_MAX_LENGTH} characters`),
});
export const reactionSchema = z.object({ kind: z.enum(REACTIONS), side: z.enum(SIDES).optional() });
export const voteSchema = z.object({ poll: z.enum(POLL_KINDS), choice: z.string().min(1).max(20) });

export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});

export const motionSchema = z.object({
  title: propositionSchema,
  context: z.string().trim().max(500).optional(),
  communityId: z.string().uuid().optional(),
  authorSide: z.enum(SIDES).optional(),
});

export const appealSchema = z.object({ actionId: z.string().uuid(), body: z.string().trim().min(10).max(1000) });
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  topic: z.enum(["support", "safety", "press", "partnerships", "legal", "other"]),
  message: z.string().trim().min(10, "Tell us a little more").max(2000),
});

export const paginationSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
