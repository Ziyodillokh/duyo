import { Check, Folder, FolderMinus } from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/text';
import { type Project } from '@/api/endpoints/conversations';
import { glass } from '@/lib/glass';

const INK = '#22406F';
const MUTED = '#8CA3CB';
const PRIMARY = '#2F6FE4';
const GREEN = '#22B573';

/**
 * "Which project does this conversation belong to?"
 *
 * Includes an explicit "no project" row rather than relying on the child
 * finding a way to undo a move — filing something is easy to do by accident.
 */
export function ProjectPicker({
  visible,
  projects,
  currentProjectId,
  onClose,
  onPick,
}: {
  visible: boolean;
  projects: readonly Project[];
  currentProjectId: string | null;
  onClose: () => void;
  onPick: (projectId: string | null) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Yopish"
        style={styles.scrim}
      >
        <Pressable onPress={() => {}} style={styles.sheet}>
          <Text style={styles.title}>Loyihaga solish</Text>

          <ScrollView>
            <PickerRow
              label="Loyihasiz"
              icon={<FolderMinus size={18} color={MUTED} />}
              selected={currentProjectId === null}
              onPress={() => onPick(null)}
            />
            {projects.map((project) => (
              <PickerRow
                key={project.id}
                label={project.name}
                icon={<Folder size={18} color={project.colour ?? PRIMARY} />}
                selected={currentProjectId === project.id}
                onPress={() => onPick(project.id)}
              />
            ))}
            {projects.length === 0 && (
              <Text style={styles.empty}>
                Hali loyiha yo‘q. Loyihalar bo‘limidan yaratishing mumkin.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerRow({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        styles.focusable,
      ]}
    >
      {icon}
      <Text style={styles.rowLabel}>{label}</Text>
      {selected && <Check size={18} color={GREEN} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,10,22,0.6)',
  },
  // 'xl' — this is chrome floating over the whole screen, the top of the
  // ladder. The fill is near-opaque rather than the usual 0.55: behind it is
  // the darkened scrim, and a half-transparent pane over that reads grey
  // instead of white.
  sheet: {
    ...glass(30, 'xl', 0.96),
    // A sheet only meets the screen at the bottom, so only the top corners
    // and the top edge are drawn.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    color: MUTED,
    paddingVertical: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.7 },
  rowLabel: {
    flexGrow: 1, flexShrink: 1,
    fontSize: 16,
    color: INK,
  },
});
