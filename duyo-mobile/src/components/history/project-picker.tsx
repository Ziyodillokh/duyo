import { Check, Folder, FolderMinus } from 'lucide-react-native';
import { Modal, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/text';

import { type Project } from '@/api/endpoints/conversations';
import { useIsDark } from '@/store/theme';

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
  const isDark = useIsDark();

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
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(4,10,22,0.6)' }}
      >
        <Pressable
          onPress={() => {}}
          className="rounded-t-3xl border-t border-neon-blue/20"
          style={{
            backgroundColor: isDark ? '#121B2E' : '#FFFFFF',
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 32,
            maxHeight: '70%',
          }}
        >
          <Text className="text-base font-bold text-foreground dark:text-dark-text mb-3">
            Loyihaga solish
          </Text>

          <ScrollView>
            <PickerRow
              label="Loyihasiz"
              icon={<FolderMinus size={18} color="#94A3B8" />}
              selected={currentProjectId === null}
              onPress={() => onPick(null)}
            />
            {projects.map((project) => (
              <PickerRow
                key={project.id}
                label={project.name}
                icon={<Folder size={18} color={project.colour ?? '#60A5FA'} />}
                selected={currentProjectId === project.id}
                onPress={() => onPick(project.id)}
              />
            ))}
            {projects.length === 0 && (
              <Text className="text-sm text-muted-foreground dark:text-dark-muted py-3">
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
      className="flex-row items-center gap-3 py-3 active:opacity-70"
    >
      {icon}
      <Text className="text-base text-foreground dark:text-dark-text flex-1">
        {label}
      </Text>
      {selected && <Check size={18} color="#05DF72" />}
    </Pressable>
  );
}
