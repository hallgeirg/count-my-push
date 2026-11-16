import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card, Eyebrow, PageTitle, Screen, styles as ui } from "../../components/ui";
import {
  challengeOutcome,
  challengeProgress,
  challengeTitle,
  dayWord,
  daysLeftLabel,
  groupChallenges,
  standing,
} from "../../social/challenges";
import { errorMessage, useSocial } from "../../social/SocialProvider";
import type { Challenge, LeaderboardRow } from "../../social/types";
import { colors, fonts, radius } from "../../theme";

export default function SocialScreen() {
  const { status } = useSocial();
  if (status === "unconfigured") return <NotSetUp />;
  if (status === "loading") {
    return (
      <View style={[ui.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Laster" />
      </View>
    );
  }
  if (status === "signedOut") return <SignedOut />;
  return <SignedIn />;
}

function NotSetUp() {
  return (
    <Screen>
      <PageTitle title="Sammen" />
      <Card>
        <Text style={ui.body}>
          «Sammen» er ikke satt opp i denne versjonen av appen ennå. Treningen din lagres på telefonen som før.
        </Text>
      </Card>
    </Screen>
  );
}

function SignedOut() {
  const { signIn, devSignIn, signingIn, authError, devLoginEnabled } = useSocial();
  const [devName, setDevName] = useState("");
  return (
    <Screen>
      <PageTitle title="Sammen" />
      <Card>
        <Text style={ui.title}>Tren med venner</Text>
        <Text style={ui.body}>
          Med konto får du streaks, ukas toppliste og utfordringer mot venner. Loggen blir liggende på telefonen, og
          appen virker som før uten konto.
        </Text>
        {authError ? <ErrorText>{authError}</ErrorText> : null}
        <Button label="Logg inn" onPress={() => void signIn()} disabled={signingIn} />
        <Button
          label="Opprett konto"
          variant="secondary"
          onPress={() => void signIn({ signUp: true })}
          disabled={signingIn}
        />
      </Card>
      {devLoginEnabled ? (
        <Card>
          <Eyebrow>Dev-innlogging</Eyebrow>
          <Text style={ui.body}>Virker bare mot den lokale dev-serveren. Bruk a–z, 0–9, punktum, - eller _.</Text>
          <TextInput
            value={devName}
            onChangeText={setDevName}
            placeholder="F.eks. kari"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Navn for dev-innlogging"
            returnKeyType="go"
            onSubmitEditing={() => devName.trim() && void devSignIn(devName)}
            style={s.input}
          />
          <Button
            label="Dev-innlogging"
            variant="secondary"
            onPress={() => void devSignIn(devName)}
            disabled={signingIn || !devName.trim()}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

function SignedIn() {
  const { me, stats, leaderboard, challenges, syncFailed, loadFailed, refresh, loadSocial } = useSocial();
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadSocial();
    }, [loadSocial]),
  );

  async function onRefresh() {
    setPulling(true);
    await refresh();
    setPulling(false);
  }

  function shareCode() {
    if (!me) return;
    void Share.share({
      message: `Utfordre meg i Make More Health! Vennekoden min er ${me.friendCode}.`,
    }).catch(() => undefined);
  }

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <PageTitle eyebrow={me ? `Logget inn som ${me.displayName}` : undefined} title="Sammen" />

      <View style={s.hero}>
        <View accessible accessibilityLabel={streakLabel(stats?.currentStreak)}>
          <Eyebrow style={{ color: colors.heroEyebrow }}>Streak</Eyebrow>
          <Text style={s.heroNumber}>{stats ? stats.currentStreak : "–"}</Text>
          <Text style={s.heroLead}>{stats ? `${dayWord(stats.currentStreak)} på rad` : "Henter …"}</Text>
        </View>
        <View style={s.heroStats}>
          <HeroStat
            label="Lengste streak"
            value={stats ? `${stats.longestStreak} ${dayWord(stats.longestStreak)}` : "–"}
          />
          <HeroStat label="Pushups denne uka" value={stats ? String(stats.weekTotal) : "–"} />
        </View>
      </View>
      {syncFailed ? <Text style={s.note}>Ikke synket ennå</Text> : null}

      {me ? (
        <Card>
          <Eyebrow>Vennekoden din</Eyebrow>
          <Text style={s.code} selectable accessibilityLabel={`Vennekode ${me.friendCode.split("").join(" ")}`}>
            {me.friendCode}
          </Text>
          <Text style={ui.body}>Gi koden til en venn, så kan dere utfordre hverandre.</Text>
          <Button label="Del vennekoden" variant="secondary" onPress={shareCode} />
        </Card>
      ) : null}

      <Card>
        <Eyebrow>Ukas toppliste</Eyebrow>
        {leaderboard ? (
          leaderboard.rows.length ? (
            <View>
              {leaderboard.rows.map((row) => (
                <LeaderRow key={row.userId} row={row} />
              ))}
            </View>
          ) : (
            <Text style={ui.body}>Ingen har logget pushups denne uka ennå.</Text>
          )
        ) : (
          <Text style={ui.body}>{loadFailed ? "Kunne ikke hente topplisten. Dra ned for å prøve igjen." : "Henter …"}</Text>
        )}
      </Card>

      <Challenges list={challenges} loadFailed={loadFailed} />
    </Screen>
  );
}

function streakLabel(n: number | undefined) {
  return n == null ? "Streak: henter" : `Streak: ${n} ${dayWord(n)} på rad`;
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.heroStatValue}>{value}</Text>
      <Text style={s.heroStatLabel}>{label}</Text>
    </View>
  );
}

