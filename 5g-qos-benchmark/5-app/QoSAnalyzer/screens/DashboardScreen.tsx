import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, GATEWAY_URL } from '../utils/constants';
import { apiFetch, getQoSColor } from '../utils/api';

export default function DashboardScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await apiFetch('/benchmark')); } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { run(); }, []);

  const ping = data?.ping || {};
  const rating = data?.qos_rating || 'N/A';

  return (
    <SafeAreaView style={s.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={run} tintColor={COLORS.accent}/>}>
        <View style={s.header}><Text style={s.title}>5G QoS Analyzer</Text></View>

        <View style={[s.card, {borderColor:getQoSColor(rating)}]}>
          <Text style={s.label}>QoS Rating</Text>
          <Text style={[s.big, {color:getQoSColor(rating)}]}>{rating}</Text>
          <Text style={s.sub}>{data?.qos_class || ''}</Text>
        </View>

        <View style={s.grid}>
          <View style={s.cell}>
            <Text style={s.label}>Avg Latency</Text>
            <Text style={s.val}>{ping.latency_avg_ms?.toFixed(1) || '?'} ms</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.label}>Jitter</Text>
            <Text style={s.val}>{ping.jitter_ms?.toFixed(1) || '?'} ms</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.label}>Packet Loss</Text>
            <Text style={s.val}>{ping.packet_loss_pct !== undefined ? `${ping.packet_loss_pct}%` : '?'}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.label}>Throughput</Text>
            <Text style={s.val}>{data?.throughput_mbps?.toFixed(2) || '?'} Mbps</Text>
          </View>
        </View>

        {ping.latency_min_ms !== undefined && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Details</Text>
            <View style={s.row}><Text style={s.k}>Min</Text><Text style={s.v}>{ping.latency_min_ms.toFixed(2)} ms</Text></View>
            <View style={s.row}><Text style={s.k}>Max</Text><Text style={s.v}>{ping.latency_max_ms.toFixed(2)} ms</Text></View>
            <View style={s.row}><Text style={s.k}>Target</Text><Text style={s.v}>{ping.target}</Text></View>
          </View>
        )}

        {error ? <View style={s.errCard}><Text style={s.errText}>Error: {error}</Text><Text style={s.errHint}>Check GATEWAY_URL in constants.ts</Text></View> : null}

        <TouchableOpacity style={s.btn} onPress={run} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> : <Text style={s.btnText}>Run Benchmark</Text>}
        </TouchableOpacity>
        {data?.timestamp && <Text style={s.ts}>Last: {data.timestamp}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:COLORS.background},
  header:{padding:20,alignItems:'center'},
  title:{fontSize:24,fontWeight:'bold',color:COLORS.text},
  card:{margin:16,padding:16,borderRadius:12,backgroundColor:COLORS.surface,borderWidth:1,borderColor:'#333',alignItems:'center'},
  label:{fontSize:12,color:COLORS.textSecondary,marginBottom:4},
  big:{fontSize:36,fontWeight:'bold'},
  sub:{fontSize:12,color:COLORS.textSecondary,marginTop:4},
  grid:{flexDirection:'row',flexWrap:'wrap',padding:8},
  cell:{width:'47%',margin:'1.5%',padding:14,borderRadius:10,backgroundColor:COLORS.surface,alignItems:'center'},
  val:{fontSize:18,fontWeight:'bold',color:COLORS.text},
  cardTitle:{fontSize:16,fontWeight:'bold',color:COLORS.text,marginBottom:8,alignSelf:'flex-start'},
  row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:3,width:'100%'},
  k:{fontSize:14,color:COLORS.textSecondary},
  v:{fontSize:14,color:COLORS.text,fontWeight:'600'},
  errCard:{margin:16,padding:16,borderRadius:12,backgroundColor:'#2a0a0a',borderColor:COLORS.error,borderWidth:1},
  errText:{color:COLORS.error,fontSize:14},
  errHint:{color:COLORS.textSecondary,fontSize:12,marginTop:4},
  btn:{margin:20,padding:16,borderRadius:12,backgroundColor:COLORS.accent,alignItems:'center'},
  btnText:{color:'#fff',fontSize:18,fontWeight:'bold'},
  ts:{textAlign:'center',color:COLORS.textSecondary,fontSize:12,marginBottom:40},
});
