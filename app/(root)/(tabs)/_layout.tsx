import icons from '@/constants/icons';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Query } from 'react-native-appwrite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Hook to check for unread notifications
const useNotificationCount = () => {
  const [hasNotifications, setHasNotifications] = useState(false);
  const { user: globalUser } = useGlobalContext();

  useEffect(() => {
    const checkNotifications = async () => {
      try {
        if (!globalUser?.$id) return;

        // Check for pending friend requests
        const friendRequests = await databases.listDocuments(
          config.databaseID!,
          config.userFriendshipsCollectionID!,
          [
            Query.and([
              Query.or([
                Query.equal('userId1', globalUser.$id),
                Query.equal('userId2', globalUser.$id)
              ]),
              Query.equal('status', 'pending'),
              Query.notEqual('requesterId', globalUser.$id) // Exclude requests we sent
            ]),
            Query.limit(1) // Just check if any exist
          ]
        );

        setHasNotifications(friendRequests.documents.length > 0);
      } catch (error) {
        console.error('Error checking notifications:', error);
        setHasNotifications(false);
      }
    };

    checkNotifications();
    // Check every 30 seconds for new notifications
    const interval = setInterval(checkNotifications, 30000);

    return () => clearInterval(interval);
  }, [globalUser?.$id]);

  return hasNotifications;
};

// TabIcon: Renders an icon and label for each tab in the bottom navigation bar
const TabIcon = ({ focused, icon, title, colors, hasNotifications = false }: {
  focused: boolean;
  icon: any;
  title: string;
  colors: any;
  hasNotifications?: boolean;
}) => (
  <View className="flex-1 mt-3 flex flex-col items-center relative">
    {/* Tab icon with dynamic tint color based on focus */}
    <View className="relative">
      <Image
        source={icon}
        style={{
          width: 24,
          height: 24,
          // Use white for the active tab highlight to ensure visibility on dark tab bar
          tintColor: focused ? '#FFFFFF' : colors.textSecondary
        }}
        resizeMode="contain"
      />
      {/* Notification badge for Feed tab only */}
      {hasNotifications && title === 'Feed' && (
        <View style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, backgroundColor: '#ef4444', borderRadius: 12, borderWidth: 1, borderColor: colors.buttonText }} />
      )}
    </View>
    {/* Tab label with dynamic style based on focus */}
    <Text
      className={`${focused ? 'font-rubik-medium' : 'font-rubik'} text-xs w-full text-center mt-1`}
      style={{
        // Ensure active tab label is white on dark tab bar
        color: focused ? '#FFFFFF' : colors.textSecondary
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
  const hasNotifications = useNotificationCount();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Tabs component from expo-router for bottom navigation */}
      <Tabs
        screenOptions={{
          tabBarShowLabel: false, // Hide default tab labels
          tabBarStyle: {
            // Use a consistent dark tab bar appearance even in light mode so the Feed looks the same
            backgroundColor: isDark ? colors.tabBar : '#1c1c1e',
            position: 'absolute',
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 70 + insets.bottom, // Add bottom safe area padding
            paddingBottom: insets.bottom, // Ensure content is above safe area
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
              <TabIcon icon={icons.home} focused={focused} title="Home" colors={colors} hasNotifications={false} />
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
              // Do not show the notification badge on the bottom Feed tab for invites.
              // Invite highlighting is handled inside the Home screen UI's bell icon.
              <TabIcon icon={icons.bell} focused={focused} title="Feed" colors={colors} hasNotifications={false} />
            )
          }}
        />
        {/* Map tab removed: map feature deprecated and route deleted */}
        {/* Explore tab */}
        <Tabs.Screen
          name="Explore"
          options={{
            title: 'Explore',
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={icons.search} focused={focused} title="Explore" colors={colors} hasNotifications={false} />
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
              <TabIcon icon={icons.person} focused={focused} title="Profile" colors={colors} hasNotifications={false} />
            )
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  )
}

export default TabsLayout;