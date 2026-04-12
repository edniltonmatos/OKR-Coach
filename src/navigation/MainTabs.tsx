import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { WeeklyScreen } from '../screens/WeeklyScreen';
import { AnalysisScreen } from '../screens/AnalysisScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_BAR_BASE_HEIGHT = 64;

export function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.onSurfaceMuted,
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 10,
          letterSpacing: 1,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'HOME',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="monitor" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Weekly"
        component={WeeklyScreen}
        options={{
          tabBarLabel: 'SEMANAS',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-gantt" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Analysis"
        component={AnalysisScreen}
        options={{
          tabBarLabel: 'ANÁLISE',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-box-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
