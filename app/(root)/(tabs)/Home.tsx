// app/Home.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { useEvents } from '../context/EventContext';
import EventForm from '../components/EventForm';
import { Event as AppEvent } from '../types/Events';
import dayjs from 'dayjs';

const viewModes: Mode[] = ['day', 'week', 'month'];

export default function Home() {
	const { events } = useEvents();
	console.log('Events in Home:', events); // <-- Add this line
	const [formVisible, setFormVisible] = useState(false);
	const [selectedDateTime, setSelectedDateTime] = useState<string | null>(null);
	const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
	const [viewMode, setViewMode] = useState<Mode>('week');

  	const calendarEvents = events.map((e) => ({
    	title: e.title,
    	start: new Date(e.dateTime),
  		end: dayjs(e.dateTime).add(e.duration, 'minute').toDate(),
    	location: e.location,
    	rawEvent: e,
	}));

  	const handlePressCell = (date: Date) => {
    	setSelectedDateTime(date.toISOString());
    	setEditingEvent(null);
    	setFormVisible(true);
  	};

  	const handlePressEvent = (calendarEvent: any) => {
    	setEditingEvent(calendarEvent.rawEvent);
    	setSelectedDateTime(calendarEvent.rawEvent.dateTime);
    	setFormVisible(true);
  	};

  	return (
    	<View className="flex-1 p-2">
      	{/* View Mode Toggle */}
      	<View className="flex-row justify-center mb-2">
        	{viewModes.map((mode) => (
          		<TouchableOpacity
            	key={mode}
            	onPress={() => setViewMode(mode)}
            	className={`px-4 py-2 mx-1 rounded-xl ${viewMode === mode ? 'bg-blue-500' : 'bg-gray-300'}`}
          		>
            	<Text className={`${viewMode === mode ? 'text-white' : 'text-black'}`}>
              		{mode.charAt(0).toUpperCase() + mode.slice(1)}
            	</Text>
          	</TouchableOpacity>
        	))}
      	</View>

      	<BigCalendar
        	events={calendarEvents}
        	height={600}
        	mode={viewMode}
        	onPressCell={handlePressCell}
        	onPressEvent={handlePressEvent}
      	/>

{selectedDateTime && (
  <EventForm
    visible={formVisible}
    selectedDateTime={selectedDateTime}
    event={editingEvent || undefined}
    currentUserId="demo"
    onClose={() => {
      setFormVisible(false);
      setEditingEvent(null);
    }}
  />
)}
    </View>
  );
}
