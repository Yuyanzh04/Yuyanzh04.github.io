export const BUILDINGS = [
  {id:'research', name:'重华阁', label:'Research', href:'research.html', position:[2,0,-7], focus:[2,6,-7]},
  {id:'writing', name:'藏书楼', label:'Writing', href:'writing.html', position:[-10,0,-2], focus:[-10,4,-2]},
  {id:'about', name:'临水榭', label:'About', href:'about.html', position:[-6,0,8], focus:[-6,2.7,8]},
  {id:'projects', name:'知行轩', label:'Projects', href:'projects.html', position:[11,0,1], focus:[11,3,1]},
];
export const QUALITY = {
  high: {dpr:1.6, leaves:1450, particles:34, shadows:true, reflection:512},
  low: {dpr:1.15, leaves:650, particles:16, shadows:false, reflection:256},
};
export function qualityLevel() {
  return innerWidth < 700 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ? 'low' : 'high';
}
