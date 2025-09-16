declare module 'js-sha3' {
  export function keccak256(data: string | Buffer | Uint8Array): string;
  export function sha3_256(data: string | Buffer | Uint8Array): string;
  export function sha3_512(data: string | Buffer | Uint8Array): string;
}