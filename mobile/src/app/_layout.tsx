import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
        </Stack>
      </AppDataProvider>
    </ThemeProvider>
  );
}
