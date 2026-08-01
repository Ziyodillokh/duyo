import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  answerPuzzle,
  type Puzzle,
  type PuzzleAnswer,
} from '@/api/endpoints/puzzles';

interface Props {
  puzzle: Puzzle;
  childId: string;
  onDone: () => void;
}

/**
 * A logic puzzle drawn on the chalkboard between chat turns.
 *
 * Answering is one-shot: the child picks, sees whether it was right and why,
 * then dismisses. Retrying is deliberately not offered — the explanation is
 * already on screen, so a second guess would measure nothing (the backend
 * keeps the first attempt for the same reason).
 */
export function PuzzleBoard({ puzzle, childId, onDone }: Props) {
  const [result, setResult] = useState<PuzzleAnswer | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const choose = async (index: number) => {
    if (result || sending) return;
    setPicked(index);
    setSending(true);
    try {
      setResult(await answerPuzzle(puzzle.puzzle_id, childId, index));
    } catch {
      // Network hiccup — let the child try again rather than blocking the chat.
      setPicked(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      className="rounded-xl border border-neon-blue/30"
      style={{ padding: 16, backgroundColor: 'rgba(10, 22, 40, 0.85)' }}
      accessibilityLabel="Mantiqiy jumboq"
    >
      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-base">🧩</Text>
        <Text className="text-sm font-bold text-neon-blue">Jumboq</Text>
      </View>

      <Text className="text-base text-foreground dark:text-dark-text leading-6 mb-4">
        {puzzle.text}
      </Text>

      <View className="gap-2">
        {puzzle.choices.map((choice, i) => {
          const isPicked = picked === i;
          const isAnswer = result !== null && i === result.correct_index;
          const isWrongPick = result !== null && isPicked && !result.is_correct;

          let border = 'rgba(96,165,250,0.25)';
          let bg = 'transparent';
          if (isAnswer) {
            border = '#05DF72';
            bg = 'rgba(5, 223, 114, 0.12)';
          } else if (isWrongPick) {
            border = '#FB64B6';
            bg = 'rgba(251, 100, 182, 0.12)';
          } else if (isPicked) {
            border = '#60A5FA';
          }

          return (
            <Pressable
              key={i}
              onPress={() => choose(i)}
              disabled={result !== null || sending}
              accessibilityRole="radio"
              accessibilityState={{ selected: isPicked }}
              accessibilityLabel={choice}
              className="rounded-md active:opacity-80"
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: bg,
              }}
            >
              <Text className="text-sm text-foreground dark:text-dark-text">
                {String.fromCharCode(65 + i)}. {choice}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {result && (
        <View className="mt-4">
          <Text
            className="text-sm font-medium mb-1"
            style={{ color: result.is_correct ? '#05DF72' : '#FDC700' }}
          >
            {result.is_correct ? "To'g'ri! 🎉" : 'Keling, birga ko\'ramiz'}
          </Text>
          <Text className="text-xs text-muted-foreground dark:text-dark-muted leading-5">
            {result.explanation}
          </Text>
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Suhbatni davom ettirish"
            className="rounded-md bg-neon-blue items-center justify-center mt-3"
            style={{ height: 40 }}
          >
            <Text className="text-sm font-medium" style={{ color: '#0A1628' }}>
              Davom etamiz
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
