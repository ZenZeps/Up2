import icons from '@/constants/icons';
import { useTheme } from '@/lib/context/ThemeContext';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// TabIcon: Renders an icon and label for each tab in the bottom navigation bar
const TabIcon = ({ focused, icon, title, colors }: { focused: boolean; icon: any; title: string; colors: any }) => (
  <View className="flex-1 mt-3 flex flex-col items-center">
    {/* Tab icon with dynamic tint color based on focus */}
    <Image
      source={icon}
      style={{ width: 24, height: 24, tintColor: focused ? colors.primary : colors.textSecondary }}
      resizeMode="contain"
    />
    {/* Tab label with dynamic style based on focus */}
    <Text
      className={`${focused ? 'font-rubik-medium' : 'font-rubik'} text-xs w-full text-center mt-1`}
      style={{ color: focused ? colors.primary : colors.textSecondary }}
    >
      {title}
    </Text>
  </View>
)

// TabsLayout: Main layout for the tab navigator
const TabsLayout = () => {
  const { colors, isDark } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Tabs component from expo-router for bottom navigation */}
      <Tabs
        screenOptions={{
          tabBarShowLabel: false, // Hide default tab labels
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            position: 'absolute',
            borderTopColor: colors.border,
            borderTopWidth: 1,
            minHeight: 70, // Height of the tab bar
          }
        }}
      >
        {/* Home tab */}
        <Tabs.Screen
          name="Home"
          options={{
            title: 'Home',
            headerShown: false, // Hide the header for this tab
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={icons.home} focused={focused} title="Home" colors={colors} />
            )
          }}
        />
        {/* Feed tab */}
        <Tabs.Screen
          name="Feed"
          options={{
            title: 'Feed',
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={icons.bell} focused={focused} title="Feed" colors={colors} />
            )
          }}
        />
        {/* Explore tab */}
        <Tabs.Screen
          name="Explore"
          options={{
            title: 'Explore',
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={icons.search} focused={focused} title="Explore" colors={colors} />
            )
          }}
        />
        {/* Profile tab */}
        <Tabs.Screen
          name="Profile"
          options={{
            title: 'Profile',
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={icons.person} focused={focused} title="Profile" colors={colors} />
            )
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  )
}

export default TabsLayout;