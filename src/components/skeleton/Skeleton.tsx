import React from 'react';
import {
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
  DimensionValue,
} from 'react-native';
import { oledTheme } from '@/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  animated?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = oledTheme.radius.sm,
  style,
  children,
  animated = true,
}) => {
  const opacityAnim = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    if (!animated) {
      opacityAnim.setValue(0.6);
      return;
    }

    const animation = Animated.loop
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.85,
              duration: 850,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.35,
              duration: 850,
              useNativeDriver: true,
            }),
          ])
        )
      : null;

    animation?.start();

    return () => {
      animation?.stop();
    };
  }, [animated, opacityAnim]);

  return (
    <Animated.View
      accessibilityRole="none"
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          opacity: opacityAnim,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: '#161616',
    borderColor: '#262626',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
