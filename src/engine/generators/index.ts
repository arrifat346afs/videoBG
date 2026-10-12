import type { Generator } from '../types.ts';
import { registerGenerator } from '../registry.ts';

// One file per generator; one line below per generator.
import { domainWarp } from './domainWarp.ts';
import { gradientMesh } from './gradientMesh.ts';
import { aurora } from './aurora.ts';
import { flowField } from './flowField.ts';
import { metaballs } from './metaballs.ts';
import { voronoi } from './voronoi.ts';
import { plasma } from './plasma.ts';
import { kaleidoscope } from './kaleidoscope.ts';
import { truchet } from './truchet.ts';
import { topographic } from './topographic.ts';
import { julia } from './julia.ts';
import { particles } from './particles.ts';
import { halftone } from './halftone.ts';
import { raymarched } from './raymarched.ts';
import { reactionDiffusion } from './reactionDiffusion.ts';
import { godrays } from './godrays.ts';
import { waveMesh } from '../scene3d/waveMesh.ts';
import { dotWave } from '../scene3d/dotWave.ts';
import { hexWave } from '../scene3d/hexWave.ts';
import { triWave } from '../scene3d/triWave.ts';
import { plexus3d } from '../scene3d/plexus3d.ts';
import { dataFlow } from '../scene3d/dataFlow.ts';

registerGenerator(domainWarp);
registerGenerator(gradientMesh);
registerGenerator(aurora);
registerGenerator(flowField);
registerGenerator(metaballs);
registerGenerator(voronoi);
registerGenerator(plasma);
registerGenerator(kaleidoscope);
registerGenerator(truchet);
registerGenerator(topographic);
registerGenerator(julia);
registerGenerator(particles);
registerGenerator(halftone);
registerGenerator(raymarched);
registerGenerator(reactionDiffusion);
registerGenerator(godrays);
registerGenerator(waveMesh);
registerGenerator(dotWave);
registerGenerator(hexWave);
registerGenerator(triWave);
registerGenerator(plexus3d);
registerGenerator(dataFlow);

export const ALL_GENERATORS: Generator[] = [
  domainWarp,
  gradientMesh,
  aurora,
  flowField,
  metaballs,
  voronoi,
  plasma,
  kaleidoscope,
  truchet,
  topographic,
  julia,
  particles,
  halftone,
  raymarched,
  reactionDiffusion,
  godrays,
  waveMesh,
  dotWave,
  hexWave,
  triWave,
  plexus3d,
  dataFlow,
];
