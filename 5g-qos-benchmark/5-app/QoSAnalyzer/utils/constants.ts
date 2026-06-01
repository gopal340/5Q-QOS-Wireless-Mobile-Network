export const GATEWAY_URL = 'http://192.168.1.100:5000'; // CHANGE to your server IP

export const COLORS = {
  primary:'#0f3460', secondary:'#16213e', accent:'#e94560',
  background:'#1a1a2e', surface:'#16213e', text:'#eee',
  textSecondary:'#aaa', success:'#00e676', warning:'#ffab00', error:'#ff1744',
};

export const FIVE_QI = [
  {qfi:1,  name:'Conversational Voice',      latency:'100ms', loss:'1e-2'},
  {qfi:2,  name:'Conversational Video',       latency:'150ms', loss:'1e-3'},
  {qfi:5,  name:'IMS Signalling',             latency:'100ms', loss:'1e-6'},
  {qfi:6,  name:'Video (Buffered Streaming)',  latency:'300ms', loss:'1e-6'},
  {qfi:7,  name:'Voice (Buffered Streaming)',  latency:'100ms', loss:'1e-3'},
  {qfi:65, name:'Mission Critical Voice',      latency:'75ms',  loss:'1e-2'},
  {qfi:66, name:'Mission Critical Video',      latency:'100ms', loss:'1e-3'},
  {qfi:75, name:'V2X Messages',                latency:'5ms',   loss:'1e-6'},
  {qfi:84, name:'Remote Control',              latency:'30ms',  loss:'1e-5'},
  {qfi:112,name:'Low Latency AR',              latency:'10ms',  loss:'1e-6'},
];
