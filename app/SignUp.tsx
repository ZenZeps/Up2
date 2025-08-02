import { CATEGORIES } from "@/constants/categories";
import images from "@/constants/images";
import { pickProfilePhoto, uploadProfilePhoto } from "@/lib/api/profilePhoto";
import {
    createUserProfile
} from "@/lib/api/user";
import {
    account,
    config,
    databases,
    signupWithEmail
} from "@/lib/appwrite/appwrite";
import { authDebug } from "@/lib/debug/authDebug";
import { useGlobalContext } from "@/lib/global-provider";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SignUpData {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    profilePhoto?: string;
    preferences: string[];
}

const SignUp = () => {
    const router = useRouter();
    const { refetch } = useGlobalContext();

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isCompletingProfile, setIsCompletingProfile] = useState(false);
    const [signUpData, setSignUpData] = useState<SignUpData>({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        preferences: [],
    });
    const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

    // Check if user is already logged in (completing profile after email verification)
    useEffect(() => {
        const checkExistingUser = async () => {
            try {
                const user = await account.get();
                if (user && user.emailVerification) {
                    setIsCompletingProfile(true);
                    setCurrentStep(2); // Skip to profile photo step
                    // Pre-fill user data
                    const names = user.name?.split(' ') || [];
                    updateSignUpData('firstName', names[0] || '');
                    updateSignUpData('lastName', names.slice(1).join(' ') || '');
                    updateSignUpData('email', user.email);
                }
            } catch (error) {
                // User not logged in, continue with normal signup
                setIsCompletingProfile(false);
            }
        };

        checkExistingUser();
    }, []);

    const updateSignUpData = (field: keyof SignUpData, value: any) => {
        setSignUpData(prev => ({ ...prev, [field]: value }));
    };

    const validateStep1 = () => {
        const { firstName, lastName, email, password, confirmPassword } = signUpData;

        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
            Alert.alert("Error", "Please fill in all required fields.");
            return false;
        }

        if (password.length < 8) {
            Alert.alert("Weak Password", "Password must be at least 8 characters.");
            return false;
        }

        if (password !== confirmPassword) {
            Alert.alert("Mismatch", "Passwords do not match.");
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert("Invalid Email", "Please enter a valid email address.");
            return false;
        }

        return true;
    };

    const handleNext = () => {
        if (currentStep === 1 && !validateStep1()) {
            return;
        }
        setCurrentStep(prev => prev + 1);
    };

    const handleBack = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handlePhotoUpload = async () => {
        try {
            const image = await pickProfilePhoto();
            if (image?.uri) {
                setProfilePhotoUri(image.uri);
            }
        } catch (error: any) {
            if (error.message !== 'Image selection was cancelled') {
                Alert.alert('Error', 'Failed to select photo');
            }
        }
    };

    const handleSkipPhoto = () => {
        setProfilePhotoUri(null);
        setCurrentStep(3);
    };

    const togglePreference = (preference: string) => {
        const currentPreferences = signUpData.preferences;
        if (currentPreferences.includes(preference)) {
            updateSignUpData('preferences', currentPreferences.filter(p => p !== preference));
        } else {
            updateSignUpData('preferences', [...currentPreferences, preference]);
        }
    };

    const handleCompleteSignUp = async () => {
        try {
            setLoading(true);

            if (isCompletingProfile) {
                // User is completing profile after verification
                const user = await account.get();

                // Create user profile
                await createUserProfile({
                    $id: user.$id,
                    firstName: signUpData.firstName.trim(),
                    lastName: signUpData.lastName.trim(),
                    email: user.email,
                    isPublic: true,
                    preferences: signUpData.preferences,
                    friends: [],
                    photoId: undefined,
                });

                // Upload profile photo if provided
                if (profilePhotoUri) {
                    try {
                        const photoId = await uploadProfilePhoto(user.$id, profilePhotoUri);
                        await databases.updateDocument(
                            config.databaseID!,
                            config.usersCollectionID!,
                            user.$id,
                            { photoId: photoId }
                        );
                    } catch (photoError) {
                        authDebug.warn("Could not upload profile photo", photoError);
                    }
                }

                // Refresh global state and navigate
                await refetch();
                router.replace("/(root)/(tabs)/Home");

            } else {
                // New user signup
                const { firstName, lastName, email, password, preferences } = signUpData;
                const fullName = `${firstName.trim()} ${lastName.trim()}`;
                const trimmedEmail = email.trim().toLowerCase();

                authDebug.info("Starting comprehensive signup process");

                // Create user account (this will send verification email automatically)
                await signupWithEmail(trimmedEmail, password, fullName);
                authDebug.info("User account created successfully");

                // Show verification message and redirect to sign-in
                Alert.alert(
                    "Email Verification Required",
                    "We've sent a verification email to your inbox. Please verify your email before signing in.",
                    [
                        {
                            text: "OK",
                            onPress: () => {
                                authDebug.info("User directed to sign-in for verification");
                                router.replace("/SignIn");
                            }
                        }
                    ]
                );
            }

        } catch (error: any) {
            authDebug.error("Signup failed", error);
            Alert.alert(
                "Sign Up Failed",
                error.message || "Could not create your account. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <View className="px-10 mt-6 pb-12">
            <Text className="text-3xl font-rubik-semibold text-black-300 text-center mb-6">
                Create Your Account
            </Text>

            <TextInput
                placeholder="First Name"
                value={signUpData.firstName}
                onChangeText={(value) => updateSignUpData('firstName', value)}
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
                autoCapitalize="words"
                placeholderTextColor="#aaa"
            />

            <TextInput
                placeholder="Last Name"
                value={signUpData.lastName}
                onChangeText={(value) => updateSignUpData('lastName', value)}
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
                autoCapitalize="words"
                placeholderTextColor="#aaa"
            />

            <TextInput
                placeholder="Email"
                value={signUpData.email}
                onChangeText={(value) => updateSignUpData('email', value)}
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#aaa"
            />

            <TextInput
                placeholder="Password"
                value={signUpData.password}
                onChangeText={(value) => updateSignUpData('password', value)}
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
                secureTextEntry
                placeholderTextColor="#aaa"
            />

            <TextInput
                placeholder="Confirm Password"
                value={signUpData.confirmPassword}
                onChangeText={(value) => updateSignUpData('confirmPassword', value)}
                className="border border-gray-300 rounded-lg px-4 py-3 mb-6 font-rubik text-black-300"
                secureTextEntry
                placeholderTextColor="#aaa"
            />

            <TouchableOpacity
                onPress={handleNext}
                className="rounded-full py-4 bg-primary-300 mb-6"
            >
                <Text className="text-white text-lg font-rubik-medium text-center">
                    Next
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.replace('/SignIn')}
                className="mb-8"
            >
                <Text className="text-center text-black-200 font-rubik">
                    Already have an account? Sign In
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep2 = () => (
        <View className="px-10 mt-6 pb-12">
            <Text className="text-3xl font-rubik-semibold text-black-300 text-center mb-6">
                Add Profile Photo
            </Text>

            <View className="items-center mb-8">
                {profilePhotoUri ? (
                    <Image
                        source={{ uri: profilePhotoUri }}
                        className="w-32 h-32 rounded-full mb-4"
                    />
                ) : (
                    <View className="w-32 h-32 rounded-full bg-gray-200 items-center justify-center mb-4">
                        <Text className="text-6xl text-gray-400 font-rubik-medium">
                            {signUpData.firstName?.charAt(0)?.toUpperCase()}
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    onPress={handlePhotoUpload}
                    className="rounded-full py-3 px-6 bg-primary-300 mb-4"
                >
                    <Text className="text-white font-rubik-medium">
                        {profilePhotoUri ? 'Change Photo' : 'Upload Photo'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSkipPhoto}>
                    <Text className="text-black-200 font-rubik underline">
                        Skip for now
                    </Text>
                </TouchableOpacity>
            </View>

            <View className="flex-row justify-between mb-8">
                <TouchableOpacity
                    onPress={handleBack}
                    className="rounded-full py-4 px-8 bg-gray-300 flex-1 mr-2"
                >
                    <Text className="text-black-300 text-lg font-rubik-medium text-center">
                        Back
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentStep(3)}
                    className="rounded-full py-4 px-8 bg-primary-300 flex-1 ml-2"
                >
                    <Text className="text-white text-lg font-rubik-medium text-center">
                        Next
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View className="px-10 mt-6 flex-1">
            <Text className="text-3xl font-rubik-semibold text-black-300 text-center mb-4">
                Choose Your Interests
            </Text>
            <Text className="text-center text-black-200 font-rubik mb-6">
                Select what you're interested in (you can change this later)
            </Text>

            <View className="flex-1 mb-4">
                <FlatList
                    data={CATEGORIES}
                    numColumns={2}
                    keyExtractor={(item) => item.value}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                        const isSelected = signUpData.preferences.includes(item.value);
                        return (
                            <TouchableOpacity
                                onPress={() => togglePreference(item.value)}
                                className={`flex-1 m-2 p-4 rounded-lg border-2 items-center min-h-[100px] justify-center ${isSelected ? 'border-primary-300 bg-blue-50' : 'border-gray-300 bg-white'
                                    }`}
                            >
                                <Text className="text-3xl mb-2">{item.emoji}</Text>
                                <Text className={`font-rubik-medium text-center ${isSelected ? 'text-primary-300' : 'text-black-300'
                                    }`}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            {/* Selection counter */}
            <View className="items-center mb-6">
                <Text className="text-black-200 font-rubik text-center">
                    {signUpData.preferences.length > 0
                        ? `${signUpData.preferences.length} interest${signUpData.preferences.length !== 1 ? 's' : ''} selected`
                        : 'No interests selected yet'
                    }
                </Text>
            </View>

            {/* Fixed bottom buttons */}
            <View className="flex-row justify-between pb-4">
                <TouchableOpacity
                    onPress={handleBack}
                    className="rounded-full py-4 px-8 bg-gray-300 flex-1 mr-2"
                >
                    <Text className="text-black-300 text-lg font-rubik-medium text-center">
                        Back
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleCompleteSignUp}
                    disabled={loading}
                    className={`rounded-full py-4 px-8 flex-1 ml-2 ${loading ? "bg-gray-300" : "bg-primary-300"
                        }`}
                >
                    <Text className="text-white text-lg font-rubik-medium text-center">
                        {loading ? "Creating Account..." : "Complete"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderProgressIndicator = () => (
        <View className="flex-row justify-center items-center mt-4 mb-4">
            {[1, 2, 3].map((step) => (
                <View key={step} className="flex-row items-center">
                    <View
                        className={`w-8 h-8 rounded-full items-center justify-center ${currentStep >= step ? 'bg-primary-300' : 'bg-gray-300'
                            }`}
                    >
                        <Text className={`font-rubik-medium ${currentStep >= step ? 'text-white' : 'text-gray-600'
                            }`}>
                            {step}
                        </Text>
                    </View>
                    {step < 3 && (
                        <View className={`w-8 h-1 mx-2 ${currentStep > step ? 'bg-primary-300' : 'bg-gray-300'
                            }`} />
                    )}
                </View>
            ))}
        </View>
    );

    return (
        <SafeAreaView className="bg-white flex-1">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                {currentStep === 3 ? (
                    // Step 3 needs different layout for the FlatList
                    <View className="flex-1">
                        <Image
                            source={images.logo}
                            className="w-full h-1/4"
                            resizeMode="contain"
                        />

                        {renderProgressIndicator()}

                        {renderStep3()}
                    </View>
                ) : (
                    // Steps 1 and 2 use ScrollView with proper spacing
                    <ScrollView
                        contentContainerStyle={{ paddingVertical: 20 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                    >
                        <Image
                            source={images.logo}
                            className="w-full h-64"
                            resizeMode="contain"
                        />

                        {renderProgressIndicator()}

                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                    </ScrollView>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignUp;
