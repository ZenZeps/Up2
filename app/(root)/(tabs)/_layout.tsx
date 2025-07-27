import icons from '@/constants/icons';
import { useTheme } from '@/lib/context/ThemeContext';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// TabIcon: Renders an icon and label for each tab in the bottom navigation bar
const TabIcon = ({ focused, icon, title, colors }: { focused: boolean; icon: any; title: string; colors: any }) => (
  <View style={{ 
    flex: 1, 
    marginTop: 12, 
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    {/* Tab icon with enhanced styling and animations */}
    <View style={{
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: focused ? colors.primary + '20' : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    }}>
      <Image
        source={icon}
        style={{ 
          width: focused ? 24 : 22, 
          height: focused ? 24 : 22, 
          tintColor: focused ? colors.primary : colors.textSecondary 
        }}
        resizeMode="contain"
      />
    </View>
    {/* Tab label with enhanced typography */}
    <Text
      style={{
        fontSize: focused ? 12 : 11,
        fontWeight: focused ? '600' : '400',
        color: focused ? colors.primary : colors.textSecondary,
        textAlign: 'center',
      }}
    >
      {title}
    </Text>
  </View>
)

// TabsLayout: Main layout for the tab navigator
const TabsLayout = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

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
            height: 70 + insets.bottom, // Add bottom safe area padding
            paddingBottom: insets.bottom, // Ensure content is above safe area
            paddingTop: 8,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 8,
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