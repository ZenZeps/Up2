import { View, Text, Image } from 'react-native'
import React from 'react'
import { Tabs } from 'expo-router'
import icons from '@/constants/icons'
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EventsProvider } from '../context/EventContext';

// TabIcon: Renders an icon and label for each tab in the bottom navigation bar
const TabIcon = ({ focused, icon, title}: {focused: boolean; icon: any; title: string}) => (
    <View className="flex-1 mt-3 flex flex-col items-center">
        {/* Tab icon with dynamic tint color based on focus */}
        <Image
            source={icon}
            style={{ width: 24, height: 24, tintColor: focused ? '#0061ff' : '#666876' }}
            resizeMode="contain"
        />
        {/* Tab label with dynamic style based on focus */}
        <Text className={`${focused ? 'text-primary-300 font-rubik-medium' : 'text-black-200 font-rubik'} text-xs w-full text-center mt-1`}>
            {title}
        </Text>
    </View>
)

// TabsLayout: Main layout for the tab navigator
const TabsLayout = () => {
  return (
    <EventsProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Tabs component from expo-router for bottom navigation */}
      <Tabs
        screenOptions={{
          tabBarShowLabel: false, // Hide default tab labels
          tabBarStyle: {
            backgroundColor: 'white',
            position: 'absolute',
            borderTopColor: '#0061FF1A', // Light blue border on top
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
              <TabIcon icon={icons.home} focused={focused} title="Home" />
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
              <TabIcon icon={icons.bell} focused={focused} title="Feed" />
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
              <TabIcon icon={icons.search} focused={focused} title="Explore" />
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
              <TabIcon icon={icons.person} focused={focused} title="Profile" />
            )
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
</EventsProvider>
  )
}

export default TabsLayout;