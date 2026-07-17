// MetaMask (and many public RPC providers) cap a single eth_getLogs call to
// roughly a 10,000-block range — fine on a local Hardhat node (which starts
// at block 0), but every queryFilter() call must be bounded on a long-lived
// chain like Sepolia, where "from block 0" can mean scanning 11M+ blocks.
// Rather than tracking each contract's exact deployment block, this looks
// back a safe window under that cap.
//
// Testing this app in practice spans multiple days, not minutes, so the
// window needs to cover that — but a single query can't exceed the ~10k
// range cap, so queryFilterChunked() below splits a longer lookback into
// multiple chunked calls and merges the results.
const MAX_CHUNK_BLOCKS = 9000;
const MAX_LOOKBACK_BLOCKS = 120000; // ~2 weeks at Sepolia's ~12s block time

export async function getSafeFromBlock(provider) {
  const latest = await provider.getBlockNumber();
  return Math.max(0, latest - MAX_LOOKBACK_BLOCKS);
}

// Runs queryFilter in <=9000-block windows from fromBlock to the latest
// block, concatenating results — use this instead of a single unbounded
// contract.queryFilter(filter, fromBlock) call whenever fromBlock might be
// more than ~9000 blocks behind latest (i.e. whenever fromBlock came from
// getSafeFromBlock above).
export async function queryFilterChunked(contract, filter, fromBlock) {
  const latest = await contract.provider.getBlockNumber();
  const allLogs = [];
  for (let start = fromBlock; start <= latest; start += MAX_CHUNK_BLOCKS) {
    const end = Math.min(start + MAX_CHUNK_BLOCKS - 1, latest);
    const logs = await contract.queryFilter(filter, start, end);
    allLogs.push(...logs);
  }
  return allLogs;
}
