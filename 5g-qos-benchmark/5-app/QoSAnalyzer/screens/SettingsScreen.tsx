import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={s.container}>
      <ScrollView>
        <View style={s.header}><Text style={s.title}>Settings</Text></View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Gateway Config</Text>
          <Text style={s.text}>Edit GATEWAY_URL in utils/constants.ts to point to your server IP.</Text>
          <Text style={s.code}>GATEWAY_URL = 'http://YOUR_IP:5000'</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Architecture</Text>
          <Text style={s.text}>1-core: Open5GS 5G SA Core (default configs)</Text>
          <Text style={s.text}>2-gateway: Flask REST API</Text>
          <Text style={s.text}>3-stress: iperf3 + tc-netem profiles</Text>
          <Text style={s.text}>4-benchmark: Python benchmark suite</Text>
          <Text style={s.text}>5-app: This React Native Expo app</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Quick Start</Text>
          <Text style={s.step}>1. Run setup.sh on Ubuntu server</Text>
          <Text style={s.step}>2. Start gateway: python3 2-gateway/gateway.py</Text>
          <Text style={s.step}>3. Update GATEWAY_URL in this app</Text>
          <Text style={s.step}>4. Run benchmarks from Dashboard tab</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:COLORS.background},
  header:{padding:20,alignItems:'center'},
  title:{fontSize:24,fontWeight:'bold',color:COLORS.text},
  card:{margin:16,padding:16,borderRadius:12,backgroundColor:COLORS.surface},
  cardTitle:{fontSize:16,fontWeight:'bold',color:COLORS.text,marginBottom:8},
  text:{fontSize:14,color:COLORS.textSecondary,marginVertical:2},
  code:{backgroundColor:'#0d1b2a',borderRadius:8,padding:10,color:COLORS.accent,fontSize:13,marginTop:8,fontFamily:'monospace'},
  step:{fontSize:14,color:COLORS.textSecondary,marginVertical:3},
});
