export function getAmountOutRaw(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeNumerator: bigint = 997n,
  feeDenominator: bigint = 1000n
): bigint {
  const amountInWithFee = amountIn * feeNumerator;
  return (amountInWithFee * reserveOut) / (reserveIn * feeDenominator + amountInWithFee);
}

export function simulateRoundTripRaw(
  amountInRaw: bigint,
  dexA: { reserveIn: bigint; reserveOut: bigint; fee: number },
  dexB: { reserveIn: bigint; reserveOut: bigint; fee: number }
): bigint {
  // Convert fee to Uniswap constants
  const feeA_num = BigInt(Math.floor((1 - dexA.fee) * 1000));
  const feeB_num = BigInt(Math.floor((1 - dexB.fee) * 1000));

  const outA = getAmountOutRaw(amountInRaw, dexA.reserveIn, dexA.reserveOut, feeA_num);
  const outB = getAmountOutRaw(outA, dexB.reserveOut, dexB.reserveIn, feeB_num);
  return outB;
}
