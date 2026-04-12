import React from 'react';
import { StyleSheet, View } from 'react-native';

type IconName = 'home' | 'risk-log' | 'contacts' | 'profile' | 'watch' | 'layers';

type Props = {
  name: IconName;
  color: string;
  active?: boolean;
};

export const AppIcon = ({ name, color, active = false }: Props) => {
  switch (name) {
    case 'home':
      return (
        <View style={styles.base}>
          <View style={[styles.roof, { borderBottomColor: color }]} />
          <View style={[styles.house, { borderColor: color }]}>
            <View style={[styles.door, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'risk-log':
      return (
        <View style={styles.base}>
          <View style={[styles.logFrame, { borderColor: color }]}>
            <View style={[styles.logBar, { backgroundColor: color, width: active ? 14 : 12 }]} />
            <View style={[styles.logBar, { backgroundColor: color, width: 10, opacity: 0.85 }]} />
            <View style={[styles.logBar, { backgroundColor: color, width: active ? 12 : 9, opacity: 0.65 }]} />
          </View>
        </View>
      );
    case 'contacts':
      return (
        <View style={styles.base}>
          <View style={[styles.peopleRow]}>
            <View style={[styles.personHead, { backgroundColor: color, opacity: 0.7 }]} />
            <View style={[styles.personHead, { backgroundColor: color }]} />
          </View>
          <View style={styles.peopleRow}>
            <View style={[styles.personBodySmall, { backgroundColor: color, opacity: 0.7 }]} />
            <View style={[styles.personBodyLarge, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'profile':
      return (
        <View style={styles.base}>
          <View style={[styles.profileHead, { borderColor: color }]} />
          <View style={[styles.profileBody, { borderColor: color }]} />
        </View>
      );
    case 'watch':
      return (
        <View style={styles.base}>
          <View style={[styles.watchFace, { borderColor: color }]}>
            <View style={[styles.watchHandLong, { backgroundColor: color }]} />
            <View style={[styles.watchHandShort, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'layers':
      return (
        <View style={styles.base}>
          <View style={[styles.layer, { borderColor: color }]} />
          <View style={[styles.layerOffset, { borderColor: color }]} />
        </View>
      );
    default:
      return null;
  }
};

const styles = StyleSheet.create({
  base: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roof: {
    position: 'absolute',
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  house: {
    width: 14,
    height: 11,
    borderWidth: 2,
    borderTopWidth: 0,
    marginTop: 7,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  door: {
    width: 4,
    height: 5,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  logFrame: {
    width: 16,
    height: 18,
    borderWidth: 2,
    borderRadius: 5,
    paddingTop: 3,
    paddingHorizontal: 2,
  },
  logBar: {
    height: 2,
    borderRadius: 999,
    marginBottom: 3,
  },
  peopleRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  personHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  personBodySmall: {
    width: 8,
    height: 5,
    borderRadius: 4,
  },
  personBodyLarge: {
    width: 10,
    height: 6,
    borderRadius: 4,
  },
  profileHead: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2,
    marginBottom: 2,
  },
  profileBody: {
    width: 16,
    height: 9,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  watchFace: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchHandLong: {
    position: 'absolute',
    width: 2,
    height: 6,
    borderRadius: 999,
    transform: [{ translateY: -1 }],
  },
  watchHandShort: {
    position: 'absolute',
    width: 5,
    height: 2,
    borderRadius: 999,
    transform: [{ rotate: '35deg' }, { translateX: 2 }],
  },
  layer: {
    width: 14,
    height: 10,
    borderWidth: 2,
    borderRadius: 3,
    transform: [{ rotate: '-12deg' }],
  },
  layerOffset: {
    position: 'absolute',
    width: 14,
    height: 10,
    borderWidth: 2,
    borderRadius: 3,
    transform: [{ translateY: 4 }, { translateX: 3 }, { rotate: '-12deg' }],
  },
});
