import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import { MainTabs } from "@/navigation/MainTabs";
import { PaywallScreen } from "@/screens/PaywallScreen";
import { SplashScreen } from "@/screens/SplashScreen";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { ProfileSetupScreen } from "@/screens/ProfileSetupScreen";
import { LegalScreen } from "@/screens/LegalScreen";
import { PrivacyPolicyScreen } from "@/screens/PrivacyPolicyScreen";
import { TermsOfServiceScreen } from "@/screens/TermsOfServiceScreen";
import { useAppStore } from "@/store/useAppStore";
import { CM } from "@/constants/theme";

const Stack = createStackNavigator<RootStackParamList>();

const stackScreenOptions = {
  headerShown: false as const,
  cardStyle: { backgroundColor: CM.canvas },
};

const legalScreens = (
  <>
    <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: "modal", headerShown: false }} />
    <Stack.Screen
      name="PrivacyPolicy"
      component={PrivacyPolicyScreen}
      options={{ presentation: "modal", headerShown: false }}
    />
    <Stack.Screen
      name="TermsOfService"
      component={TermsOfServiceScreen}
      options={{ presentation: "modal", headerShown: false }}
    />
  </>
);

export const RootNavigator = () => {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);

  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    const unsub = useAppStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-cm-canvas">
        <ActivityIndicator color={CM.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {!hasCompletedOnboarding ? (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          {legalScreens}
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ presentation: "modal", headerShown: false }}
          />
          {legalScreens}
        </>
      )}
    </Stack.Navigator>
  );
};
