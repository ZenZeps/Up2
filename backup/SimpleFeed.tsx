import { Background } from '@/components/ui/Background';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export default function SimpleFeed() {
  console.log('🍽️ SimpleFeed: Component rendering');

  const { colors } = useTheme();
  const { user: globalUser } = useGlobalContext();

  console.log('🍽️ SimpleFeed: User:', globalUser?.$id);

  return (
    <Background>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        {/* Debug header */}
        <View style={{ padding: 20, backgroundColor: '#00ff00', margin: 10 }}>
          <Text style={{ color: 'black', fontSize: 16, fontWeight: 'bold' }}>
            SIMPLE FEED TEST
          </Text>
          <Text style={{ color: 'black', fontSize: 12 }}>
            User ID: {globalUser?.$id || 'Not logged in'}
          </Text>
          <Text style={{ color: 'black', fontSize: 12 }}>
            Colors: {JSON.stringify({ primary: colors.primary, text: colors.text })}
          </Text>
        </View>

        {/* Simple header */}
        <View style={{ padding: 20, backgroundColor: colors.background }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
            UP2 YOU
          </Text>
        </View>

        {/* Simple content */}
        <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 18, textAlign: 'center' }}>
            This is a simplified Feed component for debugging.
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 10 }}>
            If you can see this, the basic component structure works.
          </Text>
        </View>
      </SafeAreaView>
    </Background>
  );
}
