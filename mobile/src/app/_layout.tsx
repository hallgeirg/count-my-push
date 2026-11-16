import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "../store/AppDataProvider";
import { colors } from "../theme";

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bgRaised,
    primary: colors.accent,
    text: colors.text,
    border: colors.line,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <AppDataProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="session/[kind]"
            options={{ presentation: "modal", title: "Økt", headerTintColor: colors.accent }}
          />
        </Stack>
      </AppDataProvider>
    </ThemeProvider>
  );
}
