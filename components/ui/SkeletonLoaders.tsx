import { useTheme } from '@/lib/context/ThemeContext';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: any;
}

// Base skeleton component with shimmer effect
export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 16,
    borderRadius = 4,
    style
}) => {
    const { colors } = useTheme();

    return (
        <View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: colors.border,
                    opacity: 0.3,
                },
                style
            ]}
        />
    );
};

// Skeleton for event cards in feed
export const SkeletonEventCard: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Event Image */}
            <Skeleton width="100%" height={200} borderRadius={12} style={{ marginBottom: 12 }} />

            {/* Event Title */}
            <Skeleton width="80%" height={20} style={{ marginBottom: 8 }} />

            {/* Event Subtitle */}
            <Skeleton width="60%" height={16} style={{ marginBottom: 12 }} />

            {/* Meta info row */}
            <View style={styles.metaRow}>
                <Skeleton width={16} height={16} borderRadius={8} />
                <Skeleton width={80} height={14} style={{ marginLeft: 8 }} />
                <Skeleton width={16} height={16} borderRadius={8} style={{ marginLeft: 16 }} />
                <Skeleton width={60} height={14} style={{ marginLeft: 8 }} />
            </View>

            {/* Creator row */}
            <View style={styles.creatorRow}>
                <Skeleton width={32} height={32} borderRadius={16} />
                <Skeleton width={100} height={16} style={{ marginLeft: 12 }} />
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
                <Skeleton width={80} height={32} borderRadius={16} />
                <Skeleton width={80} height={32} borderRadius={16} style={{ marginLeft: 12 }} />
            </View>
        </View>
    );
};

// Skeleton for agenda items in Home
export const SkeletonAgendaItem: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.agendaItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Thumbnail */}
            <Skeleton width={60} height={60} borderRadius={8} />

            <View style={styles.agendaContent}>
                {/* Title */}
                <Skeleton width="70%" height={18} style={{ marginBottom: 6 }} />

                {/* Meta info */}
                <View style={styles.agendaMeta}>
                    <Skeleton width={12} height={12} borderRadius={6} />
                    <Skeleton width={80} height={14} style={{ marginLeft: 6 }} />
                </View>

                {/* Creator info */}
                <View style={styles.agendaCreator}>
                    <Skeleton width={24} height={24} borderRadius={12} />
                    <Skeleton width={60} height={14} style={{ marginLeft: 8 }} />
                </View>
            </View>
        </View>
    );
};

// Skeleton for top picks
export const SkeletonTopPick: React.FC = () => {
    return (
        <View style={styles.topPick}>
            <Skeleton width={60} height={60} borderRadius={30} style={{ marginBottom: 8 }} />
            <Skeleton width={50} height={12} />
        </View>
    );
};

// Skeleton for travel announcements
export const SkeletonTravelCard: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.travelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header with avatar and name */}
            <View style={styles.travelHeader}>
                <Skeleton width={40} height={40} borderRadius={20} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                    <Skeleton width="40%" height={16} style={{ marginBottom: 4 }} />
                    <Skeleton width="60%" height={14} />
                </View>
            </View>

            {/* Travel content */}
            <View style={styles.travelContent}>
                <Skeleton width="80%" height={18} style={{ marginBottom: 8 }} />
                <Skeleton width="90%" height={16} style={{ marginBottom: 12 }} />

                {/* Dates */}
                <View style={styles.travelMeta}>
                    <Skeleton width={16} height={16} borderRadius={8} />
                    <Skeleton width={120} height={14} style={{ marginLeft: 8 }} />
                </View>
            </View>
        </View>
    );
};

// Feed skeleton loader with multiple items
export const FeedSkeletonLoader: React.FC<{ itemCount?: number }> = ({ itemCount = 3 }) => {
    return (
        <View style={styles.container}>
            {/* Top Picks Skeleton */}
            <View style={styles.topPicksContainer}>
                <Skeleton width={120} height={20} style={{ marginBottom: 16, marginLeft: 16 }} />
                <View style={styles.topPicksList}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <SkeletonTopPick key={`top-pick-${index}`} />
                    ))}
                </View>
            </View>

            {/* Feed Items Skeleton */}
            {Array.from({ length: itemCount }).map((_, index) => (
                <SkeletonEventCard key={`event-${index}`} />
            ))}
        </View>
    );
};

// Home skeleton loader
export const HomeSkeletonLoader: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={styles.container}>
            {/* Tab selector skeleton */}
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                <Skeleton width={80} height={32} borderRadius={16} />
                <Skeleton width={80} height={32} borderRadius={16} style={{ marginLeft: 16 }} />
            </View>

            {/* Calendar skeleton */}
            <View style={styles.calendarSkeleton}>
                <Skeleton width="100%" height={300} borderRadius={8} />
            </View>

            {/* Agenda items skeleton */}
            <View style={styles.agendaContainer}>
                {Array.from({ length: 5 }).map((_, index) => (
                    <SkeletonAgendaItem key={`agenda-${index}`} />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    eventCard: {
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    creatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 8,
    },
    agendaItem: {
        flexDirection: 'row',
        padding: 12,
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    agendaContent: {
        marginLeft: 12,
        flex: 1,
    },
    agendaMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    agendaCreator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topPick: {
        alignItems: 'center',
        marginHorizontal: 8,
        width: 70,
    },
    topPicksContainer: {
        marginBottom: 16,
    },
    topPicksList: {
        flexDirection: 'row',
        paddingHorizontal: 8,
    },
    travelCard: {
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    travelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    travelContent: {
        marginTop: 8,
    },
    travelMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    calendarSkeleton: {
        margin: 16,
    },
    agendaContainer: {
        flex: 1,
    },
});