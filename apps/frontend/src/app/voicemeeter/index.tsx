
const ffi = window.require('ffi-napi');
const ArrayType = window.require('ref-array-napi');

const CharArray = ArrayType('char');
const LongArray = ArrayType('long');
const FloatArray = ArrayType('float');

export class VoiceMeeter {
  public VoiceMeeterPath: string
  
  constructor(path: string) {
    this.VoiceMeeterPath = path;
    this.Init();
  }

  private Init() {
    
    const vm = ffi.Library(`${this.VoiceMeeterPath}/VoicemeeterRemote64.dll`, {
      'VBVMR_Login': ['long', []],
      'VBVMR_Logout': ['long', []],
      'VBVMR_RunVoicemeeter': ['long', ['long']],
      'VBVMR_GetVoicemeeterType': ['long', [LongArray]],
      'VBVMR_GetVoicemeeterVersion': ['long', [LongArray]],
      'VBVMR_IsParametersDirty':['long',[]],
      'VBVMR_GetParameterFloat': ['long',[CharArray,FloatArray]],
      'VBVMR_GetParameterStringA': ['long',[CharArray,CharArray]],
      'VBVMR_SetParameters': ['long', [CharArray]],
      'VBVMR_Output_GetDeviceNumber': ['long', []],
      'VBVMR_Output_GetDeviceDescA': ['long', ['long', LongArray, CharArray, CharArray]],
      'VBVMR_Input_GetDeviceNumber': ['long', []],
      'VBVMR_Input_GetDeviceDescA': ['long', ['long', LongArray, CharArray, CharArray]],
    });
  }
}