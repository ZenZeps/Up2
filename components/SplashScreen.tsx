import { useTheme } from '@/lib/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, Text, View } from 'react-native';

interface CustomSplashScreenProps {
    onFinish: () => void;
    preloadData?: () => Promise<void>;
    minimumDisplayTime?: number; // Minimum time to show splash in milliseconds
}

const { width, height } = Dimensions.get('window');

export const CustomSplashScreen: React.FC<CustomSplashScreenProps> = ({
    onFinish,
    preloadData,
    minimumDisplayTime = 3500 // Default 3.5 seconds to ensure Home/Feed are ready
}) => {
    const { colors } = useTheme();
    const [isLoading, setIsLoading] = useState(true);
    const [loadingText, setLoadingText] = useState('Welcome to Up2');

    // Animation values
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(0.8);
    const textFadeAnim = new Animated.Value(0);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Start animations
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 50,
                        friction: 7,
                        useNativeDriver: true,
                    }),
                ]).start();

                // Show text after logo animation
                setTimeout(() => {
                    Animated.timing(textFadeAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }).start();
                }, 800);

                const startTime = Date.now();

                // Update loading text
                setLoadingText('Loading your events...');

                // Preload data if provided
                if (preloadData) {
                    await preloadData();
                }

                // Update progress
                setLoadingText('Setting up your feed...');
                await new Promise(resolve => setTimeout(resolve, 600));

                setLoadingText('Almost ready!');

                // Ensure minimum display time has elapsed
                const elapsedTime = Date.now() - startTime;
                const remainingTime = Math.max(0, minimumDisplayTime - elapsedTime);

                if (remainingTime > 0) {
                    console.log(`⏱️ Waiting additional ${remainingTime}ms to ensure Home/Feed are ready`);
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }

                // Hide native splash screen
                await SplashScreen.hideAsync();

                // Fade out and finish
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }).start(() => {
                    setIsLoading(false);
                    onFinish();
                });

            } catch (error) {
                console.error('Splash screen initialization error:', error);
                // Fallback - finish splash screen even if preload fails
                await SplashScreen.hideAsync();
                onFinish();
            }
        };

        initializeApp();
    }, []);

    if (!isLoading) {
        return null;
    }

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient
                colors={[colors.primary, colors.secondary, '#ffffff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    width,
                    height,
                }}
            >
                <Animated.View
                    style={{
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                        alignItems: 'center',
                    }}
                >
                    {/* Logo */}
                    <Image
                        source={require('../assets/images/Up2-Logo.png')}
                        style={{
                            width: 120,
                            height: 120,
                            marginBottom: 40,
                        }}
                        resizeMode="contain"
                    />

                    {/* App Name */}
                    <Text
                        style={{
                            fontSize: 32,
                            fontWeight: 'bold',
                            color: '#ffffff',
                            marginBottom: 20,
                            fontFamily: 'Rubik-ExtraBold',
                            textShadowColor: 'rgba(0, 0, 0, 0.3)',
                            textShadowOffset: { width: 0, height: 2 },
                            textShadowRadius: 4,
                        }}
                    >
                        Up2
                    </Text>

                    {/* Tagline */}
                    <Animated.Text
                        style={{
                            opacity: textFadeAnim,
                            fontSize: 16,
                            color: '#ffffff',
                            marginBottom: 40,
                            fontFamily: 'Rubik-Medium',
                            textAlign: 'center',
                            textShadowColor: 'rgba(0, 0, 0, 0.2)',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2,
                        }}
                    >
                        Connect, Event, Experience
                    </Animated.Text>

                    {/* Loading indicator */}
                    <View style={{ alignItems: 'center' }}>
                        <ActivityIndicator
                            size="small"
                            color="#ffffff"
                            style={{ marginBottom: 12 }}
                        />
                        <Animated.Text
                            style={{
                                opacity: textFadeAnim,
                                fontSize: 14,
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontFamily: 'Rubik-Regular',
                            }}
                        >
                            {loadingText}
                        </Animated.Text>
                    </View>
                </Animated.View>
            </LinearGradient>
        </View>
    );
};