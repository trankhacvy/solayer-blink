import * as solanaStakePool from "@solana/spl-stake-pool";
import { Request, Response } from "express";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { SignMessageResponse } from "@solana/actions-spec";
import { createPostResponse } from "@solana/actions";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { unstake } from "../utils/solayer";
import { SSOL_MINT, STAKE_POOL } from "../utils/constant";

const baseURL = process.env.BASE_URL!;

export const connection = new Connection(clusterApiUrl("mainnet-beta"));

export default class SolayerController {
  get = async (_: Request, res: Response) => {
    try {
      res.status(200).send(getActions(""));
    } catch (error) {
      res.status(500).send(error);
    }
  };

  post = async (req: Request, res: Response) => {
    try {
      const { account, signature } = req.body;

      console.log({ account, signature });

      if (!account) {
        throw new Error('Invalid "account" provided');
      }

      let payer: PublicKey | null = null;

      try {
        payer = new PublicKey(account);
      } catch (error) {
        payer = null;
      }

      if (!payer) {
        throw new Error('Invalid "account" provided');
      }

      const { action } = req.params;

      if (signature) {
        const pool = await solanaStakePool.getStakePoolAccount(
          connection,
          STAKE_POOL
        );

        const totalLamports = pool.account.data.totalLamports;
        const poolTokenSupply = pool.account.data.poolTokenSupply;
        const ratio = totalLamports.toNumber() / poolTokenSupply.toNumber();

        const lstAta = getAssociatedTokenAddressSync(SSOL_MINT, payer);

        const balance = await connection.getTokenAccountBalance(lstAta);
        const balanceInSol = (balance.value.uiAmount ?? 0) * ratio;

        let payload = {};

        if (action === "check") {
          payload = getActions(
            `SSOL balance: ${balance.value.uiAmount?.toFixed(
              6
            )} (${balanceInSol.toFixed(6)}SOL)`
          );
        } else if (action === "stake") {
          payload = getActions(
            `Stake successfully !!!

            SSOL balance: ${balance.value.uiAmount?.toFixed(
              6
            )} (${balanceInSol.toFixed(6)}SOL)`
          );
        } else if (action === "unstake") {
          payload = getActions(
            `Unstake successfully !!!

            SSOL balance: ${balance.value.uiAmount?.toFixed(
              5
            )} (${balanceInSol.toFixed(5)}SOL)`
          );
        }

        return res.status(200).send(payload);
      }

      if (action === "stake") {
        return handleStake(payer, req, res);
      }

      if (action === "unstake") {
        return handleUnstake(payer, req, res);
      }

      if (action === "check") {
        return handleCheck(res);
      }

      res.status(200).send({});
    } catch (error) {
      res.status(500).send(error);
    }
  };
}

function validatedQueryParams(query: any) {
  let amount;

  try {
    amount = parseFloat(query.amount);
  } catch (err) {
    amount = 0;
  }

  return { amount };
}

async function handleStake(payer: PublicKey, req: Request, res: Response) {
  try {
    const { amount } = validatedQueryParams(req.query);

    const params = new URLSearchParams({
      staker: payer.toBase58(),
      amount: String(amount),
      referrerkey: payer.toBase58(),
    });

    const response = await fetch(
      `https://app.solayer.org/api/partner/restake/ssol?${params.toString()}`,
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error((res as any)?.message || "error");
    }

    const txDataBuffer = Buffer.from(data["transaction"], "base64");

    const transaction = VersionedTransaction.deserialize(
      Uint8Array.from(txDataBuffer)
    );

    const payload = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        links: {
          next: {
            type: "post",
            href: `${baseURL}/solayer/stake`,
          },
        },
      },
      options: {
        commitment: "max",
      },
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
}

async function handleUnstake(payer: PublicKey, req: Request, res: Response) {
  try {
    const { amount } = validatedQueryParams(req.query);

    const { transaction, stakeAccount } = await unstake(payer, amount);

    const payload = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        links: {
          next: {
            type: "post",
            href: `${baseURL}/solayer/unstake`,
          },
        },
      },
      signers: [stakeAccount],
      options: {
        commitment: "finalized",
      },
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
}

async function handleCheck(res: Response) {
  try {
    const payload: SignMessageResponse = {
      type: "message",
      data: "Solayer",
      links: {
        next: {
          type: "post",
          href: `${baseURL}/solayer/check`,
        },
      },
    };

    res.status(200).json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
}

function getActions(description: string) {
  return {
    type: "action",
    title: "Solayer | The Solana Restaking Network",
    label: "",
    icon: "https://ibntvxtfhuptinxoaera.supabase.co/storage/v1/object/public/assets/assets/logo.jpg",
    description: description,
    links: {
      actions: [
        {
          label: "Check balance",
          href: `${baseURL}/solayer/check`,
        },
        {
          label: "Stake",
          href: `${baseURL}/solayer/stake?amount={amount}`,
          parameters: [
            {
              name: "amount",
              label: "amount",
              required: true,
            },
          ],
        },
        {
          label: "Unstake",
          href: `${baseURL}/solayer/unstake?amount={amount}`,
          parameters: [
            {
              name: "amount",
              label: "amount",
              required: true,
            },
          ],
        },
      ],
    },
  };
}
