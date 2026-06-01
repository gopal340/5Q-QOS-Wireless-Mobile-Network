import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, GATEWAY_URL } from '../utils/constants';
import { apiFetch } from '../utils/api';

export default function PingScreen() {
  const [target, setTarget] = useState('8.8.8.8');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    setLoading(true);
    try { const d = await apiFetch(`/ping?target=${target}&count=10`); setResult(d.ping); } catch(e:any){}
    setLoading(false);
  };
  return (
    <SafeAreaView style={s.container}>
      <ScrollView>
        <View style={s.header}><Text style={s.title}>Ping Test</Text></View>
        <View style={s.card}>
          <Text style={s.label}>Target</Text>
          <TextInput style={s.input} value={target} onChangeText={setTarget} placeholderTextColor="#666"/>
          <TouchableOpacity style={s.btn} onPress={run} disabled={loading}>
            <Text style={s.btnText}>{loading?'Running...':'Run Ping'}</Text>
          </TouchableOpacity>
        </View>
        {result && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Results</Text>
            {[['Target','target'],['Avg','latency_avg_ms'],['Min','latency_min_ms'],['Max','latency_max_ms'],['Jitter','jitter_ms'],['Loss','packet_loss_pct']].map(([label,key])=>(
              <View key={key} style={s.row}>
                <Text style={s.k}>{label}</Text>
                <Text style={s.v}>{result[key]!==undefined?(key==='packet_loss_pct'?`${result[key]}%`:`${result[key].toFixed(2)} ms`):'N/A'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:COLORS.background},
  header:{padding:20,alignItems:'center'},
  title:{fontSize:24,fontWeight:'bold',color:COLORS.text},
  card:{margin:16,padding:16,borderRadius:12,backgroundColor:COLORS.surface},
  label:{fontSize:14,color:COLORS.textSecondary,marginBottom:4,marginTop:8},
  input:{backgroundColor:'#0d1b2a',borderRadius:8,padding:12,color:COLORS.text,fontSize:16,marginBottom:8},
  btn:{backgroundColor:COLORS.accent,borderRadius:10,padding:14,alignItems:'center',marginTop:12},
  btnText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  cardTitle:{fontSize:16,fontWeight:'bold',color:COLORS.text,marginBottom:12},
  row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:4},
  k:{fontSize:14,color:COLORS.textSecondary},
  v:{fontSize:14,color:COLORS.text,fontWeight:'600'},
});