function LeaderRow({ row }: { row: LeaderboardRow }) {
  return (
    <View
      style={[s.leaderRow, row.isMe && s.leaderRowMe]}
      accessible
      accessibilityLabel={`${row.rank}. plass, ${row.displayName}${row.isMe ? " (deg)" : ""}, ${row.total} pushups, streak ${row.currentStreak} ${dayWord(row.currentStreak)}`}
    >
      <Text style={s.rank}>{row.rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.leaderName} numberOfLines={1}>
          {row.displayName}
          {row.isMe ? <Text style={s.meTag}> · deg</Text> : null}
        </Text>
        <Text style={s.small}>
          Streak {row.currentStreak} {dayWord(row.currentStreak)}
        </Text>
      </View>
      <Text style={s.leaderTotal}>{row.total}</Text>
    </View>
  );
}

function Challenges({ list, loadFailed }: { list: Challenge[] | null; loadFailed: boolean }) {
  const groups = list ? groupChallenges(list) : null;
  return (
    <Card>
      <Eyebrow>Utfordringer</Eyebrow>
      <Button label="Ny utfordring" onPress={() => router.push("/challenge/new")} />
      {!groups ? (
        <Text style={ui.body}>{loadFailed ? "Kunne ikke hente utfordringene. Dra ned for å prøve igjen." : "Henter …"}</Text>
      ) : list!.length === 0 ? (
        <Text style={ui.body}>Ingen utfordringer ennå.</Text>
      ) : (
        <>
          <Group title="Venter på deg" items={groups.incoming} render={(c) => <Incoming c={c} />} />
          <Group title="Sendt" items={groups.sent} render={(c) => <Sent c={c} />} />
          <Group title="Pågår" items={groups.active} render={(c) => <Active c={c} />} />
          <Group title="Ferdige" items={groups.finished} render={(c) => <Finished c={c} />} />
        </>
      )}
    </Card>
  );
}

function Group({
  title,
  items,
  render,
}: {
  title: string;
  items: Challenge[];
  render: (c: Challenge) => ReactNode;
}) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <Text style={s.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      {items.map((c) => (
        <View key={c.id} style={s.challenge}>
          {render(c)}
        </View>
      ))}
    </View>
  );
}

