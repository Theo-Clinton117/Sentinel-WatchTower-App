import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '../theme';

type Props = {
  children: React.ReactNode;
};

export const ScreenCanvas = ({ children }: Props) => {
  const theme = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {children}
    </View>
  );
};
