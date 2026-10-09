import { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Import only the weights the app uses (the package index would bundle all of them).
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4/600SemiBold";
import { SourceSerif4_700Bold } from "@expo-google-fonts/source-serif-4/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { AuthProvider, useAuth } from "@/auth";
import { useTheme } from "@/theme";
import { setupLiveKit } from "@/room/setup";

SplashScreen.preventAutoHideAsync().catch(() => {});
setupLiveKit();

function Gate() {
  const { me, loading } = useAuth();
  const segments = useSegments();
  const t = useTheme();
  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync().catch(() => {});
    const inAuth = segments[0] === "(auth)";
    const onOnboarding = segments[0] === "onboarding";
    if (!me && !inAuth) router.replace("/sign-in");
    else if (me && !me.onboarded && !onOnboarding) router.replace("/onboarding");
    else if (me && me.onboarded && (inAuth || onOnboarding)) router.replace("/");
  }, [me, loading, segments]);
  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="d/[id]" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="challenge/[userId]" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ SourceSerif4_600SemiBold, SourceSerif4_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
