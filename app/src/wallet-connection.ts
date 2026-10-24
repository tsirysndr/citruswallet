// Keep the native SDK on its deep-link path. In MetaMask Connect 2.1,
// preferExtension:false selects an install modal, whose RN mount is a no-op.
export const nativeWalletUI = {
  preferExtension: true,
  showInstallModal: false,
};

export async function withWalletDeadline<T>(
  operation: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
