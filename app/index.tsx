import { Redirect } from "expo-router";
import { memo } from "react";

// Memoized redirect component for better performance
const Index = memo(() => {
    // Redirect to the root layout which mounts providers (GlobalProvider, ThemeProvider, etc.)
    return <Redirect href="/(root)/(tabs)/Home" />;
});

Index.displayName = 'Index';

export default Index;
