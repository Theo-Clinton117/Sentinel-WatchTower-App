import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

type Props = {
  currentStep: 1 | 2;
};

const steps = ['Contacts', 'Permissions'];

export const OnboardingProgress = ({ currentStep }: Props) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.wrap} accessibilityLabel={`Setup step ${currentStep} of ${steps.length}`}>
      <View style={styles.track}>
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const active = stepNumber <= currentStep;

          return (
            <React.Fragment key={step}>
              <View style={styles.stepWrap}>
                <View style={[styles.dot, active && styles.dotActive]}>
                  <Text style={[styles.dotText, active && styles.dotTextActive]}>{stepNumber}</Text>
                </View>
                <Text style={[styles.label, active && styles.labelActive]}>{step}</Text>
              </View>
              {index < steps.length - 1 ? (
                <View style={[styles.line, currentStep > stepNumber && styles.lineActive]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    track: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepWrap: {
      alignItems: 'center',
      minWidth: 76,
    },
    dot: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dotActive: {
      backgroundColor: theme.colors.blue,
      borderColor: theme.colors.blue,
    },
    dotText: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '800',
    },
    dotTextActive: {
      color: '#FFFFFF',
    },
    label: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 15,
      marginTop: 6,
    },
    labelActive: {
      color: theme.colors.text,
    },
    line: {
      flex: 1,
      height: 2,
      backgroundColor: theme.colors.border,
      marginHorizontal: 4,
      marginBottom: 21,
    },
    lineActive: {
      backgroundColor: theme.colors.blue,
    },
  });
