declare module '@ericblade/quagga2' {
  const Quagga: {
    init: (config: any, callback?: (err: any) => void) => Promise<void>;
    start: () => void;
    stop: () => void;
    onDetected: (callback: (result: any) => void) => void;
    offDetected: (callback: (result: any) => void) => void;
    onProcessed: (callback: (result: any) => void) => void;
    offProcessed: (callback: (result: any) => void) => void;
    decodeSingle: (config: any, callback?: (result: any) => void) => Promise<any>;
    CameraAccess: {
      request: (video: HTMLVideoElement | null, constraints: any) => Promise<any>;
      release: () => void;
      enumerateVideoDevices: () => Promise<MediaDeviceInfo[]>;
      getActiveStreamLabel: () => string;
    };
  };
  export default Quagga;
}
