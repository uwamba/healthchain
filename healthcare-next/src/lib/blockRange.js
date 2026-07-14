// MetaMask (and many public RPC providers) cap a single eth_getLogs call to
// roughly a 10,000-block range — fine on a local Hardhat node (which starts
// at block 0), but every queryFilter() call must be bounded on a long-lived
// chain like Sepolia, where "from block 0" can mean scanning 11M+ blocks.
// Rather than tracking each contract's exact deployment block, this looks
// back a safe window under that cap — this app's on-chain activity is
// always recent relative to when it was deployed, so nothing is missed in
// practice.
const MAX_LOOKBACK_BLOCKS = 9000;

export async function getSafeFromBlock(provider) {
  const latest = await provider.getBlockNumber();
  return Math.max(0, latest - MAX_LOOKBACK_BLOCKS);
}
