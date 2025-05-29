import icons from '@/constants/icons';
import images from '@/constants/images';
import React from 'react'
import { Text, View, Image } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

const Profile = () => {
  const handleLogout = async () => {};

  return (
    <SafeAreaView className="bg-white h-full">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-32 px-7">
        <View className = "flex flex-row items-center justify-between mt-5">
          <Text className='text-xl font-rubik-semibold'>Profile</Text>
          <Image source= {icons.bell} className='size-5'/>
        </View>
        <View className = "flex flex-row justify-center mt-5">
          <View className="flex flex-col items-center relative mt-5">
            <Image source = {images.avatar} className = "size-44 relative rounded-full"/>

          </View>
        </View>
      </ScrollView>
     
    </SafeAreaView>
  )
}

export default Profile