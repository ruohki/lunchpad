 // augmentations.d.ts or whatever you want to call it.

 import electron from 'electron';

 declare global {
   interface Window {
     require(moduleSpecifier: 'electron'): typeof electron;
   }
 }