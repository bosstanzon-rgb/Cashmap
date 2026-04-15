import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/constants/i18n";
import { PlatformGlyph } from "@/lib/platformVisuals";
import { INPUT_PLACEHOLDER } from "@/constants/theme";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";

type Props = {
  presets: string[];
  selectedPlatforms: string[];
  onTogglePlatform: (platform: string) => void;
  presetLimit?: number;
};

/**
 * Platform multi-select with emoji “icons” — tuned for Gauteng delivery / ride apps.
 */
export const PlatformChipSelector = ({
  presets,
  selectedPlatforms,
  onTogglePlatform,
  presetLimit = 10,
}: Props) => {
  const languageCode = useAppStore((s) => s.languageCode);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [customPlatform, setCustomPlatform] = useState("");

  const shownPresets = showAllPresets ? presets : presets.slice(0, presetLimit);
  const customSelected = useMemo(
    () => selectedPlatforms.filter((p) => !presets.includes(p)),
    [selectedPlatforms, presets]
  );

  return (
    <>
      <Text className="text-[14px] font-semibold text-cm-ink-secondary">{t("platformsYouUse", languageCode)}</Text>
      <Text className="mt-1 text-[12px] text-cm-ink-tertiary">{t("selectAppsYouUseHint", languageCode)}</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {shownPresets.map((platform) => {
          const selected = selectedPlatforms.includes(platform);
          return (
            <PremiumPressable
              key={platform}
              variant="chip"
              className={`flex-row items-center gap-1.5 px-4 ${
                selected ? "border-cm-accent/45 bg-cm-accent-soft shadow-cm-glow-sm" : "border-white/[0.08] bg-cm-raised"
              }`}
              onPress={() => onTogglePlatform(platform)}
            >
              <PlatformGlyph name={platform} size="sm" />
              <Text className={`text-[13px] font-bold ${selected ? "text-cm-accent" : "text-cm-ink-secondary"}`}>
                {platform}
              </Text>
            </PremiumPressable>
          );
        })}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {presets.length > presetLimit ? (
          <PremiumPressable
            variant="secondary"
            className="px-5"
            onPress={() => setShowAllPresets((v) => !v)}
          >
            <Text className="text-center text-[14px] font-bold text-cm-ink-secondary">
              {showAllPresets ? "Show fewer apps" : "Show all apps"}
            </Text>
          </PremiumPressable>
        ) : null}
        <PremiumPressable
          variant="none"
          className={`flex-row items-center px-5 py-3 ${
            showCustomInput ? "rounded-full border-[1.5px] border-cm-cyan/45 bg-cm-cyan-dim" : "rounded-full border border-white/10 bg-cm-raised"
          }`}
          onPress={() => setShowCustomInput((v) => !v)}
        >
          <Text className={`text-[13px] font-bold ${showCustomInput ? "text-cm-cyan" : "text-cm-ink-secondary"}`}>
            {t("iUseOtherApps", languageCode)}
          </Text>
        </PremiumPressable>
      </View>
      {showCustomInput ? (
        <View className="mt-3 flex-row gap-2">
          <TextInput
            value={customPlatform}
            onChangeText={setCustomPlatform}
            placeholder={t("addAnotherAppPlaceholder", languageCode)}
            placeholderTextColor={INPUT_PLACEHOLDER}
            className="min-h-14 flex-1 rounded-2xl border border-white/10 bg-cm-raised px-4 py-3 text-[15px] text-cm-ink"
          />
          <PremiumPressable
            variant="primary"
            className="min-w-[88px] px-5"
            onPress={() => {
              const name = customPlatform.trim();
              if (!name) return;
              if (!selectedPlatforms.includes(name)) onTogglePlatform(name);
              setCustomPlatform("");
            }}
          >
            <Text className={`${BTN_PRIMARY_TEXT} text-[14px]`}>{t("add", languageCode)}</Text>
          </PremiumPressable>
        </View>
      ) : null}
      {customSelected.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {customSelected.map((platform) => (
            <PremiumPressable
              key={`custom-${platform}`}
              variant="chip"
              className="flex-row items-center gap-1 border-cm-cyan/35 bg-cm-cyan-dim px-3"
              onPress={() => onTogglePlatform(platform)}
            >
              <PlatformGlyph name={platform} size="sm" />
              <Text className="text-[13px] font-bold text-cm-cyan">
                {platform} ×
              </Text>
            </PremiumPressable>
          ))}
        </View>
      ) : null}
    </>
  );
};
