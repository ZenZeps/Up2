import { useGlobalContext } from "@/lib/global-provider";
import { Redirect } from "expo-router";

export default function Index() {
    const { isLoggedIn, user, loading } = useGlobalContext();

    // Show nothing while checking authentication
    if (loading) {
        return null;
    }

    // Handle authentication and profile completion flow
    if (isLoggedIn && user) {
        // Check if user has completed their profile
        if (!user.profile) {
            // User is verified but hasn't completed profile - redirect to SignUp to complete it
            return <Redirect href="/SignUp" />;
        }
        // User is verified and has completed profile - go to main app
        return <Redirect href="/(root)/(tabs)/Home" />;
    } else {
        // User is not authenticated or not verified - go to sign in
        return <Redirect href="/SignIn" />;
    }
}
