// Fix TS1540 error in @ericblade/quagga2 type definitions
declare module "@ericblade/quagga2" {
  export default Quagga;
  const Quagga: any;
}
