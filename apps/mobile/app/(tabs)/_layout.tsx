import { Tabs } from "expo-router";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { LogoMark } from "@/components/Logo";
import { fonts, useTheme } from "@/theme";

function Icon({ d, color, dot }: { d: string; color: string; dot?: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
      {dot ? <Circle cx="19" cy="5" r="3" fill="#C93B35" stroke="none" /> : null}
    </Svg>
  );
}

/** Five destinations: Home, Discover, FaceOff (primary), Activity, Profile. */
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.text,
        tabBarInactiveTintColor: t.textSubtle,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.border, height: 84, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Icon color={color} d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /> }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: ({ color }) => <Icon color={color} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm3.5-12.5-2 5-5 2 2-5z" /> }} />
      <Tabs.Screen
        name="faceoff"
        options={{
          title: "FaceOff",
          tabBarAccessibilityLabel: "Start a FaceOff",
          tabBarIcon: ({ focused }) => (
            <View style={{ marginTop: -18, width: 56, height: 56, borderRadius: 16, backgroundColor: t.surface, borderWidth: 1, borderColor: focused ? t.text : t.border, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
              <LogoMark size={26} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: ({ color }) => <Icon color={color} d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <Icon color={color} d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /> }} />
    </Tabs>
  );
}
