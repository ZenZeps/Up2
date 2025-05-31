import images from '@/constants/images';
import icons from '@/constants/icons';
import React from "react";
import { Image, ScrollView, Text, TouchableOpacity, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { login } from '@/lib/appwrite';

const SignIn = () => {
  const handleLogin = async() => {
    const result = await login();
    if(result) {
      console.log('Login Successful');
    } else {
      Alert.alert('Error', 'Failed to Login');
    }
  };
  return (
    <SafeAreaView className ="bg-white h-full">
      <ScrollView contentContainerClassName="h-full">
        <Image source = {images.onboarding} className ="w-full h-4/6" resizeMode = "contain"/>
        <View className ="px-10">
          <Text className ="text-base text-centre uppercase font-rubik text-black-200">Welcome to Up2</Text>
          <Text className ="text-3xl font-rubik-semibold text-black-300 text-center mt-2">Make Meeting Up {"\n"}
            <Text className= "text-primary-300">EASY</Text>
          </Text>
          <Text className ="text-leg font-rubik text-black-200 text-center mt-12">
            Login to Up2 with Google
          </Text>
          <TouchableOpacity onPress={handleLogin} className = "bg-white shadow-md shadow-zinc-300 rounded-full w-full py-4 mt-5">
            <View className ="flex flex-row items-center justify-center">
              <Image source ={icons.google} className ="w-5 h-5" resizeMode ="contain"/>
              <Text className = "text-lg font-rubik-medium text-black-300 ml-2"> Continue With Google</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
