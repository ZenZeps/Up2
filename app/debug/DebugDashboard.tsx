import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { dbUsageMonitor } from '@/lib/debug/dbUsageMonitor';
import { cacheManager } from '@/lib/debug/cacheManager';
import { Link } from 'expo-router';

/**
 * A debug component to monitor database usage and cache performance
 * Only use this in development builds
 */
export default function DebugDashboard() {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState({
    reads: 0,
    writes: 0,
    readPercentage: 0,
    cacheHitRate: 0,
    cacheSize: 0
  });
  
  // Update stats periodically
  useEffect(() => {
    if (!visible) return;
    
    const updateStats = () => {
      const dbStats = dbUsageMonitor.getUsageStats();
      const cacheStats = cacheManager.getStats();
      
      setStats({
        reads: dbStats.reads,
        writes: dbStats.writes,
        readPercentage: dbStats.readPercentage,
        cacheHitRate: cacheStats.hitRate,
        cacheSize: cacheStats.size
      });
    };
    
    // Update immediately
    updateStats();
    
    // Then update periodically
    const intervalId = setInterval(updateStats, 1000);
    
    return () => clearInterval(intervalId);
  }, [visible]);
  
  if (!visible) {
    // Just show a small indicator button
    return (
      <TouchableOpacity 
        style={styles.indicatorButton}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.indicatorText}>DB: {stats.reads}</Text>
      </TouchableOpacity>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Database Usage Monitor</Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setVisible(false)}
          >
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Database Operations</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Read Operations:</Text>
            <Text style={styles.statValue}>{stats.reads}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Write Operations:</Text>
            <Text style={styles.statValue}>{stats.writes}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Daily Usage:</Text>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${stats.readPercentage}%` },
                  stats.readPercentage > 90 ? styles.dangerBar : 
                  stats.readPercentage > 70 ? styles.warningBar : 
                  styles.normalBar
                ]} 
              />
              <Text style={styles.progressText}>
                {stats.readPercentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Cache Performance</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Cache Size:</Text>
            <Text style={styles.statValue}>{stats.cacheSize} items</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Hit Rate:</Text>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${stats.cacheHitRate}%` },
                  styles.normalBar
                ]} 
              />
              <Text style={styles.progressText}>
                {stats.cacheHitRate.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => dbUsageMonitor.resetCounters()}
          >
            <Text style={styles.buttonText}>Reset Counters</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => cacheManager.clear()}
          >
            <Text style={styles.buttonText}>Clear Cache</Text>
          </TouchableOpacity>
        </View>
        
        <Link href="/(root)/Debug" asChild>
          <TouchableOpacity style={styles.debugPageButton}>
            <Text style={styles.buttonText}>Open Debug Page</Text>
          </TouchableOpacity>
        </Link>
        
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Optimization Tips:</Text>
          <Text style={styles.tip}>• Use caching for frequently accessed data</Text>
          <Text style={styles.tip}>• Batch related database queries</Text>
          <Text style={styles.tip}>• Avoid duplicated API calls</Text>
          <Text style={styles.tip}>• Only fetch data you need</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    height: 300,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 15,
    zIndex: 9999,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  statValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    flex: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 10,
  },
  normalBar: {
    backgroundColor: '#4CAF50',
  },
  warningBar: {
    backgroundColor: '#FFC107',
  },
  dangerBar: {
    backgroundColor: '#F44336',
  },
  progressText: {
    color: 'white',
    fontSize: 12,
    position: 'absolute',
    right: 10,
    top: 2,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  actionButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  tips: {
    marginTop: 10,
  },
  tipsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  tip: {
    color: '#ccc',
    marginBottom: 3,
  },
  indicatorButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    zIndex: 9999,
  },
  indicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugPageButton: {
    backgroundColor: '#8e44ad',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
});
