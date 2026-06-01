import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FIVE_QI } from '../utils/constants';
import { apiFetch } from '../utils/api';

export default function CoreScreen() {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => { (async () => { try { setStatus(await apiFetch('/status')); } catch(e){} })(); }, []);

  const svcs = status?.core_services || {};
  const running = Object.values(svcs).filter(Boolean).length;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView>
        <View style={s.header}><Text style={s.title}>5G Core Status</Text></View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Network Functions ({running}/{Object.keys(svcs).length})</Text>
          {Object.entries(svcs).map(([k,v]:[string,any]) => (
            <View key={k} style={s.row}>
              <View style={[s.dot,{backgroundColor:v?COLORS.success:COLORS.error}]}/>
              <Text style={s.name}>{k.replace('open5gs-','').replace('d','').toUpperCase()}</Text>
              <Text style={[s.st,{color:v?COLORS.success:COLORS.error}]}>{v?'UP':'DOWN'}</Text>
            </View>
          ))}
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>5QI Reference</Text>
          <View style={s.th}>
            <Text style={[s.tc,{flex:0.5,fontWeight:'bold'}]}>5QI</Text>
            <Text style={[s.tc,{flex:2,fontWeight:'bold'}]}>Name</Text>
            <Text style={[s.tc,{flex:0.8,fontWeight:'bold'}]}>Latency</Text>
          </View>
          {FIVE_QI.map(r => (
            <View key={r.qfi} style={s.tr}>
              <Text style={[s.tc,{flex:0.5}]}>{r.qfi}</Text>
              <Text style={[s.tc,{flex:2}]}>{r.name}</Text>
              <Text style={[s.tc,{flex:0.8}]}>{r.latency}</Text>
            </View>
          ))}
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
  cardTitle:{fontSize:16,fontWeight:'bold',color:COLORS.text,marginBottom:12},
  row:{flexDirection:'row',alignItems:'center',paddingVertical:5},
  dot:{width:10,height:10,borderRadius:5,marginRight:10},
  name:{flex:1,fontSize:14,color:COLORS.text},
  st:{fontSize:12,fontWeight:'bold'},
  th:{flexDirection:'row',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#333'},
  tr:{flexDirection:'row',paddingVertical:5},
  tc:{fontSize:12,color:COLORS.textSecondary},
});
