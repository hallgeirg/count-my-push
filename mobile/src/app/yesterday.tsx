import { router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { DayGoals } from "../components/DayGoals";
import { Button, styles as ui } from "../components/ui";
import { addDays, dayKey, fromDayKey } from "../program/dates";
import { goalsOnDay } from "../program/progression";
import { useAppData } from "../store/AppDataProvider";
import { colors } from "../theme";

/** Log what was forgotten yesterday. Counts towards yesterday's goals and the weekly review. */
export default function YesterdayScreen() {
  const { data } = useAppData();
  if (!data) return null;
  const day = addDays(dayKey(new Date()), -1);
  const date = fromDayKey(day).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={ui.body}>
        Glemte du å logge {date}? Det du legger inn her teller på gårsdagens mål og i ukas justering.
      </Text>
      <DayGoals day={day} goals={goalsOnDay(data, day)} />
      <Button label="Ferdig" onPress={() => router.back()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
});
