import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';

import AttendanceScreen from '../screens/AttendanceScreen';
import LogsScreen from '../screens/LogsScreen';
import SalaryScreen from '../screens/SalaryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SalaryConfigScreen from '../screens/SalaryConfigScreen';
import ThemeSettingsScreen from '../screens/ThemeSettingsScreen';
import PolicyScreen from '../screens/PolicyScreen';
import SupportFeedbackScreen from '../screens/SupportFeedbackScreen';
import BackupScreen from '../screens/BackupScreen';
import StatisticsCompareScreen from '../screens/StatisticsCompareScreen';
import PersonalInfoScreen from '../screens/PersonalInfoScreen';
import TaxSettingsScreen from '../screens/TaxSettingsScreen';
import ExportScreen from '../screens/ExportScreen';
import { applyReminders } from '../services/reminders';
import { useReminderStore } from '../store/useReminderStore';
import SetupScreen from '../screens/SetupScreen';
import SplashScreen from '../screens/SplashScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

import { useAppTheme } from '../hooks/useAppTheme';
import { useThemeStore } from '../store/useThemeStore';
import { useProfileStore } from '../store/useProfileStore';
import { useSalaryStore } from '../store/useSalaryStore';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();
const AttendanceStack = createNativeStackNavigator();
const SalaryStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const SPLASH_MIN_MS = 900;

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Attendance: { active: 'timer', inactive: 'timer-outline' },
  Logs: { active: 'calendar', inactive: 'calendar-outline' },
  Salary: { active: 'cash', inactive: 'cash-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

const AttendanceStackScreen = () => {
  const theme = useAppTheme();

  return (
    <AttendanceStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <AttendanceStack.Screen name="AttendanceMain" component={AttendanceScreen} />
      <AttendanceStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: true, title: 'Thong bao' }}
      />
    </AttendanceStack.Navigator>
  );
};

const SalaryStackScreen = () => {
  const theme = useAppTheme();

  return (
    <SalaryStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <SalaryStack.Screen name="SalaryMain" component={SalaryScreen} />
      <SalaryStack.Screen
        name="StatisticsCompare"
        component={StatisticsCompareScreen}
        options={{ headerShown: true, title: 'Thong ke va so sanh' }}
      />
      <SalaryStack.Screen
        name="TaxSettings"
        component={TaxSettingsScreen}
        options={{ headerShown: true, title: 'Thuế và bảo hiểm' }}
      />
      <SalaryStack.Screen
        name="Export"
        component={ExportScreen}
        options={{ headerShown: true, title: 'Xuất CSV' }}
      />
    </SalaryStack.Navigator>
  );
};

const ProfileStackScreen = () => {
  const theme = useAppTheme();

  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="SalaryConfig" component={SalaryConfigScreen} />
      <ProfileStack.Screen
        name="TaxSettings"
        component={TaxSettingsScreen}
        options={{ headerShown: true, title: 'Thuế và bảo hiểm' }}
      />
      <ProfileStack.Screen
        name="Export"
        component={ExportScreen}
        options={{ headerShown: true, title: 'Xuất CSV' }}
      />
      <ProfileStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: true, title: 'Nhắc nhở' }}
      />
      <ProfileStack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{ headerShown: true, title: 'Giao dien' }}
      />
      <ProfileStack.Screen
        name="PersonalInfo"
        component={PersonalInfoScreen}
        options={{ headerShown: true, title: 'Thong tin ca nhan' }}
      />
      <ProfileStack.Screen
        name="Policy"
        component={PolicyScreen}
        options={{ headerShown: true, title: 'Chinh sach va quy dinh' }}
      />
      <ProfileStack.Screen
        name="SupportFeedback"
        component={SupportFeedbackScreen}
        options={{ headerShown: true, title: 'Ho tro va gop y' }}
      />
      <ProfileStack.Screen
        name="Backup"
        component={BackupScreen}
        options={{ headerShown: true, title: 'Sao luu va khoi phuc' }}
      />
      <ProfileStack.Screen
        name="StatisticsCompare"
        component={StatisticsCompareScreen}
        options={{ headerShown: true, title: 'Thong ke va so sanh' }}
      />
    </ProfileStack.Navigator>
  );
};

const MainTabs = () => {
  const theme = useAppTheme();
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const tabBackground = isDark ? '#111317' : '#FFFFFF';

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <View style={styles.tabOuter}>
          <View
            style={[
              styles.tabGlass,
              {
                backgroundColor: tabBackground,
                borderColor: theme.colors.outlineVariant,
                shadowColor: theme.colors.primary,
              },
            ]}
          >
            {props.state.routes.map((route, index) => {
              const focused = props.state.index === index;
              const iconConfig = TAB_ICONS[route.name] ?? TAB_ICONS.Attendance;
              const iconName = focused ? iconConfig.active : iconConfig.inactive;
              const color = focused ? theme.colors.primary : theme.colors.outline;
              const label = props.descriptors[route.key].options.title || route.name;

              return (
                <TouchableOpacity
                  key={route.key}
                  style={styles.tabItem}
                  onPress={() => props.navigation.navigate(route.name as never)}
                >
                  <View
                    style={[
                      styles.iconBubble,
                      focused && {
                        backgroundColor: theme.colors.primaryContainer,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                  >
                    <Ionicons name={iconName} size={20} color={color} />
                  </View>
                  <Text style={[styles.tabLabel, { color }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen name="Attendance" component={AttendanceStackScreen} options={{ title: 'Diem danh' }} />
      <Tab.Screen name="Logs" component={LogsScreen} options={{ title: 'Lich su' }} />
      <Tab.Screen name="Salary" component={SalaryStackScreen} options={{ title: 'Bang luong' }} />
      <Tab.Screen name="Profile" component={ProfileStackScreen} options={{ title: 'Ca nhan' }} />
    </Tab.Navigator>
  );
};

const allStoresHydrated = () =>
  useProfileStore.persist.hasHydrated() &&
  useSalaryStore.persist.hasHydrated() &&
  useThemeStore.persist.hasHydrated();

/** Chờ các store nạp xong dữ liệu từ bộ nhớ máy trước khi quyết định hiện màn hình nào. */
const useStoresHydrated = () => {
  const [hydrated, setHydrated] = useState(allStoresHydrated());

  useEffect(() => {
    const check = () => setHydrated(allStoresHydrated());
    const unsubscribers = [
      useProfileStore.persist.onFinishHydration(check),
      useSalaryStore.persist.onFinishHydration(check),
      useThemeStore.persist.onFinishHydration(check),
    ];
    check();
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  return hydrated;
};

export default function AppNavigator() {
  const theme = useAppTheme();
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const onboarded = useProfileStore((s) => s.onboarded);
  const hydrated = useStoresHydrated();

  const [splashDone, setSplashDone] = useState(false);

  // Đặt lại lịch nhắc mỗi lần mở app (thông báo cục bộ, không cần mạng)
  useEffect(() => {
    if (hydrated && onboarded) {
      applyReminders(useReminderStore.getState().settings).catch(() => {});
    }
  }, [hydrated, onboarded]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  const resolvedDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const navTheme = resolvedDark ? DarkTheme : DefaultTheme;

  if (!hydrated || !splashDone) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer
      theme={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.onSurface,
          primary: theme.colors.primary,
          border: theme.colors.outlineVariant,
        },
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!onboarded ? (
          <RootStack.Screen name="Setup" component={SetupScreen} />
        ) : (
          <RootStack.Screen name="MainTabs" component={MainTabs} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabOuter: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  tabGlass: {
    flexDirection: 'row',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
