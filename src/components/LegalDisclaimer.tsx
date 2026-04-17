import { Text, View } from "react-native";
import { CASHMAP_FULL_DISCLAIMER } from "@/constants/legal";
import { navigationRef } from "@/navigation/navigationRef";
import { PremiumPressable } from "@/components/PremiumPressable";

type Props = {
  /** Slightly smaller padding / text for tight layouts */
  compact?: boolean;
  /** Show tappable links to Privacy / Terms (navigates root stack) */
  showPolicyLinks?: boolean;
};

export const LegalDisclaimer = ({ compact, showPolicyLinks }: Props) => {
  const openLegal = () => {
    if (navigationRef.isReady()) navigationRef.navigate("Legal");
  };
  const openPrivacy = () => {
    if (navigationRef.isReady()) navigationRef.navigate("PrivacyPolicy");
  };
  const openTerms = () => {
    if (navigationRef.isReady()) navigationRef.navigate("TermsOfService");
  };

  return (
    <View
      className={`rounded-3xl bg-cm-surface/95 shadow-cm-inner ${compact ? "p-3" : "p-4"}`}
    >
      <Text className={`leading-6 text-cm-ink-secondary ${compact ? "text-[11px]" : "text-[13px]"}`}>
        {CASHMAP_FULL_DISCLAIMER}
      </Text>
      {showPolicyLinks ? (
        <View className="mt-3 flex-row flex-wrap gap-x-2 gap-y-2">
          <PremiumPressable variant="none" className="min-h-11 justify-center rounded-full px-4 py-2.5" onPress={openPrivacy}>
            <Text className="text-[12px] font-bold text-cm-accent">Privacy Policy</Text>
          </PremiumPressable>
          <PremiumPressable variant="none" className="min-h-11 justify-center rounded-full px-4 py-2.5" onPress={openTerms}>
            <Text className="text-[12px] font-bold text-cm-accent">Terms of Service</Text>
          </PremiumPressable>
          <PremiumPressable variant="none" className="min-h-11 justify-center rounded-full px-4 py-2.5" onPress={openLegal}>
            <Text className="text-[12px] font-bold text-cm-ink-secondary">Legal & Privacy</Text>
          </PremiumPressable>
        </View>
      ) : null}
    </View>
  );
};