function Incoming({ c }: { c: Challenge }) {
  const { respond } = useSocial();
  const [busy, setBusy] = useState(false);
  async function answer(accept: boolean) {
    setBusy(true);
    try {
      await respond(c.id, accept);
    } catch (e) {
      Alert.alert("Fikk ikke svart", errorMessage(e, "Utfordringen kan ikke besvares lenger."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Text style={ui.strong}>{challengeTitle(c)}</Text>
      <Text style={s.small}>Fra {c.opponent.displayName}</Text>
      <View style={s.buttonRow}>
        <View style={{ flex: 1 }}>
          <Button
            label="Godta"
            accessibilityLabel={`Godta utfordringen fra ${c.opponent.displayName}`}
            onPress={() => void answer(true)}
            disabled={busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Avslå"
            variant="secondary"
            accessibilityLabel={`Avslå utfordringen fra ${c.opponent.displayName}`}
            onPress={() => void answer(false)}
            disabled={busy}
          />
        </View>
      </View>
    </>
  );
}

function Sent({ c }: { c: Challenge }) {
  return (
    <>
      <Text style={ui.strong}>{challengeTitle(c)}</Text>
      <Text style={s.small}>Venter på svar fra {c.opponent.displayName}</Text>
    </>
  );
}

function Active({ c }: { c: Challenge }) {
  const progress = challengeProgress(c);
  const suffix = c.type === "first_to_target" && c.target ? ` / ${c.target}` : "";
  return (
    <>
      <Text style={ui.strong}>{challengeTitle(c)}</Text>
      <Text style={s.small}>
        Mot {c.opponent.displayName}
        {daysLeftLabel(c.daysLeft) ? ` · ${daysLeftLabel(c.daysLeft)}` : ""}
      </Text>
      <Bar label="Du" value={`${c.me.total}${suffix}`} fraction={progress.me} highlight />
      <Bar label={c.opponent.displayName} value={`${c.opponent.total}${suffix}`} fraction={progress.opponent} />
      <Text style={s.standing}>{standing(c)}</Text>
    </>
  );
}

function Bar({ label, value, fraction, highlight }: { label: string; value: string; fraction: number; highlight?: boolean }) {
  return (
    <View style={{ gap: 4 }} accessible accessibilityLabel={`${label}: ${value} pushups`}>
      <View style={s.barLabels}>
        <Text style={s.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.barValue}>{value}</Text>
      </View>
      <View style={s.barTrack}>
        <View
          style={[
            s.barFill,
            { width: `${Math.round(fraction * 100)}%`, backgroundColor: highlight ? colors.accent : colors.muted },
          ]}
        />
      </View>
    </View>
  );
}

function Finished({ c }: { c: Challenge }) {
  const outcome = challengeOutcome(c);
  const won = outcome === "Vunnet";
  return (
    <>
      <View style={s.finishedHead}>
        <Text style={[ui.strong, { flex: 1 }]}>{challengeTitle(c)}</Text>
        {outcome ? (
          <Text style={[s.badge, won ? { color: colors.good, backgroundColor: colors.goodSoft } : null]}>
            {won ? "✓ " : ""}
            {outcome}
          </Text>
        ) : null}
      </View>
      <Text style={s.small}>
        Mot {c.opponent.displayName}
        {c.status === "completed" ? ` · ${c.me.total} – ${c.opponent.total}` : ""}
      </Text>
    </>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <Text style={{ color: colors.danger, fontFamily: fonts.bold, fontSize: 15 }} accessibilityRole="alert">
      {children}
    </Text>
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  hero: {
    backgroundColor: colors.hero,
    borderRadius: radius.container,
    padding: 20,
    gap: 16,
  },
  heroNumber: {
    color: colors.heroText,
    fontFamily: fonts.bold,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  heroLead: { color: colors.heroLead, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  heroStats: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.heroLine,
    paddingTop: 12,
  },
  heroStatValue: { color: colors.heroText, fontFamily: fonts.bold, fontSize: 22, fontVariant: ["tabular-nums"] },
  heroStatLabel: { color: colors.heroMuted, fontFamily: fonts.mono, fontSize: 12 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, marginTop: -8 },
  code: { color: colors.text, fontFamily: fonts.mono, fontSize: 28, letterSpacing: 4 },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.control,
  },
  leaderRowMe: { backgroundColor: colors.accentSoft },
  rank: { width: 28, color: colors.muted, fontFamily: fonts.mono, fontSize: 14, fontVariant: ["tabular-nums"] },
  leaderName: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  meTag: { color: colors.accent, fontFamily: fonts.bold },
  leaderTotal: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, fontVariant: ["tabular-nums"] },
  small: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  groupTitle: { color: colors.text, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  challenge: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceSubtle,
  },
  buttonRow: { flexDirection: "row", gap: 8 },
  barLabels: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  barLabel: { flex: 1, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 14 },
  barValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, fontVariant: ["tabular-nums"] },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  standing: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  finishedHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    color: colors.textSecondary,
    backgroundColor: colors.line,
    fontFamily: fonts.mono,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.control,
    overflow: "hidden",
  },
});
