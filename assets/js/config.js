export const BUILDINGS = [
  {id:'research', name:'研究', label:'RESEARCH', href:'research.html', position:[3,0,-5.5], focus:[3,5,-5.5]},
  {id:'writing', name:'文章', label:'WRITING', href:'writing.html', position:[-7,0,-2.5], focus:[-7,3.5,-2.5]},
  {id:'about', name:'关于', label:'ABOUT', href:'about.html', position:[-6,0,7], focus:[-6,2.7,7]},
  {id:'projects', name:'项目', label:'PROJECTS', href:'projects.html', position:[9,0,2], focus:[9,2.5,2]},
];
export const QUALITY = {
  high: {dpr:1.6, leaves:3200, particles:10, shadows:true, reflection:1024},
  low: {dpr:1.5, leaves:2200, particles:5, shadows:true, reflection:256},
};
export function qualityLevel() {
  return innerWidth < 700 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ? 'low' : 'high';
}
