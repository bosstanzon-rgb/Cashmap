// WeakRef polyfill for older Hermes builds
if (typeof WeakRef === 'undefined') {
  (global as any).WeakRef = class WeakRef {
    private _target: any;
    constructor(target: any) { this._target = target; }
    deref() { return this._target; }
  };
}

import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
