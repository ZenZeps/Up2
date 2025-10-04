import images from '@/constants/images';
import { useTheme } from '@/lib/context/ThemeContext';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, View } from 'react-native';

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

    // Enhanced animation values
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(0.8);
    const textFadeAnim = new Animated.Value(0);
    const pulseAnim = new Animated.Value(1);
    const rotateAnim = new Animated.Value(0);
    const progressAnim = new Animated.Value(0);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Start enhanced animations
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

                // Start pulsing animation for logo
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.1,
                            duration: 1000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 1000,
                            useNativeDriver: true,
                        }),
                    ])
                ).start();

                // Start subtle rotation animation
                Animated.loop(
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 3000,
                        useNativeDriver: true,
                    })
                ).start();

                // Animate progress bar
                Animated.timing(progressAnim, {
                    toValue: 1,
                    duration: minimumDisplayTime,
                    useNativeDriver: false,
                }).start();

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

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={{
            flex: 1,
            backgroundColor: '#ffffff',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <Animated.View
                style={{
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                    alignItems: 'center',
                }}
            >
                {/* Animated Logo with pulsing and subtle rotation */}
                <Animated.View
                    style={{
                        transform: [
                            { scale: pulseAnim },
                            { rotate: spin }
                        ],
                        marginBottom: 40,
                    }}
                >
                    <Image
                        source={images.logo}
                        style={{
                            width: 120,
                            height: 120,
                        }}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* App Name */}
                <Animated.Text
                    style={{
                        opacity: textFadeAnim,
                        fontSize: 28,
                        fontWeight: 'bold',
                        color: colors.primary,
                        marginBottom: 30,
                        fontFamily: 'Rubik-ExtraBold',
                    }}
                >
                    Up2
                </Animated.Text>

                {/* Progress Bar */}
                <View style={{
                    width: 200,
                    height: 4,
                    backgroundColor: '#f0f0f0',
                    borderRadius: 2,
                    marginBottom: 20,
                    overflow: 'hidden'
                }}>
                    <Animated.View
                        style={{
                            height: '100%',
                            backgroundColor: colors.primary,
                            borderRadius: 2,
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }),
                        }}
                    />
                </View>

                {/* Loading indicator and text */}
                <View style={{ alignItems: 'center' }}>
                    <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={{ marginBottom: 12 }}
                    />
                    <Animated.Text
                        style={{
                            opacity: textFadeAnim,
                            fontSize: 14,
                            color: colors.textSecondary,
                            fontFamily: 'Rubik-Regular',
                        }}
                    >
                        {loadingText}
                    </Animated.Text>
                </View>
            </Animated.View>
        </View>
    );
};