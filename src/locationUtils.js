const CITY_DATABASE = [
  { names: ['madurai'], state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198, region: 'tamilnadu' },
  { names: ['chennai', 'madras', 'mylapore', 'adyar', 't nagar', 'anna nagar'], state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, region: 'tamilnadu' },
  { names: ['coimbatore', 'kovai'], state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558, region: 'tamilnadu' },
  { names: ['tiruchirappalli', 'trichy', 'tiruchi'], state: 'Tamil Nadu', lat: 10.7905, lng: 78.7047, region: 'tamilnadu' },
  { names: ['salem'], state: 'Tamil Nadu', lat: 11.6643, lng: 78.146, region: 'tamilnadu' },
  { names: ['tirunelveli', 'nellai'], state: 'Tamil Nadu', lat: 8.7139, lng: 77.7567, region: 'tamilnadu' },
  { names: ['erode'], state: 'Tamil Nadu', lat: 11.341, lng: 77.7172, region: 'tamilnadu' },
  { names: ['vellore'], state: 'Tamil Nadu', lat: 12.9165, lng: 79.1325, region: 'tamilnadu' },
  { names: ['thoothukudi', 'tuticorin'], state: 'Tamil Nadu', lat: 8.7642, lng: 78.1348, region: 'tamilnadu' },
  { names: ['dindigul'], state: 'Tamil Nadu', lat: 10.3673, lng: 77.9803, region: 'tamilnadu' },
  { names: ['thanjavur', 'tanjore'], state: 'Tamil Nadu', lat: 10.787, lng: 79.1378, region: 'tamilnadu' },
  { names: ['kanchipuram', 'kancheepuram'], state: 'Tamil Nadu', lat: 12.8342, lng: 79.7036, region: 'tamilnadu' },
  { names: ['nagercoil'], state: 'Tamil Nadu', lat: 8.1833, lng: 77.4119, region: 'tamilnadu' },
  { names: ['cuddalore'], state: 'Tamil Nadu', lat: 11.748, lng: 79.7714, region: 'tamilnadu' },
  { names: ['karur'], state: 'Tamil Nadu', lat: 10.9601, lng: 78.0766, region: 'tamilnadu' },
  { names: ['sivakasi'], state: 'Tamil Nadu', lat: 9.4539, lng: 77.7979, region: 'tamilnadu' },
  { names: ['hosur'], state: 'Tamil Nadu', lat: 12.7409, lng: 77.8253, region: 'tamilnadu' },
  { names: ['tiruppur'], state: 'Tamil Nadu', lat: 11.1085, lng: 77.3411, region: 'tamilnadu' },
  { names: ['namakkal'], state: 'Tamil Nadu', lat: 11.2189, lng: 78.1674, region: 'tamilnadu' },
  { names: ['ooty', 'udagamandalam'], state: 'Tamil Nadu', lat: 11.4064, lng: 76.6932, region: 'tamilnadu' },
  { names: ['sivaganga', 'karaikudi'], state: 'Tamil Nadu', lat: 9.8433, lng: 78.4809, region: 'tamilnadu' },
  { names: ['ramanathapuram', 'rameswaram'], state: 'Tamil Nadu', lat: 9.3639, lng: 78.8395, region: 'tamilnadu' },
  { names: ['theni'], state: 'Tamil Nadu', lat: 10.0104, lng: 77.4768, region: 'tamilnadu' },
  { names: ['pune', 'erandwane'], state: 'Maharashtra', lat: 18.5204, lng: 73.8567, region: 'india' },
  { names: ['mumbai', 'bombay'], state: 'Maharashtra', lat: 19.076, lng: 72.8777, region: 'india' },
  { names: ['bangalore', 'bengaluru'], state: 'Karnataka', lat: 12.9716, lng: 77.5946, region: 'india' },
  { names: ['hyderabad'], state: 'Telangana', lat: 17.385, lng: 78.4867, region: 'india' },
  { names: ['delhi', 'new delhi'], state: 'Delhi', lat: 28.6139, lng: 77.209, region: 'india' },
  { names: ['kolkata', 'calcutta'], state: 'West Bengal', lat: 22.5726, lng: 88.3639, region: 'india' },
  { names: ['ahmedabad'], state: 'Gujarat', lat: 23.0225, lng: 72.5714, region: 'india' },
  { names: ['jaipur'], state: 'Rajasthan', lat: 26.9124, lng: 75.7873, region: 'india' },
  { names: ['kochi', 'cochin', 'ernakulam'], state: 'Kerala', lat: 9.9312, lng: 76.2673, region: 'india' },
  { names: ['visakhapatnam', 'vizag'], state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185, region: 'india' },
  { names: ['lucknow'], state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, region: 'india' },
  { names: ['chandigarh'], state: 'Chandigarh', lat: 30.7333, lng: 76.7794, region: 'india' },
  { names: ['bhopal'], state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126, region: 'india' },
  { names: ['patna'], state: 'Bihar', lat: 25.5941, lng: 85.1376, region: 'india' },
  { names: ['guwahati'], state: 'Assam', lat: 26.1445, lng: 91.7362, region: 'india' },
];

const DEFAULT_LOCATION = {
  deliveryCity: 'Madurai',
  deliveryState: 'Tamil Nadu',
  latitude: 9.9252,
  longitude: 78.1198,
  region: 'tamilnadu',
};

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveLocationFromAddress(address) {
  const normalized = normalizeText(address);
  if (!normalized) return DEFAULT_LOCATION;

  let best = null;
  for (const entry of CITY_DATABASE) {
    for (const name of entry.names) {
      if (normalized.includes(name) && (!best || name.length > best.name.length)) {
        best = { entry, name };
      }
    }
  }

  if (!best) {
    if (normalized.includes('tamil nadu') || normalized.includes('tamilnadu') || /\btn\b/.test(normalized)) {
      return { ...DEFAULT_LOCATION, deliveryCity: 'Tamil Nadu', deliveryState: 'Tamil Nadu' };
    }
    return DEFAULT_LOCATION;
  }

  const cityLabel = best.name.charAt(0).toUpperCase() + best.name.slice(1);
  return {
    deliveryCity: cityLabel,
    deliveryState: best.entry.state,
    latitude: best.entry.lat,
    longitude: best.entry.lng,
    region: best.entry.region,
  };
}

export function jitterCoordinates(lat, lng, seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const angle = (hash % 360) * (Math.PI / 180);
  const distance = 0.04 + (Math.abs(hash) % 100) / 2500;
  return {
    latitude: lat + Math.cos(angle) * distance,
    longitude: lng + Math.sin(angle) * distance,
  };
}
