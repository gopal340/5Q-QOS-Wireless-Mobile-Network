import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';
import { apiFetch } from '../utils/api';

export default function StressScreen() {
  const [target, setTarget] = useState('127.0.0.1');
  const [duration, setDuration] = useState('10');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const startIperf = async () => {
    setLoading(true); setMsg('');
    try {
      const r = await fetch('http://192.168.1.100:5000/start-iperf', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({target, port:5201, duration:parseInt(duration)})
      });
      const d = await r.json(); setMsg(d.message||'Started');
      setTimeout(async () => {
        try { setResult(await apiFetch('/iperf-result')); } catch(e){}
        setLoading(false);
      }, (parseInt(duration)+5)*1000);
    } catch(e:any) { setMsg('Error: '+e.message); setLoading(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView>
        <View style={s.header}><Text style={s.title}>Stress Test</Text></View>
        <View style={s.card}>
          <Text style={s.label}>Target IP</Text>
          <TextInput style={s.input} value={target} onChangeText={setTarget} placeholderTextColor="#666"/>
          <Text style={s.label}>Duration (sec)</Text>
          <TextInput style={s.input} value={duration} onChangeText={setDuration} placeholderTextColor="#666" keyboardType="numeric"/>
          <TouchableOpacity style={s.btn} onPress={startIperf} disabled={loading}>
            {loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnText}>Start iperf3</Text>}
          </TouchableOpacity>
        </View>
        {msg?<Text style={s.msg}>{msg}</Text>:null}
        {result && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Results</Text>
            {result.throughput_mbps!==undefined && <Text style={s.rv}>Throughput: {result.throughput_mbps.toFixed(2)} Mbps</Text>}
            {result.retransmits!==undefined && <Text style={s.rv}>Retransmits: {result.retransmits}</Text>}
            {result.error && <Text style={s.re}>Error: {result.error}</Text>}
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
  msg:{textAlign:'center',color:COLORS.warning,margin:12,fontSize:14},
  cardTitle:{fontSize:16,fontWeight:'bold',color:COLORS.text,marginBottom:8},
  rv:{fontSize:14,color:COLORS.text,marginVertical:3},
  re:{fontSize:14,color:COLORS.error,marginVertical:3},
});
