export const SEASON_CONFIG = {
 spring: {name:'春', sky:0xe5e6dd, fog:0xe5e6dd, ground:0x728d7b, grass:0x719b83, leaves:[0xb9c795,0x81995d,0xe6cfc3,0xefe3d7], sun:0xffedcf, ambient:0xd8e5e5, water:0x657d76, density:0.8, particle:'petal', snow:false},
 summer: {name:'夏', sky:0xd5e1df, fog:0xd5e1df, ground:0x607e6d, grass:0x5b856f, leaves:[0x43624a,0x597547,0x718d53,0x87995d], sun:0xfff0d5, ambient:0xd1e3e7, water:0x4c7976, density:1.15, particle:null, snow:false},
 autumn: {name:'秋', sky:0xd6dedb, fog:0xd9d8c9, ground:0x8f9880, grass:0x4c665a, leaves:[0x74473b,0x9f5140,0xb66b48,0xb19854,0x52684d], sun:0xffead0, ambient:0xbfd0df, water:0x8aa9ad, density:1, particle:'leaf', snow:false},
 winter: {name:'冬', sky:0xdce1e5, fog:0xdce1e5, ground:0x9c9f99, grass:0xa3a69b, leaves:[0x766a5e], sun:0xeaf1fb, ambient:0xc9d7e7, water:0x8c9fA6, density:0, particle:'snow', snow:true},
};
export function seasonForMonth(month) {
  return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
}
export function getSeason() {
 const override = new URLSearchParams(location.search).get('season');
 const id = Object.hasOwn(SEASON_CONFIG, override) ? override : seasonForMonth(new Date().getMonth()+1);
 return {id, ...SEASON_CONFIG[id]};
}
