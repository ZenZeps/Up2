import icons from '@/constants/icons';
import { config, databases, getCurrentUser } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUserId(currentUser.$id);

        // Check for pending friend requests
        const friendRequests = await databases.listDocuments(
          config.databaseID!,
          config.userFriendshipsCollectionID!,
          [
            Query.and([
              Query.or([
                Query.equal('userId1', currentUser.$id),
                Query.equal('userId2', currentUser.$id)
              ]),
              Query.equal('status', 'pending'),
              Query.notEqual('requesterId', currentUser.$id) // Exclude requests we sent
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
  }, []);

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
          tintColor: focused ? '#000000' : colors.textSecondary
        }}
        resizeMode="contain"
      />
      {/* Notification badge for Feed tab only */}
      {hasNotifications && title === 'Feed' && (
        <View className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" />
      )}
    </View>
    {/* Tab label with dynamic style based on focus */}
    <Text
      className={`${focused ? 'font-rubik-medium' : 'font-rubik'} text-xs w-full text-center mt-1`}
      style={{
        color: focused ? '#000000' : colors.textSecondary
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
            backgroundColor: colors.tabBar,
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
              <TabIcon icon={icons.bell} focused={focused} title="Feed" colors={colors} hasNotifications={hasNotifications} />
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
              <TabIcon icon={icons.bell} focused={focused} title="Profile" colors={colors} hasNotifications={hasNotifications} />
            )
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  )
}

export default TabsLayout;