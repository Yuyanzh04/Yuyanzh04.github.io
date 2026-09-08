import {getSeason} from './season.js';
import {createGarden as createLegacyGarden} from './legacy-scene.js';
import {createBeautyGarden} from './beauty-scene.js';

export async function createGarden(canvas, progress) {
  return getSeason().id === 'autumn'
    ? createBeautyGarden(canvas, progress)
    : createLegacyGarden(canvas, progress);
}
