import { GATEWAY_URL } from './constants';

export async function apiFetch(path: string) {
  const res = await fetch(`${GATEWAY_URL}${path}`);
  return res.json();
}

export function getQoSColor(r: string) {
  switch(r) {
    case 'Excellent': return '#00e676';
    case 'Good': return '#66bb6a';
    case 'Fair': return '#ffab00';
    default: return '#ff1744';
  }
}
