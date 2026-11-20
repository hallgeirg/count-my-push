import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SocialProvider } from "../social/SocialProvider";
import { AppDataProvider } from "../store/AppDataProvider";
import { colors, fonts } from "../theme";

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.accent,
    text: colors.text,
    border: colors.line,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <AppDataProvider>
        <SocialProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="session/[kind]"
              options={{
                presentation: "modal",
                title: "Økt",
                headerTintColor: colors.accent,
                headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
              }}
            />
            <Stack.Screen
              name="challenge/new"
              options={{
                presentation: "modal",
                title: "Ny utfordring",
                headerTintColor: colors.accent,
                headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
              }}
            />
            <Stack.Screen
              name="goal/[id]"
              options={{
                presentation: "modal",
                title: "Mål",
                headerTintColor: colors.accent,
                headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
              }}
            />
            <Stack.Screen
              name="schedule"
              options={{
                presentation: "modal",
                title: "Ukeplan",
                headerTintColor: colors.accent,
                headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
              }}
            />
            <Stack.Screen
              name="yesterday"
              options={{
                presentation: "modal",
                title: "Logg for i går",
                headerTintColor: colors.accent,
                headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
              }}
            />
            <Stack.Screen name="setup" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          </Stack>
        </SocialProvider>
      </AppDataProvider>
    </ThemeProvider>
  );
}
