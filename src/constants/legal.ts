/** Short risk line — banners on Map / Predictions / Earnings. */
export const MVP_DISCLAIMER_SHORT =
  "Estimates only. Use at your own risk. Independent tool.";

/** One-line footer shown on every main screen (MVP requirement). */
export const CASHMAP_MVP_FOOTER = `${MVP_DISCLAIMER_SHORT} Not affiliated with any delivery platform.`;

/** Full disclaimer — modals, Legal screen, expanded copy. */
export const CASHMAP_FULL_DISCLAIMER = `CashMap is an independent third-party tool. All zone data, predictions, and advice are based on anonymous community data and are estimates only. 
We do not guarantee accuracy, earnings, or results. 
${MVP_DISCLAIMER_SHORT} Not affiliated with Mr D, Uber Eats, Bolt, or any delivery platform. 
Using this app does not guarantee you will make more money and may carry risks including platform deactivation. 
By using CashMap you agree to our Terms of Service and Privacy Policy.`;

/** Short line for in-app callouts (Home / Predictions). Full legal line is `CASHMAP_MVP_FOOTER` / footer component. */
export const CASHMAP_COMMUNITY_ESTIMATE_NOTICE =
  "Community estimates only — not financial advice.";

export const PRIVACY_POLICY_PLACEHOLDER = `CashMap collects only what is necessary to provide the service:

LOCATION DATA (opt-in): When you enable heatmap sharing, anonymous GPS pings are sent at ~1km precision and auto-deleted after 7 days. No other user can read your pings.

MILEAGE LOGS (private): Your km data is stored against an anonymous device ID only you can access. Used only for your tax export. Auto-deleted after 365 days.

SHIFT LOGS (private + community): Your personal earnings are private. An anonymised version (suburb + platform + earnings, no ID) contributes to community predictions to help all drivers.

We never collect your name, email, or payment details. We never sell your data.

Your rights (POPIA/GDPR): You can opt out of location sharing anytime in Settings. Use "Reset CashMap" to delete all local data. Email support@cashmap.app to request server-side deletion.`;

export const TERMS_OF_SERVICE_PLACEHOLDER = `You use CashMap entirely at your own risk. We are not liable for any losses, platform actions, or decisions you make based on estimates shown in the app.`;

/** Onboarding consent checkbox — must match ProfileSetup. */
export const ONBOARDING_HEATMAP_CONSENT_TEXT =
  "I consent to anonymously sharing my location and active platforms to help build community heatmaps. Data is fully anonymized and I can stop anytime in Settings.";
