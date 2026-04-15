/**
 * Lifetime Pro redemption — code `LAUNCH500` is validated server-side for the first ~500 early users.
 */
import { useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { PremiumPressable } from "@/components/PremiumPressable";
import { redeemLaunchGiveawayCode } from "@/services/giveaway";
import { useProStore } from "@/store/proStore";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/constants/i18n";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";
import { CM, INPUT_PLACEHOLDER } from "@/constants/theme";

type Props = {
  onLifetimeSuccess?: () => void;
};

export const LaunchCodeSection = ({ onLifetimeSuccess }: Props) => {
  const languageCode = useAppStore((s) => s.languageCode);
  const openUpgradeModal = useProStore((s) => s.openUpgradeModal);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const activate = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBanner(null);
    const upper = trimmed.toUpperCase();
    if (upper === "LAUNCH500") {
      setBusy(true);
      try {
        const r = await redeemLaunchGiveawayCode("LAUNCH500");
        if (r.ok) {
          useProStore.getState().applyLifetimeGiveaway();
          setBanner({ kind: "ok", text: t("launchCodeSuccess", languageCode) });
          setCode("");
          onLifetimeSuccess?.();
        } else if (r.reason === "sold_out") {
          setBanner({ kind: "err", text: t("launchCodeSoldOut", languageCode) });
        } else {
          setBanner({ kind: "err", text: t("launchCodeInvalid", languageCode) });
        }
      } catch {
        setBanner({ kind: "err", text: t("launchCodeNetwork", languageCode) });
      } finally {
        setBusy(false);
      }
    } else {
      openUpgradeModal();
    }
  };

  return (
    <View className="rounded-3xl border border-white/10 bg-cm-surface/95 p-4 shadow-cm-inner">
      <Text className="text-sm font-medium text-cm-ink-secondary">{t("launchCodeLabel", languageCode)}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder={t("launchCodePlaceholder", languageCode)}
        placeholderTextColor={INPUT_PLACEHOLDER}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!busy}
        className="mt-2 rounded-2xl border border-white/10 bg-cm-raised px-3 py-3 text-[15px] text-cm-ink shadow-cm-inner"
      />
      <PremiumPressable
        variant={busy ? "none" : "primary"}
        className={
          busy
            ? "mt-3 w-full min-h-14 justify-center rounded-full bg-cm-muted px-8 py-4 shadow-cm-inner"
            : "mt-3 w-full shadow-cm-glow-sm"
        }
        onPress={() => void activate()}
        disabled={busy}
      >
        {busy ? (
          <View className="flex-row items-center justify-center gap-2">
            <ActivityIndicator color={CM.onAccent} />
            <Text className="font-bold text-cm-on-accent">{t("processing", languageCode)}</Text>
          </View>
        ) : (
          <Text className={BTN_PRIMARY_TEXT}>{t("launchCodeActivate", languageCode)}</Text>
        )}
      </PremiumPressable>
      {banner ? (
        <Text className={`mt-3 text-sm leading-5 ${banner.kind === "ok" ? "text-cm-accent" : "text-cm-warn"}`}>
          {banner.text}
        </Text>
      ) : null}
    </View>
  );
};
