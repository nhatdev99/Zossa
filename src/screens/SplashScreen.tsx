import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

/** Màn hình splash hiển thị trong lúc app nạp dữ liệu từ bộ nhớ máy. */
export default function SplashScreen() {
  const theme = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View style={{ alignItems: 'center', opacity, transform: [{ scale }] }}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.brand, { color: theme.colors.onSurface }]}>Rosala</Text>
        <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>Chấm công & tính lương</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 110, height: 110, marginBottom: 12 },
  brand: { fontSize: 32, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 6 },
});
