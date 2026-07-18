/** Ambient stub for optional peer `onnxruntime-node` (not installed in CI). */
declare module "onnxruntime-node" {
  export const InferenceSession: {
    create: (path: string) => Promise<unknown>;
  };
  export const Tensor: new (
    type: string,
    data: BigInt64Array | Int32Array | Float32Array,
    dims: number[],
  ) => unknown;
}
