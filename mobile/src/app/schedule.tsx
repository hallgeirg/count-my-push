import { router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { ScheduleEditor } from "../components/pickers";
import { Button, Card, styles as ui } from "../components/ui";
import { useAppData } from "../store/AppDataProvider";
import { colors } from "../theme";

export default function ScheduleScreen() {
  const { data, setSchedule } = useAppData();
  if (!data) return null;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={ui.body}>
        Velg hvilken økt du vil ta hver dag. Dagsmålene har egne dager, som du endrer under hvert mål.
      </Text>
      <Card>
        <ScheduleEditor schedule={data.schedule} onChange={setSchedule} />
      </Card>
      <Button label="Ferdig" onPress={() => router.back()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
});
