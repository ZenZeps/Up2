import { Redirect } from "expo-router";

export default function Index() {
    // Redirect to the root layout which mounts providers (GlobalProvider, ThemeProvider, etc.)
    return <Redirect href="/(root)/(tabs)/Home" />;
}
