import "server-only";
import type { ProfileSummary } from "@faceoff/shared";
import { publicUrl } from "../storage";

export interface ProfileRowLike {
  user_id: string;
  username: string;
  display_name: string;
  avatar_key: string | null;
  is_demo: boolean;
  available_until?: Date | null;
  account_status?: string;
}

export function toProfileSummary(r: ProfileRowLike): ProfileSummary {
  const gone = r.account_status === "deleted";
  return {
    userId: r.user_id,
    username: gone ? "deleted" : r.username,
    displayName: gone ? "Deleted account" : r.display_name,
    avatarUrl: gone ? null : publicUrl(r.avatar_key),
    isDemo: r.is_demo,
    availableNow: !!r.available_until && r.available_until.getTime() > Date.now(),
  };
}

/** Builds a ProfileSummary from prefixed columns (e.g. "c_" → c_user_id, c_username, ...). */
export function prefixedProfile(row: Record<string, unknown>, prefix: string): ProfileSummary {
  return toProfileSummary({
    user_id: row[`${prefix}user_id`] as string,
    username: row[`${prefix}username`] as string,
    display_name: row[`${prefix}display_name`] as string,
    avatar_key: (row[`${prefix}avatar_key`] as string | null) ?? null,
    is_demo: Boolean(row[`${prefix}is_demo`]),
    available_until: (row[`${prefix}available_until`] as Date | null) ?? null,
    account_status: row[`${prefix}account_status`] as string | undefined,
  });
}

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
