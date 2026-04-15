import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  ProfileSetup: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Paywall: undefined;
  Legal: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

export type MainTabParamList = {
  HomeMap: { platform?: string; forceShiftLogger?: boolean } | undefined;
  Predictions: undefined;
  Earnings: undefined;
  Settings: undefined;
};
