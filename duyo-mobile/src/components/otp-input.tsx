import { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
}: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const handleChange = (text: string) => {
    onChange(text.replace(/\D/g, '').slice(0, length));
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View className="flex-row gap-2">
        {digits.map((d, i) => {
          const isFilled = d.trim().length > 0;
          const isCursor = i === value.length;
          return (
            <View
              key={i}
              className={`w-12 h-14 rounded-lg items-center justify-center border-2 bg-card ${
                isCursor
                  ? 'border-primary'
                  : isFilled
                    ? 'border-foreground'
                    : 'border-border'
              }`}
            >
              <Text className="text-2xl font-bold text-foreground">
                {d.trim()}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        accessibilityLabel="Tasdiqlash kodi"
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}
