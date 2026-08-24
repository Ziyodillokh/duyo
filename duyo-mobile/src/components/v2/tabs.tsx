import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { lift } from '@/lib/glass';

const PRIMARY = '#2F6FE4';
const MUTED = '#8CA3CB';

export function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: readonly { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.track}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
            style={[styles.tab, isActive && styles.tabOn, styles.focusable]}
          >
            <Text style={[styles.label, isActive && styles.labelOn]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  // The track is a WELL, not a pane: it sits below the page, so it takes a
  // tinted recess rather than a lift.
  track: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    backgroundColor: 'rgba(47,111,228,0.08)',
  },
  tab: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Only the chosen tab rises — that lift is the whole signal.
  tabOn: { backgroundColor: '#FFFFFF', boxShadow: lift('sm') },

  label: { fontSize: 14, fontWeight: '600', color: MUTED },
  labelOn: { color: PRIMARY },
});
