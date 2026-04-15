import { supabase, isSupabaseConfigured } from "@/services/supabase";

export type RedeemGiveawayResult =
  | { ok: true; redeemedCount: number }
  | { ok: false; reason: "invalid_code" | "sold_out" | "network" };

/**
 * Atomically increments redemption count for LAUNCH500 when under the cap.
 */
export const redeemLaunchGiveawayCode = async (code: string): Promise<RedeemGiveawayResult> => {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "network" };
  }
  const { data, error } = await supabase.rpc("redeem_giveaway_code", { p_code: code.trim() });
  if (error) {
    return { ok: false, reason: "network" };
  }
  const row = data as { ok?: boolean; reason?: string; redeemed_count?: number } | null;
  if (!row || typeof row.ok !== "boolean") {
    return { ok: false, reason: "network" };
  }
  if (!row.ok) {
    const reason = row.reason === "sold_out" ? "sold_out" : "invalid_code";
    return { ok: false, reason };
  }
  return { ok: true, redeemedCount: Number(row.redeemed_count ?? 0) };
};
