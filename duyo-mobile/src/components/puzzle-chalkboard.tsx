import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

import {
  answerPuzzle,
  type Puzzle,
  type PuzzleAnswer,
} from '@/api/endpoints/puzzles';
import {
  BOARD_SHADOW,
  CHALK,
  CHALK_DIM,
  CHALK_YELLOW,
  ChalkLine,
  FadeInView,
  LINE_GAP_MS,
  SLATE,
  SLATE_EDGE,
  START_DELAY_MS,
  WOOD,
  WOOD_DARK,
  writeDuration,
} from '@/components/chalkboard';

const CHALK_GREEN = '#9BE8A8';
const CHALK_PINK = '#F5A8C8';

interface Props {
  puzzle: Puzzle;
  childId: string;
  onDone: () => void;
  /** Compact layout for shorter screens (the voice screen). */
  compact?: boolean;
}

/**
 * A logic puzzle written on the same slate DUYO solves problems on.
 *
 * Shares the wood/slate/chalk primitives with `Chalkboard` rather than
 * re-styling them, so the two boards are visibly the same object. The
 * difference is direction: `Chalkboard` writes out a finished solution, this
 * one asks and waits for the child.
 *
 * Answering is one-shot — the explanation is written straight after, so a
 * second guess would measure nothing (the backend keeps the first attempt for
 * the same reason).
 */
export function PuzzleChalkboard({ puzzle, childId, onDone, compact = false }: Props) {
  const [result, setResult] = useState<PuzzleAnswer | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [slateWidth, setSlateWidth] = useState(0);

  const questionSize = compact ? 18 : 21;
  const choiceSize = compact ? 15 : 17;
  const noteSize = compact ? 11 : 12;

  // The question is written first, then the choices appear one after another —
  // the child reads at the pace the chalk moves rather than meeting a wall.
  const questionDelay = START_DELAY_MS;
  const choicesDelay = questionDelay + writeDuration(puzzle.text) + LINE_GAP_MS;

  const choose = async (index: number) => {
    if (result || sending) return;
    setPicked(index);
    setSending(true);
    try {
      setResult(await answerPuzzle(puzzle.puzzle_id, childId, index));
    } catch {
      // Network hiccup — let the child pick again rather than blocking the chat.
      setPicked(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <FadeInView
      delay={0}
      duration={420}
      rise={14}
      style={styles.frame}
      accessibilityLabel={`Doskadagi jumboq: ${puzzle.text}`}
    >
      <View
        onLayout={(e) => setSlateWidth(e.nativeEvent.layout.width)}
        style={[
          styles.slate,
          {
            paddingHorizontal: compact ? 16 : 22,
            paddingTop: compact ? 12 : 16,
            paddingBottom: compact ? 14 : 18,
          },
        ]}
      >
        <Text style={[styles.headLabel, { fontSize: noteSize + 1 }]}>
          Jumboq
        </Text>
        <View style={styles.rule} />

        <ChalkLine
          text={puzzle.text}
          delay={questionDelay}
          size={questionSize}
          maxWidth={slateWidth}
        />

        <View style={styles.choices}>
          {puzzle.choices.map((choice, i) => {
            const isPicked = picked === i;
            const isAnswer = result !== null && i === result.correct_index;
            const isWrongPick = result !== null && isPicked && !result.is_correct;

            let colour = CHALK;
            let border = 'rgba(242, 239, 228, 0.22)';
            if (isAnswer) {
              colour = CHALK_GREEN;
              border = CHALK_GREEN;
            } else if (isWrongPick) {
              colour = CHALK_PINK;
              border = CHALK_PINK;
            } else if (isPicked) {
              border = CHALK;
            }

            return (
              <FadeInView key={i} delay={choicesDelay + i * 120} rise={6}>
                <Pressable
                  onPress={() => choose(i)}
                  disabled={result !== null || sending}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isPicked }}
                  accessibilityLabel={choice}
                  style={({ pressed }) => [
                    styles.choice,
                    { borderColor: border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={{ fontSize: choiceSize, color: colour }}>
                    {String.fromCharCode(65 + i)}. {choice}
                  </Text>
                </Pressable>
              </FadeInView>
            );
          })}
        </View>

        {result && (
          <FadeInView delay={120} rise={8} style={styles.result}>
            <Text
              style={[
                styles.verdict,
                {
                  fontSize: choiceSize,
                  color: result.is_correct ? CHALK_GREEN : CHALK_YELLOW,
                },
              ]}
            >
              {result.is_correct ? "To'g'ri!" : "Keling, birga ko'ramiz"}
            </Text>
            <Text style={[styles.explanation, { fontSize: noteSize + 2 }]}>
              {result.explanation}
            </Text>
            <Pressable
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Suhbatni davom ettirish"
              style={({ pressed }) => [
                styles.continue,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.continueLabel, { fontSize: choiceSize - 1 }]}>
                Davom etamiz
              </Text>
            </Pressable>
          </FadeInView>
        )}
      </View>
    </FadeInView>
  );
}

// Same wood, same slate, same chalk as Chalkboard — imported rather than
// re-picked, so the two boards stay one object.
const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: 18,
    padding: 7,
    backgroundColor: WOOD,
    borderWidth: 2,
    borderColor: WOOD_DARK,
    boxShadow: BOARD_SHADOW,
  },
  slate: {
    borderRadius: 12,
    backgroundColor: SLATE,
    borderWidth: 1,
    borderColor: SLATE_EDGE,
    overflow: 'hidden',
  },

  headLabel: {
    color: CHALK_DIM,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rule: {
    height: 1,
    backgroundColor: CHALK_DIM,
    opacity: 0.25,
    marginTop: 6,
    marginBottom: 12,
  },

  choices: { marginTop: 14, gap: 8 },
  // The border colour is the state (picked / right / wrong) and is passed in.
  choice: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8 },

  result: { marginTop: 14 },
  verdict: { fontWeight: '700' },
  explanation: { color: CHALK_DIM, marginTop: 6, lineHeight: 18 },
  continue: {
    marginTop: 12,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CHALK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: { color: CHALK, fontWeight: '600' },
});
