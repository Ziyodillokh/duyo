import { forwardRef, useState } from 'react';
import {
  Text,
  TextInput,
  type TextInputProps,
  type TextInput as RNTextInput,
  View,
} from 'react-native';

interface FormInputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
}

export const FormInput = forwardRef<RNTextInput, FormInputProps>(
  function FormInput({ label, onFocus, onBlur, ...rest }, ref) {
    const [focused, setFocused] = useState(false);

    return (
      <View className="w-full gap-2">
        {label && (
          <Text className="text-sm font-medium text-foreground">{label}</Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor="#94A3B8"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={`w-full px-6 py-4 rounded-md bg-white text-[18px] text-foreground border-2 ${
            focused ? 'border-primary' : 'border-primary/10'
          }`}
          {...rest}
        />
      </View>
    );
  },
);
