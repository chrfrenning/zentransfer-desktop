const os = require('os');

function formatTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(2)}m`;
  return `${(seconds / 3600).toFixed(2)}h`;
}

function estimatePOWPerformance(bits) {
  const totalCores = os.cpus().length;
  const usableCores = Math.max(totalCores - 1, 1); // Always use at least 1 core
  const hashRatePerCore = 1.5e5; // double SHA-512 hashes/sec
  const totalHashRate = usableCores * hashRatePerCore;

  const expectedHashes = Math.pow(2, bits);
  const seconds = expectedHashes / totalHashRate;

  return {
    bits,
    coresUsed: usableCores,
    totalCores,
    hashRatePerCore: `${hashRatePerCore.toLocaleString()} hashes/sec`,
    totalHashRate: `${totalHashRate.toLocaleString()} hashes/sec`,
    estimatedTime: formatTime(seconds)
  };
}

module.exports = { estimatePOWPerformance };
