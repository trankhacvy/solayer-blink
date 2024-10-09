import * as anchor from "@coral-xyz/anchor";
import restakingProgramIDL from "./restaking_program.json";
import {
  POOL_ADDRESS,
  RESTAKING_PROGRAM_ID,
  SOLAYER_ADMIN_SIGNER,
  SSOL_MINT,
  STAKE_POOL_MINT,
} from "./constant";
import { convertFromDecimalBN, useWallet } from "./helper";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  StakeProgram,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createApproveInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { StakePoolInstruction } from "@solana/spl-stake-pool";
import { connection } from "../controllers/solayer.controller";

export async function unstake(signer: PublicKey, amount: string | number) {
  const mockKeypair = Keypair.generate();

  const restakeProgram = new anchor.Program(
    restakingProgramIDL as unknown as anchor.Idl,
    RESTAKING_PROGRAM_ID,
    useWallet(mockKeypair) as any
  );

  const lstVault = getAssociatedTokenAddressSync(
    STAKE_POOL_MINT,
    POOL_ADDRESS,
    true
  );
  const rstMint = SSOL_MINT;
  const rstAta = getAssociatedTokenAddressSync(rstMint, signer, true);
  const lstAta = getAssociatedTokenAddressSync(STAKE_POOL_MINT, signer);

  const amountBN = convertFromDecimalBN(amount, 9);

  const unrestakeInstruction = await restakeProgram.methods
    .unrestake(amountBN)
    .accounts({
      signer,
      lstMint: STAKE_POOL_MINT,
      rstMint: rstMint,
      solayerSigner: SOLAYER_ADMIN_SIGNER,
      pool: POOL_ADDRESS,
      vault: lstVault,
      lstAta: lstAta,
      rstAta: rstAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const approveInstruction = createApproveInstruction(
    lstAta,
    signer,
    signer,
    amountBN.toNumber()
  );

  const stakeAccount = Keypair.generate();

  // Create a stake account to receive the user’s stake that is being withdrawn from our stake pool.
  const createAccountTransaction = SystemProgram.createAccount({
    fromPubkey: signer,
    newAccountPubkey: stakeAccount.publicKey,
    lamports: 2282880,
    space: StakeProgram.space,
    programId: StakeProgram.programId,
  });

  const withdrawStakeInstruction = StakePoolInstruction.withdrawStake({
    stakePool: new PublicKey("po1osKDWYF9oiVEGmzKA4eTs8eMveFRMox3bUKazGN2"),
    validatorList: new PublicKey("nk5E1Gc2rCuU2MDTRqdcQdiMfV9KnZ6JHykA1cTJQ56"),
    withdrawAuthority: new PublicKey(
      "H5rmot8ejBUWzMPt6E44h27xj5obbSz3jVuK4AsJpHmv"
    ),
    validatorStake: new PublicKey(
      "CpWqBteUJodiTcGYWsxq4WTaBPoZJyKkBbkWwAMXSyTK"
    ),
    destinationStake: stakeAccount.publicKey,
    destinationStakeAuthority: signer,
    sourceTransferAuthority: signer,
    sourcePoolAccount: lstAta,
    managerFeeAccount: new PublicKey(
      "ARs3HTD79nsaUdDKqfGhgbNMVJkXVdRs2EpHAm4LNEcq"
    ),
    poolMint: STAKE_POOL_MINT,
    poolTokens: amountBN.toNumber(),
  });

  let deactivateInstruction = StakeProgram.deactivate({
    stakePubkey: stakeAccount.publicKey,
    authorizedPubkey: signer,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const transaction = new Transaction({
    feePayer: signer,
    blockhash,
    lastValidBlockHeight,
  }).add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 200000,
    }),
    unrestakeInstruction,
    approveInstruction,
    createAccountTransaction,
    withdrawStakeInstruction,
    deactivateInstruction
  );

  return { transaction, stakeAccount };
}
