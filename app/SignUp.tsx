import { LegalDocumentModal } from "@/components/legal/LegalDocumentModal";
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
import { EmailVerificationHandler } from "@/lib/auth/emailVerification";
import { authDebug } from "@/lib/debug/authDebug";
import { useGlobalContext } from "@/lib/global-provider";
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
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
    birthYear: string;
    profilePhoto?: string;
    preferences: string[];
    agreeToTerms: boolean;
    agreeToPrivacy: boolean;
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
        birthYear: "",
        preferences: [],
        agreeToTerms: false,
        agreeToPrivacy: false,
    });
    const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
    const [legalModalVisible, setLegalModalVisible] = useState(false);
    const [legalDocument, setLegalDocument] = useState<'terms' | 'privacy'>('terms');

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
        const { firstName, lastName, email, password, confirmPassword, birthYear, agreeToTerms, agreeToPrivacy } = signUpData;

        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword || !birthYear.trim()) {
            Alert.alert("Error", "Please fill in all required fields.");
            return false;
        }

        // Validate birth year
        const currentYear = new Date().getFullYear();
        const birthYearNum = parseInt(birthYear);
        if (isNaN(birthYearNum) || birthYearNum < 1900 || birthYearNum > currentYear) {
            Alert.alert("Invalid Birth Year", "Please enter a valid birth year.");
            return false;
        }

        // Check minimum age (13 years old)
        const age = currentYear - birthYearNum;
        if (age < 13) {
            Alert.alert("Age Requirement", "You must be at least 13 years old to use Up2.");
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

        if (!agreeToTerms) {
            Alert.alert("Terms Required", "Please agree to the Terms of Service to continue.");
            return false;
        }

        if (!agreeToPrivacy) {
            Alert.alert("Privacy Required", "Please agree to the Privacy Policy to continue.");
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

    const openLegalDocument = (document: 'terms' | 'privacy') => {
        setLegalDocument(document);
        setLegalModalVisible(true);
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
                const currentYear = new Date().getFullYear();
                const age = currentYear - parseInt(signUpData.birthYear);

                await createUserProfile({
                    $id: user.$id,
                    firstName: signUpData.firstName.trim(),
                    lastName: signUpData.lastName.trim(),
                    email: user.email,
                    isPublic: true,
                    preferences: signUpData.preferences,
                    friends: [],
                    age: age,
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
                    "Account Created Successfully",
                    "We've sent a verification email to your inbox. Please verify your email before signing in to complete your account setup.",
                    [
                        {
                            text: "Check Email",
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

            // Handle specific error cases
            if (error.message && error.message.includes("already exists")) {
                Alert.alert(
                    "Account Already Exists",
                    "An account with this email already exists. Would you like to sign in instead or try resetting your password?",
                    [
                        {
                            text: "Sign In",
                            onPress: () => router.replace("/SignIn")
                        },
                        {
                            text: "Cancel",
                            style: "cancel"
                        }
                    ]
                );
            } else {
                Alert.alert(
                    "Sign Up Failed",
                    error.message || "Could not create your account. Please try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <View style={styles.stepContent}>
            {/* Account Details Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialIcons name="person-add" size={24} color="#007AFF" />
                    <Text style={styles.cardTitle}>Account Details</Text>
                </View>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        placeholder="First Name"
                        value={signUpData.firstName}
                        onChangeText={(value) => updateSignUpData('firstName', value)}
                        style={styles.textInput}
                        autoCapitalize="words"
                        placeholderTextColor="#aaa"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Last Name"
                        value={signUpData.lastName}
                        onChangeText={(value) => updateSignUpData('lastName', value)}
                        style={styles.textInput}
                        autoCapitalize="words"
                        placeholderTextColor="#aaa"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Email"
                        value={signUpData.email}
                        onChangeText={(value) => updateSignUpData('email', value)}
                        style={styles.textInput}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholderTextColor="#aaa"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Password"
                        value={signUpData.password}
                        onChangeText={(value) => updateSignUpData('password', value)}
                        style={styles.textInput}
                        secureTextEntry
                        placeholderTextColor="#aaa"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Confirm Password"
                        value={signUpData.confirmPassword}
                        onChangeText={(value) => updateSignUpData('confirmPassword', value)}
                        style={styles.textInput}
                        secureTextEntry
                        placeholderTextColor="#aaa"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="cake" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Birth Year (e.g., 1995)"
                        value={signUpData.birthYear}
                        onChangeText={(value) => updateSignUpData('birthYear', value)}
                        style={styles.textInput}
                        keyboardType="numeric"
                        maxLength={4}
                        placeholderTextColor="#aaa"
                    />
                </View>
            </View>

            {/* Legal Agreements Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialIcons name="gavel" size={24} color="#007AFF" />
                    <Text style={styles.cardTitle}>Legal Agreements</Text>
                </View>

                <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                        onPress={() => updateSignUpData('agreeToTerms', !signUpData.agreeToTerms)}
                        style={styles.checkboxRow}
                    >
                        <MaterialIcons
                            name={signUpData.agreeToTerms ? "check-box" : "check-box-outline-blank"}
                            size={24}
                            color={signUpData.agreeToTerms ? "#007AFF" : "#666"}
                        />
                        <View style={styles.checkboxTextContainer}>
                            <Text style={styles.checkboxText}>I agree to the </Text>
                            <TouchableOpacity onPress={() => openLegalDocument('terms')}>
                                <Text style={styles.linkText}>Terms of Service</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                        onPress={() => updateSignUpData('agreeToPrivacy', !signUpData.agreeToPrivacy)}
                        style={styles.checkboxRow}
                    >
                        <MaterialIcons
                            name={signUpData.agreeToPrivacy ? "check-box" : "check-box-outline-blank"}
                            size={24}
                            color={signUpData.agreeToPrivacy ? "#007AFF" : "#666"}
                        />
                        <View style={styles.checkboxTextContainer}>
                            <Text style={styles.checkboxText}>I agree to the </Text>
                            <TouchableOpacity onPress={() => openLegalDocument('privacy')}>
                                <Text style={styles.linkText}>Privacy Policy</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    onPress={handleNext}
                    style={styles.nextButton}
                >
                    <Text style={styles.nextButtonText}>Next</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="white" />
                </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View style={styles.signInSection}>
                <Text style={styles.signInText}>Already have an account?</Text>
                <TouchableOpacity
                    onPress={() => router.replace('/SignIn')}
                    style={styles.signInButton}
                >
                    <MaterialIcons name="login" size={18} color="#007AFF" />
                    <Text style={styles.signInButtonText}>Sign In</Text>
                </TouchableOpacity>
            </View>
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
        <SafeAreaView style={styles.container}>
            {/* Modern Black Gradient Header */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#000000', '#1a1a1a', '#2d2d2d']}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            onPress={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back()}
                            style={styles.headerButton}
                        >
                            <MaterialIcons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Create Account</Text>
                        <View style={styles.headerSpacer} />
                    </View>
                </LinearGradient>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                {currentStep === 3 ? (
                    // Step 3 needs different layout for the FlatList
                    <View style={styles.stepContainer}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={images.logo}
                                style={styles.logoSmall}
                                resizeMode="contain"
                            />
                        </View>

                        {renderProgressIndicator()}
                        {renderStep3()}
                    </View>
                ) : (
                    // Steps 1 and 2 use ScrollView with proper spacing
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                    >
                        <View style={styles.logoContainer}>
                            <Image
                                source={images.logo}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>

                        {renderProgressIndicator()}

                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                    </ScrollView>
                )}
            </KeyboardAvoidingView>

            <LegalDocumentModal
                visible={legalModalVisible}
                onClose={() => setLegalModalVisible(false)}
                document={legalDocument}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerContainer: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    headerGradient: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    headerButton: {
        padding: 8,
        borderRadius: 8,
    },
    headerSpacer: {
        width: 40,
    },
    keyboardView: {
        flex: 1,
    },
    stepContainer: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logo: {
        width: 120,
        height: 120,
    },
    logoSmall: {
        width: 80,
        height: 80,
    },
    stepContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginLeft: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e1e5e9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 4,
        marginBottom: 16,
        backgroundColor: '#ffffff',
    },
    inputIcon: {
        marginRight: 12,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        paddingVertical: 12,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 16,
        marginTop: 8,
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
        marginRight: 8,
    },
    signInSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    signInText: {
        fontSize: 16,
        color: '#666',
        marginRight: 8,
    },
    signInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    signInButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
        marginLeft: 4,
    },
    checkboxContainer: {
        marginBottom: 16,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        flex: 1,
    },
    checkboxText: {
        fontSize: 16,
        color: '#333',
    },
    linkText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});

export default SignUp;
