#!/bin/bash
# Fix EventForm.tsx to use cascade deletion

cd /home/zen/Up2

# Create backup
cp "app/(root)/components/forms/EventForm.tsx" "app/(root)/components/forms/EventForm.tsx.backup"

# Replace the first occurrence (around line 856-862)
sed -i '856,862c\
                              // 🚀 Use cascade deletion to remove event and ALL related data\
                              const { deleteEvent } = await import("@/lib/api/event");\
                              await deleteEvent(event.$id);' "app/(root)/components/forms/EventForm.tsx"

# Replace the second occurrence (around line 1392-1398) - adjust line numbers after first replacement
sed -i '1386,1392c\
                              // 🚀 Use cascade deletion to remove event and ALL related data\
                              const { deleteEvent } = await import("@/lib/api/event");\
                              await deleteEvent(event.$id);' "app/(root)/components/forms/EventForm.tsx"

echo "✅ Fixed EventForm.tsx to use cascade deletion!"
echo "📁 Backup saved as EventForm.tsx.backup"