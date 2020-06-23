type ArrayLengthMutationKeys = 'splice' | 'push' | 'pop' | 'shift' | 'unshift' | number
type ArrayItems<T extends Array<any>> = T extends Array<infer TItems> ? TItems : never
type FixedLengthArray<T extends any[]> =
  Pick<T, Exclude<keyof T, ArrayLengthMutationKeys>>
  & { [Symbol.iterator]: () => IterableIterator< ArrayItems<T> > }

export type RGBColor = FixedLengthArray<[number, number, number]>

export const FileURI = (file: string) => file.toLowerCase().startsWith("file://") ? file : `file://${file}`

export enum ControllerType {
  Software = 'software',
  Launchpad = 'launchpad'
}

export interface IMediaDevice {
  deviceId: string
  groupId: string
  label: string
  kind: "audioinput" | "audiooutput"
}