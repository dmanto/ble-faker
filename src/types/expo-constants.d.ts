declare module "expo-constants" {
  const Constants: {
    expoConfig?: { hostUri?: string };
    manifest?: { debuggerHost?: string };
  };
  export default Constants;
}
