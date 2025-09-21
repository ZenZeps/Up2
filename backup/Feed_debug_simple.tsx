// DEBUG: Temporary simple version
import { Background } from '@/components/ui/Background';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export default function Feed() {
  console.log('🍽️ Feed: Component rendering (SIMPLE VERSION)');

  const { colors } = useTheme();
  const { user: globalUser } = useGlobalContext();

  console.log('🍽️ Feed: User:', globalUser?.$id);

  return (
    <Background>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        {/* Debug header */}
        <View style={{ padding: 20, backgroundColor: '#00ff00', margin: 10 }}>
          <Text style={{ color: 'black', fontSize: 16, fontWeight: 'bold' }}>
            FEED DEBUG MODE
          </Text>
          <Text style={{ color: 'black', fontSize: 12 }}>
            User ID: {globalUser?.$id || 'Not logged in'}
          </Text>
          <Text style={{ color: 'black', fontSize: 12 }}>
            This should render if basic Feed works
          </Text>
        </View>

        {/* Simple header */}
        <View style={{ padding: 20, backgroundColor: colors.background }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
            UP2 YOU (Debug)
          </Text>
        </View>

        {/* Simple content */}
        <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 18, textAlign: 'center' }}>
            Feed is in debug mode - basic structure test.
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 10 }}>
            If you can see this, the Feed component can render.
          </Text>
        </View>
      </SafeAreaView>
    </Background>
  );
}
