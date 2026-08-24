import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { glass } from '@/lib/glass';

const MUTED = '#8CA3CB';

export function CountryChip({ code }: { code: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.code}>{code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits beside a 56pt FormInput, so it matches that height rather than
  // floating at its own.
  chip: {
    ...glass(18, 'sm', 0.86),
    minHeight: 56,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { fontSize: 16, color: MUTED },
});
