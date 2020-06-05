export * from './lib/types';
export * from './actions'
export * from './page'

export const FileURI = (file: string) => file.toLowerCase().startsWith("file://") ? file : `file://${file}`