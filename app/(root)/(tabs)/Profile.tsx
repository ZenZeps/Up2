import React, { useState } from 'react';
import { Text, View, Image, TextInput, FlatList, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import RNPickerSelect from 'react-native-picker-select';
import icons from '@/constants/icons';
import images from '@/constants/images';

const eventTypeOptions = [
  { label: 'Sports', value: 'sports' },
  { label: 'Party', value: 'party' },
  { label: 'Study', value: 'study' },
  { label: 'Family', value: 'family' },
];

const mockFriends = ['Alice', 'Bob', 'Charlie', 'Diana'];

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('John Doe');
  const [isPrivate, setIsPrivate] = useState(false);
  const [eventType, setEventType] = useState('sports');

  const toggleEditing = () => setIsEditing(!isEditing);

  return (
    <SafeAreaView className="bg-white h-full">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-32 px-7">
        <View className="flex flex-row items-center justify-between mt-5">
          <Text className="text-xl font-rubik-semibold">Profile</Text>
          <TouchableOpacity onPress={toggleEditing}>
            <Text className="text-blue-500">{isEditing ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View className="flex flex-row justify-center mt-5">
          <View className="items-center mt-5">
            <Image source={images.avatar} className="size-44 rounded-full" />
          </View>
        </View>

        {/* Name */}
        <View className="mt-5">
          <Text className="text-lg font-semibold mb-1">Name</Text>
          {isEditing ? (
            <TextInput
              className="border border-gray-300 p-2 rounded"
              value={name}
              onChangeText={setName}
            />
          ) : (
            <Text>{name}</Text>
          )}
        </View>

        {/* Privacy Toggle */}
        <View className="mt-5 flex flex-row items-center justify-between">
          <Text className="text-lg font-semibold">Profile Privacy</Text>
          <View className="flex-row items-center space-x-2">
            <Text>{isPrivate ? 'Private' : 'Public'}</Text>
            <Switch value={isPrivate} onValueChange={setIsPrivate} />
          </View>
        </View>

        {/* Event Type Dropdown */}
        <View className="mt-5">
          <Text className="text-lg font-semibold mb-1">Event Interests</Text>
          {isEditing ? (
            <RNPickerSelect
              value={eventType}
              onValueChange={setEventType}
              items={eventTypeOptions}
              style={{
                inputIOS: { paddingVertical: 12, paddingHorizontal: 10, borderColor: 'gray', borderWidth: 1, borderRadius: 5 },
                inputAndroid: { color: 'black' },
              }}
            />
          ) : (
            <Text>{eventTypeOptions.find(e => e.value === eventType)?.label}</Text>
          )}
        </View>

        {/* Friends List */}
        <View className="mt-7">
          <Text className="text-lg font-semibold mb-2">Friends</Text>
          <FlatList
            data={mockFriends}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <View className="py-2 border-b border-gray-200">
                <Text>{item}</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
