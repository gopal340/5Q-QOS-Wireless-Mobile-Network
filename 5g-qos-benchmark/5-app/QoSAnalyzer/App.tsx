import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import DashboardScreen from './screens/DashboardScreen';
import PingScreen from './screens/PingScreen';
import CoreScreen from './screens/CoreScreen';
import StressScreen from './screens/StressScreen';
import SettingsScreen from './screens/SettingsScreen';
import { COLORS } from './utils/constants';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer theme={{
      dark:true, colors:{
        primary:COLORS.accent, background:COLORS.background, card:COLORS.surface,
        text:COLORS.text, border:'#333', notification:COLORS.accent
      }, fonts:{regular:{fontFamily:''},medium:{fontFamily:''},bold:{fontFamily:''},heavy:{fontFamily:''}}
    }}>
      <Tab.Navigator screenOptions={({route})=>({
        tabBarIcon:({focused})=><Text style={{fontSize:focused?22:18}}>
          {{Dashboard:'📊',Ping:'📡',Core:'🏢',Stress:'🔥',Settings:'⚙️'}[route.name]||'📱'}</Text>,
        tabBarActiveTintColor:COLORS.accent, tabBarInactiveTintColor:COLORS.textSecondary,
        tabBarStyle:{backgroundColor:COLORS.surface,borderTopColor:'#333'},
        headerStyle:{backgroundColor:COLORS.surface}, headerTintColor:COLORS.text,
      })}>
        <Tab.Screen name="Dashboard" component={DashboardScreen}/>
        <Tab.Screen name="Ping" component={PingScreen}/>
        <Tab.Screen name="Core" component={CoreScreen}/>
        <Tab.Screen name="Stress" component={StressScreen}/>
        <Tab.Screen name="Settings" component={SettingsScreen}/>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
