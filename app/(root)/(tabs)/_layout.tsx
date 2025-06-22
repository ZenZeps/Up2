
import { View, Text, Image } from 'react-native'
import React from 'react'
import { Tabs } from 'expo-router'
import icons from '@/constants/icons'
import { EventsProvider } from '../context/EventContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const TabIcon = ({ focused, icon, title}: {focused: boolean; icon: any; title: string}) => (
    <View className="flex-1 mt-3 flex flex-col items-center">
       <Image source={icon} style={{ width: 24, height: 24, tintColor: focused ? '#0061ff' : '#666876'}}
    resizeMode="contain"/>
        <Text className={`${focused ? 'text-primary-300 font-rubik-medium' : 'text-black-200 font-rubik'} text-xs w-full text-center mt-1`}>
            {title}
        </Text>
    </View>
)

const TabsLayout = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <EventsProvider>
        <Tabs screenOptions = {{
            tabBarShowLabel: false, //Don't want to show label
            tabBarStyle: {
                backgroundColor: 'white',
                position: 'absolute',
                borderTopColor: '#0061FF1A', // Border color
                borderTopWidth: 1, // Border width
                minHeight: 70,
            }
        }}
        >
            <Tabs.Screen
                name="Home"
                options={{
                    title: 'Home',
                    headerShown: false,
                    tabBarIcon: ({focused}) => (
                        <TabIcon icon ={icons.home} focused = {focused} title="Home" />
                 )
                }}
            />
            <Tabs.Screen
                name="Explore"
            options={{
                title: 'Explore',
                headerShown: false,
                tabBarIcon: ({focused}) => (
                <TabIcon icon = {icons.search} focused = {focused} title = "Explore" />
             )
            }}
        />
        <Tabs.Screen
            name="Map"
            options={{
                title: 'Map',
                headerShown: false,
                tabBarIcon: ({ focused }) => (
                <TabIcon icon={icons.location} focused={focused} title="Map" />
                ),
            }}
        />
        <Tabs.Screen
            name="Profile"
            options={{
                title: 'Profile',
                headerShown: false,
                tabBarIcon: ({focused}) => (
                <TabIcon icon = {icons.person} focused = {focused} title = "Profile" />)
            }}
        />
    </Tabs>
    </EventsProvider>
    </GestureHandlerRootView>
  )
}

export default TabsLayout