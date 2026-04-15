module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Must be last — Reanimated + NativeWind ordering per Expo / NativeWind v4
      "react-native-reanimated/plugin",
    ],
  };
};
