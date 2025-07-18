import { account } from "@/lib/appwrite/client";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

export default function Index() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await account.get();
                setIsAuthenticated(true);
            } catch (err) {
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

    // Show nothing while checking authentication
    if (isAuthenticated === null) {
        return null;
    }

    // Redirect based on authentication status
    if (isAuthenticated) {
        return <Redirect href="/(root)/(tabs)/Home" />;
    } else {
        return <Redirect href="/SignIn" />;
    }
}
