// app/(tabs)/Explore.tsx
import { useEffect, useState } from 'react';
import { TextInput, View, Text, TouchableOpacity, ScrollView } from 'react-native';
//import { getAllUsers } from '@/lib/api';

const Explore = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [query, setQuery] = useState('');

  /*8useEffect(() => {
    const fetchUsers = async () => {
      const res = await getAllUsers();
      setUsers(res);
    };
    fetchUsers();
  }, []); */

  const filtered = users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <ScrollView className="p-4">
      <TextInput
        placeholder="Search users..."
        value={query}
        onChangeText={setQuery}
        className="border p-2 mb-4"
      />
      {filtered.map(user => (
        <TouchableOpacity key={user.id} className="p-2 border-b border-gray-300">
          <Text>{user.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

export default Explore;
